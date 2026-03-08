import { MODULE_ID, TEMPLATES, SETTINGS, SOCKET_EVENTS } from "../constants";
type LocalHiddenMap = Record<string, string[]>;
import { CatalogManager } from "../data/CatalogManager";
import { FlagManager } from "../data/FlagManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker } from "../helpers/handlebars";
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
  /** Saved scroll position of .window-content — restored after each re-render */
  private _scrollTop = 0;

  /** Configure this shop instance from a Note marker */
  setConfig(name: string, categories: string[], priceFactor = 100): void {
    this.localName = name;
    this.localCategories = categories;
    this.priceFactor = priceFactor;
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
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.SHOP,
    },
  };

  override async _prepareContext(
    _options: Partial<ApplicationV2Options>
  ): Promise<Record<string, unknown>> {
    const g = game as Game;
    const shopState = g.settings.get(MODULE_ID, SETTINGS.SHOP_STATE) as ShopState;
    const partyMembers = (g.actors?.contents ?? []).filter((actor) =>
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );

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

    // Compute selected actor inventory + encumbrance
    let selectedInventory = undefined;
    let selectedEncumbrance = undefined;
    if (selectedActor) {
      selectedInventory = FlagManager.getInventory(selectedActor);
      selectedEncumbrance = calculateEncumbrance(
        selectedInventory,
        CatalogManager.getMap()
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

    // Group by category, marking hidden items for GM view and applying price factor
    const factor = this.priceFactor;
    const grouped: Record<string, (ItemDefinition & { isHidden?: boolean })[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      const adjustedCost = factor === 100 ? item.cost : {
        amount: Math.max(1, Math.round(item.cost.amount * factor / 100)),
        currency: item.cost.currency,
      };
      grouped[item.category].push({ ...item, cost: adjustedCost, isHidden: isGM && activeHiddenItems.includes(item.id) });
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
      showAffordableOnly: this.showAffordableOnly,
      availableCp,
      shopName: this.localName ?? "Shop",
      isLocalShop: this.localName !== null,
      priceFactor: this.priceFactor,
    };
  }

  override render(...args: Parameters<InstanceType<typeof foundry.applications.api.ApplicationV2>["render"]>): unknown {
    this._scrollTop = this.element?.querySelector<HTMLElement>(".window-content")?.scrollTop ?? 0;
    return super.render(...args);
  }

  override _onRender(
    _context: Record<string, unknown>,
    _options: Partial<ApplicationV2Options>
  ): void {
    const el = this.element;

    // Restore scroll position after re-render
    const wc = el.querySelector<HTMLElement>(".window-content");
    if (wc) wc.scrollTop = this._scrollTop;

    // Target actor selector
    el.querySelector<HTMLSelectElement>("#shop-target-actor")?.addEventListener(
      "change",
      (e) => {
        this.selectedActorId = (e.target as HTMLSelectElement).value || null;
        this.render();
      }
    );

    // Search input
    const searchEl = el.querySelector<HTMLInputElement>("#shop-search");
    searchEl?.addEventListener("input", (e) => {
      this.searchText = (e.target as HTMLInputElement).value;
      this.render();
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
    this.render();
  }

  private static async _onToggleTag(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const scrollTop = this.element?.querySelector<HTMLElement>(".window-content")?.scrollTop ?? this._scrollTop;
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
    this.render();
  }

  private static async _onPurchaseItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const definitionId = target.dataset.itemId!;
    const def = CatalogManager.getDefinition(definitionId);
    if (!def || !this.selectedActorId) return;

    const g = game as Game;
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
    const result = await new Promise<{ confirmed: boolean; zone: string }>((resolve) => {
      new Dialog({
        title: "Purchase Item",
        content: `
          <p>Purchase <strong>${def.name}</strong> for <strong>${adjustedAmount} ${def.cost.currency}</strong>?</p>
          <p>Target: <strong>${actor.name}</strong></p>
          ${!canAfford ? '<p class="warning"><i class="fas fa-exclamation-triangle"></i> Insufficient funds! Proceed anyway (GM override)?</p>' : ""}
          <div class="form-group">
            <label>Add to zone:</label>
            <select id="purchase-zone">
              <option value="equipped">Equipped</option>
              <option value="stowed" selected>Stowed</option>
              <option value="tiny">Tiny</option>
            </select>
          </div>
        `,
        buttons: {
          confirm: {
            label: canAfford ? "Purchase" : "Override & Purchase",
            icon: `<i class="fas ${canAfford ? "fa-shopping-cart" : "fa-exclamation-triangle"}"></i>`,
            callback: (html: JQuery) => {
              const zone = (html.find("#purchase-zone").val() as string) ?? "stowed";
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

    const payload: PurchasePayload = {
      actorId: this.selectedActorId,
      definitionId,
      quantity: 1,
      zone: result.zone,
      totalCost: costObj,
      gmOverride: !canAfford && isGM,
    };

    if (isGM) {
      await SocketHandler.processPurchase(payload);
      SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    } else {
      SocketHandler.emit(SOCKET_EVENTS.PURCHASE_ITEM, payload);
    }

    ui.notifications?.info(`Purchased ${def.name} for ${actor.name}.`);
  }

  private static _onGrantItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const definitionId = target.dataset.itemId!;
    const def = CatalogManager.getDefinition(definitionId);
    if (!def || !this.selectedActorId) {
      ui.notifications?.warn("Select a party member first.");
      return;
    }

    SocketHandler.emit(SOCKET_EVENTS.GM_GRANT, {
      actorId: this.selectedActorId,
      item: {
        definitionId,
        name: def.name,
        quantity: 1,
        zone: "stowed" as InventoryItem["zone"],
        isSecret: false,
        notes: "",
      },
    });
    ui.notifications?.info(`Granted ${def.name}.`);
  }

  private static async _onToggleHideItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const scrollTop = this.element?.querySelector<HTMLElement>(".window-content")?.scrollTop ?? this._scrollTop;
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
    this.render();
  }

  private static async _onToggleLocalHideItem(
    this: ShopApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!this.localName) return;
    const scrollTop = this.element?.querySelector<HTMLElement>(".window-content")?.scrollTop ?? this._scrollTop;
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
    this.render();
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
    super({
      title: "Grant Custom Item",
      content: `
        <form>
          <div class="form-group">
            <label>Item Name</label>
            <input type="text" id="custom-name" placeholder="Custom item name" />
          </div>
          <div class="form-group">
            <label>Size</label>
            <select id="custom-size">
              <option value="tiny">Tiny (0 slots)</option>
              <option value="normal" selected>Normal (1 slot)</option>
              <option value="large">Large (2 slots)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="custom-qty" value="1" min="1" />
          </div>
          <div class="form-group">
            <label>Zone</label>
            <select id="custom-zone">
              <option value="equipped">Equipped</option>
              <option value="stowed" selected>Stowed</option>
              <option value="tiny">Tiny</option>
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
            const size = html.find("#custom-size").val() as "tiny" | "normal" | "large";
            const qty = Math.max(1, parseInt(html.find("#custom-qty").val() as string, 10) || 1);
            const zone = html.find("#custom-zone").val() as InventoryItem["zone"];
            const icon = (html.find("#custom-icon-value").val() as string) || "fa-sack";
            const description = (html.find("#custom-desc").val() as string).trim();
            const isSecret = html.find("#custom-secret").prop("checked") as boolean;

            SocketHandler.emit(SOCKET_EVENTS.GM_GRANT, {
              actorId,
              item: {
                definitionId: "",
                name,
                quantity: qty,
                zone,
                isSecret,
                notes: "",
                customDefinition: {
                  size,
                  isCustom: true,
                  icon,
                  ...(description ? { description } : {}),
                },
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
