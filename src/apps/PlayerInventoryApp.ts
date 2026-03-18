import { TEMPLATES, SOCKET_EVENTS, SETTINGS, MODULE_ID } from "../constants";
import { ShopApp } from "./ShopApp";
import { buildPartySummary } from "./PartyOverviewApp";
import { FlagManager, totalZoneCoins, addCoinsToZone } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker, buildColorPickerHTML, activateColorPicker, ZONE_ICONS } from "../helpers/handlebars";
import type { InventoryItem, ExtraZone, ZoneCoins } from "../types";

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
      incrementUses: PlayerInventoryApp._onIncrementUses,
      decrementUses: PlayerInventoryApp._onDecrementUses,
      addExtraZone: PlayerInventoryApp._onAddExtraZone,
      deleteExtraZone: PlayerInventoryApp._onDeleteExtraZone,
      renameExtraZone: PlayerInventoryApp._onRenameExtraZone,
      moveZoneCoins: PlayerInventoryApp._onMoveZoneCoins,
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
    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const isGM = g.user?.isGM ?? false;
    const isOwner = this.actor.isOwner;

    // Extra zones (needed early for coinsByZone normalization)
    const allExtraZones = inventory.extraZones ?? [];

    // Build per-zone coin map (normalised: all zone IDs present with default 0s)
    const rawCoinsByZone = inventory.coinsByZone ?? { equipped: { ...inventory.coins } };
    const coinsByZone: Record<string, ZoneCoins> = {};
    for (const zoneId of ["tiny", "equipped", "stowed", ...allExtraZones.map(z => z.id)]) {
      coinsByZone[zoneId] = rawCoinsByZone[zoneId] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
    }

    const encumbrance = calculateEncumbrance(inventory, CatalogManager.getMap(), encMode);

    // Filter secret items: hidden from non-GM non-owners
    // In weight mode filter container items (grantsStorageZone) — they appear as storage zone headers
    // Also filter zone-only animals/vehicles — they appear as vehicle zone headers
    const visibleItems = inventory.items.filter((item) => {
      if (item.isSecret && !isGM && !isOwner) return false;
      const def = CatalogManager.getDefinition(item.definitionId);
      if (def?.grantsZone && def?.category === "Animals & Vehicles") return false;
      if (def?.grantsStorageZone && encMode === "weight") return false;
      return true;
    });

    const zones = {
      tiny: visibleItems.filter((i) => i.zone === "tiny"),
      equipped: visibleItems.filter((i) => i.zone === "equipped"),
      stowed: visibleItems.filter((i) => i.zone === "stowed"),
    };

    // Enrich items with catalog def + computed display fields
    const enriched = (items: InventoryItem[]) =>
      items.map((item) => {
        const def = CatalogManager.getDefinition(item.definitionId);
        const uses = def?.maxUses !== undefined && item.uses === undefined ? def.maxUses : item.uses;
        const effectiveWeight = item.customDefinition?.weight ?? def?.weight ?? 0;
        return { ...item, uses, def, effectiveWeight };
      });

    const vehicleZones = allExtraZones
      .filter((ez) => !ez.type || ez.type === "vehicle")
      .map((ez: ExtraZone) => {
        const zoneItems = visibleItems.filter((i) => i.zone === ez.id);
        const zoneCoins = coinsByZone[ez.id] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
        const coinWeight = zoneCoins.cp + zoneCoins.sp + zoneCoins.gp + zoneCoins.pp;
        const usedWeight = zoneItems.reduce((acc, i) => {
          const def = CatalogManager.getDefinition(i.definitionId);
          return acc + (i.customDefinition?.weight ?? def?.weight ?? 0) * i.quantity;
        }, 0) + coinWeight;

        // Find the animal item definition that granted this zone
        let animalDescription: string | undefined;
        let animalSubcategory: string | undefined;
        for (const item of inventory.items) {
          const def = CatalogManager.getDefinition(item.definitionId);
          if (def?.grantsZone?.name === ez.name) {
            animalDescription = def.description;
            animalSubcategory = def.subcategory;
            break;
          }
        }

        // Look up speed info from encumbrance result
        const speedInfo = encumbrance.animalSpeeds.find((a) => a.zoneName === ez.name);

        return {
          ...ez,
          items: enriched(zoneItems),
          usedSlots: zoneItems.reduce((acc, i) => {
            const def = CatalogManager.getDefinition(i.definitionId);
            const size = i.customDefinition?.size ?? def?.size ?? "normal";
            return acc + (size === "large" ? 2 : size === "normal" ? 1 : 0) * i.quantity;
          }, 0),
          usedWeight,
          animalDescription,
          animalSubcategory,
          speedInfo,
        };
      });

    const storageZones = allExtraZones
      .filter((ez) => ez.type === "storage")
      .map((ez: ExtraZone) => {
        const zoneItems = visibleItems.filter((i) => i.zone === ez.id);
        const zoneCoins = coinsByZone[ez.id] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
        const coinWeight = zoneCoins.cp + zoneCoins.sp + zoneCoins.gp + zoneCoins.pp;
        return {
          ...ez,
          items: enriched(zoneItems),
          usedWeight: zoneItems.reduce((acc, i) => {
            const def = CatalogManager.getDefinition(i.definitionId);
            return acc + (i.customDefinition?.weight ?? def?.weight ?? 0) * i.quantity;
          }, 0) + coinWeight,
        };
      });

    // Party members for "Give item" / "Give coins" dialogs
    const partyMembers = (g.actors?.contents ?? []).filter((actor) =>
      actor.id !== this.actor.id &&
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );

    const allPartyActors = (g.actors?.contents ?? []).filter((actor) =>
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );
    const partySummary = buildPartySummary(allPartyActors, isGM, g.user ?? null, undefined, encMode);

    return {
      actor: this.actor,
      actorId: this.actor.id,
      inventory,
      encMode,
      zones: {
        tiny: enriched(zones.tiny),
        equipped: enriched(zones.equipped),
        stowed: enriched(zones.stowed),
      },
      extraZones: allExtraZones,
      storageZones,
      vehicleZones,
      coinsByZone,
      encumbrance,
      isGM,
      isOwner,
      canEdit: isGM,
      canAddItem: isOwner && !isGM,
      canGive: isOwner && !isGM,
      partyMembers,
      partySummary,
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
        const sel = e.target as HTMLSelectElement;
        const itemId = sel.dataset.itemId!;
        const newZone = sel.value as InventoryItem["zone"];
        const inventory = FlagManager.getInventory(this.actor);
        const item = inventory.items.find((i) => i.id === itemId);

        // Enforce storage zone capacity in weight mode
        const targetZone = (inventory.extraZones ?? []).find((ez) => ez.id === newZone);
        if (targetZone?.type === "storage" && targetZone.weightCapacity > 0 && item) {
          const def = CatalogManager.getDefinition(item.definitionId);
          const itemWeight = (item.customDefinition?.weight ?? def?.weight ?? 0) * item.quantity;
          const currentZoneWeight = inventory.items
            .filter((i) => i.zone === newZone && i.id !== itemId)
            .reduce((acc, i) => {
              const d = CatalogManager.getDefinition(i.definitionId);
              return acc + (i.customDefinition?.weight ?? d?.weight ?? 0) * i.quantity;
            }, 0);
          if (currentZoneWeight + itemWeight > targetZone.weightCapacity) {
            ui.notifications?.warn(
              `"${targetZone.name}" can hold ${targetZone.weightCapacity} wt. ` +
              `Currently ${currentZoneWeight} wt; item is ${itemWeight} wt.`
            );
            sel.value = item.zone; // reset select to current zone
            return;
          }
        }

        // Enforce belt pouch weight limit (≤ 10 wt)
        if (targetZone?.isBeltPouch && item) {
          const def = CatalogManager.getDefinition(item.definitionId);
          const itemWeight = item.customDefinition?.weight ?? def?.weight ?? 0;
          if (itemWeight > 10) {
            ui.notifications?.warn(`Only items weighing 10 wt or less fit in a belt pouch (item weighs ${itemWeight} wt).`);
            sel.value = item.zone;
            return;
          }
        }

        await FlagManager.updateInventory(this.actor, (inv) => {
          const i = inv.items.find((i) => i.id === itemId);
          if (i) i.zone = newZone;
          return inv;
        });
        this.render();
      });
    });

    // Notes editing
    el.querySelectorAll<HTMLTextAreaElement>(".item-notes-input").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const itemId = (e.target as HTMLTextAreaElement).dataset.itemId!;
        const notes = (e.target as HTMLTextAreaElement).value;
        await FlagManager.updateInventory(this.actor, (inv) => {
          const item = inv.items.find((i) => i.id === itemId);
          if (item) item.notes = notes;
          return inv;
        });
      });
    });

    // Zone coin inputs (GM only — editable fields in zone coin purses)
    el.querySelectorAll<HTMLInputElement>(".zone-coin-input").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const inp = e.target as HTMLInputElement;
        const zoneId = inp.dataset.zoneId!;
        const currency = inp.dataset.currency as "cp" | "sp" | "gp" | "pp";
        // parseInt("0") is falsy, so use explicit null-check instead of || 0
        const parsed = parseInt(inp.value, 10);
        const value = Math.max(0, Number.isNaN(parsed) ? 0 : parsed);
        await FlagManager.updateInventory(this.actor, (inv) => {
          inv.coinsByZone ??= { equipped: { ...inv.coins } };
          inv.coinsByZone[zoneId] ??= { cp: 0, sp: 0, gp: 0, pp: 0 };
          inv.coinsByZone[zoneId][currency] = value;
          return inv;
        });
        this.render({ force: true } as Parameters<typeof this.render>[0]);
      });
    });

    // Drag-and-drop: items between zones, zones reorder
    this._setupItemDragDrop(el);
    this._setupZoneDragDrop(el);
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

  private static async _onIncrementUses(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this.actor, (inv) => {
      const item = inv.items.find((i) => i.id === itemId);
      if (!item) return inv;
      const def = CatalogManager.getDefinition(item.definitionId);
      const maxUses = def?.maxUses ?? 0;
      const current = item.uses ?? maxUses;
      item.uses = Math.min(maxUses, current + 1);
      return inv;
    });
    this.render();
  }

  private static async _onDecrementUses(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this.actor, (inv) => {
      const item = inv.items.find((i) => i.id === itemId);
      if (!item) return inv;
      const def = CatalogManager.getDefinition(item.definitionId);
      const maxUses = def?.maxUses ?? 0;
      const current = item.uses ?? maxUses;
      item.uses = Math.max(0, current - 1);
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
    const defaultZone = (target.dataset.zone ?? "stowed") as InventoryItem["zone"];
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    if ((game as Game).user?.isGM) {
      new AddItemDialog(this.actor, defaultZone, encMode, () => this.render()).render(true);
    } else {
      new AddCustomItemDialog(this.actor, defaultZone, encMode, () => this.render()).render(true);
    }
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

  private static _onAddExtraZone(this: PlayerInventoryApp): void {
    if (!(game as Game).user?.isGM) return;
    new AddExtraZoneDialog(this.actor, () => this.render()).render(true);
  }

  private static async _onDeleteExtraZone(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!(game as Game).user?.isGM) return;
    const g = game as Game;
    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const fallbackZone = encMode === "weight" ? "equipped" : "stowed";
    const fallbackLabel = encMode === "weight" ? "Equipped" : "Stowed";
    const zoneId = target.dataset.zoneId!;
    const confirmed = await Dialog.confirm({
      title: "Delete Storage Zone",
      content: `<p>Delete this zone? All items in it will be moved to <strong>${fallbackLabel}</strong>.</p>`,
    });
    if (!confirmed) return;

    await FlagManager.updateInventory(this.actor, (inv) => {
      const zone = (inv.extraZones ?? []).find((ez) => ez.id === zoneId);
      for (const item of inv.items) {
        if (item.zone === zoneId) item.zone = fallbackZone;
      }
      // Remove the container item that created this zone.
      // New zones track via itemId; old zones fall back to matching by catalog zone name.
      if (zone?.itemId) {
        inv.items = inv.items.filter((i) => i.id !== zone.itemId);
      } else if (zone) {
        inv.items = inv.items.filter((i) => {
          const def = CatalogManager.getDefinition(i.definitionId);
          return !(def?.grantsStorageZone?.name === zone.name || def?.grantsZone?.name === zone.name);
        });
      }
      inv.extraZones = (inv.extraZones ?? []).filter((ez) => ez.id !== zoneId);
      return inv;
    });
    this.render();
  }
  private static async _onRenameExtraZone(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const zoneId = target.dataset.zoneId!;
    const inventory = FlagManager.getInventory(this.actor);
    const zone = (inventory.extraZones ?? []).find((ez) => ez.id === zoneId);
    if (!zone) return;
    new RenameZoneDialog(this.actor, zoneId, zone.name, zone.icon, zone.color, () => this.render()).render(true);
  }

  private static _onMoveZoneCoins(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const fromZoneId = target.dataset.zoneId!;
    const inventory = FlagManager.getInventory(this.actor);
    new MoveCoinsBetweenZonesDialog(this.actor, fromZoneId, inventory, () => this.render()).render(true);
  }

  // ─── Drag-and-drop helpers ──────────────────────────────────────────────────

  private async _moveItemToZone(itemId: string, newZone: string): Promise<void> {
    const inventory = FlagManager.getInventory(this.actor);
    const item = inventory.items.find((i) => i.id === itemId);
    if (!item || item.zone === newZone) return;

    const targetZone = (inventory.extraZones ?? []).find((ez) => ez.id === newZone);

    // Enforce storage zone weight capacity
    if (targetZone?.type === "storage" && targetZone.weightCapacity > 0) {
      const def = CatalogManager.getDefinition(item.definitionId);
      const itemWeight = (item.customDefinition?.weight ?? def?.weight ?? 0) * item.quantity;
      const currentZoneWeight = inventory.items
        .filter((i) => i.zone === newZone && i.id !== itemId)
        .reduce((acc, i) => {
          const d = CatalogManager.getDefinition(i.definitionId);
          return acc + (i.customDefinition?.weight ?? d?.weight ?? 0) * i.quantity;
        }, 0);
      if (currentZoneWeight + itemWeight > targetZone.weightCapacity) {
        ui.notifications?.warn(
          `"${targetZone.name}" can hold ${targetZone.weightCapacity} wt. ` +
          `Currently ${currentZoneWeight} wt; item is ${itemWeight} wt.`
        );
        return;
      }
    }

    // Enforce belt pouch weight limit (≤ 10 wt per item)
    if (targetZone?.isBeltPouch) {
      const def = CatalogManager.getDefinition(item.definitionId);
      const itemWeight = item.customDefinition?.weight ?? def?.weight ?? 0;
      if (itemWeight > 10) {
        ui.notifications?.warn(`Only items weighing 10 wt or less fit in a belt pouch (item weighs ${itemWeight} wt).`);
        return;
      }
    }

    await FlagManager.updateInventory(this.actor, (inv) => {
      const i = inv.items.find((i) => i.id === itemId);
      if (i) i.zone = newZone;
      return inv;
    });
    this.render();
  }

  private _setupItemDragDrop(el: HTMLElement): void {
    el.querySelectorAll<HTMLElement>(".item-row[draggable='true']").forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        e.dataTransfer!.setData("text/plain", row.dataset.itemId!);
        e.dataTransfer!.effectAllowed = "move";
        row.classList.add("item-dragging");
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("item-dragging");
        el.querySelectorAll(".item-drop-zone").forEach((z) => z.classList.remove("item-drag-over"));
      });
    });

    el.querySelectorAll<HTMLElement>(".item-drop-zone").forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        if (e.dataTransfer?.types.includes("text/plain")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      });
      zone.addEventListener("dragenter", (e) => {
        if (e.dataTransfer?.types.includes("text/plain")) {
          e.preventDefault();
          zone.classList.add("item-drag-over");
        }
      });
      zone.addEventListener("dragleave", (e) => {
        if (!zone.contains(e.relatedTarget as Node))
          zone.classList.remove("item-drag-over");
      });
      zone.addEventListener("drop", async (e) => {
        e.preventDefault();
        zone.classList.remove("item-drag-over");
        if (!e.dataTransfer?.types.includes("text/plain")) return;
        const itemId = e.dataTransfer.getData("text/plain");
        const newZone = zone.dataset.zoneId!;
        if (itemId && newZone) await this._moveItemToZone(itemId, newZone);
      });
    });
  }

  private _setupZoneDragDrop(el: HTMLElement): void {
    el.querySelectorAll<HTMLElement>(".zone-drag-handle").forEach((handle) => {
      handle.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        const section = handle.closest<HTMLElement>(".inv-zone-section");
        if (!section) return;
        e.dataTransfer!.setData("application/qm-zone", section.dataset.zoneDragId!);
        e.dataTransfer!.effectAllowed = "move";
        section.classList.add("zone-dragging");
      });
      handle.addEventListener("dragend", () => {
        el.querySelectorAll(".inv-zone-section").forEach((s) =>
          s.classList.remove("zone-dragging", "zone-drop-target")
        );
      });
    });

    el.querySelectorAll<HTMLElement>(".inv-zone-section.inv-zone-extra").forEach((section) => {
      section.addEventListener("dragover", (e) => {
        if (e.dataTransfer?.types.includes("application/qm-zone")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      });
      section.addEventListener("dragenter", (e) => {
        if (e.dataTransfer?.types.includes("application/qm-zone")) {
          e.preventDefault();
          section.classList.add("zone-drop-target");
        }
      });
      section.addEventListener("dragleave", (e) => {
        if (!section.contains(e.relatedTarget as Node))
          section.classList.remove("zone-drop-target");
      });
      section.addEventListener("drop", async (e) => {
        if (!e.dataTransfer?.types.includes("application/qm-zone")) return;
        e.preventDefault();
        section.classList.remove("zone-drop-target");
        const draggedId = e.dataTransfer.getData("application/qm-zone");
        const targetId = section.dataset.zoneDragId;
        if (!targetId || draggedId === targetId) return;
        await this._reorderZone(draggedId, targetId);
      });
    });
  }

  private async _reorderZone(draggedId: string, targetId: string): Promise<void> {
    const inventory = FlagManager.getInventory(this.actor);
    const zones = inventory.extraZones ?? [];
    const dragged = zones.find((z) => z.id === draggedId);
    const target = zones.find((z) => z.id === targetId);
    // Only allow reordering within the same zone type
    if ((dragged?.type ?? "vehicle") !== (target?.type ?? "vehicle")) return;
    await FlagManager.updateInventory(this.actor, (inv) => {
      const zs = inv.extraZones ?? [];
      const fromIdx = zs.findIndex((z) => z.id === draggedId);
      const toIdx = zs.findIndex((z) => z.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return inv;
      const [moved] = zs.splice(fromIdx, 1);
      zs.splice(toIdx, 0, moved);
      inv.extraZones = zs;
      return inv;
    });
    this.render();
  }
}

