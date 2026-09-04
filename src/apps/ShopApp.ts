import { MODULE_ID, TEMPLATES, SETTINGS, SOCKET_EVENTS, GENERIC_SHOP_KEY } from "../constants";
type LocalHiddenMap = Record<string, string[]>;
import { CatalogManager } from "../data/CatalogManager";
import { FlagManager } from "../data/FlagManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { zoneRejection } from "../data/zoneGrants";
import { getPartyActors } from "../data/sharedStore";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker, escapeHTML, activateQualitiesPreview } from "../helpers/handlebars";
import {
  shopEntries,
  setShopEntries,
  addShopEntries,
  allLibraryServices,
  serviceLibrary,
  setServiceLibrary,
  mergeShopEntry,
  buyCategories,
  removeFromLibrary,
  isOwnLibraryEntry,
  SPECIAL_SERVICES,
  shopBuys,
} from "../data/shopStock";
import { inStock, shopVisit, bumpShopVisit } from "../data/shopAvailability";
import { qualitiesHint, parseQualities, describeQualities } from "../data/weapons";
import { saleValue } from "../data/shopSale";
import { definitionFor } from "../data/itemDefs";
import { linkBookReferences, activateBookLinks } from "../data/dayRolls";
import { CURRENCY_IN_CP as IN_CP, coinToCp, cpToCoin, withPriceFactor } from "../data/coins";
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
import { t } from "../helpers/i18n";
import { coinLabel } from "../data/coins";
import type { Coin } from "../data/coins";

