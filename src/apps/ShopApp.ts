import { MODULE_ID, TEMPLATES, SETTINGS, SOCKET_EVENTS, GENERIC_SHOP_KEY } from "../constants";
type LocalHiddenMap = Record<string, string[]>;
import { CatalogManager } from "../data/CatalogManager";
import { FlagManager } from "../data/FlagManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { zoneRejection } from "../data/zoneGrants";
import { getPartyActors } from "../data/sharedStore";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker, buildZoneOptionsHTML } from "../helpers/handlebars";
import type { ItemDefinition, ShopState, InventoryItem, PurchasePayload } from "../types";

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

  /** The GM-defined items stocked in this shop. */
  private customItems(): ItemDefinition[] {
    const all =
      ((game as Game).settings.get(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS) as Record<string, ItemDefinition[]>) ?? {};
    return all[this.shopKey] ?? [];
  }

  /** Configure this shop instance from a Note marker */
  setConfig(name: string, categories: string[], priceFactor = 100): void {
    this.localName = name;
    this.localCategories = categories;
    this.priceFactor = priceFactor;
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
      removeFromShop: ShopApp._onRemoveFromShop,
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

    // Filter catalog
    let items = CatalogManager.filterByTags(shopState.activeTags);
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
    type GroupedItem = ItemDefinition & { isHidden?: boolean; isLocalCustom?: boolean };
    const factor = this.priceFactor;
    const grouped: Record<string, { subcategory: string; items: GroupedItem[] }[]> = {};

    const addToGrouped = (item: GroupedItem) => {
      if (!grouped[item.category]) grouped[item.category] = [];
      const catGroups = grouped[item.category];
      let sub = catGroups.find((g) => g.subcategory === (item.subcategory || ""));
      if (!sub) { sub = { subcategory: item.subcategory || "", items: [] }; catGroups.push(sub); }
      sub.items.push(item);
    };

    const withPriceFactor = (cost: ItemDefinition["cost"]) =>
      factor === 100
        ? cost
        : { amount: Math.max(1, Math.round(cost.amount * factor / 100)), currency: cost.currency };

    for (const item of items) {
      addToGrouped({
        ...item,
        cost: withPriceFactor(item.cost),
        isHidden: isGM && activeHiddenItems.includes(item.id),
      });
    }

    // Append the GM's own items for this shop. The generic shop stores them
    // under a reserved key, so stocking it works exactly like a map-note shop.
    // The price factor applies here too — the purchase dialog always charges
    // the adjusted price, so listing the raw one would misquote it.
    for (const item of this.customItems()) {
      const q = this.searchText.toLowerCase();
      if (this.searchText && !item.name.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) continue;
      addToGrouped({ ...item, cost: withPriceFactor(item.cost), isLocalCustom: true, isHidden: false });
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
    };
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

  private static async _onRemoveFromShop(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const g = game as Game;
    const key = this.shopKey;
    const all = (g.settings.get(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS) as Record<string, ItemDefinition[]>) ?? {};
    if (!all[key]) return;
    all[key] = all[key].filter((i) => i.id !== itemId);
    await g.settings.set(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS, all);
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

class AddToShopDialog extends Dialog {
  constructor(shopName: string, onComplete: () => void) {
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const categories = CatalogManager.getCategories();
    const categoryOptions = categories.map((c) => `<option value="${c}">${c}</option>`).join("");
    const sizeOrWeightField = encMode === "weight"
      ? `<div class="form-group">
            <label>Weight (coin wt)</label>
            <input type="number" id="shop-item-weight" value="10" min="0" />
          </div>`
      : `<div class="form-group">
            <label>Size</label>
            <select id="shop-item-size">
              <option value="tiny">Tiny (0 slots)</option>
              <option value="normal" selected>Normal (1 slot)</option>
              <option value="large">Large (2 slots)</option>
            </select>
          </div>`;
    super({
      title: "Add Item to Shop",
      content: `
        <form>
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" id="shop-item-name" placeholder="Item name" />
          </div>
          <div class="form-group" style="display:flex;gap:8px;">
            <div style="flex:1;">
              <label>Price</label>
              <input type="number" id="shop-item-price" value="1" min="0" />
            </div>
            <div style="flex:1;">
              <label>Currency</label>
              <select id="shop-item-currency">
                <option value="cp">cp</option>
                <option value="sp">sp</option>
                <option value="gp" selected>gp</option>
                <option value="pp">pp</option>
              </select>
            </div>
          </div>
          ${sizeOrWeightField}
          <div class="form-group">
            <label>Category</label>
            <select id="shop-item-category">
              ${categoryOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Subcategory (optional)</label>
            <input type="text" id="shop-item-subcategory" placeholder="e.g. Melee Weapons" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            ${buildIconPickerHTML()}
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="shop-item-desc" placeholder="Optional description…" rows="2" style="width:100%;resize:vertical;"></textarea>
          </div>
          <div class="form-group">
            <label>Edible</label>
            <input type="checkbox" id="shop-item-edible" />
            <span class="qm-hint">Gives the row an Eat button that feeds the character for the day.</span>
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: "Add to Shop",
          callback: async (html: JQuery) => {
            const name = (html.find("#shop-item-name").val() as string).trim();
            if (!name) return;
            const priceAmount = Math.max(0, parseInt(html.find("#shop-item-price").val() as string, 10) || 1);
            const currency = html.find("#shop-item-currency").val() as "cp" | "sp" | "gp" | "pp";
            const category = html.find("#shop-item-category").val() as string;
            const subcategory = (html.find("#shop-item-subcategory").val() as string).trim();
            const icon = (html.find("#custom-icon-value").val() as string) || "fa-sack";
            const description = (html.find("#shop-item-desc").val() as string).trim();

            const newItem: ItemDefinition = {
              id: foundry.utils.randomID(),
              name,
              category,
              subcategory,
              cost: { amount: priceAmount, currency },
              size: "normal",
              cannotBeStowed: false,
              unit: "piece",
              qualities: [],
              weight: 10,
              icon,
              tags: [],
              isCustom: true,
              description: "",
              ...(description ? { description } : {}),
              ...(html.find("#shop-item-edible").is(":checked") ? { edible: true } : {}),
            };
            if (encMode === "weight") {
              newItem.weight = Math.max(0, parseInt(html.find("#shop-item-weight").val() as string, 10) || 0);
            } else {
              newItem.size = html.find("#shop-item-size").val() as "tiny" | "normal" | "large";
            }

            const g = game as Game;
            const all = ((g.settings.get(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS) as Record<string, ItemDefinition[]>) ?? {});
            if (!all[shopName]) all[shopName] = [];
            all[shopName].push(newItem);
            await g.settings.set(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS, all);
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
  }
}
