import { MODULE_ID, TEMPLATES, SETTINGS, SOCKET_EVENTS, GENERIC_SHOP_KEY } from "../constants";
type LocalHiddenMap = Record<string, string[]>;
import { CatalogManager } from "../data/CatalogManager";
import { FlagManager } from "../data/FlagManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { zoneRejection } from "../data/zoneGrants";
import { getPartyActors } from "../data/sharedStore";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker, buildZoneOptionsHTML, escapeHTML } from "../helpers/handlebars";
import {
  shopEntries,
  setShopEntries,
  addShopEntries,
  allLibraryServices,
  serviceLibrary,
  setServiceLibrary,
  mergeShopEntry,
  buyCategories,
  shopBuys,
} from "../data/shopStock";
import { inStock, shopVisit, bumpShopVisit } from "../data/shopAvailability";
import { saleValue } from "../data/shopSale";
import { definitionFor } from "../data/itemDefs";
import { linkBookReferences, activateBookLinks } from "../data/dayRolls";
import { CURRENCY_IN_CP as IN_CP, cpToCoin, withPriceFactor } from "../data/coins";
import type {
  ItemDefinition,
  ShopEntry,
  ShopState,
  InventoryItem,
  CharacterInventory,
  PurchasePayload,
  ServicePurchasePayload,
  SellItemPayload,
} from "../types";