/** A price as it is read: the figure, then the coin it is counted in. */
function coinText(c: Coin): string {
  return `${c.amount} ${coinLabel(c.currency)}`;
}

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
  /**
   * The toolbar shop's own name, which is **not** `localName`.
   *
   * `localName` is what keys the shelf, so putting the typed name there would
   * move a shop's stock every time it was renamed. The toolbar shop keeps its
   * reserved key whatever it is called; this is the name on the door.
   */
  private toolbarName = "";
  /** Toolbar shop only: whether the party may walk in. */
  private released = false;
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

  /** The place-less shop, opened from the toolbar rather than from a note. */
  private get isToolbar(): boolean {
    return this.localName === null;
  }

  /** What to call this shop on its own door. */
  private get displayName(): string {
    return this.localName ?? (this.toolbarName || "Shop");
  }

  /**
   * Whether the toolbar shop is open to the party.
   *
   * Read from the setting rather than an instance, because the doors — the
   * scene toolbar, the day bar, the button in a character's inventory — all
   * have to ask before there is a window to ask.
   */
  static isReleased(): boolean {
    const st = (game as Game).settings?.get(MODULE_ID, SETTINGS.SHOP_STATE) as ShopState | undefined;
    return st?.toolbarReleased === true;
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
    return this.displayName;
  }

  /**
   * Remember the toolbar shop's own settings — and only the toolbar shop's.
   *
   * A note shop carries its name, categories and rates on the note and
   * re-applies them on every open, so writing them here would do nothing for
   * that shop and would quietly overwrite what the toolbar one comes back as.
   */
  private async _saveToolbarState(): Promise<void> {
    if (!this.isToolbar) return;
    const g = game as Game;
    const st = g.settings.get(MODULE_ID, SETTINGS.SHOP_STATE) as ShopState;
    await g.settings.set(MODULE_ID, SETTINGS.SHOP_STATE, {
      ...st,
      toolbarName: this.toolbarName,
      toolbarReleased: this.released,
      toolbarOwnStock: this.ownStockOnly,
    });
  }

  /**
   * Open the toolbar shop to the party, or shut it.
   *
   * The same door the inn has, for the same reason: the Referee names it and
   * stocks it first, and until then it is not a place anybody can walk into
   * (Leander, 2026-09-01). Shutting it takes the window off anyone holding it
   * open — see `_onRender`.
   */
  private static async _onToggleRelease(this: ShopApp): Promise<void> {
    if (!((game as Game).user?.isGM ?? false) || !this.isToolbar) return;
    this.released = !this.released;
    await this._saveToolbarState();
    if (this.released) await this._announceRelease();
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render(false);
  }

  /**
   * The shelf, or the whole catalogue.
   *
   * The toolbar shop starts on its own shelf — that is what "empty at first"
   * means — but the catalogue standing open was what it did for a year, and a
   * change of mind should not need a reinstall. One button, and it says which
   * of the two it is showing.
   */
  private static async _onToggleOwnStock(this: ShopApp): Promise<void> {
    if (!((game as Game).user?.isGM ?? false) || !this.isToolbar) return;
    this.ownStockOnly = !this.ownStockOnly;
    await this._saveToolbarState();
    this.render(false);
  }

  /** How the party finds out there is a shop to walk into. */
  private async _announceRelease(): Promise<void> {
    await ChatMessage.create({
      content: `
        <div class="dw-shop-message">
          <h3><i class="fas fa-store"></i> ${escapeHTML(this.displayName)}</h3>
          <p><em>${t("DOLMENWOOD.Shop.Chat.Open")}</em></p>
        </div>`,
    } as Parameters<typeof ChatMessage.create>[0]);
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-shop",
    window: {
      title: "DOLMENWOOD.Shop.Title",
      resizable: true,
    },
    position: {
      width: 700,
      // A third taller than it was (Leander, 2026-09-05). The shelves are the
      // one list in this module that is always longer than its window, and the
      // toolbar now takes two rows. Capped against the viewport the way the
      // party overview caps its width — a window taller than the screen cannot
      // be dragged back into reach.
      height: Math.min(832, window.innerHeight - 80),
    },
    classes: ["dolmenwood-party-inventory", "shop"],
    actions: {
      toggleTag: ShopApp._onToggleTag,
      toggleRelease: ShopApp._onToggleRelease,
      toggleOwnStock: ShopApp._onToggleOwnStock,
      toggleAffordable: ShopApp._onToggleAffordable,
      purchaseItem: ShopApp._onPurchaseItem,
      grantItem: ShopApp._onGrantItem,
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
    // Re-read every render rather than trusted from a constructor: the Referee
    // may have named, stocked, opened or shut this shop since the window was
    // built, and on a player's client a refresh is the only warning it gets.
    // A note shop carries its own settings and has none of this.
    if (this.isToolbar) {
      this.toolbarName = shopState.toolbarName ?? "";
      this.released = shopState.toolbarReleased === true;
      // Absent means the shelf, not the catalogue — see ShopState.
      this.ownStockOnly = shopState.toolbarOwnStock !== false;
    }
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
    // What the selected character could actually pay, at this shop's prices.
    // Shared with the shop's own shelf below: the filter used to reach only the
    // catalogue, so a player with 2gp saw a filtered catalogue sitting beside
    // an unfiltered 300gp potion and concluded the filter was broken.
    const canAfford = (cost: ItemDefinition["cost"]) =>
      availableCp >= Math.max(1, Math.round((coinToCp(cost) * this.priceFactor) / 100));

    if (this.showAffordableOnly && selectedInventory) {
      items = items.filter((i) => canAfford(i.cost));
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

      // The affordability filter reaches the shop's own shelf too. A row whose
      // price the book declines to print is never filtered out: there is no
      // number to compare, and hiding it would be a guess.
      if (this.showAffordableOnly && selectedInventory && !byArrangement && !canAfford(item.cost)) {
        continue;
      }

      addToGrouped({
        ...item,
        cost: (() => {
          const c = byArrangement ? item.cost : priced(item.cost);
          return { ...c, currencyLabel: coinLabel(c.currency) };
        })(),
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
      shopName: this.displayName,
      isLocalShop: this.localName !== null,
      localName: this.localName,
      // The head's own controls, and only where there is no note behind the
      // window to carry these decisions instead.
      isToolbarShop: this.isToolbar,
      canRelease: isGM && this.isToolbar,
      released: this.released,
      toolbarName: this.toolbarName,
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
          // Written out here rather than in the template: a price is a figure and
          // a coin, and only one of the two comes out of the language file.
          perItemText: coinText(cpToCoin(perItem)),
          totalText: coinText(cpToCoin(perItem * value.units)),
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
    // **A player must not be left holding a shop the Referee has shut.** The
    // doors go grey the moment it closes, but a window already open is not a
    // door and would go on selling until somebody closed it by hand.
    if (!((game as Game).user?.isGM ?? false) && this.isToolbar && !ShopApp.isReleased()) {
      void this.close();
      return;
    }

    const el = this.element;

    el.querySelector<HTMLInputElement>("#shop-name-input")?.addEventListener("change", async (e) => {
      // Clearing it is allowed: an unnamed shop is simply "Shop". The name is
      // the sign over the door and nothing else — the shelf is keyed by the
      // reserved toolbar key, so renaming never moves the stock.
      const next = (e.target as HTMLInputElement).value.trim();
      if (next === this.toolbarName) return;
      this.toolbarName = next;
      await this._saveToolbarState();
      this.render(false);
    });

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
      ui.notifications?.warn(
        t("DOLMENWOOD.Shop.CannotAfford", { actor: actor.name ?? "", what: def.name })
      );
      return;
    }

    // Show confirmation dialog — capture zone selection inside callback
    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const zoneFormGroup = encMode === "weight"
      ? ""
      : `<div class="form-group">
           <label>${t("DOLMENWOOD.Shop.Purchase.Zone")}</label>
           <select id="purchase-zone">
             <option value="equipped">${t("DOLMENWOOD.Zone.Equipped")}</option>
             <option value="stowed" selected>${t("DOLMENWOOD.Zone.Stowed")}</option>
             <option value="tiny">${t("DOLMENWOOD.Zone.BeltPouch")}</option>
           </select>
         </div>`;
    const result = await new Promise<{ confirmed: boolean; zone: string }>((resolve) => {
      new Dialog({
        title: t("DOLMENWOOD.Shop.Purchase.Title"),
        content: `
          ${t("DOLMENWOOD.Shop.Purchase.Body", {
            what: escapeHTML(def.name),
            cost: `${adjustedAmount} ${coinLabel(def.cost.currency)}`,
          })}
          ${t("DOLMENWOOD.Shop.Purchase.Target", { who: escapeHTML(actor.name ?? "") })}
          ${
            !canAfford
              ? `<p class="warning"><i class="fas fa-exclamation-triangle"></i> ${t(
                  "DOLMENWOOD.Shop.Purchase.Insufficient"
                )}</p>`
              : ""
          }
          ${zoneFormGroup}
        `,
        buttons: {
          confirm: {
            label: t(
              canAfford ? "DOLMENWOOD.Shop.Purchase.Confirm" : "DOLMENWOOD.Shop.Purchase.Override"
            ),
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

    ui.notifications?.info(
      t("DOLMENWOOD.Shop.Purchased", { what: def.name, who: actor.name ?? "" })
    );
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
        ui.notifications?.warn(
          t("DOLMENWOOD.Shop.CannotAfford", { actor: actor.name ?? "", what: entry.name })
        );
        return;
      }
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      new Dialog({
        title: t(free ? "DOLMENWOOD.Shop.Service.GrantTitle" : "DOLMENWOOD.Shop.Service.BuyTitle"),
        content: `
          ${t("DOLMENWOOD.Shop.Service.Body", { name: escapeHTML(entry.name), price: priceText })}
          ${t("DOLMENWOOD.Shop.Service.For", { who: escapeHTML(actor.name ?? "") })}
          ${entry.description ? `<p class="qm-hint">${escapeHTML(entry.description)}</p>` : ""}
          <p class="qm-hint"><i class="fas fa-circle-info"></i> ${t("DOLMENWOOD.Shop.Service.Note")}</p>
        `,
        buttons: {
          confirm: {
            label: t(free ? "DOLMENWOOD.Shop.Grant" : "DOLMENWOOD.Shop.Buy.Label"),
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
      ui.notifications?.warn(t("DOLMENWOOD.Shop.SelectFirst"));
      return;
    }

    const g = game as Game;
    const catalogDef = CatalogManager.getDefinition(definitionId);
    const def = catalogDef ?? this.customItems().find((i) => i.id === definitionId);
    if (!def) {
      ui.notifications?.warn(t("DOLMENWOOD.Shop.ItemNotFound"));
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
    ui.notifications?.info(t("DOLMENWOOD.Shop.Granted", { what: def.name }));
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
      ui.notifications?.info(t("DOLMENWOOD.Shop.Library.Already", { name: entry.name }));
      return;
    }
    await setServiceLibrary([...library, foundry.utils.deepClone(entry)]);
    ui.notifications?.info(t("DOLMENWOOD.Shop.Library.Saved", { name: entry.name }));
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
    ui.notifications?.info(t("DOLMENWOOD.Shop.Rerolled"));
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
      ui.notifications?.warn(t("DOLMENWOOD.Shop.SelectFirst"));
      return;
    }
    const actor = g.actors?.get(this.selectedActorId);
    if (!actor) {
      ui.notifications?.warn(t("DOLMENWOOD.Shop.NoLongerInWorld"));
      return;
    }

    const inventory = FlagManager.getInventory(actor);
    const row = inventory.items.find((i) => i.id === itemId);
    if (!row) {
      ui.notifications?.warn(t("DOLMENWOOD.Shop.NoLongerCarrying", { who: actor.name ?? "" }));
      return;
    }

    const def = definitionFor(row, CatalogManager.getMap());

    // The same rule the list is built with, applied again here: the button can
    // outlive the shelf that justified it, if the shop is reconfigured while
    // the window is open.
    if (!shopBuys(def?.category, this.buyCategories())) {
      ui.notifications?.warn(
        t("DOLMENWOOD.Shop.DoesNotDeal", {
          shop: this.localName ?? t("DOLMENWOOD.Shop.ThisShop"),
          what: row.name,
        })
      );
      return;
    }

    const value = saleValue(row, def);
    const perItemCp = Math.floor((value.unitCp * this.buyBackRate) / 100);
    if (perItemCp <= 0) {
      // A part-full container can land here on its own: three arrows out of
      // twenty is a fifteenth of five gold, and at half rate that rounds away.
      ui.notifications?.warn(
        t(
          value.fill && value.fill.used < value.fill.capacity
            ? "DOLMENWOOD.Shop.TooEmpty"
            : "DOLMENWOOD.Shop.WorthNothing",
          { what: row.name }
        )
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
          title: t("DOLMENWOOD.Shop.SellQty.Title"),
          content: `<form class="qm-form">
            ${t("DOLMENWOOD.Shop.SellQty.Body", { what: escapeHTML(row.name) })}
            <p class="qm-hint">${t("DOLMENWOOD.Shop.SellQty.Hint", {
              cost: coinText(cpToCoin(perItemCp)),
              n: value.units,
            })}</p>
            <div class="form-group">
              <label>${t("DOLMENWOOD.Common.HowMany")}</label>
              <div class="qm-field">
                <input type="number" id="sell-qty" value="1" min="1" max="${value.units}" />
              </div>
            </div>
          </form>`,
          buttons: {
            sell: {
              label: t("DOLMENWOOD.Shop.SellBtn"),
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
        title: t("DOLMENWOOD.Shop.SellQty.Title"),
        content: `${t("DOLMENWOOD.Shop.SellConfirm.Body", {
            n: quantity,
            what: escapeHTML(row.name),
            cost: coinText(proceeds),
          })}
          <p class="qm-hint">${
            value.fill
              ? t("DOLMENWOOD.Shop.SellConfirm.Fill", {
                  used: value.fill.used,
                  capacity: value.fill.capacity,
                  what: escapeHTML(row.name.toLowerCase()),
                })
              : value.units - quantity > 0
                ? t("DOLMENWOOD.Shop.SellConfirm.Keeps", {
                    who: escapeHTML(actor.name ?? ""),
                    left: value.units - quantity,
                    total: value.units,
                  })
                : value.units === 1
                  ? t("DOLMENWOOD.Shop.SellConfirm.LastOne")
                  : t("DOLMENWOOD.Shop.SellConfirm.LastAll", { n: value.units })
          }</p>
          <p class="qm-hint">${t("DOLMENWOOD.Shop.SellConfirm.Rate", {
            shop: this.localName ?? t("DOLMENWOOD.Shop.TheShop"),
            pct: this.buyBackRate,
          })}</p>`,
        buttons: {
          sell: {
            label: t("DOLMENWOOD.Shop.SellBtn"),
            icon: '<i class="fas fa-hand-holding-dollar"></i>',
            callback: () => resolve(true),
          },
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
              <input type="checkbox" class="dw-stock-all" title="${escapeHTML(t("DOLMENWOOD.Shop.Stock.TickAll.Hint"))}" />
            </summary>
            <div class="dw-stock-rows">${rows}</div>
          </details>`;
      })
      .join("");

    super({
      title: t("DOLMENWOOD.Shop.Stock.Title"),
      content: `<div class="dw-stock-picker">
          <div class="dw-stock-toolbar">
            <input type="search" class="dw-stock-search" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Stock.Search"))}" autofocus />
            <button type="button" class="dw-stock-expand" title="${escapeHTML(t("DOLMENWOOD.Shop.Stock.Expand.Hint"))}">
              <i class="fas fa-angles-down"></i>
            </button>
            <span class="dw-stock-chosen">${t("DOLMENWOOD.Shop.Stock.NothingPicked")}</span>
          </div>
          <div class="dw-stock-list">${sections}</div>
        </div>`,
      buttons: {
        add: {
          label: t("DOLMENWOOD.Shop.AddToShop.Label"),
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
            <label for="shop-item-weight">${t("DOLMENWOOD.Shop.Entry.Weight.Label")}</label>
            <div class="qm-field">
              <input type="number" id="shop-item-weight" value="${was?.weight ?? 10}" min="0" />
              <span class="qm-unit">${t("DOLMENWOOD.Shop.Entry.Weight.Unit")}</span>
            </div>
          </div>`
      : `<div class="form-group">
            <label for="shop-item-size">${t("DOLMENWOOD.Shop.Entry.Size.Label")}</label>
            <div class="qm-field">
            <select id="shop-item-size">
              <option value="tiny"${sel(was?.size === "tiny")}>${t("DOLMENWOOD.ItemDialog.Slots.Tiny")}</option>
              <option value="normal"${sel(!was || was.size === "normal")}>${t("DOLMENWOOD.ItemDialog.Slots.Normal")}</option>
              <option value="large"${sel(was?.size === "large")}>${t("DOLMENWOOD.ItemDialog.Slots.Large")}</option>
            </select>
            </div>
          </div>`;

    super({
      title: was
        ? t("DOLMENWOOD.Shop.Entry.EditTitle", { name: was.name })
        : t("DOLMENWOOD.Shop.AddToShop.Label"),
      content: `
        <form class="qm-form">
          <div class="form-group">
            <label for="shop-item-kind">${t("DOLMENWOOD.Shop.Entry.Kind.Label")}</label>
            <div class="qm-field">
            <select id="shop-item-kind">
              <option value="goods"${sel(!was?.service)}>${t("DOLMENWOOD.Shop.Entry.Kind.Goods")}</option>
              <option value="service"${sel(!!was?.service)}>${t("DOLMENWOOD.Shop.Entry.Kind.Service")}</option>
            </select>
            </div>
          </div>
          <div class="form-group">
            <label for="shop-item-name">${t("DOLMENWOOD.Shop.Entry.Name.Label")}</label>
            <div class="qm-field">
              <input type="text" id="shop-item-name" value="${escapeHTML(was?.name ?? "")}" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Entry.Name.Placeholder"))}" />
            </div>
          </div>
          <div class="form-group">
            <label for="shop-item-price">${t("DOLMENWOOD.Shop.Entry.Price.Label")}</label>
            <div class="qm-field">
              <input type="number" id="shop-item-price" value="${was?.cost.amount ?? 1}" min="0" />
              <select id="shop-item-currency">
                <option value="cp"${sel(was?.cost.currency === "cp")}>${t("DOLMENWOOD.Currency.CP")}</option>
                <option value="sp"${sel(was?.cost.currency === "sp")}>${t("DOLMENWOOD.Currency.SP")}</option>
                <option value="gp"${sel(!was || was.cost.currency === "gp")}>${t("DOLMENWOOD.Currency.GP")}</option>
                <option value="pp"${sel(was?.cost.currency === "pp")}>${t("DOLMENWOOD.Currency.PP")}</option>
              </select>
            </div>
            <p class="qm-hint">${escapeHTML(t("DOLMENWOOD.Shop.Entry.Price.Hint"))}</p>
          </div>
          <div class="form-group">
            <label for="shop-item-unit">${t("DOLMENWOOD.Shop.Entry.Per.Label")}</label>
            <div class="qm-field">
              <input type="text" id="shop-item-unit" value="${escapeHTML(was && was.unit !== "piece" ? was.unit : "")}" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Entry.Per.Placeholder"))}" />
            </div>
            <p class="qm-hint">${t("DOLMENWOOD.Shop.Entry.Per.Hint")}</p>
          </div>
          <div id="shop-item-carry">
            ${sizeOrWeightField}
          </div>
          <div class="form-group">
            <label for="shop-item-category">${t("DOLMENWOOD.Shop.Entry.Category.Label")}</label>
            <div class="qm-field">
              <input type="text" id="shop-item-category" list="shop-item-categories" value="${escapeHTML(was?.category ?? "")}" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Entry.Category.Placeholder"))}" />
              <datalist id="shop-item-categories">${categoryOptions}</datalist>
            </div>
            <p class="qm-hint">${t("DOLMENWOOD.Shop.Entry.Category.Hint")}</p>
          </div>
          <div class="form-group">
            <label for="shop-item-subcategory">${t("DOLMENWOOD.Shop.Entry.Subcategory.Label")}</label>
            <div class="qm-field">
              <input type="text" id="shop-item-subcategory" value="${escapeHTML(was?.subcategory ?? "")}" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Entry.Subcategory.Placeholder"))}" />
            </div>
          </div>
          <div class="form-group">
            <label for="shop-item-availability">${t("DOLMENWOOD.Shop.Entry.Availability.Label")}</label>
            <div class="qm-field">
              <select id="shop-item-availability">
                <option value=""${sel(was?.availability === undefined)}>${t("DOLMENWOOD.Shop.Entry.Availability.Always")}</option>
                ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}"${sel(was?.availability === n)}>${t("DOLMENWOOD.Shop.Entry.Availability.NInSix", { n })}</option>`).join("")}
              </select>
            </div>
            <p class="qm-hint">${t("DOLMENWOOD.Shop.Entry.Availability.Hint")}</p>
          </div>
          <div class="form-group qm-wide">
            <label>${t("DOLMENWOOD.Shop.Entry.Icon")}</label>
            <div class="qm-field qm-field-icons">
              ${buildIconPickerHTML(was?.icon)}
            </div>
          </div>
          <div class="form-group qm-wide">
            <label for="shop-item-desc">${t("DOLMENWOOD.Shop.Entry.Description.Label")}</label>
            <div class="qm-field">
              <textarea id="shop-item-desc" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Entry.Description.Placeholder"))}" rows="2">${escapeHTML(was?.description ?? "")}</textarea>
            </div>
            <p class="qm-hint">${escapeHTML(t("DOLMENWOOD.Shop.Entry.Description.Hint"))}</p>
          </div>
          <div class="form-group" id="shop-item-edible-group">
            <label for="shop-item-edible">${t("DOLMENWOOD.Shop.Entry.Edible.Label")}</label>
            <div class="qm-field">
              <input type="checkbox" id="shop-item-edible"${was?.edible ? " checked" : ""} />
            </div>
            <p class="qm-hint">${t("DOLMENWOOD.ItemDialog.Edible.Hint")}</p>
          </div>
          <div class="form-group">
            <label for="shop-item-qualities">${t("DOLMENWOOD.Shop.Entry.Qualities.Label")}</label>
            <div class="qm-field">
              <input type="text" id="shop-item-qualities" value="${escapeHTML((was?.qualities ?? []).join(", "))}"
                     placeholder="${escapeHTML(t("DOLMENWOOD.ItemDialog.Qualities.Placeholder"))}" />
            </div>
            <p class="qm-hint">${escapeHTML(qualitiesHint())}</p>
            <p class="qm-hint" data-read-for="shop-item-qualities"></p>
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: t(was ? "DOLMENWOOD.Common.Save" : "DOLMENWOOD.Shop.AddToShop.Label"),
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
              qualities: parseQualities((html.find("#shop-item-qualities").val() as string) ?? ""),
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
    activateQualitiesPreview(html[0] ?? html.get(0), "shop-item-qualities");

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
  /** Kept so the dialog can rebuild itself after the library is pruned. */
  private shopName!: string;
  private onComplete!: () => void;

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
              ${
                isOwnLibraryEntry(entry.id)
                  ? `<button type="button" class="dw-stock-prune" data-prune="${escapeHTML(entry.id)}"
                             title="${
                               SPECIAL_SERVICES.some((s) => s.id === entry.id)
                                 ? t("DOLMENWOOD.Shop.Library.Prune.Restore.Hint")
                                 : t("DOLMENWOOD.Shop.Library.Prune.Remove.Hint")
                             }"><i class="fas fa-trash"></i></button>`
                  : ""
              }
            </label>`
          )
          .join("");
        return `<details class="dw-stock-group" data-category="${escapeHTML(group)}">
            <summary>
              <i class="fas fa-chevron-right dw-stock-caret"></i>
              <span class="dw-stock-group-name">${escapeHTML(group)}</span>
              <span class="dw-stock-group-count">${entries.length}</span>
              <input type="checkbox" class="dw-stock-all" title="${escapeHTML(t("DOLMENWOOD.Shop.Stock.TickAll.Hint"))}" />
            </summary>
            <div class="dw-stock-rows">${rows}</div>
          </details>`;
      })
      .join("");

    super({
      title: t("DOLMENWOOD.Shop.Library.Title"),
      content: `<div class="dw-stock-picker">
          <div class="dw-stock-toolbar">
            <input type="search" class="dw-stock-search" placeholder="${escapeHTML(t("DOLMENWOOD.Shop.Library.Search"))}" autofocus />
            <button type="button" class="dw-stock-expand" title="${escapeHTML(t("DOLMENWOOD.Shop.Library.Expand.Hint"))}">
              <i class="fas fa-angles-down"></i>
            </button>
            <span class="dw-stock-chosen">${t("DOLMENWOOD.Shop.Stock.NothingPicked")}</span>
          </div>
          <div class="dw-stock-list">${sections}</div>
          <p class="qm-hint">${t("DOLMENWOOD.Shop.Library.Note")}</p>
        </div>`,
      buttons: {
        add: {
          label: t("DOLMENWOOD.Shop.AddToShop.Label"),
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
                t("DOLMENWOOD.Shop.Library.AlreadyOnShelf", { n: picked.length - added })
              );
            }
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });

    this.shopName = shopName;
    this.onComplete = onComplete;
  }

  /** The same four behaviours the catalogue picker has; see its own note. */
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const root = html[0] ?? html.get(0);
    if (!root) return;
    wireStockPicker(root);

    // Pruning the library. The button sits inside the row's <label>, so the
    // click has to be stopped or it toggles the checkbox on its way out.
    for (const btn of root.querySelectorAll<HTMLElement>("[data-prune]")) {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = btn.dataset.prune!;
        const name = btn.closest(".dw-stock-row")?.querySelector(".dw-stock-name")?.textContent ?? id;
        const isBuiltIn = SPECIAL_SERVICES.some((s) => s.id === id);
        new Dialog({
          title: t(
            isBuiltIn
              ? "DOLMENWOOD.Shop.Library.Restore.Title"
              : "DOLMENWOOD.Shop.Library.Remove.Title"
          ),
          content: isBuiltIn
            ? t("DOLMENWOOD.Shop.Library.Restore.Body", { name: escapeHTML(name) }) +
              `<p class="qm-hint">${t("DOLMENWOOD.Shop.Library.Restore.Hint")}</p>`
            : t("DOLMENWOOD.Shop.Library.Remove.Body", { name: escapeHTML(name) }) +
              `<p class="qm-hint">${t("DOLMENWOOD.Shop.Library.Remove.Hint")}</p>`,
          buttons: {
            yes: {
              label: t(
                isBuiltIn
                  ? "DOLMENWOOD.Shop.Library.Restore.Button"
                  : "DOLMENWOOD.Shop.Library.Remove.Button"
              ),
              icon: `<i class="fas ${isBuiltIn ? "fa-rotate-left" : "fa-trash"}"></i>`,
              callback: async () => {
                const what = await removeFromLibrary(id);
                if (what === "missing") {
                  ui.notifications?.warn(t("DOLMENWOOD.Shop.Library.Missing", { name }));
                  return;
                }
                ui.notifications?.info(
                  what === "reverted"
                    ? t("DOLMENWOOD.Shop.Library.Reverted", { name })
                    : t("DOLMENWOOD.Shop.Library.Removed", { name })
                );
                // Reopen rather than patch the DOM: a restored built-in has to
                // come back with the book's price, and the list was built from
                // a snapshot taken before any of this.
                await this.close();
                new StockFromLibraryDialog(this.shopName, this.onComplete).render(true);
              },
            },
            cancel: { label: "Cancel" },
          },
          default: "cancel",
        }).render(true);
      });
    }
  }
}