// ─── Add Item Dialog ──────────────────────────────────────────────────────────

class AddItemDialog extends Dialog {
  private actor: Actor;
  private zone: InventoryItem["zone"];
  private onComplete: () => void;

  constructor(actor: Actor, zone: InventoryItem["zone"], encMode: "slots" | "weight", onComplete: () => void) {
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

    const customSizeOrWeightField = encMode === "weight"
      ? `<div class="form-group">
              <label>Custom Weight (coin wt)</label>
              <input type="number" id="add-custom-weight" value="10" min="0" />
            </div>`
      : `<div class="form-group">
              <label>Custom Size</label>
              <select id="add-custom-size">
                <option value="tiny">Tiny (0 slots)</option>
                <option value="normal" selected>Normal (1 slot)</option>
                <option value="large">Large (2 slots)</option>
              </select>
            </div>`;

    const zoneOptions = encMode === "weight"
      ? `<option value="equipped" ${zone === "equipped" ? "selected" : ""}>Equipped</option>`
      : `<option value="equipped" ${zone === "equipped" ? "selected" : ""}>Equipped</option>
              <option value="stowed" ${zone === "stowed" ? "selected" : ""}>Stowed</option>
              <option value="tiny" ${zone === "tiny" ? "selected" : ""}>Belt Pouch</option>`;

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
              ${zoneOptions}
            </select>
          </div>
          <hr/>
          <details>
            <summary>Add Custom Item Instead</summary>
            <div class="form-group">
              <label>Custom Name</label>
              <input type="text" id="add-custom-name" placeholder="Custom item name" />
            </div>
            ${customSizeOrWeightField}
            <div class="form-group">
              <label>Icon</label>
              ${buildIconPickerHTML()}
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="add-custom-desc" placeholder="Optional description…" rows="2" style="width:100%;resize:vertical;"></textarea>
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
              const customIcon = (html.find("#custom-icon-value").val() as string) || "fa-sack";
              const customDesc = (html.find("#add-custom-desc").val() as string).trim();
              const customDef: Partial<import("../types").ItemDefinition> = { isCustom: true, icon: customIcon };
              if (encMode === "weight") {
                customDef.weight = Math.max(0, parseInt(html.find("#add-custom-weight").val() as string, 10) || 0);
                customDef.size = "normal";
              } else {
                customDef.size = html.find("#add-custom-size").val() as "tiny" | "normal" | "large";
              }
              if (customDesc) customDef.description = customDesc;
              await FlagManager.updateInventory(actor, (inv) => {
                inv.items.push({
                  id: foundry.utils.randomID(),
                  definitionId: "",
                  name: customName,
                  quantity: qty,
                  zone: selectedZone,
                  isSecret: false,
                  notes: "",
                  customDefinition: customDef,
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

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
  }
}

// ─── Add Custom Item Dialog (player-facing) ───────────────────────────────────

class AddCustomItemDialog extends Dialog {
  constructor(actor: Actor, zone: InventoryItem["zone"], encMode: "slots" | "weight", onComplete: () => void) {
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
    const zoneOptions = encMode === "weight"
      ? `<option value="equipped" ${zone === "equipped" ? "selected" : ""}>Equipped</option>`
      : `<option value="equipped" ${zone === "equipped" ? "selected" : ""}>Equipped</option>
              <option value="stowed" ${zone === "stowed" ? "selected" : ""}>Stowed</option>
              <option value="tiny" ${zone === "tiny" ? "selected" : ""}>Belt Pouch</option>`;
    super({
      title: "Add Custom Item",
      content: `
        <form>
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="custom-name" placeholder="Item name" />
          </div>
          ${sizeOrWeightField}
          <div class="form-group">
            <label>Zone</label>
            <select id="custom-zone">
              ${zoneOptions}
            </select>
          </div>
          <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="custom-qty" value="1" min="1" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            ${buildIconPickerHTML()}
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="custom-desc" placeholder="Optional description…" rows="2" style="width:100%;resize:vertical;"></textarea>
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: "Add",
          callback: async (html: JQuery) => {
            const name = (html.find("#custom-name").val() as string).trim();
            if (!name) { ui.notifications?.warn("Item name is required."); return; }
            const selectedZone = html.find("#custom-zone").val() as InventoryItem["zone"];
            const qty = Math.max(1, parseInt(html.find("#custom-qty").val() as string, 10) || 1);
            const icon = (html.find("#custom-icon-value").val() as string) || "fa-sack";
            const description = (html.find("#custom-desc").val() as string).trim();
            const customDef: Partial<import("../types").ItemDefinition> = { isCustom: true, icon };
            if (encMode === "weight") {
              customDef.weight = Math.max(0, parseInt(html.find("#custom-weight").val() as string, 10) || 0);
              customDef.size = "normal";
            } else {
              customDef.size = html.find("#custom-size").val() as "tiny" | "normal" | "large";
            }
            if (description) customDef.description = description;
            await FlagManager.updateInventory(actor, (inv) => {
              inv.items.push({
                id: foundry.utils.randomID(),
                definitionId: "",
                name,
                quantity: qty,
                zone: selectedZone,
                isSecret: false,
                notes: "",
                customDefinition: customDef,
              });
              return inv;
            });
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
            // Normalize extra zones to stowed since recipient doesn't have those zones
            const safeZone = (["tiny", "equipped", "stowed"] as string[]).includes(item.zone)
              ? item.zone as "tiny" | "equipped" | "stowed"
              : "stowed";
            SocketHandler.emit(SOCKET_EVENTS.GM_GRANT, {
              actorId: toActorId,
              item: {
                definitionId: item.definitionId,
                name: item.name,
                quantity: qty,
                zone: safeZone,
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

// ─── Add Extra Zone Dialog (GM only) ─────────────────────────────────────────

class AddExtraZoneDialog extends Dialog {
  constructor(actor: Actor, onComplete: () => void) {
    super({
      title: "Add Storage Zone",
      content: `
        <form>
          <div class="form-group">
            <label>Zone Name</label>
            <input type="text" id="extra-zone-name" placeholder="e.g. Pack Horse" />
          </div>
          <div class="form-group">
            <label>Max Slots</label>
            <input type="number" id="extra-zone-slots" value="10" min="1" max="999" />
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: "Add Zone",
          callback: async (html: JQuery) => {
            const name = (html.find("#extra-zone-name").val() as string).trim();
            if (!name) { ui.notifications?.warn("Zone name is required."); return; }
            const maxSlots = Math.max(1, parseInt(html.find("#extra-zone-slots").val() as string, 10) || 10);
            await FlagManager.updateInventory(actor, (inv) => {
              if (!inv.extraZones) inv.extraZones = [];
              inv.extraZones.push({ id: foundry.utils.randomID(), name, maxSlots, weightCapacity: 0 });
              return inv;
            });
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    });
  }
}

// ─── Rename Zone Dialog (owner) ──────────────────────────────────────────────

class RenameZoneDialog extends Dialog {
  constructor(
    actor: Actor,
    zoneId: string,
    currentName: string,
    currentIcon: string | undefined,
    currentColor: string | undefined,
    onComplete: () => void
  ) {
    super({
      title: "Rename Storage Zone",
      content: `
        <form>
          <div class="form-group">
            <label>Zone Name</label>
            <input type="text" id="rename-zone-name" value="${currentName}" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            ${buildIconPickerHTML(currentIcon ?? "fa-backpack", ZONE_ICONS)}
          </div>
          <div class="form-group">
            <label>Color</label>
            ${buildColorPickerHTML(currentColor ?? "green")}
          </div>
        </form>
      `,
      buttons: {
        rename: {
          label: "Rename",
          callback: async (html: JQuery) => {
            const name = (html.find("#rename-zone-name").val() as string).trim();
            if (!name) return;
            const icon = (html.find("#custom-icon-value").val() as string) || "fa-backpack";
            const color = (html.find("#zone-color-value").val() as string) || "green";
            await FlagManager.updateInventory(actor, (inv) => {
              const zone = (inv.extraZones ?? []).find((ez) => ez.id === zoneId);
              if (zone) { zone.name = name; zone.icon = icon; zone.color = color; }
              return inv;
            });
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "rename",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
    activateColorPicker(html);
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
              inv.coinsByZone ??= { equipped: { ...inv.coins } };
              addCoinsToZone(inv.coinsByZone, { cp, sp, gp, pp });
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

// ─── Move Coins Between Zones Dialog ─────────────────────────────────────────

function zoneIdToName(zoneId: string, extraZones: ExtraZone[]): string {
  if (zoneId === "equipped") return "Equipped";
  if (zoneId === "stowed") return "Stowed";
  if (zoneId === "tiny") return "Belt Pouch";
  return extraZones.find((ez) => ez.id === zoneId)?.name ?? zoneId;
}

class MoveCoinsBetweenZonesDialog extends Dialog {
  constructor(
    actor: Actor,
    fromZoneId: string,
    inventory: import("../types").CharacterInventory,
    onComplete: () => void
  ) {
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const extraZones = inventory.extraZones ?? [];
    const fromCoins = (inventory.coinsByZone ?? {})[fromZoneId] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
    const fromName = zoneIdToName(fromZoneId, extraZones);

    // Build target zone list (all zones except the source)
    // In weight mode there is no Stowed or Belt Pouch zone
    const allZones = [
      { id: "equipped", name: "Equipped" },
      ...(encMode !== "weight" ? [
        { id: "stowed", name: "Stowed" },
        { id: "tiny", name: "Belt Pouch" },
      ] : []),
      ...extraZones.map((ez) => ({ id: ez.id, name: ez.name })),
    ].filter((z) => z.id !== fromZoneId);
    const toOptions = allZones.map((z) => `<option value="${z.id}">${z.name}</option>`).join("");

    super({
      title: `Move Coins from ${fromName}`,
      content: `
        <form>
          <p style="margin:0 0 8px;opacity:0.8;">
            Available: ${fromCoins.pp}pp &nbsp; ${fromCoins.gp}gp &nbsp; ${fromCoins.sp}sp &nbsp; ${fromCoins.cp}cp
          </p>
          <div class="form-group">
            <label>Move to</label>
            <select id="move-coins-to">${toOptions}</select>
          </div>
          <div class="form-group">
            <label>PP</label>
            <input type="number" id="move-pp" value="0" min="0" max="${fromCoins.pp}" />
          </div>
          <div class="form-group">
            <label>GP</label>
            <input type="number" id="move-gp" value="0" min="0" max="${fromCoins.gp}" />
          </div>
          <div class="form-group">
            <label>SP</label>
            <input type="number" id="move-sp" value="0" min="0" max="${fromCoins.sp}" />
          </div>
          <div class="form-group">
            <label>CP</label>
            <input type="number" id="move-cp" value="0" min="0" max="${fromCoins.cp}" />
          </div>
        </form>
      `,
      buttons: {
        move: {
          label: "Move",
          callback: async (html: JQuery) => {
            const toZoneId = html.find("#move-coins-to").val() as string;
            const pp = Math.min(fromCoins.pp, Math.max(0, parseInt(html.find("#move-pp").val() as string, 10) || 0));
            const gp = Math.min(fromCoins.gp, Math.max(0, parseInt(html.find("#move-gp").val() as string, 10) || 0));
            const sp = Math.min(fromCoins.sp, Math.max(0, parseInt(html.find("#move-sp").val() as string, 10) || 0));
            const cp = Math.min(fromCoins.cp, Math.max(0, parseInt(html.find("#move-cp").val() as string, 10) || 0));
            if (pp + gp + sp + cp === 0) return;

            await FlagManager.updateInventory(actor, (inv) => {
              inv.coinsByZone ??= { equipped: { ...inv.coins } };
              const from = (inv.coinsByZone[fromZoneId] ??= { cp: 0, sp: 0, gp: 0, pp: 0 });
              from.pp = Math.max(0, from.pp - pp);
              from.gp = Math.max(0, from.gp - gp);
              from.sp = Math.max(0, from.sp - sp);
              from.cp = Math.max(0, from.cp - cp);
              addCoinsToZone(inv.coinsByZone, { cp, sp, gp, pp }, toZoneId);
              return inv;
            });
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "move",
    });
  }
}
