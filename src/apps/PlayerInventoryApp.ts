import { TEMPLATES, SOCKET_EVENTS } from "../constants";
import { ShopApp } from "./ShopApp";
import { FlagManager } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { SocketHandler } from "../socket/SocketHandler";
import type { InventoryItem } from "../types";

export class PlayerInventoryApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private actor: Actor;

  constructor(actor: Actor, options?: Partial<ApplicationV2Options>) {
    super(options);
    this.actor = actor;
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-player-inventory",
    window: {
      title: "Inventory",
      resizable: true,
    },
    position: {
      width: 520,
      height: 700,
    },
    classes: ["dolmenwood-party-inventory", "player-inventory"],
    actions: {
      addItem: PlayerInventoryApp._onAddItem,
      deleteItem: PlayerInventoryApp._onDeleteItem,
      toggleSecret: PlayerInventoryApp._onToggleSecret,
      giveItem: PlayerInventoryApp._onGiveItem,
      giveCoins: PlayerInventoryApp._onGiveCoins,
      grantCoins: PlayerInventoryApp._onGrantCoins,
      openShop: PlayerInventoryApp._onOpenShop,
      incrementQty: PlayerInventoryApp._onIncrementQty,
      decrementQty: PlayerInventoryApp._onDecrementQty,
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.PLAYER_INVENTORY,
    },
  };

  override get title(): string {
    return `${this.actor.name} — Inventory`;
  }

  override async _prepareContext(
    _options: Partial<ApplicationV2Options>
  ): Promise<Record<string, unknown>> {
    const g = game as Game;
    const inventory = FlagManager.getInventory(this.actor);
    const encumbrance = calculateEncumbrance(inventory, CatalogManager.getMap());
    const isGM = g.user?.isGM ?? false;
    const isOwner = this.actor.isOwner;

    // Filter secret items: hidden from non-GM non-owners
    const visibleItems = inventory.items.filter(
      (item) => !item.isSecret || isGM || isOwner
    );

    const zones = {
      tiny: visibleItems.filter((i) => i.zone === "tiny"),
      equipped: visibleItems.filter((i) => i.zone === "equipped"),
      stowed: visibleItems.filter((i) => i.zone === "stowed"),
    };

    // Enrich items with their catalog definition for display
    const enriched = (items: InventoryItem[]) =>
      items.map((item) => ({
        ...item,
        def: CatalogManager.getDefinition(item.definitionId),
      }));

    // Party members for "Give item" / "Give coins" dialogs
    const partyMembers = (g.actors?.contents ?? []).filter((actor) =>
      actor.id !== this.actor.id &&
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );

    return {
      actor: this.actor,
      actorId: this.actor.id,
      inventory,
      zones: {
        tiny: enriched(zones.tiny),
        equipped: enriched(zones.equipped),
        stowed: enriched(zones.stowed),
      },
      encumbrance,
      isGM,
      isOwner,
      canEdit: isGM,              // full edit: add/delete/move items, change coins — GM only
      canGive: isOwner && !isGM, // give items/coins to others — player only
      partyMembers,
      transactions: isGM ? FlagManager.getTransactions() : [],
    };
  }

  override _onRender(
    _context: Record<string, unknown>,
    _options: Partial<ApplicationV2Options>
  ): void {
    const el = this.element;

    // Zone change dropdowns
    el.querySelectorAll<HTMLSelectElement>(".item-zone-select").forEach((select) => {
      select.addEventListener("change", async (e) => {
        const itemId = (e.target as HTMLSelectElement).dataset.itemId!;
        const newZone = (e.target as HTMLSelectElement).value as InventoryItem["zone"];
        await FlagManager.updateInventory(this.actor, (inv) => {
          const item = inv.items.find((i) => i.id === itemId);
          if (item) item.zone = newZone;
          return inv;
        });
        this.render();
      });
    });

    // Notes editing
    el.querySelectorAll<HTMLInputElement>(".item-notes-input").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const itemId = (e.target as HTMLInputElement).dataset.itemId!;
        const notes = (e.target as HTMLInputElement).value;
        await FlagManager.updateInventory(this.actor, (inv) => {
          const item = inv.items.find((i) => i.id === itemId);
          if (item) item.notes = notes;
          return inv;
        });
      });
    });

    // Coin inputs
    el.querySelectorAll<HTMLInputElement>(".coin-input").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const currency = (e.target as HTMLInputElement).dataset.currency as
          | "cp"
          | "sp"
          | "gp"
          | "pp";
        const value = Math.max(0, parseInt((e.target as HTMLInputElement).value, 10) || 0);
        await FlagManager.updateInventory(this.actor, (inv) => {
          inv.coins[currency] = value;
          return inv;
        });
        this.render();
      });
    });
  }

  // ─── Action Handlers ──────────────────────────────────────────────────────

  private static async _onIncrementQty(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this.actor, (inv) => {
      const item = inv.items.find((i) => i.id === itemId);
      if (item) item.quantity = Math.max(1, item.quantity + 1);
      return inv;
    });
    this.render();
  }

  private static async _onDecrementQty(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this.actor, (inv) => {
      const item = inv.items.find((i) => i.id === itemId);
      if (item) item.quantity = Math.max(1, item.quantity - 1);
      return inv;
    });
    this.render();
  }

  private static async _onDeleteItem(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const confirmed = await Dialog.confirm({
      title: "Remove Item",
      content: "<p>Remove this item from inventory?</p>",
    });
    if (!confirmed) return;

    await FlagManager.updateInventory(this.actor, (inv) => {
      inv.items = inv.items.filter((i) => i.id !== itemId);
      return inv;
    });
    this.render();
  }

  private static async _onToggleSecret(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this.actor, (inv) => {
      const item = inv.items.find((i) => i.id === itemId);
      if (item) item.isSecret = !item.isSecret;
      return inv;
    });
    this.render();
  }

  private static _onAddItem(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const defaultZone = (target.dataset.zone ?? "equipped") as InventoryItem["zone"];
    new AddItemDialog(this.actor, defaultZone, () => this.render()).render(true);
  }

  private static _onGiveItem(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const itemId = target.dataset.itemId!;
    new GiveItemDialog(this.actor, itemId, () => this.render()).render(true);
  }

  private static _onGiveCoins(this: PlayerInventoryApp): void {
    new GiveCoinsDialog(this.actor, () => this.render()).render(true);
  }

  private static _onGrantCoins(this: PlayerInventoryApp): void {
    new GrantCoinsDialog(this.actor, () => this.render()).render(true);
  }

  private static _onOpenShop(this: PlayerInventoryApp): void {
    const existing = foundry.applications?.instances?.get("dolmenwood-shop");
    if (existing) {
      (existing as { render: (o: unknown) => void }).render({ force: true });
    } else {
      new ShopApp().render(true);
    }
  }
}