export class ShopApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /** Currently selected target actor ID */
  private selectedActorId: string | null = null;
  /** Current search/filter text */
  private searchText = "";
  /** Only show items the selected actor can afford */
  private showAffordableOnly = false;
  /** Local shop name — set when opened from a Note marker (null = generic shop) */
  private localName: string | null = null;
  /** Categories this shop sells — empty means all categories */
  private localCategories: string[] = [];
  /** Price multiplier in percent (100 = normal, 200 = double price) */
  private priceFactor = 100;
  /**
   * The shop keeps to its own shelf and shows nothing from the catalogue.
   *
   * Needed because an empty category list has always meant "sells everything",
   * so unticking every box could not express a cheesemonger. The settlement
   * notes are full of shops like that — the pipe carver, the moon-fruit
   * orchard, the magicians' guild — and until now none of them was buildable.
   */
  private ownStockOnly = false;
  /**
   * What the shop pays for what the party brings in, as a percentage of the
   * item's own value. 0 = buys nothing, which is the default: most shops in
   * the settlement notes sell only.
   */
  private buyBackRate = 0;
  /** Showing the sell panel rather than the shelves. */
  private selling = false;
  /** Saved scroll position of .shop-catalog — restored after each re-render */
  private _scrollTop = 0;

  /**
   * Storage key for this shop's own stock. A map-note shop keys by its name;
   * the generic shop opened from the toolbar uses a reserved key so it can be
   * stocked the same way instead of being the one shop the GM cannot fill.
   */
  private get shopKey(): string {
    return this.localName ?? GENERIC_SHOP_KEY;
  }

  /** The GM-defined items and services stocked in this shop. */
  private customItems(): ShopEntry[] {
    return shopEntries(this.shopKey);
  }

  /** Configure this shop instance from a Note marker */
  setConfig(
    name: string,
    categories: string[],
    priceFactor = 100,
    ownStockOnly = false,
    buyBackRate = 0
  ): void {
    this.localName = name;
    this.localCategories = categories;
    this.priceFactor = priceFactor;
    this.ownStockOnly = ownStockOnly;
    this.buyBackRate = buyBackRate;
  }

  /**
   * Pre-select the character the shop buys for. Used when the shop is opened
   * from a specific inventory, so the GM does not land on whichever party member
   * happens to come first in the actor directory.
   * Ignored for players — they can only ever buy for their own character.
   */
  setActor(actorId: string | null): void {
    if (!(game as Game).user?.isGM) return;
    this.selectedActorId = actorId;
  }

  override get title(): string {
    return this.localName ?? "Shop";
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-shop",
    window: {
      title: "Shop",
      resizable: true,
    },
    position: {
      width: 700,
      height: 640,
    },
    classes: ["dolmenwood-party-inventory", "shop"],
    actions: {
      toggleTag: ShopApp._onToggleTag,
      toggleAffordable: ShopApp._onToggleAffordable,
      purchaseItem: ShopApp._onPurchaseItem,
      grantItem: ShopApp._onGrantItem,
      addCustomItem: ShopApp._onAddCustomItem,
      toggleHideItem: ShopApp._onToggleHideItem,
      toggleLocalHideItem: ShopApp._onToggleLocalHideItem,
      addToShop: ShopApp._onAddToShop,
      stockFromCatalogue: ShopApp._onStockFromCatalogue,
      stockFromLibrary: ShopApp._onStockFromLibrary,
      removeFromShop: ShopApp._onRemoveFromShop,
      editShopEntry: ShopApp._onEditShopEntry,
      saveToLibrary: ShopApp._onSaveToLibrary,
      toggleSelling: ShopApp._onToggleSelling,
      sellItem: ShopApp._onSellItem,
      newVisit: ShopApp._onNewVisit,
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.SHOP,
    },
  };

  override async _prepareContext(
    _options: DeepPartial<ApplicationV2RenderOptions> & { isFirstRender: boolean }
  ): Promise<Record<string, unknown>> {
    const g = game as Game;
    const shopState = g.settings.get(MODULE_ID, SETTINGS.SHOP_STATE) as ShopState;
    // The shared store is deliberately not a purchase target: the shop always
    // deducts coins from the selected character.
    const partyMembers = getPartyActors();

    const isGM = g.user?.isGM ?? false;

    // Non-GM players can only buy for their own character
    if (!isGM) {
      this.selectedActorId = g.user?.character?.id ?? null;
    } else if (!this.selectedActorId && partyMembers.length > 0) {
      this.selectedActorId = partyMembers[0].id ?? null;
    }

    const selectedActor = this.selectedActorId
      ? g.actors?.get(this.selectedActorId)
      : undefined;

    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";

    // Compute selected actor inventory + encumbrance
    let selectedInventory = undefined;
    let selectedEncumbrance = undefined;
    if (selectedActor) {
      selectedInventory = FlagManager.getInventory(selectedActor);
      selectedEncumbrance = calculateEncumbrance(
        selectedInventory,
        CatalogManager.getMap(),
        encMode
      );
    }

    // Compute available funds in cp for affordability filtering
    const availableCp = selectedInventory
      ? selectedInventory.coins.cp +
        selectedInventory.coins.sp * 10 +
        selectedInventory.coins.gp * 100 +
        selectedInventory.coins.pp * 500
      : 0;

    // Filter catalog. Treasures are in the catalogue so they can be carried,
    // not so they can be bought — a shop lists them only where the GM has put
    // them there by hand, which arrives through customItems() below.
    // A shop that keeps to its own shelf never reaches the catalogue at all.
    // Note the asymmetry with the category list below: no categories means
    // "everything", which is why this needed a switch of its own rather than
    // an empty list.
    let items = this.ownStockOnly
      ? []
      : CatalogManager.filterByTags(shopState.activeTags).filter((i) => !i.notSold);
    // Local shop category restriction (from Note marker) takes precedence over global availableItems
    if (this.localCategories.length > 0) {
      items = items.filter((i) => this.localCategories.includes(i.category));
    } else if (shopState.availableItems.length > 0) {
      items = items.filter((i) => shopState.availableItems.includes(i.id));
    }
    if (this.searchText) {
      const q = this.searchText.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.subcategory.toLowerCase().includes(q)
      );
    }
    if (this.showAffordableOnly && selectedInventory) {
      const factor = this.priceFactor;
      items = items.filter((i) => {
        const rawCostCp =
          i.cost.currency === "cp" ? i.cost.amount :
          i.cost.currency === "sp" ? i.cost.amount * 10 :
          i.cost.currency === "gp" ? i.cost.amount * 100 :
          i.cost.amount * 500;
        const adjCostCp = Math.max(1, Math.round(rawCostCp * factor / 100));
        return availableCp >= adjCostCp;
      });
    }

    // Apply hidden-item filter: global shop uses shopState.hiddenItems; local shop uses localHidden map
    const globalHiddenItems = shopState.hiddenItems ?? [];
    const localHiddenMap = g.settings.get(MODULE_ID, SETTINGS.LOCAL_HIDDEN) as LocalHiddenMap ?? {};
    const localHiddenItems = this.localName ? (localHiddenMap[this.localName] ?? []) : [];
    const activeHiddenItems = this.localName !== null ? localHiddenItems : globalHiddenItems;

    if (!isGM) {
      items = items.filter((i) => !activeHiddenItems.includes(i.id));
    }

    // Group by category → subcategory, applying price factor and hidden markers
    type GroupedItem = ShopEntry & {
      isHidden?: boolean;
      isLocalCustom?: boolean;
      /** Nothing enters the inventory: no size, no weight, no zone to choose. */
      isService?: boolean;
      /** Stocked on a chance, and this visit the chance failed. GM sees it greyed; players never see it at all. */
      outOfStock?: boolean;
      /** The price the books do not print — the alchemist's "the potion's own value". */
      byArrangement?: boolean;
    };
    const factor = this.priceFactor;
    const grouped: Record<string, { subcategory: string; items: GroupedItem[] }[]> = {};

    const addToGrouped = (item: GroupedItem) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      const catGroups = grouped[item.category];
      let sub = catGroups.find((g) => g.subcategory === (item.subcategory || ""));
      if (!sub) { sub = { subcategory: item.subcategory || "", items: [] }; catGroups.push(sub); }
      sub.items.push(item);
    };

    const priced = (cost: ItemDefinition["cost"]) => withPriceFactor(cost, factor);

    for (const item of items) {
      addToGrouped({
        ...item,
        cost: priced(item.cost),
        isHidden: isGM && activeHiddenItems.includes(item.id),
      });
    }

    // Append the GM's own items for this shop. The generic shop stores them
    // under a reserved key, so stocking it works exactly like a map-note shop.
    // The price factor applies here too — the purchase dialog always charges
    // the adjusted price, so listing the raw one would misquote it.
    const visit = shopVisit(this.shopKey);
    for (const item of this.customItems()) {
      const q = this.searchText.toLowerCase();
      if (this.searchText && !item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) continue;

      // A chancy line that is not there this visit is simply not on the shelf.
      // The Referee still sees it, greyed out, because otherwise a shop they
      // stocked yesterday looks empty today and the natural conclusion is that
      // the module lost it.
      const here = inStock(item, this.shopKey, visit);
      if (!here && !isGM) continue;

      // A price of 0 is not free — it is a price the book declines to print,
      // and the row says so rather than offering a bath for nothing.
      const byArrangement = item.cost.amount === 0;

      addToGrouped({
        ...item,
        cost: byArrangement ? item.cost : priced(item.cost),
        isLocalCustom: true,
        isHidden: false,
        isService: item.service === true,
        outOfStock: !here,
        byArrangement,
      });
    }

    return {
      shopState,
      allTags: CatalogManager.getAllTags(),
      grouped,
      hiddenItems: activeHiddenItems,
      partyMembers,
      selectedActorId: this.selectedActorId,
      selectedActor,
      selectedInventory,
      selectedEncumbrance,
      searchText: this.searchText,
      isGM,
      encMode,
      showAffordableOnly: this.showAffordableOnly,
      availableCp,
      shopName: this.localName ?? "Shop",
      isLocalShop: this.localName !== null,
      localName: this.localName,
      priceFactor: this.priceFactor,
      ownStockOnly: this.ownStockOnly,
      buyBackRate: this.buyBackRate,
      buysAnything: this.buyBackRate > 0,
      // Whether the sell panel has to explain a restriction, and in whose terms.
      buysOnlyItsTrade: this.buyCategories() !== null,
      buyCategoryList: [...(this.buyCategories() ?? [])].sort().join(", "),
      selling: this.selling,
      sellRows: this.selling ? this.sellableRows(selectedInventory) : [],
      // Only worth a button where something in the shop actually turns on it.
      hasChancyStock: this.customItems().some((e) => e.availability !== undefined),
      visit,
    };
  }

  /**
   * What the selected character could sell here, with what the shop would pay.
   *
   * The rate is the shop's, the value is the item's own — a shop that sells at
   * double does not therefore buy at double, and the settlement notes are
   * explicit about it: "50% of its normal value", not of the asking price.
   *
   * Rows that brought a zone with them are left out. Selling a backpack would
   * have to decide what happens to everything inside it, and quietly dropping
   * a zone full of gear is the kind of loss nobody notices until much later.
   */
  /** This shop's buy-back reach — the rule itself lives in shopStock.ts. */
  private buyCategories(): Set<string> | null {
    return buyCategories(this.localCategories, this.ownStockOnly, this.customItems());
  }

  private sellableRows(inventory: CharacterInventory | undefined) {
    if (!inventory || this.buyBackRate <= 0) return [];
    const catalog = CatalogManager.getMap();
    const zoneItemIds = new Set((inventory.extraZones ?? []).map((z) => z.itemId).filter(Boolean));
    const buys = this.buyCategories();

    return inventory.items
      .filter((row) => !zoneItemIds.has(row.id))
      .filter((row) => shopBuys(definitionFor(row, catalog)?.category, buys))
      .map((row) => {
        const def = definitionFor(row, catalog);
        // saleValue is the shared answer to "how many, and what is one worth" —
        // the same one processSale writes by, so the price shown and the price
        // paid cannot drift apart. It also fixes the count: a bundle's row
        // quantity is 1 however many torches are loose in it.
        const value = saleValue(row, def);
        const perItem = Math.floor((value.unitCp * this.buyBackRate) / 100);
        return {
          id: row.id,
          name: row.name,
          quantity: value.units,
          fill: value.fill,
          icon: def?.icon,
          worthless: perItem <= 0,
          perItem: cpToCoin(perItem),
          total: cpToCoin(perItem * value.units),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  override render(
    options?: boolean | DeepPartial<ApplicationV2RenderOptions>,
    _options?: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<this> {
    const current = this.element?.querySelector<HTMLElement>(".shop-catalog")?.scrollTop;
    // Ignore a zero read: the browser clamps scrollTop to 0 while the catalog is
    // being replaced, and overwriting the saved value with that loses the position.
    if (current) this._scrollTop = current;
    return super.render(options as boolean, _options);
  }

  override async _onRender(
    _context: DeepPartial<ApplicationV2RenderContext>,
    _options: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<void> {
    const el = this.element;

    // Restore scroll position on the next frame. Setting it synchronously here
    // lands while the replaced catalog is still collapsing/laying out, so the
    // browser clamps the value and the window snaps to the top. The expanded
    // state of the categories is restored by ApplicationV2 itself via data-sync.
    const wc = el.querySelector<HTMLElement>(".shop-catalog");
    if (wc) requestAnimationFrame(() => { wc.scrollTop = this._scrollTop; });

    // Target actor selector
    el.querySelector<HTMLSelectElement>("#shop-target-actor")?.addEventListener(
      "change",
      (e) => {
        this.selectedActorId = (e.target as HTMLSelectElement).value || null;
        this.render(false);
      }
    );

    // Search input
    const searchEl = el.querySelector<HTMLInputElement>("#shop-search");
    searchEl?.addEventListener("input", (e) => {
      this.searchText = (e.target as HTMLInputElement).value;
      this.render(false);
    });
    // Restore cursor to end after re-render (render() recreates the DOM)
    if (searchEl && this.searchText) {
      searchEl.focus();
      const len = searchEl.value.length;
      searchEl.setSelectionRange(len, len);
    }

    // A service description carries its own page — "Player's Book p132" — and
    // the same DOM pass that turns those into doors on a chat card turns them
    // into doors here.
    linkBookReferences(el);
    activateBookLinks(el);
  }

  // ─── Action Handlers ────────────────────────────────────────────────────────

  private static _onToggleAffordable(this: ShopApp): void {
    this.showAffordableOnly = !this.showAffordableOnly;
    this.render(false);
  }

  private static async _onToggleTag(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const scrollTop = this.element?.querySelector<HTMLElement>(".shop-catalog")?.scrollTop ?? this._scrollTop;
    const tag = target.dataset.tag!;
    const g = game as Game;
    const shopState = g.settings.get(MODULE_ID, SETTINGS.SHOP_STATE) as ShopState;
    const idx = shopState.activeTags.indexOf(tag);
    if (idx === -1) {
      shopState.activeTags.push(tag);
    } else {
      shopState.activeTags.splice(idx, 1);
    }
    await g.settings.set(MODULE_ID, SETTINGS.SHOP_STATE, shopState);
    this._scrollTop = scrollTop;
    this.render(false);
  }

  private static async _onPurchaseItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const definitionId = target.dataset.itemId!;
    const g = game as Game;
    const catalogDef = CatalogManager.getDefinition(definitionId);
    const def = catalogDef ?? this.customItems().find((i) => i.id === definitionId);
    if (!def || !this.selectedActorId) return;
    const actor = g.actors?.get(this.selectedActorId);
    if (!actor) return;

    // A service takes an entirely different road: no zone to choose, no row to
    // add, no encumbrance to warn about. Only the money and the record.
    if ((def as ShopEntry).service) {
      await this.buyService(def as ShopEntry, actor, false);
      return;
    }

    const inventory = FlagManager.getInventory(actor);

    // Calculate available funds across all denominations
    const totalCp =
      inventory.coins.cp +
      inventory.coins.sp * 10 +
      inventory.coins.gp * 100 +
      inventory.coins.pp * 500;

    const rawCostCp =
      def.cost.currency === "cp" ? def.cost.amount :
      def.cost.currency === "sp" ? def.cost.amount * 10 :
      def.cost.currency === "gp" ? def.cost.amount * 100 :
      def.cost.amount * 500; // pp
    const adjustedAmount = Math.max(1, Math.round(def.cost.amount * this.priceFactor / 100));
    const costCp = Math.max(1, Math.round(rawCostCp * this.priceFactor / 100));

    const canAfford = totalCp >= costCp;
    const isGM = g.user?.isGM ?? false;

    // Non-GM players cannot buy items they can't afford
    if (!canAfford && !isGM) {
      ui.notifications?.warn(`${actor.name} cannot afford ${def.name}.`);
      return;
    }

    // Show confirmation dialog — capture zone selection inside callback
    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const zoneFormGroup = encMode === "weight"
      ? ""
      : `<div class="form-group">
           <label>Add to zone:</label>
           <select id="purchase-zone">
             <option value="equipped">Equipped</option>
             <option value="stowed" selected>Stowed</option>
             <option value="tiny">Belt Pouch</option>
           </select>
         </div>`;
    const result = await new Promise<{ confirmed: boolean; zone: string }>((resolve) => {
      new Dialog({
        title: "Purchase Item",
        content: `
          <p>Purchase <strong>${def.name}</strong> for <strong>${adjustedAmount} ${def.cost.currency}</strong>?</p>
          <p>Target: <strong>${actor.name}</strong></p>
          ${!canAfford ? '<p class="warning"><i class="fas fa-exclamation-triangle"></i> Insufficient funds! Proceed anyway (GM override)?</p>' : ""}
          ${zoneFormGroup}
        `,
        buttons: {
          confirm: {
            label: canAfford ? "Purchase" : "Override & Purchase",
            icon: `<i class="fas ${canAfford ? "fa-shopping-cart" : "fa-exclamation-triangle"}"></i>`,
            callback: (html: JQuery) => {
              const zone = encMode === "weight" ? "stowed" : ((html.find("#purchase-zone").val() as string) ?? "stowed");
              resolve({ confirmed: true, zone });
            },
          },
          cancel: { label: "Cancel", callback: () => resolve({ confirmed: false, zone: "stowed" }) },
        },
        default: "confirm",
      }).render(true);
    });

    if (!result.confirmed) return;

    const costObj = { cp: 0, sp: 0, gp: 0, pp: 0 };
    costObj[def.cost.currency as "cp" | "sp" | "gp" | "pp"] = adjustedAmount;

    const isLocalCustom = !catalogDef;
    const payload: PurchasePayload = {
      actorId: this.selectedActorId,
      definitionId,
      quantity: 1,
      zone: result.zone,
      totalCost: costObj,
      gmOverride: !canAfford && isGM,
      ...(isLocalCustom ? { customDef: def as Partial<ItemDefinition> } : {}),
    };

    SocketHandler.emitOrHandle(SOCKET_EVENTS.PURCHASE_ITEM, payload);

    ui.notifications?.info(`Purchased ${def.name} for ${actor.name}.`);
  }

  /**
   * Buy — or, from the Referee's Grant button, wave through — one service.
   *
   * The confirmation says outright that nothing will be carried away, because
   * the button sits in the same column as the one that buys a sword and the two
   * are not undoable in the same way: a wrong sword can be dropped, a wrong
   * 1,000gp identification cannot.
   */
  private async buyService(entry: ShopEntry, actor: Actor, free: boolean): Promise<void> {
    const byArrangement = entry.cost.amount === 0;
    const cost = byArrangement ? entry.cost : withPriceFactor(entry.cost, this.priceFactor);

    const priceText = free
      ? "with the shop's compliments"
      : byArrangement
        ? "at a price to be agreed — nothing is deducted"
        : `for <strong>${cost.amount} ${cost.currency}</strong>${entry.unit && entry.unit !== "piece" ? ` ${escapeHTML(entry.unit)}` : ""}`;

    // The same refusal the goods path gives: a player who cannot pay is told so
    // here, on their own screen. Without this the click would travel to the GM's
    // client, fail there, and warn nobody the player can see.
    const isGM = (game as Game).user?.isGM ?? false;
    if (!free && !byArrangement && !isGM) {
      const inventory = FlagManager.getInventory(actor);
      const walletCp =
        inventory.coins.cp + inventory.coins.sp * 10 + inventory.coins.gp * 100 + inventory.coins.pp * 500;
      if (walletCp < cost.amount * IN_CP[cost.currency]) {
        ui.notifications?.warn(`${actor.name} cannot afford ${entry.name}.`);
        return;
      }
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      new Dialog({
        title: free ? "Grant Service" : "Buy Service",
        content: `
          <p>${escapeHTML(entry.name)} ${priceText}?</p>
          <p>For: <strong>${escapeHTML(actor.name ?? "")}</strong></p>
          ${entry.description ? `<p class="qm-hint">${escapeHTML(entry.description)}</p>` : ""}
          <p class="qm-hint"><i class="fas fa-circle-info"></i> Nothing is added to the inventory — a service is used where it is bought.</p>
        `,
        buttons: {
          confirm: {
            label: free ? "Grant" : "Buy",
            icon: '<i class="fas fa-hand-holding-dollar"></i>',
            callback: () => resolve(true),
          },
          cancel: { label: "Cancel", callback: () => resolve(false) },
        },
        default: "confirm",
      }).render(true);
    });

    if (!confirmed) return;

    const payload: ServicePurchasePayload = {
      actorId: actor.id!,
      forActorId: actor.id!,
      serviceName: entry.name,
      shopName: this.localName ?? "Shop",
      cost,
      unit: entry.unit,
      note: entry.description,
      // `free` is the Referee's compliments and nothing else. A price of 0 is
      // settled away from the table and needs no deduction either, but the card
      // must say "by arrangement" rather than thanking a shop that was paid.
      free,
    };
    SocketHandler.emitOrHandle(SOCKET_EVENTS.PURCHASE_SERVICE, payload);
  }

  private static _onGrantItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const definitionId = target.dataset.itemId!;
    if (!this.selectedActorId) {
      ui.notifications?.warn("Select a party member first.");
      return;
    }

    const g = game as Game;
    const catalogDef = CatalogManager.getDefinition(definitionId);
    const def = catalogDef ?? this.customItems().find((i) => i.id === definitionId);
    if (!def) {
      ui.notifications?.warn("Item not found.");
      return;
    }

    // The Referee's Grant on a service is the free tattoo: it happened, the
    // card says so, and no coins moved.
    if ((def as ShopEntry).service) {
      const actor = g.actors?.get(this.selectedActorId);
      if (actor) void this.buyService(def as ShopEntry, actor, true);
      return;
    }

    const isLocalCustom = !catalogDef;

    SocketHandler.emitOrHandle(SOCKET_EVENTS.GM_GRANT, {
      actorId: this.selectedActorId,
      item: {
        definitionId,
        name: def.name,
        quantity: 1,
        zone: "stowed" as InventoryItem["zone"],
        isSecret: false,
        notes: "",
        ...(isLocalCustom ? { customDefinition: def as Partial<ItemDefinition> } : {}),
      },
    });
    ui.notifications?.info(`Granted ${def.name}.`);
  }

  private static async _onToggleHideItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const scrollTop = this.element?.querySelector<HTMLElement>(".shop-catalog")?.scrollTop ?? this._scrollTop;
    const itemId = target.dataset.itemId!;
    const g = game as Game;
    const shopState = g.settings.get(MODULE_ID, SETTINGS.SHOP_STATE) as ShopState;
    shopState.hiddenItems ??= [];
    const idx = shopState.hiddenItems.indexOf(itemId);
    if (idx === -1) {
      shopState.hiddenItems.push(itemId);
    } else {
      shopState.hiddenItems.splice(idx, 1);
    }
    await g.settings.set(MODULE_ID, SETTINGS.SHOP_STATE, shopState);
    this._scrollTop = scrollTop;
    this.render(false);
  }

  private static async _onToggleLocalHideItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!this.localName) return;
    const scrollTop = this.element?.querySelector<HTMLElement>(".shop-catalog")?.scrollTop ?? this._scrollTop;
    const itemId = target.dataset.itemId!;
    const g = game as Game;
    const localHiddenMap = (g.settings.get(MODULE_ID, SETTINGS.LOCAL_HIDDEN) as LocalHiddenMap) ?? {};
    const key = this.localName;
    if (!localHiddenMap[key]) localHiddenMap[key] = [];
    const idx = localHiddenMap[key].indexOf(itemId);
    if (idx === -1) {
      localHiddenMap[key].push(itemId);
    } else {
      localHiddenMap[key].splice(idx, 1);
    }
    await g.settings.set(MODULE_ID, SETTINGS.LOCAL_HIDDEN, localHiddenMap);
    this._scrollTop = scrollTop;
    this.render(false);
  }

  private static _onAddToShop(this: ShopApp): void {
    new AddToShopDialog(this.shopKey, () => this.render(false)).render(true);
  }

  private static _onStockFromCatalogue(this: ShopApp): void {
    new StockFromCatalogueDialog(this.shopKey, () => this.render(false)).render(true);
  }

  private static _onStockFromLibrary(this: ShopApp): void {
    new StockFromLibraryDialog(this.shopKey, () => this.render(false)).render(true);
  }

  /**
   * Change a row already on this shelf — its price for this village, or the
   * X-in-6 chance a catalogue copy arrived without.
   */
  private static _onEditShopEntry(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const itemId = target.dataset.itemId!;
    const entry = this.customItems().find((i) => i.id === itemId);
    if (!entry) return;
    new AddToShopDialog(this.shopKey, () => this.render(false), entry).render(true);
  }

  /**
   * Put one of this shop's own services into the library, so the next village
   * can have it without it being typed again.
   */
  private static async _onSaveToLibrary(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const entry = this.customItems().find((i) => i.id === itemId);
    if (!entry) return;

    const library = serviceLibrary();
    if (library.some((e) => e.id === entry.id)) {
      ui.notifications?.info(`${entry.name} is already in the library.`);
      return;
    }
    await setServiceLibrary([...library, foundry.utils.deepClone(entry)]);
    ui.notifications?.info(`${entry.name} saved to the service library.`);
  }

  private static _onToggleSelling(this: ShopApp): void {
    this.selling = !this.selling;
    this.render(false);
  }

  /**
   * Moving the shop's stock on: everything stocked on an X-in-6 chance is
   * rolled again. The Referee's equivalent of the inn's new day, and a world
   * write, so players never reach it.
   */
  private static async _onNewVisit(this: ShopApp): Promise<void> {
    await bumpShopVisit(this.shopKey);
    ui.notifications?.info("The shop's chancy stock has been rolled again.");
    this.render(false);
  }

  private static async _onSellItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    // Every bail-out below says so. A sale that stops here leaves no trace of
    // its own — the row stays, the purse is unchanged — so a silent return is
    // indistinguishable from a dead button, and cost a test round for exactly
    // that reason.
    const itemId = target.dataset.itemId!;
    const g = game as Game;
    if (!this.selectedActorId) {
      ui.notifications?.warn("Select a party member first.");
      return;
    }
    const actor = g.actors?.get(this.selectedActorId);
    if (!actor) {
      ui.notifications?.warn("That character is no longer in the world.");
      return;
    }

    const inventory = FlagManager.getInventory(actor);
    const row = inventory.items.find((i) => i.id === itemId);
    if (!row) {
      ui.notifications?.warn(`${actor.name} is no longer carrying that — reopen the shop.`);
      return;
    }

    const def = definitionFor(row, CatalogManager.getMap());

    // The same rule the list is built with, applied again here: the button can
    // outlive the shelf that justified it, if the shop is reconfigured while
    // the window is open.
    if (!shopBuys(def?.category, this.buyCategories())) {
      ui.notifications?.warn(`${this.localName ?? "This shop"} does not deal in ${row.name}.`);
      return;
    }

    const value = saleValue(row, def);
    const perItemCp = Math.floor((value.unitCp * this.buyBackRate) / 100);
    if (perItemCp <= 0) {
      // A part-full container can land here on its own: three arrows out of
      // twenty is a fifteenth of five gold, and at half rate that rounds away.
      ui.notifications?.warn(
        value.fill && value.fill.used < value.fill.capacity
          ? `${row.name} is too nearly empty to be worth anything here.`
          : `${row.name} is worth nothing to this shop.`
      );
      return;
    }

    // How many units. A single one skips the question entirely rather than
    // asking "how many of your one sword" — and a part-full quiver is one
    // object, so it is never asked about either.
    let quantity = 1;
    if (value.units > 1) {
      const answer = await new Promise<number>((resolve) => {
        new Dialog({
          title: "Sell",
          content: `
            <p>Sell how many of <strong>${escapeHTML(row.name)}</strong>?</p>
            <p class="qm-hint">${cpToCoin(perItemCp).amount} ${cpToCoin(perItemCp).currency} each, ${value.units} in hand.</p>
            <div class="form-group">
              <input type="number" id="sell-qty" value="1" min="1" max="${value.units}" />
            </div>`,
          buttons: {
            sell: {
              label: "Sell",
              callback: (html: JQuery) =>
                resolve(Math.max(1, Math.min(value.units, parseInt(html.find("#sell-qty").val() as string, 10) || 1))),
            },
            cancel: { label: "Cancel", callback: () => resolve(0) },
          },
          default: "sell",
        }).render(true);
      });
      if (!answer) return;
      quantity = answer;
    }

    const proceeds = cpToCoin(perItemCp * quantity);
    const confirmed = await new Promise<boolean>((resolve) => {
      new Dialog({
        title: "Sell",
        content: `<p>Sell ${quantity} × <strong>${escapeHTML(row.name)}</strong> for <strong>${proceeds.amount} ${proceeds.currency}</strong>?</p>
          <p class="qm-hint">${
            value.fill
              ? `${value.fill.used} of ${value.fill.capacity} left in it — the shop pays for what is in it, not for the empty ${escapeHTML(row.name.toLowerCase())}.`
              : value.units - quantity > 0
                ? `${escapeHTML(actor.name ?? "")} keeps ${value.units - quantity} of ${value.units}.`
                : `That is the last of ${value.units === 1 ? "them" : `all ${value.units}`}.`
          }</p>
          <p class="qm-hint">${this.localName ?? "The shop"} pays ${this.buyBackRate}% of what a thing is worth.</p>`,
        buttons: {
          sell: { label: "Sell", icon: '<i class="fas fa-hand-holding-dollar"></i>', callback: () => resolve(true) },
          cancel: { label: "Cancel", callback: () => resolve(false) },
        },
        default: "sell",
      }).render(true);
    });
    if (!confirmed) return;

    const payload: SellItemPayload = {
      actorId: this.selectedActorId,
      itemId,
      quantity,
      proceeds,
      shopName: this.localName ?? "Shop",
    };
    SocketHandler.emitOrHandle(SOCKET_EVENTS.SELL_ITEM, payload);
    this.render(false);
  }

  private static async _onRemoveFromShop(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await setShopEntries(
      this.shopKey,
      this.customItems().filter((i) => i.id !== itemId)
    );
    this.render(false);
  }

  private static _onAddCustomItem(this: ShopApp): void {
    if (!this.selectedActorId) {
      ui.notifications?.warn("Select a party member first.");
      return;
    }
    new AddCustomShopItemDialog(this.selectedActorId).render(true);
  }
}

