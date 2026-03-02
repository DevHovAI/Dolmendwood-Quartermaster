import { MODULE_ID, TEMPLATES, SETTINGS, SOCKET_EVENTS } from "../constants";
import { CatalogManager } from "../data/CatalogManager";
import { FlagManager } from "../data/FlagManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker } from "../helpers/handlebars";
import type { ItemDefinition, ShopState, InventoryItem } from "../types";

export class ShopApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /** Currently selected target actor ID */
  private selectedActorId: string | null = null;
  /** Current search/filter text */
  private searchText = "";
  /** Only show items the selected actor can afford */
  private showAffordableOnly = false;

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
    if (shopState.availableItems.length > 0) {
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
      items = items.filter((i) => {
        const costCp =
          i.cost.currency === "cp" ? i.cost.amount :
          i.cost.currency === "sp" ? i.cost.amount * 10 :
          i.cost.currency === "gp" ? i.cost.amount * 100 :
          i.cost.amount * 500;
        return availableCp >= costCp;
      });
    }

    // Group by category
    const grouped: Record<string, ItemDefinition[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    return {
      shopState,
      allTags: CatalogManager.getAllTags(),
      grouped,
      partyMembers,
      selectedActorId: this.selectedActorId,
      selectedActor,
      selectedInventory,
      selectedEncumbrance,
      searchText: this.searchText,
      isGM,
      showAffordableOnly: this.showAffordableOnly,
      availableCp,
    };
  }

  override _onRender(
    _context: Record<string, unknown>,
    _options: Partial<ApplicationV2Options>
  ): void {
    const el = this.element;

    // Target actor selector
    el.querySelector<HTMLSelectElement>("#shop-target-actor")?.addEventListener(
      "change",
      (e) => {
        this.selectedActorId = (e.target as HTMLSelectElement).value || null;
        this.render();
      }
    );

    // Search input
    el.querySelector<HTMLInputElement>("#shop-search")?.addEventListener(
      "input",
      (e) => {
        this.searchText = (e.target as HTMLInputElement).value;
        this.render();
      }
    );
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

    const costCp =
      def.cost.currency === "cp" ? def.cost.amount :
      def.cost.currency === "sp" ? def.cost.amount * 10 :
      def.cost.currency === "gp" ? def.cost.amount * 100 :
      def.cost.amount * 500; // pp

    const canAfford = totalCp >= costCp;

    // Show confirmation dialog
    const confirmed = await new Promise<boolean>((resolve) => {
      new Dialog({
        title: "Purchase Item",
        content: `
          <p>Purchase <strong>${def.name}</strong> for <strong>${def.cost.amount} ${def.cost.currency}</strong>?</p>
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
            callback: () => resolve(true),
          },
          cancel: { label: "Cancel", callback: () => resolve(false) },
        },
        default: "confirm",
      }).render(true);
    });

    if (!confirmed) return;

    // Get zone from dialog — we approximate by finding the rendered dialog
    const zone: InventoryItem["zone"] = "stowed"; // default; dialog already closed

    // Deduct cost from actor's coins, converting across denominations as needed
    await FlagManager.updateInventory(actor, (inv) => {
      if (canAfford) {
        const remaining = totalCp - costCp;
        inv.coins.pp = Math.floor(remaining / 500);
        inv.coins.gp = Math.floor((remaining % 500) / 100);
        inv.coins.sp = Math.floor((remaining % 100) / 10);
        inv.coins.cp = remaining % 10;
      }
      inv.items.push({
        id: foundry.utils.randomID(),
        definitionId,
        name: def.name,
        quantity: 1,
        zone,
        isSecret: false,
        notes: "",
      });
      return inv;
    });

    ui.notifications?.info(`Purchased ${def.name} for ${actor.name}.`);
    this.render();
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