// ─── Add Item Dialog ──────────────────────────────────────────────────────────

class AddItemDialog extends Dialog {
  private actor: Actor;
  private zone: InventoryItem["zone"];
  private onComplete: () => void;

  constructor(actor: Actor, zone: InventoryItem["zone"], onComplete: () => void) {
    const catalogItems = CatalogManager.getAllDefinitions();
    const optionsByCategory: Record<string, string> = {};
    for (const item of catalogItems) {
      if (!optionsByCategory[item.category]) optionsByCategory[item.category] = "";
      optionsByCategory[item.category] += `<option value="${item.id}">${item.name} (${item.size}, ${item.cost.amount} ${item.cost.currency})</option>`;
    }

    let selectContent = "";
    for (const [cat, opts] of Object.entries(optionsByCategory)) {
      selectContent += `<optgroup label="${cat}">${opts}</optgroup>`;
    }

    super({
      title: "Add Item to Inventory",
      content: `
        <form>
          <div class="form-group">
            <label>Item</label>
            <select id="add-item-select">${selectContent}</select>
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="add-item-qty" value="1" min="1" />
          </div>
          <div class="form-group">
            <label>Zone</label>
            <select id="add-item-zone">
              <option value="equipped" ${zone === "equipped" ? "selected" : ""}>Equipped</option>
              <option value="stowed" ${zone === "stowed" ? "selected" : ""}>Stowed</option>
              <option value="tiny" ${zone === "tiny" ? "selected" : ""}>Tiny</option>
            </select>
          </div>
          <hr/>
          <details>
            <summary>Add Custom Item Instead</summary>
            <div class="form-group">
              <label>Custom Name</label>
              <input type="text" id="add-custom-name" placeholder="Custom item name" />
            </div>
            <div class="form-group">
              <label>Custom Size</label>
              <select id="add-custom-size">
                <option value="tiny">Tiny (0 slots)</option>
                <option value="normal" selected>Normal (1 slot)</option>
                <option value="large">Large (2 slots)</option>
              </select>
            </div>
          </details>
        </form>
      `,
      buttons: {
        add: {
          label: "Add",
          callback: async (html: JQuery) => {
            const customName = (html.find("#add-custom-name").val() as string).trim();
            const qty = Math.max(1, parseInt(html.find("#add-item-qty").val() as string, 10) || 1);
            const selectedZone = html.find("#add-item-zone").val() as InventoryItem["zone"];

            if (customName) {
              // Custom item
              const customSize = html.find("#add-custom-size").val() as "tiny" | "normal" | "large";
              await FlagManager.updateInventory(actor, (inv) => {
                inv.items.push({
                  id: foundry.utils.randomID(),
                  definitionId: "",
                  name: customName,
                  quantity: qty,
                  zone: selectedZone,
                  isSecret: false,
                  notes: "",
                  customDefinition: { size: customSize, isCustom: true },
                });
                return inv;
              });
            } else {
              // Catalog item
              const definitionId = html.find("#add-item-select").val() as string;
              const def = CatalogManager.getDefinition(definitionId);
              if (!def) return;
              await FlagManager.updateInventory(actor, (inv) => {
                inv.items.push({
                  id: foundry.utils.randomID(),
                  definitionId,
                  name: def.name,
                  quantity: qty,
                  zone: selectedZone,
                  isSecret: false,
                  notes: "",
                });
                return inv;
              });
            }
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });
    this.actor = actor;
    this.zone = zone;
    this.onComplete = onComplete;
  }
}

// ─── Give Item Dialog ─────────────────────────────────────────────────────────

class GiveItemDialog extends Dialog {
  constructor(fromActor: Actor, itemId: string, onComplete: () => void) {
    const g = game as Game;
    const partyMembers = (g.actors?.contents ?? []).filter((actor) =>
      actor.id !== fromActor.id &&
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );

    const memberOptions = partyMembers
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const inventory = FlagManager.getInventory(fromActor);
    const item = inventory.items.find((i) => i.id === itemId);
    if (!item) return;

    super({
      title: `Give ${item.name}`,
      content: `
        <form>
          <div class="form-group">
            <label>Give to</label>
            <select id="give-item-target">${memberOptions}</select>
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="give-item-qty" value="1" min="1" max="${item.quantity}" />
          </div>
        </form>
      `,
      buttons: {
        give: {
          label: "Give",
          callback: async (html: JQuery) => {
            const toActorId = html.find("#give-item-target").val() as string;
            const qty = Math.min(
              item.quantity,
              Math.max(1, parseInt(html.find("#give-item-qty").val() as string, 10) || 1)
            );
            const toActor = g.actors?.get(toActorId);
            if (!toActor) return;

            // Remove quantity from giver
            await FlagManager.updateInventory(fromActor, (inv) => {
              const src = inv.items.find((i) => i.id === itemId);
              if (src) {
                src.quantity -= qty;
                if (src.quantity <= 0) inv.items = inv.items.filter((i) => i.id !== itemId);
              }
              return inv;
            });

            // Add to recipient via socket (so GM handles write if needed)
            SocketHandler.emit(SOCKET_EVENTS.GM_GRANT, {
              actorId: toActorId,
              item: {
                definitionId: item.definitionId,
                name: item.name,
                quantity: qty,
                zone: item.zone,
                isSecret: false,
                notes: "",
                customDefinition: item.customDefinition,
              },
            });

            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "give",
    });
  }
}

// ─── Give Coins Dialog ────────────────────────────────────────────────────────


class GiveCoinsDialog extends Dialog {
  constructor(fromActor: Actor, onComplete: () => void) {
    const g = game as Game;
    const partyMembers = (g.actors?.contents ?? []).filter((actor) =>
      actor.id !== fromActor.id &&
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );

    if (partyMembers.length === 0) {
      super({
        title: "Give Coins",
        content: "<p>No other party members to give coins to.</p>",
        buttons: { ok: { label: "OK" } },
        default: "ok",
      });
      return;
    }

    const memberOptions = partyMembers
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const inv = FlagManager.getInventory(fromActor);

    super({
      title: "Give Coins",
      content: `
        <form>
          <div class="form-group">
            <label>Give to</label>
            <select id="give-coins-target">${memberOptions}</select>
          </div>
          <div class="form-group">
            <label>PP (have: ${inv.coins.pp})</label>
            <input type="number" id="give-pp" value="0" min="0" max="${inv.coins.pp}" />
          </div>
          <div class="form-group">
            <label>GP (have: ${inv.coins.gp})</label>
            <input type="number" id="give-gp" value="0" min="0" max="${inv.coins.gp}" />
          </div>
          <div class="form-group">
            <label>SP (have: ${inv.coins.sp})</label>
            <input type="number" id="give-sp" value="0" min="0" max="${inv.coins.sp}" />
          </div>
          <div class="form-group">
            <label>CP (have: ${inv.coins.cp})</label>
            <input type="number" id="give-cp" value="0" min="0" max="${inv.coins.cp}" />
          </div>
        </form>
      `,
      buttons: {
        give: {
          label: "Give",
          callback: (html: JQuery) => {
            const toActorId = html.find("#give-coins-target").val() as string;
            const pp = Math.min(inv.coins.pp, Math.max(0, parseInt(html.find("#give-pp").val() as string, 10) || 0));
            const gp = Math.min(inv.coins.gp, Math.max(0, parseInt(html.find("#give-gp").val() as string, 10) || 0));
            const sp = Math.min(inv.coins.sp, Math.max(0, parseInt(html.find("#give-sp").val() as string, 10) || 0));
            const cp = Math.min(inv.coins.cp, Math.max(0, parseInt(html.find("#give-cp").val() as string, 10) || 0));
            if (pp + gp + sp + cp === 0) return;
            SocketHandler.emit(SOCKET_EVENTS.GIVE_COINS, {
              fromActorId: fromActor.id,
              toActorId,
              cp, sp, gp, pp,
            });
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "give",
    });
  }
}

// ─── Grant Coins Dialog (GM only) ────────────────────────────────────────────

class GrantCoinsDialog extends Dialog {
  constructor(toActor: Actor, onComplete: () => void) {
    super({
      title: `Grant Coins to ${toActor.name}`,
      content: `
        <form>
          <div class="form-group">
            <label>PP</label>
            <input type="number" id="grant-pp" value="0" min="0" />
          </div>
          <div class="form-group">
            <label>GP</label>
            <input type="number" id="grant-gp" value="0" min="0" />
          </div>
          <div class="form-group">
            <label>SP</label>
            <input type="number" id="grant-sp" value="0" min="0" />
          </div>
          <div class="form-group">
            <label>CP</label>
            <input type="number" id="grant-cp" value="0" min="0" />
          </div>
        </form>
      `,
      buttons: {
        grant: {
          label: "Grant",
          callback: async (html: JQuery) => {
            const pp = Math.max(0, parseInt(html.find("#grant-pp").val() as string, 10) || 0);
            const gp = Math.max(0, parseInt(html.find("#grant-gp").val() as string, 10) || 0);
            const sp = Math.max(0, parseInt(html.find("#grant-sp").val() as string, 10) || 0);
            const cp = Math.max(0, parseInt(html.find("#grant-cp").val() as string, 10) || 0);
            if (pp + gp + sp + cp === 0) return;
            await FlagManager.updateInventory(toActor, (inv) => {
              inv.coins.pp += pp;
              inv.coins.gp += gp;
              inv.coins.sp += sp;
              inv.coins.cp += cp;
              return inv;
            });
            ui.notifications?.info(`Granted coins to ${toActor.name}.`);
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "grant",
    });
  }
}