// ─── Add Custom Shop Item Dialog ──────────────────────────────────────────────

class AddCustomShopItemDialog extends Dialog {
  constructor(actorId: string) {
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const sizeOrWeightField = encMode === "weight"
      ? `<div class="form-group">
            <label>Weight (coin wt)</label>
            <input type="number" id="custom-weight" value="10" min="0" />
          </div>`
      : `<div class="form-group">
            <label>Size</label>
            <select id="custom-size">
              <option value="tiny">Tiny (0 slots)</option>
              <option value="normal" selected>Normal (1 slot)</option>
              <option value="large">Large (2 slots)</option>
            </select>
          </div>`;
    const targetActor = (game as Game).actors?.get(actorId);
    const zoneOptions = buildZoneOptionsHTML(
      targetActor ? FlagManager.getInventory(targetActor).extraZones ?? [] : [],
      encMode
    );
    super({
      title: "Grant Custom Item",
      content: `
        <form>
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" id="custom-name" placeholder="Custom item name" />
          </div>
          ${sizeOrWeightField}
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="custom-qty" value="1" min="1" />
          </div>
          <div class="form-group">
            <label>Zone</label>
            <select id="custom-zone">
              ${zoneOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Icon</label>
            ${buildIconPickerHTML()}
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="custom-desc" placeholder="Optional description…" rows="2" style="width:100%;resize:vertical;"></textarea>
          </div>
          <div class="form-group">
            <label>Edible</label>
            <input type="checkbox" id="custom-edible" />
            <span class="qm-hint">Gives the row an Eat button that feeds the character for the day.</span>
          </div>
          <div class="form-group">
            <label>Secret?</label>
            <input type="checkbox" id="custom-secret" />
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: "Grant Item",
          callback: (html: JQuery) => {
            const name = (html.find("#custom-name").val() as string).trim();
            if (!name) return;
            const qty = Math.max(1, parseInt(html.find("#custom-qty").val() as string, 10) || 1);
            const zone = html.find("#custom-zone").val() as InventoryItem["zone"];
            const icon = (html.find("#custom-icon-value").val() as string) || "fa-sack";
            const description = (html.find("#custom-desc").val() as string).trim();
            const isSecret = html.find("#custom-secret").prop("checked") as boolean;
            const customDef: Partial<ItemDefinition> = { isCustom: true, icon };
            if (encMode === "weight") {
              customDef.weight = Math.max(0, parseInt(html.find("#custom-weight").val() as string, 10) || 0);
              customDef.size = "normal";
            } else {
              customDef.size = html.find("#custom-size").val() as "tiny" | "normal" | "large";
            }
            if (description) customDef.description = description;
            if (html.find("#custom-edible").is(":checked")) customDef.edible = true;

            // Same zone rules as moving an item by hand
            if (targetActor) {
              const rejection = zoneRejection(
                FlagManager.getInventory(targetActor),
                zone,
                { id: "", definitionId: "", name, quantity: qty, zone, isSecret, notes: "", customDefinition: customDef }
              );
              if (rejection) { ui.notifications?.warn(rejection); return; }
            }

            SocketHandler.emitOrHandle(SOCKET_EVENTS.GM_GRANT, {
              actorId,
              item: {
                definitionId: "",
                name,
                quantity: qty,
                zone,
                isSecret,
                notes: "",
                customDefinition: customDef,
              },
            });
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
  }
}

// ─── Add To Shop Dialog ───────────────────────────────────────────────────────

/**
 * Put catalogue items on this shop's shelves by hand.
 *
 * The counterpart to `notSold`: the treasures out of the Campaign Book are in
 * the catalogue so that a party can carry them, and off the shelves so that
 * every unconfigured shop does not sell potions. This is how a particular
 * alchemist gets to sell a particular potion — and it lists **everything**,
 * flag or no flag, because the whole point of it is to override the default.
 *
 * What it stores is a copy of the definition in this shop's own stock, which
 * is the same place the invented items live, so the shelf, the price factor
 * and the remove button all work on it without knowing where it came from.
 */
class StockFromCatalogueDialog extends Dialog {
  constructor(shopName: string, onComplete: () => void) {
    // Grouped the way the shop itself groups, so what the Referee picks here
    // and what they see on the shelf afterwards are arranged alike.
    const byCategory = new Map<string, ItemDefinition[]>();
    for (const item of CatalogManager.getAllDefinitions()) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const sections = [...byCategory.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, items]) => {
        const rows = [...items]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (item) => `<label class="dw-stock-row" data-search="${escapeHTML(
              (item.name + " " + item.category + " " + item.subcategory).toLowerCase()
            )}">
              <input type="checkbox" value="${escapeHTML(item.id)}" />
              <span class="dw-stock-name">${escapeHTML(item.name)}</span>
              <span class="dw-stock-sub">${escapeHTML(item.subcategory)}</span>
              <span class="dw-stock-cost">${item.cost.amount}${item.cost.currency}</span>
            </label>`
          )
          .join("");
        return `<details class="dw-stock-group" data-category="${escapeHTML(category)}">
            <summary>
              <i class="fas fa-chevron-right dw-stock-caret"></i>
              <span class="dw-stock-group-name">${escapeHTML(category)}</span>
              <span class="dw-stock-group-count">${items.length}</span>
              <input type="checkbox" class="dw-stock-all" title="Tick everything under this heading" />
            </summary>
            <div class="dw-stock-rows">${rows}</div>
          </details>`;
      })
      .join("");

    super({
      title: "Stock from Catalogue",
      content: `<div class="dw-stock-picker">
          <div class="dw-stock-toolbar">
            <input type="search" class="dw-stock-search" placeholder="Search the whole catalogue…" autofocus />
            <button type="button" class="dw-stock-expand" title="Open or close every category">
              <i class="fas fa-angles-down"></i>
            </button>
            <span class="dw-stock-chosen">nothing picked</span>
          </div>
          <div class="dw-stock-list">${sections}</div>
        </div>`,
      buttons: {
        add: {
          label: "Add to Shop",
          callback: async (html: JQuery) => {
            const chosen = html
              .find(".dw-stock-rows input:checked")
              .map((_i: number, el: HTMLElement) => (el as HTMLInputElement).value)
              .get();
            if (!chosen.length) return;
            // addShopEntries skips anything already on this shelf, so picking a
            // category twice does not list its items twice.
            const picked = chosen
              .map((id: string) => CatalogManager.getDefinition(id))
              .filter((def): def is ItemDefinition => !!def)
              .map((def) => ({ ...def }));
            await addShopEntries(shopName, picked);
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });
  }

  /**
   * Four behaviours, all of them about not scrolling through four hundred rows:
   * a search that opens the categories it finds something in, a tick on the
   * category header that takes the lot, a running count of what is picked, and
   * one button to fold everything up again.
   */
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const root = html[0] ?? html.get(0);
    if (!root) return;
    wireStockPicker(root);
  }
}



// ─── The stock picker's behaviour, shared by both pickers ────────────────────

/**
 * Four behaviours, all of them about not scrolling through four hundred rows:
 * a search that opens the headings it finds something in, a tick on the heading
 * that takes the lot, a running count of what is picked, and one button to fold
 * everything up again.
 *
 * Written against the markup rather than against either dialog, so the
 * catalogue picker and the service picker cannot drift apart.
 */
function wireStockPicker(root: HTMLElement): void {
  const count = (): void => {
    const picked = root.querySelectorAll(".dw-stock-rows input:checked").length;
    const label = root.querySelector(".dw-stock-chosen");
    if (label) label.textContent = picked ? `${picked} picked` : "nothing picked";
    // A heading is ticked when everything under it is, and shows a dash while
    // only some of it is — the same three states a file tree uses.
    root.querySelectorAll<HTMLDetailsElement>(".dw-stock-group").forEach((group) => {
      const boxes = [...group.querySelectorAll<HTMLInputElement>(".dw-stock-rows input")];
      const on = boxes.filter((b) => b.checked).length;
      const all = group.querySelector<HTMLInputElement>(".dw-stock-all");
      if (!all) return;
      all.checked = on > 0 && on === boxes.length;
      all.indeterminate = on > 0 && on < boxes.length;
    });
  };

  root.querySelectorAll<HTMLInputElement>(".dw-stock-all").forEach((all) => {
    // The heading tick lives inside <summary>, where a click would otherwise
    // fold the group shut under the Referee's hand.
    all.addEventListener("click", (event) => event.stopPropagation());
    all.addEventListener("change", () => {
      const group = all.closest(".dw-stock-group");
      group?.querySelectorAll<HTMLInputElement>(".dw-stock-rows input").forEach((box) => {
        if (box.parentElement?.style.display !== "none") box.checked = all.checked;
      });
      count();
    });
  });

  root.querySelector(".dw-stock-list")?.addEventListener("change", () => count());

  const search = root.querySelector<HTMLInputElement>(".dw-stock-search");
  search?.addEventListener("input", () => {
    const q = search.value.toLowerCase().trim();
    root.querySelectorAll<HTMLDetailsElement>(".dw-stock-group").forEach((group) => {
      let shown = 0;
      group.querySelectorAll<HTMLElement>(".dw-stock-row").forEach((row) => {
        const hit = !q || (row.dataset.search ?? "").includes(q);
        row.style.display = hit ? "" : "none";
        if (hit) shown++;
      });
      group.style.display = shown ? "" : "none";
      // Searching opens what it found and closes what it did not; clearing the
      // box puts every group back to shut.
      group.open = q ? shown > 0 : false;
    });
  });

  const expand = root.querySelector<HTMLButtonElement>(".dw-stock-expand");
  expand?.addEventListener("click", () => {
    const groups = [...root.querySelectorAll<HTMLDetailsElement>(".dw-stock-group")];
    const anyShut = groups.some((g) => !g.open);
    groups.forEach((g) => (g.open = anyShut));
    const icon = expand.querySelector("i");
    if (icon) icon.className = anyShut ? "fas fa-angles-up" : "fas fa-angles-down";
  });
}

/**
 * One row on a shop's own shelf — a thing or a service.
 *
 * The two differ in exactly one place, and the form follows it: goods have a
 * size or a weight because they are carried away, services have neither
 * because nothing is. Everything else — name, price, category, availability —
 * is asked once and means the same for both.
 *
 * **The category is typed, not chosen.** It used to be a dropdown of the
 * catalogue's own categories, which is why a bath had nowhere to go. The
 * datalist still offers the catalogue's, plus whatever this shop already uses,
 * so the common case is still one click.
 */
class AddToShopDialog extends Dialog {
  /**
   * @param existing an entry already on this shelf, to be edited in place.
   *   Without it the dialog adds a new one. Editing matters most for the
   *   X-in-6 chance: an item put on the shelf with **From Catalogue** arrives
   *   as a plain copy, and giving the apothecary's Alchemical Tonic its 2-in-6
   *   would otherwise mean deleting it and typing the whole thing again.
   */
  constructor(shopName: string, onComplete: () => void, existing?: ShopEntry) {
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const was = existing;
    const sel = (on: boolean): string => (on ? " selected" : "");

    // Categories already in use here come first: a Referee filling a shop is
    // usually adding the fourth thing to a category they invented for the first.
    const used = [...new Set(shopEntries(shopName).map((e) => e.category).filter(Boolean))];
    const known = [...new Set([...used, "Special Services", ...CatalogManager.getCategories()])];
    const categoryOptions = known.map((c) => `<option value="${escapeHTML(c)}"></option>`).join("");

    const sizeOrWeightField = encMode === "weight"
      ? `<div class="form-group">
            <label for="shop-item-weight">Weight</label>
            <div class="qm-field">
              <input type="number" id="shop-item-weight" value="${was?.weight ?? 10}" min="0" />
              <span class="qm-unit">coin wt</span>
            </div>
          </div>`
      : `<div class="form-group">
            <label for="shop-item-size">Size</label>
            <div class="qm-field">
            <select id="shop-item-size">
              <option value="tiny"${sel(was?.size === "tiny")}>Tiny (0 slots)</option>
              <option value="normal"${sel(!was || was.size === "normal")}>Normal (1 slot)</option>
              <option value="large"${sel(was?.size === "large")}>Large (2 slots)</option>
            </select>
            </div>
          </div>`;

    super({
      title: was ? `Edit: ${was.name}` : "Add to Shop",
      content: `
        <form class="qm-form">
          <div class="form-group">
            <label for="shop-item-kind">This is</label>
            <div class="qm-field">
            <select id="shop-item-kind">
              <option value="goods"${sel(!was?.service)}>Goods — carried away and kept</option>
              <option value="service"${sel(!!was?.service)}>A service — used here, nothing to carry</option>
            </select>
            </div>
          </div>
          <div class="form-group">
            <label for="shop-item-name">Name</label>
            <div class="qm-field">
              <input type="text" id="shop-item-name" value="${escapeHTML(was?.name ?? "")}" placeholder="e.g. Bath, attended by Heggid" />
            </div>
          </div>
          <div class="form-group">
            <label for="shop-item-price">Price</label>
            <div class="qm-field">
              <input type="number" id="shop-item-price" value="${was?.cost.amount ?? 1}" min="0" />
              <select id="shop-item-currency">
                <option value="cp"${sel(was?.cost.currency === "cp")}>cp</option>
                <option value="sp"${sel(was?.cost.currency === "sp")}>sp</option>
                <option value="gp"${sel(!was || was.cost.currency === "gp")}>gp</option>
                <option value="pp"${sel(was?.cost.currency === "pp")}>pp</option>
              </select>
            </div>
            <p class="qm-hint">0 means the price is settled at the table — the shelf shows it as "by arrangement".</p>
          </div>
          <div class="form-group">
            <label for="shop-item-unit">Per</label>
            <div class="qm-field">
              <input type="text" id="shop-item-unit" value="${escapeHTML(was && was.unit !== "piece" ? was.unit : "")}" placeholder="e.g. per person, per day, per night" />
            </div>
            <p class="qm-hint">Printed after the price. Leave empty for a plain each-one price.</p>
          </div>
          <div id="shop-item-carry">
            ${sizeOrWeightField}
          </div>
          <div class="form-group">
            <label for="shop-item-category">Category</label>
            <div class="qm-field">
              <input type="text" id="shop-item-category" list="shop-item-categories" value="${escapeHTML(was?.category ?? "")}" placeholder="Type one, or pick a known one" />
              <datalist id="shop-item-categories">${categoryOptions}</datalist>
            </div>
            <p class="qm-hint">Anything you like — a bath belongs under Baths, not under Adventuring Gear.</p>
          </div>
          <div class="form-group">
            <label for="shop-item-subcategory">Subcategory</label>
            <div class="qm-field">
              <input type="text" id="shop-item-subcategory" value="${escapeHTML(was?.subcategory ?? "")}" placeholder="Optional — e.g. Melee Weapons" />
            </div>
          </div>
          <div class="form-group">
            <label for="shop-item-availability">In stock</label>
            <div class="qm-field">
              <select id="shop-item-availability">
                <option value=""${sel(was?.availability === undefined)}>Always</option>
                ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${sel(was?.availability === n)}>${n} in 6</option>`).join("")}
              </select>
            </div>
            <p class="qm-hint">Rolled once per visit and the same for everyone. Move a shop on with <strong>New visit</strong>.</p>
          </div>
          <div class="form-group qm-wide">
            <label>Icon</label>
            <div class="qm-field qm-field-icons">
              ${buildIconPickerHTML(was?.icon)}
            </div>
          </div>
          <div class="form-group qm-wide">
            <label for="shop-item-desc">Description</label>
            <div class="qm-field">
              <textarea id="shop-item-desc" placeholder="Conditions, waiting time, what it actually does…" rows="2">${escapeHTML(was?.description ?? "")}</textarea>
            </div>
            <p class="qm-hint">A page reference like "Player's Book p132" becomes a link, on the shelf and on the chat card.</p>
          </div>
          <div class="form-group" id="shop-item-edible-group">
            <label for="shop-item-edible">Edible</label>
            <div class="qm-field">
              <input type="checkbox" id="shop-item-edible"${was?.edible ? " checked" : ""} />
            </div>
            <p class="qm-hint">Gives the row an Eat button that feeds the character for the day.</p>
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: was ? "Save" : "Add to Shop",
          callback: async (html: JQuery) => {
            const name = (html.find("#shop-item-name").val() as string).trim();
            if (!name) return;
            const isService = (html.find("#shop-item-kind").val() as string) === "service";
            // A price of 0 is meaningful and kept: it is the alchemist charging
            // what the potion is worth, which the shelf prints as "by
            // arrangement" rather than as free.
            const priceAmount = Math.max(0, parseInt(html.find("#shop-item-price").val() as string, 10) || 0);
            const currency = html.find("#shop-item-currency").val() as "cp" | "sp" | "gp" | "pp";
            const category = (html.find("#shop-item-category").val() as string).trim() ||
              (isService ? "Special Services" : "Sundries");
            const subcategory = (html.find("#shop-item-subcategory").val() as string).trim();
            const unit = (html.find("#shop-item-unit").val() as string).trim();
            const icon = (html.find("#custom-icon-value").val() as string) || (isService ? "fa-hand-holding-dollar" : "fa-sack");
            const description = (html.find("#shop-item-desc").val() as string).trim();
            const availability = parseInt(html.find("#shop-item-availability").val() as string, 10);

            // Only the field the running mode actually showed is passed on;
            // the other is left undefined so the entry keeps what it had.
            const newItem = mergeShopEntry(was, {
              name,
              category,
              subcategory,
              cost: { amount: priceAmount, currency },
              unit,
              icon,
              description,
              availability: Number.isFinite(availability) ? availability : undefined,
              service: isService,
              edible: html.find("#shop-item-edible").is(":checked") as boolean,
              ...(isService
                ? {}
                : encMode === "weight"
                  ? { weight: Math.max(0, parseInt(html.find("#shop-item-weight").val() as string, 10) || 0) }
                  : { size: html.find("#shop-item-size").val() as "tiny" | "normal" | "large" }),
            });

            // Editing replaces in place so the row keeps its position on the
            // shelf; adding appends.
            const shelf = shopEntries(shopName);
            await setShopEntries(
              shopName,
              was ? shelf.map((e) => (e.id === was.id ? newItem : e)) : [...shelf, newItem]
            );
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);

    // Size, weight and Edible describe a thing that gets carried. Asking them
    // about a bath is how a form teaches people to ignore it.
    const kind = html.find("#shop-item-kind");
    const sync = (): void => {
      const isService = (kind.val() as string) === "service";
      html.find("#shop-item-carry").toggle(!isService);
      html.find("#shop-item-edible-group").toggle(!isService);
      this.setPosition({ height: "auto" });
    };
    kind.on("change", sync);
    sync();
  }
}

/**
 * Putting a service the Referee has already written — or one of the Player's
 * Book's own specialists — onto this shop's shelf.
 *
 * A *copy* lands on the shelf, never a link: the guide costs 5gp a day in the
 * book and 3gp in a village that likes the party, and the second must not
 * rewrite the first.
 */
class StockFromLibraryDialog extends Dialog {
  constructor(shopName: string, onComplete: () => void) {
    const services = allLibraryServices();

    const byGroup = new Map<string, ShopEntry[]>();
    for (const entry of services) {
      const group = entry.subcategory || entry.category || "Services";
      const list = byGroup.get(group) ?? [];
      list.push(entry);
      byGroup.set(group, list);
    }

    const sections = [...byGroup.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, entries]) => {
        const rows = entries
          .map(
            (entry) => `<label class="dw-stock-row" data-search="${escapeHTML(
              (entry.name + " " + group).toLowerCase()
            )}">
              <input type="checkbox" value="${escapeHTML(entry.id)}" />
              <span class="dw-stock-name">${escapeHTML(entry.name)}</span>
              <span class="dw-stock-sub">${escapeHTML(entry.unit && entry.unit !== "piece" ? entry.unit : "")}</span>
              <span class="dw-stock-cost">${entry.cost.amount === 0 ? "—" : `${entry.cost.amount}${entry.cost.currency}`}</span>
            </label>`
          )
          .join("");
        return `<details class="dw-stock-group" data-category="${escapeHTML(group)}">
            <summary>
              <i class="fas fa-chevron-right dw-stock-caret"></i>
              <span class="dw-stock-group-name">${escapeHTML(group)}</span>
              <span class="dw-stock-group-count">${entries.length}</span>
              <input type="checkbox" class="dw-stock-all" title="Tick everything under this heading" />
            </summary>
            <div class="dw-stock-rows">${rows}</div>
          </details>`;
      })
      .join("");

    super({
      title: "Add a Service",
      content: `<div class="dw-stock-picker">
          <div class="dw-stock-toolbar">
            <input type="search" class="dw-stock-search" placeholder="Search the services…" autofocus />
            <button type="button" class="dw-stock-expand" title="Open or close every heading">
              <i class="fas fa-angles-down"></i>
            </button>
            <span class="dw-stock-chosen">nothing picked</span>
          </div>
          <div class="dw-stock-list">${sections}</div>
          <p class="qm-hint">A copy goes on this shop's shelf. Repricing it here leaves the library alone.</p>
        </div>`,
      buttons: {
        add: {
          label: "Add to Shop",
          callback: async (html: JQuery) => {
            const chosen = html
              .find(".dw-stock-rows input:checked")
              .map((_i: number, el: HTMLElement) => (el as HTMLInputElement).value)
              .get();
            if (!chosen.length) return;
            const picked = services.filter((s) => chosen.includes(s.id));
            const added = await addShopEntries(shopName, picked);
            if (added < picked.length) {
              ui.notifications?.info(
                `${picked.length - added} of those were already on this shelf.`
              );
            }
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });
  }

  /** The same four behaviours the catalogue picker has; see its own note. */
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const root = html[0] ?? html.get(0);
    if (!root) return;
    wireStockPicker(root);
  }
}
