import { TEMPLATES, SOCKET_EVENTS, SETTINGS, MODULE_ID } from "../constants";
import { ShopApp } from "./ShopApp";
import { buildPartySummary, buildPartyConvoy } from "./PartyOverviewApp";
import { FlagManager, totalZoneCoins, addCoinsToZone } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import {
  addItemWithZones,
  itemStackWeight,
  zoneRejection,
  zonesAcceptingItems,
  getEncumbranceMode,
} from "../data/zoneGrants";
import type { ZoneOption } from "../data/zoneGrants";
import { effectiveWeightCapacity, effectiveMaxSlots } from "../data/zoneCapacity";
import {
  isBundle,
  stackUnits,
  setStackUnits,
  displayQuantity,
  findStackTarget,
  mergeInto,
  reduceItem,
  portionOf,
} from "../data/consumables";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { SocketHandler } from "../socket/SocketHandler";
import { buildIconPickerHTML, activateIconPicker, buildColorPickerHTML, activateColorPicker, buildZoneOptionsHTML, escapeHTML, ZONE_ICONS } from "../helpers/handlebars";
import {
  getSharedActor,
  getPartyActors,
  getConvoyActors,
  ensureSharedActor,
  isSharedActor,
} from "../data/sharedStore";
import type { InventoryItem, ExtraZone, ZoneCoins, CharacterInventory, EncumbranceResult } from "../types";

/**
 * Per-zone view model for the inventory template. Built once for the character's
 * own inventory and once for the shared party store, so a shared pack animal is
 * rendered by exactly the same markup as a privately owned one.
 */
interface ZoneViews {
  coinsByZone: Record<string, ZoneCoins>;
  visibleItems: InventoryItem[];
  storageZones: Record<string, unknown>[];
  vehicleZones: Record<string, unknown>[];
}

/**
 * Giving to another player's character removes the item locally and hands the
 * write to the GM's client over the socket. With no GM connected that message
 * goes nowhere and the item is simply gone, so check before removing anything.
 */
function requireActiveGM(): boolean {
  const g = game as Game;
  if (g.user?.isGM) return true;
  if ((g.users?.contents ?? []).some((u) => u.isGM && u.active)) return true;
  ui.notifications?.warn("No GM is connected — handovers only work while a GM is online.");
  return false;
}

/**
 * Catalog definition plus the display fields the item row needs.
 *
 * Module-level on purpose: this existed twice — once for the extra zones and
 * once for equipped/stowed/belt pouch — and the two copies drifted, so the
 * bundle counter appeared in containers but not in the zones where weight-mode
 * characters actually keep their consumables.
 */
function enrichItems(items: InventoryItem[]) {
  return items.map((item) => {
    const def = CatalogManager.getDefinition(item.definitionId);
    const uses = def?.maxUses !== undefined && item.uses === undefined ? def.maxUses : item.uses;
    const effectiveWeight = item.customDefinition?.weight ?? def?.weight ?? 0;
    // Bundles show one running total of loose units instead of a bundle count
    // next to a uses counter
    const bundle = isBundle(item, def);
    return {
      ...item,
      uses,
      def,
      effectiveWeight,
      isBundle: bundle,
      units: bundle ? stackUnits(item, def!.maxUses!) : item.quantity,
      unitWeight: bundle ? effectiveWeight / def!.maxUses! : effectiveWeight,
    };
  });
}

function buildZoneViews(
  inventory: CharacterInventory,
  encumbrance: EncumbranceResult,
  encMode: "slots" | "weight",
  canSeeSecret: boolean,
  isShared: boolean
): ZoneViews {
  const allExtraZones = inventory.extraZones ?? [];

  // Per-zone coin map, normalised so every zone ID is present with default 0s
  const rawCoinsByZone = inventory.coinsByZone ?? { equipped: { ...inventory.coins } };
  const coinsByZone: Record<string, ZoneCoins> = {};
  for (const zoneId of ["tiny", "equipped", "stowed", ...allExtraZones.map((z) => z.id)]) {
    coinsByZone[zoneId] = rawCoinsByZone[zoneId] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
  }

  // Secret items are hidden from anyone but the GM and the actor's owner.
  // Container items (weight mode) and animals/vehicles render as zone headers,
  // so they are filtered out of the plain item lists.
  const visibleItems = inventory.items.filter((item) => {
    if (item.isSecret && !canSeeSecret) return false;
    const def = CatalogManager.getDefinition(item.definitionId);
    const effectiveDef = def ?? item.customDefinition;
    if (effectiveDef?.grantsZone && (effectiveDef?.category === "Animals & Vehicles" || item.customDefinition?.grantsZone)) return false;
    if (def?.grantsStorageZone && encMode === "weight") return false;
    return true;
  });

  const zoneCoinWeight = (zoneId: string) => {
    const c = coinsByZone[zoneId] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
    return c.cp + c.sp + c.gp + c.pp;
  };

  const vehicleZones = allExtraZones
    .filter((ez) => !ez.type || ez.type === "vehicle")
    .map((ez: ExtraZone) => {
      const zoneItems = visibleItems.filter((i) => i.zone === ez.id);
      const usedWeight =
        zoneItems.reduce((acc, i) => acc + itemStackWeight(i), 0) + zoneCoinWeight(ez.id);

      // Find the animal item definition that granted this zone
      let animalDescription: string | undefined;
      let animalSubcategory: string | undefined;
      let animalItemName: string | undefined;
      let animalQualities: string[] = [];
      for (const item of inventory.items) {
        const def = CatalogManager.getDefinition(item.definitionId);
        const effectiveDef = def ?? (item.customDefinition as import("../types").ItemDefinition | undefined);
        if (!effectiveDef?.grantsZone) continue;
        // Match by itemId (preferred), fall back to name for legacy zones without itemId
        if ((ez.itemId && item.id === ez.itemId) || (!ez.itemId && effectiveDef.grantsZone.name === ez.name)) {
          animalDescription = effectiveDef.description;
          animalSubcategory = effectiveDef.subcategory;
          animalItemName = effectiveDef.name ?? item.name;
          animalQualities = effectiveDef.qualities ?? [];
          break;
        }
      }

      const speedInfo = encumbrance.animalSpeeds.find((a) => a.zoneName === ez.name);

      return {
        ...ez,
        isShared,
        // Displayed capacity must include a doubled draught team, otherwise the
        // header would still read the single-team rating.
        effectiveWeightCapacity: effectiveWeightCapacity(ez),
        effectiveMaxSlots: effectiveMaxSlots(ez),
        // Nothing pulls a boat, so it gets no team toggle. Anything else that
        // is a vehicle does, including custom ones with a free-text type.
        isLandVehicle:
          !!ez.isVehicle && (animalSubcategory ?? "").toLowerCase() !== "water vehicles",
        items: enrichItems(zoneItems),
        usedSlots: zoneItems.reduce((acc, i) => {
          const def = CatalogManager.getDefinition(i.definitionId);
          const size = i.customDefinition?.size ?? def?.size ?? "normal";
          return acc + (size === "large" ? 2 : size === "normal" ? 1 : 0) * i.quantity;
        }, 0),
        usedWeight,
        animalDescription,
        animalSubcategory,
        animalItemName,
        animalQualities,
        speedInfo,
      };
    });

  const storageZones = allExtraZones
    .filter((ez) => ez.type === "storage")
    .map((ez: ExtraZone) => {
      const zoneItems = visibleItems.filter((i) => i.zone === ez.id);
      return {
        ...ez,
        isShared,
        isStorage: true,
        effectiveWeightCapacity: ez.weightCapacity,
        items: enrichItems(zoneItems),
        usedWeight:
          zoneItems.reduce((acc, i) => acc + itemStackWeight(i), 0) + zoneCoinWeight(ez.id),
      };
    });

  return { coinsByZone, visibleItems, storageZones, vehicleZones };
}

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
      // Capped so the window cannot open wider than the viewport on small screens
      width: Math.min(1040, window.innerWidth - 80),
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
      incrementUnits: PlayerInventoryApp._onIncrementUnits,
      decrementUnits: PlayerInventoryApp._onDecrementUnits,
      incrementUses: PlayerInventoryApp._onIncrementUses,
      decrementUses: PlayerInventoryApp._onDecrementUses,
      addExtraZone: PlayerInventoryApp._onAddExtraZone,
      deleteExtraZone: PlayerInventoryApp._onDeleteExtraZone,
      renameExtraZone: PlayerInventoryApp._onRenameExtraZone,
      moveZoneCoins: PlayerInventoryApp._onMoveZoneCoins,
      toggleDropZone: PlayerInventoryApp._onToggleDropZone,
      toggleDroppedVisibility: PlayerInventoryApp._onToggleDroppedVisibility,
      toggleDoubleTeam: PlayerInventoryApp._onToggleDoubleTeam,
      giveZone: PlayerInventoryApp._onGiveZone,
      shareZone: PlayerInventoryApp._onShareZone,
      unshareZone: PlayerInventoryApp._onUnshareZone,
      addCustomAnimal: PlayerInventoryApp._onAddCustomAnimal,
      renameItem: PlayerInventoryApp._onRenameItem,
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

  // ─── Shared store resolution ────────────────────────────────────────────────
  // Shared zones are rendered inside this window but stored on the shared actor.
  // Every handler therefore has to ask which actor a zone or item really lives
  // on before writing — IDs are randomID()s and unique across actors, so a
  // lookup by ID is unambiguous.

  private _actorForZone(zoneId: string): Actor {
    const own = FlagManager.getInventory(this.actor);
    if ((own.extraZones ?? []).some((z) => z.id === zoneId)) return this.actor;
    const shared = getSharedActor();
    if (shared && (FlagManager.getInventory(shared).extraZones ?? []).some((z) => z.id === zoneId)) {
      return shared;
    }
    return this.actor;
  }

  private _actorForItem(itemId: string): Actor {
    const own = FlagManager.getInventory(this.actor);
    if (own.items.some((i) => i.id === itemId)) return this.actor;
    const shared = getSharedActor();
    if (shared && FlagManager.getInventory(shared).items.some((i) => i.id === itemId)) return shared;
    return this.actor;
  }

  private _isSharedZone(zoneId: string): boolean {
    const shared = getSharedActor();
    return !!shared && this._actorForZone(zoneId).id === shared.id;
  }

  override async _prepareContext(
    _options: DeepPartial<ApplicationV2RenderOptions> & { isFirstRender: boolean }
  ): Promise<Record<string, unknown>> {
    const g = game as Game;
    const inventory = FlagManager.getInventory(this.actor);
    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const isGM = g.user?.isGM ?? false;
    const isOwner = this.actor.isOwner;

    const encumbrance = calculateEncumbrance(inventory, CatalogManager.getMap(), encMode);
    const own = buildZoneViews(inventory, encumbrance, encMode, isGM || isOwner, false);
    const { coinsByZone, visibleItems, storageZones, vehicleZones } = own;

    // Shared party store: its zones are rendered inside every player's inventory
    // but stay stored on the shared actor, so they never count toward this
    // character's own weight or slots.
    const sharedActor = getSharedActor();
    // Opening the shared actor's own inventory already lists its zones as the
    // regular ones — do not append them a second time.
    const viewingShared = !!sharedActor && sharedActor.id === this.actor.id;
    const sharedInventory = sharedActor && !viewingShared ? FlagManager.getInventory(sharedActor) : null;
    const sharedEncumbrance = sharedInventory
      ? calculateEncumbrance(sharedInventory, CatalogManager.getMap(), encMode)
      : null;
    const sharedViews = sharedInventory && sharedEncumbrance
      ? buildZoneViews(sharedInventory, sharedEncumbrance, encMode, true, true)
      : null;
    const sharedZonesAll = sharedViews
      ? [...(encMode === "weight" ? sharedViews.storageZones : []), ...sharedViews.vehicleZones]
      : [];

    // Zones left behind are dead weight on screen while the party is away from
    // the stash, so they can be folded away per user. They already count for
    // nothing in weight or speed, making this purely a view preference.
    const hideDropped = (g.settings.get(MODULE_ID, SETTINGS.HIDE_DROPPED_ZONES) ?? false) as boolean;
    const isDropped = (z: { isDropped?: boolean }) => !!z.isDropped;
    const droppedCount =
      storageZones.filter(isDropped).length +
      vehicleZones.filter(isDropped).length +
      sharedZonesAll.filter(isDropped).length;
    const visible = <T extends { isDropped?: boolean }>(zs: T[]) =>
      hideDropped ? zs.filter((z) => !z.isDropped) : zs;
    const sharedZones = visible(sharedZonesAll);

    const zones = {
      tiny: visibleItems.filter((i) => i.zone === "tiny"),
      equipped: visibleItems.filter((i) => i.zone === "equipped"),
      stowed: visibleItems.filter((i) => i.zone === "stowed"),
    };

    // Party members for "Give item" / "Give coins" dialogs
    const partyMembers = getPartyActors().filter((actor) => actor.id !== this.actor.id);

    // The party summary counts the shared store's contents as party gear, and
    // the convoy must see its pack animals or a shared animal would silently
    // stop setting the marching pace.
    const convoyActors = getConvoyActors();
    const partySummary = buildPartySummary(convoyActors, isGM, g.user ?? null, undefined, encMode);
    const partyConvoy = buildPartyConvoy(convoyActors, encMode);

    // Coins parked in "stowed" would be unreachable in weight mode when the Unsorted
    // section is hidden for having no items — keep it open while it holds money.
    const stowedCoins = coinsByZone["stowed"];
    const showUnsorted =
      zones.stowed.length > 0 ||
      stowedCoins.cp + stowedCoins.sp + stowedCoins.gp + stowedCoins.pp > 0;

    return {
      actor: this.actor,
      actorId: this.actor.id,
      inventory,
      encMode,
      zones: {
        tiny: enrichItems(zones.tiny),
        equipped: enrichItems(zones.equipped),
        stowed: enrichItems(zones.stowed),
      },
      extraZones: inventory.extraZones ?? [],
      storageZones: visible(storageZones),
      vehicleZones: visible(vehicleZones),
      hideDropped,
      droppedCount,
      coinsByZone,
      encumbrance,
      isGM,
      isOwner,
      canEdit: isGM,
      canAddItem: isOwner && !isGM,
      canGive: isOwner && !isGM,
      // Handing over a whole container is a GM job too — unlike the per-item
      // give button, which stays off the GM's screen to keep rows uncluttered.
      canGiveZone: isOwner,
      // Shared party store
      sharedZones,
      sharedAnimalSpeeds: sharedEncumbrance?.animalSpeeds ?? [],
      isSharedStore: viewingShared,
      sharedCoinsByZone: sharedViews?.coinsByZone ?? {},
      sharedActorName: sharedActor?.name ?? "",
      hasSharedZones: sharedZones.length > 0,
      // Everyone owns the shared actor, so its zones stay editable even when
      // looking at a character this user does not own.
      sharedIsOwner: sharedActor?.isOwner ?? false,
      canShare: isOwner,
      partyMembers,
      partySummary,
      partyConvoy,
      showUnsorted,
      transactions: isGM ? FlagManager.getTransactions() : [],
    };
  }

  override async _onRender(
    _context: DeepPartial<ApplicationV2RenderContext>,
    _options: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<void> {
    const el = this.element;

    // Notes editing
    el.querySelectorAll<HTMLTextAreaElement>(".item-notes-input").forEach((input) => {
      input.addEventListener("change", async (e) => {
        const itemId = (e.target as HTMLTextAreaElement).dataset.itemId!;
        const notes = (e.target as HTMLTextAreaElement).value;
        await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
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
        await FlagManager.updateInventory(this._actorForZone(zoneId), (inv) => {
          inv.coinsByZone ??= { equipped: { ...inv.coins } };
          inv.coinsByZone[zoneId] ??= { cp: 0, sp: 0, gp: 0, pp: 0 };
          inv.coinsByZone[zoneId][currency] = value;
          return inv;
        });
        this.render(true);
      });
    });

    // Drag-and-drop: items between zones, zones reorder
    this._setupItemDragDrop(el);
    this._setupZoneDragDrop(el);
    this._setupItemSelection(el);
  }

  // ─── Multi-select ───────────────────────────────────────────────────────────
  // Click a row to select, shift-click to extend within a zone, right-click for
  // move / give / delete on the whole selection. Survives re-renders: the app
  // keeps the IDs and repaints them, dropping any that no longer exist.

  private selectedItemIds = new Set<string>();
  private selectionAnchor: string | null = null;
  /** Set by _setupItemSelection; repaints without re-binding listeners. */
  private repaintSelection: (() => void) | null = null;

  private _setupItemSelection(el: HTMLElement): void {
    const rows = Array.from(el.querySelectorAll<HTMLElement>(".item-row[data-item-id]"));
    const present = new Set(rows.map((r) => r.dataset.itemId!));
    for (const id of Array.from(this.selectedItemIds)) {
      if (!present.has(id)) this.selectedItemIds.delete(id);
    }

    const paint = () => {
      for (const r of rows) {
        r.classList.toggle("item-selected", this.selectedItemIds.has(r.dataset.itemId!));
      }
      this._renderSelectionBar(el);
    };
    this.repaintSelection = paint;

    for (const row of rows) {
      row.title = "Click to select · right-click for actions";

      row.addEventListener("click", (e) => {
        // Buttons, note fields and the like keep their own behaviour
        if ((e.target as HTMLElement).closest("button, input, textarea, select, a")) return;
        const id = row.dataset.itemId!;

        if (e.shiftKey && this.selectionAnchor) {
          const container = row.closest(".inventory-zone");
          const ids = Array.from(
            container?.querySelectorAll<HTMLElement>(".item-row[data-item-id]") ?? []
          ).map((r) => r.dataset.itemId!);
          const from = ids.indexOf(this.selectionAnchor);
          const to = ids.indexOf(id);
          if (from !== -1 && to !== -1) {
            for (const x of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) {
              this.selectedItemIds.add(x);
            }
          } else {
            this._toggleSelection(id);
          }
        } else {
          this._toggleSelection(id);
          this.selectionAnchor = this.selectedItemIds.has(id) ? id : null;
        }
        paint();
      });

      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = row.dataset.itemId!;
        // Right-clicking outside the selection acts on that row alone
        if (!this.selectedItemIds.has(id)) {
          this.selectedItemIds.clear();
          this.selectedItemIds.add(id);
          this.selectionAnchor = id;
          paint();
        }
        this._openItemContextMenu(e.clientX, e.clientY);
      });
    }

    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".item-row, .qm-selection-bar")) return;
      if (this.selectedItemIds.size === 0) return;
      this.selectedItemIds.clear();
      this.selectionAnchor = null;
      paint();
    });

    el.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || this.selectedItemIds.size === 0) return;
      this.selectedItemIds.clear();
      this.selectionAnchor = null;
      paint();
    });

    paint();
  }

  private _toggleSelection(id: string): void {
    if (this.selectedItemIds.has(id)) this.selectedItemIds.delete(id);
    else this.selectedItemIds.add(id);
  }

  /**
   * "N selected" strip — without it nobody discovers the feature. Attached to
   * the window frame rather than the scrolling content and positioned over it,
   * so appearing and disappearing never reflows what the user is looking at.
   */
  private _renderSelectionBar(el: HTMLElement): void {
    let bar = el.querySelector<HTMLElement>(":scope > .qm-selection-bar");
    const count = this.selectedItemIds.size;

    if (count === 0) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "qm-selection-bar";
      el.appendChild(bar);
    }
    bar.innerHTML =
      `<span class="qm-sel-count"><i class="fas fa-check-double"></i> ${count} item${count === 1 ? "" : "s"} selected</span>` +
      `<button type="button" class="qm-sel-actions"><i class="fas fa-bars"></i> Actions</button>` +
      `<button type="button" class="qm-sel-clear">Clear</button>`;

    bar.querySelector(".qm-sel-actions")?.addEventListener("click", (e) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      this._openItemContextMenu(r.left, r.bottom + 2);
    });
    bar.querySelector(".qm-sel-clear")?.addEventListener("click", () => {
      this.selectedItemIds.clear();
      this.selectionAnchor = null;
      this.repaintSelection?.();
    });
  }

  /** The selected items, grouped by the actor that actually stores them. */
  private _selectionByActor(): { actor: Actor; items: InventoryItem[] }[] {
    const groups = new Map<string, { actor: Actor; items: InventoryItem[] }>();
    for (const id of this.selectedItemIds) {
      const actor = this._actorForItem(id);
      const item = FlagManager.getInventory(actor).items.find((i) => i.id === id);
      if (!item) continue;
      const key = actor.id ?? "";
      if (!groups.has(key)) groups.set(key, { actor, items: [] });
      groups.get(key)!.items.push(item);
    }
    return Array.from(groups.values());
  }

  private _closeContextMenu(): void {
    document.querySelectorAll(".qm-context-menu").forEach((m) => m.remove());
  }

  private _openItemContextMenu(x: number, y: number): void {
    this._closeContextMenu();
    const groups = this._selectionByActor();
    const count = groups.reduce((n, g) => n + g.items.length, 0);
    if (count === 0) return;

    const g = game as Game;
    const isGM = g.user?.isGM ?? false;
    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";

    const menu = document.createElement("div");
    menu.className = "qm-context-menu";

    const section = (label: string) => {
      const h = document.createElement("div");
      h.className = "qm-menu-header";
      h.textContent = label;
      menu.appendChild(h);
    };
    const entry = (html: string, onClick: () => void, cls = "") => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `qm-menu-item ${cls}`.trim();
      b.innerHTML = html;
      b.addEventListener("click", () => {
        this._closeContextMenu();
        onClick();
      });
      menu.appendChild(b);
    };

    section(`${count} item${count === 1 ? "" : "s"} selected`);

    // ── Move to ──
    const ownInv = FlagManager.getInventory(this.actor);
    const standardZones =
      encMode === "weight"
        ? [{ id: "equipped", name: "Equipped" }, { id: "stowed", name: "Unsorted" }]
        : [
            { id: "equipped", name: "Equipped" },
            { id: "stowed", name: "Stowed" },
            { id: "tiny", name: "Belt Pouch" },
          ];
    const moveTargets = [
      ...standardZones,
      ...(ownInv.extraZones ?? []).map((z) => ({ id: z.id, name: z.name })),
      ...(getSharedActor() && getSharedActor()!.id !== this.actor.id
        ? (FlagManager.getInventory(getSharedActor()!).extraZones ?? []).map((z) => ({
            id: z.id,
            name: `${getSharedActor()!.name} — ${z.name}`,
          }))
        : []),
    ];
    section("Move to");
    for (const t of moveTargets) {
      entry(
        `<i class="fas fa-arrow-right-to-bracket"></i> ${escapeHTML(t.name)}`,
        () => void this._moveSelectionToZone(t.id)
      );
    }
    // Splitting only makes sense for one row holding more than one, and it
    // stays a separate entry so moving the whole stack keeps its one click
    const splittable = splittableCount(groups.flatMap((g) => g.items));
    if (splittable > 0) {
      entry(`<i class="fas fa-scissors"></i> Move some…`, () => {
        const item = groups[0].items[0];
        new MovePartDialog(item, moveTargets, splittable, (zoneId, amount) => {
          void this._movePartToZone(item.id, zoneId, amount);
        }).render(true);
      });
    }

    // ── Give to ──
    const giveTargets = getPartyActors().filter((a) => a.id !== this.actor.id);
    if (this.actor.isOwner && giveTargets.length > 0) {
      section("Give to");
      for (const t of giveTargets) {
        entry(
          `<i class="fas fa-share"></i> ${escapeHTML(t.name ?? "")}…`,
          () => this._giveSelectionTo(t)
        );
      }
    }

    // ── Delete ──
    if (isGM || this.actor.isOwner) {
      section("");
      entry(`<i class="fas fa-trash"></i> Delete`, () => void this._deleteSelection(), "qm-menu-danger");
    }

    document.body.appendChild(menu);

    // Keep the menu inside the viewport
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`;

    const dismiss = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.(".qm-context-menu")) return;
      this._closeContextMenu();
      document.removeEventListener("mousedown", dismiss, true);
      document.removeEventListener("keydown", onKey, true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss(e);
    };
    document.addEventListener("mousedown", dismiss, true);
    document.addEventListener("keydown", onKey, true);
  }

  // ─── Bulk actions ───────────────────────────────────────────────────────────

  /** Move part of one stack, leaving the rest where it is. */
  private async _movePartToZone(itemId: string, zoneId: string, amount: number): Promise<void> {
    const fromActor = this._actorForItem(itemId);
    const toActor = this._actorForZone(zoneId);
    const item = FlagManager.getInventory(fromActor).items.find((i) => i.id === itemId);
    if (!item || amount <= 0) return;

    const def = CatalogManager.getDefinition(item.definitionId);
    if (amount >= displayQuantity(item, def)) {
      await this._moveItemToZone(itemId, zoneId);
      return;
    }

    const portion = portionOf(item, def, amount);
    const rejection = zoneRejection(FlagManager.getInventory(toActor), zoneId, portion);
    if (rejection) {
      ui.notifications?.warn(rejection);
      return;
    }

    await FlagManager.updateInventory(fromActor, (inv) => {
      const src = inv.items.find((i) => i.id === itemId);
      if (src && !reduceItem(src, def, amount)) {
        inv.items = inv.items.filter((i) => i.id !== itemId);
      }
      return inv;
    });

    const intoShared = this._isSharedZone(zoneId);
    await FlagManager.updateInventory(toActor, (inv) => {
      const arrival: InventoryItem = {
        ...portion,
        zone: zoneId,
        isSecret: intoShared ? false : portion.isSecret,
      };
      const target = findStackTarget(inv.items, arrival, zoneId, def);
      if (target) mergeInto(target, arrival, def);
      else inv.items.push(arrival);
      return inv;
    });

    if (fromActor.id !== toActor.id) SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.selectedItemIds.clear();
    this.render();
  }

  private async _moveSelectionToZone(zoneId: string): Promise<void> {
    const toActor = this._actorForZone(zoneId);
    const groups = this._selectionByActor();
    const intoShared = this._isSharedZone(zoneId);

    // Validate against a working copy so the capacity check sees each accepted
    // item — moving five things into a full sack must not let all five through.
    const trial = structuredClone(FlagManager.getInventory(toActor));
    const accepted = new Map<string, InventoryItem[]>();
    const rejected: string[] = [];

    for (const group of groups) {
      const sameActor = group.actor.id === toActor.id;
      for (const item of group.items) {
        if (sameActor && item.zone === zoneId) continue;
        const rejection = zoneRejection(trial, zoneId, item, sameActor ? item.id : undefined);
        if (rejection) {
          rejected.push(`${item.name}: ${rejection}`);
          continue;
        }
        if (sameActor) {
          const t = trial.items.find((i) => i.id === item.id);
          if (t) t.zone = zoneId;
        } else {
          trial.items.push({ ...item, zone: zoneId });
        }
        const key = group.actor.id ?? "";
        if (!accepted.has(key)) accepted.set(key, []);
        accepted.get(key)!.push(item);
      }
    }

    if (rejected.length > 0) ui.notifications?.warn(rejected.join(" | "));
    if (accepted.size === 0) return;

    const incoming: InventoryItem[] = [];
    for (const group of groups) {
      const moving = accepted.get(group.actor.id ?? "") ?? [];
      if (moving.length === 0) continue;
      const ids = new Set(moving.map((i) => i.id));

      if (group.actor.id === toActor.id) {
        await FlagManager.updateInventory(group.actor, (inv) => {
          for (const id of ids) {
            const moved = inv.items.find((i) => i.id === id);
            if (!moved) continue;
            const def = CatalogManager.getDefinition(moved.definitionId);
            const target = findStackTarget(inv.items, moved, zoneId, def);
            if (target) {
              mergeInto(target, moved, def);
              inv.items = inv.items.filter((i) => i.id !== id);
            } else {
              moved.zone = zoneId;
            }
          }
          return inv;
        });
      } else {
        await FlagManager.updateInventory(group.actor, (inv) => {
          inv.items = inv.items.filter((i) => !ids.has(i.id));
          return inv;
        });
        incoming.push(...moving);
      }
    }

    if (incoming.length > 0) {
      await FlagManager.updateInventory(toActor, (inv) => {
        for (const item of incoming) {
          const arrival: InventoryItem = {
            ...item,
            id: foundry.utils.randomID(),
            zone: zoneId,
            // Depositing publishes an item — nothing in a shared container is secret
            isSecret: intoShared ? false : item.isSecret,
          };
          const def = CatalogManager.getDefinition(arrival.definitionId);
          const target = findStackTarget(inv.items, arrival, zoneId, def);
          if (target) mergeInto(target, arrival, def);
          else inv.items.push(arrival);
        }
        return inv;
      });
      SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    }

    this.selectedItemIds.clear();
    this.render();
  }

  private _giveSelectionTo(toActor: Actor): void {
    if (!requireActiveGM()) return;
    const groups = this._selectionByActor();
    const items = groups.flatMap((g) => g.items);
    if (items.length === 0) return;

    // Ask where it should land — and how much of it — before anything is removed
    new PickGiveZoneDialog(toActor, items, (zoneId, amount) => {
      void this._handOverSelection(toActor, groups, zoneId, amount);
    }).render(true);
  }

  private async _handOverSelection(
    toActor: Actor,
    groups: { actor: Actor; items: InventoryItem[] }[],
    zoneId: string,
    amount = 0
  ): Promise<void> {
    const handed: InventoryItem[] = [];

    // amount > 0 means a single row is being split rather than handed over whole
    if (amount > 0 && groups.length === 1 && groups[0].items.length === 1) {
      const [{ actor, items: [item] }] = groups;
      const def = CatalogManager.getDefinition(item.definitionId);
      if (amount < displayQuantity(item, def)) {
        handed.push(portionOf(item, def, amount));
        await FlagManager.updateInventory(actor, (inv) => {
          const src = inv.items.find((i) => i.id === item.id);
          if (src && !reduceItem(src, def, amount)) {
            inv.items = inv.items.filter((i) => i.id !== item.id);
          }
          return inv;
        });
      }
    }

    if (handed.length === 0) {
      for (const group of groups) {
        const ids = new Set(group.items.map((i) => i.id));
        await FlagManager.updateInventory(group.actor, (inv) => {
          inv.items = inv.items.filter((i) => !ids.has(i.id));
          return inv;
        });
        handed.push(...group.items);
      }
    }

    for (const item of handed) {
      SocketHandler.emitOrHandle(SOCKET_EVENTS.GM_GRANT, {
        actorId: toActor.id,
        item: {
          definitionId: item.definitionId,
          name: item.name,
          quantity: item.quantity,
          zone: zoneId,
          isSecret: item.isSecret,
          notes: item.notes,
          ...(item.uses !== undefined ? { uses: item.uses } : {}),
          ...(item.customDefinition ? { customDefinition: item.customDefinition } : {}),
        },
      });
    }

    ui.notifications?.info(`Gave ${handed.length} item(s) to ${toActor.name}.`);
    this.selectedItemIds.clear();
    this.render();
  }

  private async _deleteSelection(): Promise<void> {
    const groups = this._selectionByActor();
    const count = groups.reduce((n, g) => n + g.items.length, 0);
    if (count === 0) return;

    const confirmed = await Dialog.confirm({
      title: "Remove Items",
      content: `<p>Remove <strong>${count}</strong> item${count === 1 ? "" : "s"} from inventory?</p>`,
    });
    if (!confirmed) return;

    for (const group of groups) {
      const ids = new Set(group.items.map((i) => i.id));
      await FlagManager.updateInventory(group.actor, (inv) => {
        inv.items = inv.items.filter((i) => !ids.has(i.id));
        return inv;
      });
    }
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.selectedItemIds.clear();
    this.render();
  }

  // ─── Action Handlers ──────────────────────────────────────────────────────

  private static async _onIncrementQty(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
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
    const owner = this._actorForItem(itemId);
    const inventory = FlagManager.getInventory(owner);
    const item = inventory.items.find((i) => i.id === itemId);
    if (!item) return;

    if (item.quantity <= 1) {
      // Last one — confirm removal
      const confirmed = await Dialog.confirm({
        title: "Remove Item",
        content: `<p>Use the last <strong>${item.name}</strong>? This will remove it from inventory.</p>`,
      });
      if (!confirmed) return;
      await FlagManager.updateInventory(owner, (inv) => {
        inv.items = inv.items.filter((i) => i.id !== itemId);
        return inv;
      });
    } else {
      await FlagManager.updateInventory(owner, (inv) => {
        const i = inv.items.find((i) => i.id === itemId);
        if (i) i.quantity -= 1;
        return inv;
      });
    }
    this.render();
  }

  /**
   * Bundles are edited as one running unit total; quantity and uses are derived
   * from it, so 9 units of a bundle of 8 becomes 2 bundles with 1 left over.
   */
  private static async _onIncrementUnits(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
      const item = inv.items.find((i) => i.id === itemId);
      const def = item && CatalogManager.getDefinition(item.definitionId);
      if (!item || !def?.maxUses) return inv;
      setStackUnits(item, def.maxUses, stackUnits(item, def.maxUses) + 1);
      return inv;
    });
    this.render();
  }

  private static async _onDecrementUnits(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const owner = this._actorForItem(itemId);
    const item = FlagManager.getInventory(owner).items.find((i) => i.id === itemId);
    const def = item && CatalogManager.getDefinition(item.definitionId);
    if (!item || !def?.maxUses) return;

    // Using up the last unit removes the item, so confirm it like the plain
    // quantity control does
    if (stackUnits(item, def.maxUses) <= 1) {
      const confirmed = await Dialog.confirm({
        title: "Remove Item",
        content: `<p>Use the last <strong>${escapeHTML(item.name)}</strong>? This will remove it from inventory.</p>`,
      });
      if (!confirmed) return;
    }

    await FlagManager.updateInventory(owner, (inv) => {
      const target = inv.items.find((i) => i.id === itemId);
      if (!target) return inv;
      const left = stackUnits(target, def.maxUses!) - 1;
      if (!setStackUnits(target, def.maxUses!, left)) {
        inv.items = inv.items.filter((i) => i.id !== itemId);
      }
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
    await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
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
    await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
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

    await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
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
    await FlagManager.updateInventory(this._actorForItem(itemId), (inv) => {
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
    const targetActor = this._actorForZone(defaultZone);
    if ((game as Game).user?.isGM) {
      new AddItemDialog(targetActor, defaultZone, encMode, () => this.render()).render(true);
    } else {
      new AddCustomItemDialog(targetActor, defaultZone, encMode, () => this.render()).render(true);
    }
  }

  private static _onGiveItem(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const itemId = target.dataset.itemId!;
    new GiveItemDialog(this._actorForItem(itemId), itemId, () => this.render()).render(true);
  }

  private static _onGiveCoins(this: PlayerInventoryApp): void {
    new GiveCoinsDialog(this.actor, () => this.render()).render(true);
  }

  private static _onGrantCoins(this: PlayerInventoryApp): void {
    new GrantCoinsDialog(this.actor, () => this.render()).render(true);
  }

  private static _onOpenShop(this: PlayerInventoryApp): void {
    // Buy for the character whose inventory we came from, not for whoever the
    // shop would otherwise default to. Also re-targets an already-open shop.
    const actorId = this.actor.id ?? null;
    const existing = foundry.applications?.instances?.get("dolmenwood-shop") as ShopApp | undefined;
    if (existing) {
      existing.setActor(actorId);
      (existing as unknown as { render: (o: unknown) => void }).render({ force: true });
    } else {
      const app = new ShopApp();
      app.setActor(actorId);
      app.render(true);
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
    const owner = this._actorForZone(zoneId);

    // A shared zone belongs to the whole party — emptying it into one character's
    // Equipped would quietly hand them everyone's gear. Make it be emptied first.
    if (this._isSharedZone(zoneId)) {
      const sharedInv = FlagManager.getInventory(owner);
      const coins = sharedInv.coinsByZone?.[zoneId];
      const hasCoins = !!coins && coins.cp + coins.sp + coins.gp + coins.pp > 0;
      if (sharedInv.items.some((i) => i.zone === zoneId) || hasCoins) {
        ui.notifications?.warn("A shared container must be empty before it can be deleted.");
        return;
      }
    }

    const confirmed = await Dialog.confirm({
      title: "Delete Storage Zone",
      content: `<p>Delete this zone? All items in it will be moved to <strong>${fallbackLabel}</strong>.</p>`,
    });
    if (!confirmed) return;

    await FlagManager.updateInventory(owner, (inv) => {
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
    const owner = this._actorForZone(zoneId);
    const inventory = FlagManager.getInventory(owner);
    const zone = (inventory.extraZones ?? []).find((ez) => ez.id === zoneId);
    if (!zone) return;
    new RenameZoneDialog(owner, zoneId, zone.name, zone.icon, zone.color, () => this.render()).render(true);
  }

  private static _onMoveZoneCoins(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const fromZoneId = target.dataset.zoneId!;
    const owner = this._actorForZone(fromZoneId);
    const inventory = FlagManager.getInventory(owner);
    // Offer the other side of the shared store as a target, so coins can move
    // between a character and the party's purse in both directions.
    const shared = getSharedActor();
    const counterpart = this._isSharedZone(fromZoneId)
      ? this.actor
      : shared && shared.id !== this.actor.id
        ? shared
        : undefined;
    new MoveCoinsBetweenZonesDialog(owner, fromZoneId, inventory, () => this.render(), counterpart).render(true);
  }

  private static async _onToggleDropZone(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const zoneId = target.dataset.zoneId!;
    await FlagManager.updateInventory(this._actorForZone(zoneId), (inv) => {
      const zone = (inv.extraZones ?? []).find((ez) => ez.id === zoneId);
      if (zone) zone.isDropped = !zone.isDropped;
      return inv;
    });
    this.render();
  }

  private static _onGiveZone(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const zoneId = target.dataset.zoneId!;
    // May be a shared zone: then the giver is the shared actor, and giving is
    // how a container leaves the shared store for a single character.
    const owner = this._actorForZone(zoneId);
    const zone = (FlagManager.getInventory(owner).extraZones ?? []).find((ez) => ez.id === zoneId);
    if (!zone) return;
    new GiveZoneDialog(owner, zoneId, () => this.render()).render(true);
  }

  /**
   * Hand a container, animal or vehicle to the whole party. The shared actor is
   * OWNER for everyone, so once it exists any player can do the move themself;
   * only its creation needs a GM and therefore goes over the socket.
   */
  private static async _onShareZone(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const zoneId = target.dataset.zoneId!;
    const inventory = FlagManager.getInventory(this.actor);
    const zone = (inventory.extraZones ?? []).find((ez) => ez.id === zoneId);
    if (!zone) return;

    const confirmed = await Dialog.confirm({
      title: "Share with the Party",
      content:
        `<p>Move <strong>${escapeHTML(zone.name)}</strong> and everything in it into the party's shared store?</p>` +
        `<p style="font-size:0.9em;color:#888;">Every player can then take things out and put things in. Secret items stop being secret.</p>`,
    });
    if (!confirmed) return;

    const shared = getSharedActor() ?? (await ensureSharedActor());
    if (!shared) {
      // No shared actor and no GM rights — let the GM's client create and move it
      SocketHandler.emitOrHandle(SOCKET_EVENTS.SHARE_ZONE, {
        fromActorId: this.actor.id,
        zoneId,
      });
      ui.notifications?.info("Sharing — waiting for the GM's client to set up the shared store.");
      return;
    }

    await SocketHandler.moveZoneAndLog(this.actor, shared, zoneId, { clearSecret: true });
    this.render();
  }

  /** Take a shared zone back into this character's own inventory. */
  private static async _onUnshareZone(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const zoneId = target.dataset.zoneId!;
    const shared = getSharedActor();
    if (!shared) return;
    const zone = (FlagManager.getInventory(shared).extraZones ?? []).find((ez) => ez.id === zoneId);
    if (!zone) return;

    const confirmed = await Dialog.confirm({
      title: "Take Back",
      content:
        `<p>Move <strong>${escapeHTML(zone.name)}</strong> and everything in it out of the shared store ` +
        `and into <strong>${escapeHTML(this.actor.name ?? "")}</strong>'s inventory?</p>`,
    });
    if (!confirmed) return;

    await SocketHandler.moveZoneAndLog(shared, this.actor, zoneId);
    this.render();
  }

  private static async _onToggleDoubleTeam(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const zoneId = target.dataset.zoneId!;
    await FlagManager.updateInventory(this._actorForZone(zoneId), (inv) => {
      const zone = (inv.extraZones ?? []).find((ez) => ez.id === zoneId);
      if (zone?.isVehicle) zone.doubleTeam = !zone.doubleTeam;
      return inv;
    });
    this.render();
  }

  private static async _onToggleDroppedVisibility(this: PlayerInventoryApp): Promise<void> {
    const g = game as Game;
    const current = (g.settings.get(MODULE_ID, SETTINGS.HIDE_DROPPED_ZONES) ?? false) as boolean;
    await g.settings.set(MODULE_ID, SETTINGS.HIDE_DROPPED_ZONES, !current);
    this.render();
  }

  private static _onAddCustomAnimal(this: PlayerInventoryApp): void {
    if (!(game as Game).user?.isGM) return;
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    new AddCustomAnimalDialog(this.actor, encMode, () => this.render()).render(true);
  }

  private static async _onRenameItem(
    this: PlayerInventoryApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const owner = this._actorForItem(itemId);
    const inventory = FlagManager.getInventory(owner);
    const item = inventory.items.find((i) => i.id === itemId);
    if (!item) return;
    new RenameItemDialog(owner, itemId, item.name, () => this.render()).render(true);
  }

  // ─── Drag-and-drop helpers ──────────────────────────────────────────────────

  private async _moveItemToZone(itemId: string, newZone: string): Promise<void> {
    const fromActor = this._actorForItem(itemId);
    const toActor = this._actorForZone(newZone);
    const inventory = FlagManager.getInventory(fromActor);
    const item = inventory.items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.zone === newZone && fromActor.id === toActor.id) return;

    const sameActor = fromActor.id === toActor.id;
    const targetInventory = sameActor ? inventory : FlagManager.getInventory(toActor);
    // ignoreItemId only applies within one inventory — across actors the item is
    // not part of the target zone's weight yet.
    const rejection = zoneRejection(targetInventory, newZone, item, sameActor ? itemId : undefined);
    if (rejection) {
      ui.notifications?.warn(rejection);
      return;
    }

    const def = CatalogManager.getDefinition(item.definitionId);

    if (sameActor) {
      await FlagManager.updateInventory(fromActor, (inv) => {
        const moved = inv.items.find((i) => i.id === itemId);
        if (!moved) return inv;
        // Landing on an identical stack adds to it instead of leaving two rows
        const target = findStackTarget(inv.items, moved, newZone, def);
        if (target) {
          mergeInto(target, moved, def);
          inv.items = inv.items.filter((i) => i.id !== itemId);
        } else {
          moved.zone = newZone;
        }
        return inv;
      });
      this.render();
      return;
    }

    // Into or out of the shared store: two writes, one per actor. Both are owned
    // by this user (the shared actor is OWNER for everyone), so no GM is needed.
    const intoShared = this._isSharedZone(newZone);
    await FlagManager.updateInventory(fromActor, (inv) => {
      inv.items = inv.items.filter((i) => i.id !== itemId);
      return inv;
    });
    await FlagManager.updateInventory(toActor, (inv) => {
      const incoming: InventoryItem = {
        ...item,
        id: foundry.utils.randomID(),
        zone: newZone,
        // Depositing publishes an item — nothing in a shared container is secret
        isSecret: intoShared ? false : item.isSecret,
      };
      const target = findStackTarget(inv.items, incoming, newZone, def);
      if (target) mergeInto(target, incoming, def);
      else inv.items.push(incoming);
      return inv;
    });
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render();
  }

  private _setupItemDragDrop(el: HTMLElement): void {
    el.querySelectorAll<HTMLElement>(".item-row[draggable='true']").forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        const id = row.dataset.itemId!;
        // Dragging a row that is part of a multi-selection carries the whole
        // selection. text/plain still holds one ID so every existing drop
        // handler keeps working; the extra type is what signals "several".
        const multi = this.selectedItemIds.has(id) && this.selectedItemIds.size > 1;
        e.dataTransfer!.setData("text/plain", id);
        if (multi) {
          e.dataTransfer!.setData("application/qm-items", JSON.stringify([...this.selectedItemIds]));
        }
        e.dataTransfer!.effectAllowed = "move";
        if (multi) {
          for (const r of el.querySelectorAll<HTMLElement>(".item-row.item-selected")) {
            r.classList.add("item-dragging");
          }
        } else {
          row.classList.add("item-dragging");
        }
      });
      row.addEventListener("dragend", () => {
        el.querySelectorAll(".item-row").forEach((r) =>
          r.classList.remove("item-dragging", "item-reorder-target")
        );
        el.querySelectorAll(".item-drop-zone").forEach((z) => z.classList.remove("item-drag-over"));
      });

      // Item-on-item drop for reordering within a zone
      row.addEventListener("dragover", (e) => {
        if (e.dataTransfer?.types.includes("text/plain")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      });
      row.addEventListener("dragenter", (e) => {
        if (e.dataTransfer?.types.includes("text/plain")) {
          e.preventDefault();
          row.classList.add("item-reorder-target");
        }
      });
      row.addEventListener("dragleave", (e) => {
        if (!row.contains(e.relatedTarget as Node))
          row.classList.remove("item-reorder-target");
      });
      row.addEventListener("drop", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        row.classList.remove("item-reorder-target");

        // A multi-drag has no meaningful reorder target — drop it into the zone
        // the row sits in.
        if (e.dataTransfer?.types.includes("application/qm-items")) {
          const zoneId = row.closest<HTMLElement>("[data-zone-id]")?.dataset.zoneId;
          if (zoneId) await this._moveSelectionToZone(zoneId);
          return;
        }

        if (!e.dataTransfer?.types.includes("text/plain")) return;
        const draggedId = e.dataTransfer.getData("text/plain");
        const targetId = row.dataset.itemId!;
        if (!draggedId || draggedId === targetId) return;
        await this._reorderItem(draggedId, targetId);
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
        const newZone = zone.dataset.zoneId!;
        if (!newZone) return;

        if (e.dataTransfer?.types.includes("application/qm-items")) {
          await this._moveSelectionToZone(newZone);
          return;
        }

        if (!e.dataTransfer?.types.includes("text/plain")) return;
        const itemId = e.dataTransfer.getData("text/plain");
        if (itemId) await this._moveItemToZone(itemId, newZone);
      });
    });
  }

  private async _reorderItem(draggedId: string, targetId: string): Promise<void> {
    const draggedActor = this._actorForItem(draggedId);
    const targetActor = this._actorForItem(targetId);
    const draggedItem = FlagManager.getInventory(draggedActor).items.find((i) => i.id === draggedId);
    const targetItem = FlagManager.getInventory(targetActor).items.find((i) => i.id === targetId);
    if (!draggedItem || !targetItem) return;

    // Different zone — or a different actor's zone, i.e. the shared store — is a
    // move, not a reorder
    if (draggedItem.zone !== targetItem.zone || draggedActor.id !== targetActor.id) {
      await this._moveItemToZone(draggedId, targetItem.zone);
      return;
    }

    await FlagManager.updateInventory(draggedActor, (inv) => {
      const fromIdx = inv.items.findIndex((i) => i.id === draggedId);
      const toIdx = inv.items.findIndex((i) => i.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return inv;
      const [moved] = inv.items.splice(fromIdx, 1);
      // After removal, indices shift down by 1 for items after fromIdx
      const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
      inv.items.splice(insertIdx, 0, moved);
      return inv;
    });
    this.render();
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
    const owner = this._actorForZone(draggedId);
    // Reordering only makes sense inside one list — dragging between own zones
    // and shared ones is not a reorder
    if (owner.id !== this._actorForZone(targetId).id) return;
    const zones = FlagManager.getInventory(owner).extraZones ?? [];
    const dragged = zones.find((z) => z.id === draggedId);
    const target = zones.find((z) => z.id === targetId);
    // Only allow reordering within the same zone type
    if ((dragged?.type ?? "vehicle") !== (target?.type ?? "vehicle")) return;
    await FlagManager.updateInventory(owner, (inv) => {
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

    const zoneOptions = buildZoneOptionsHTML(
      FlagManager.getInventory(actor).extraZones ?? [],
      encMode,
      zone
    );

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
              const newItem: InventoryItem = {
                id: foundry.utils.randomID(),
                definitionId: "",
                name: customName,
                quantity: qty,
                zone: selectedZone,
                isSecret: false,
                notes: "",
                customDefinition: customDef,
              };
              const rejection = zoneRejection(FlagManager.getInventory(actor), selectedZone, newItem);
              if (rejection) { ui.notifications?.warn(rejection); return; }
              await FlagManager.updateInventory(actor, (inv) => {
                inv.items.push(newItem);
                return inv;
              });
            } else {
              // Catalog item
              const definitionId = html.find("#add-item-select").val() as string;
              const def = CatalogManager.getDefinition(definitionId);
              if (!def) return;

              const newItem: InventoryItem = {
                id: foundry.utils.randomID(),
                definitionId,
                name: def.name,
                quantity: qty,
                zone: selectedZone,
                isSecret: false,
                notes: "",
              };
              const rejection = zoneRejection(FlagManager.getInventory(actor), selectedZone, newItem);
              if (rejection) { ui.notifications?.warn(rejection); return; }

              await FlagManager.updateInventory(actor, (inv) => {
                // Containers/animals must get their zone here too — pushing the bare
                // item would leave an invisible, undeletable entry that still weighs.
                addItemWithZones(inv, newItem, encMode, def);
                return inv;
              });
            }
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "add",
    }, { width: 520 } as Partial<Dialog.Options>);
    this.actor = actor;
    this.zone = zone;
    this.onComplete = onComplete;
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
    // The dialog is sized once, when the custom section is still collapsed.
    // Without this the extra fields appear inside a small scrolling box.
    html.find("details").on("toggle", () => {
      (this as unknown as { setPosition: (p: { height: string }) => void }).setPosition({ height: "auto" });
    });
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
    const zoneOptions = buildZoneOptionsHTML(
      FlagManager.getInventory(actor).extraZones ?? [],
      encMode,
      zone
    );
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
            const newItem: InventoryItem = {
              id: foundry.utils.randomID(),
              definitionId: "",
              name,
              quantity: qty,
              zone: selectedZone,
              isSecret: false,
              notes: "",
              customDefinition: customDef,
            };
            const rejection = zoneRejection(FlagManager.getInventory(actor), selectedZone, newItem);
            if (rejection) { ui.notifications?.warn(rejection); return; }
            await FlagManager.updateInventory(actor, (inv) => {
              inv.items.push(newItem);
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
    const partyMembers = getPartyActors().filter((actor) => actor.id !== fromActor.id);

    const memberOptions = partyMembers
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const inventory = FlagManager.getInventory(fromActor);
    const item = inventory.items.find((i) => i.id === itemId);
    // Returning before super() throws in a derived constructor — bail out with
    // a message instead.
    if (!item) {
      super({ title: "Give Item", content: "<p>Item not found.</p>", buttons: { ok: { label: "OK" } }, default: "ok" });
      return;
    }

    // Bundles are counted in loose units, so the amount is capped at units and
    // the handover is built as a portion — sending the raw quantity would have
    // handed over that many whole bundles.
    const def = CatalogManager.getDefinition(item.definitionId);
    const available = displayQuantity(item, def);

    super({
      title: `Give ${item.name}`,
      content: `
        <form>
          <div class="form-group">
            <label>Give to</label>
            <select id="give-item-target">${memberOptions}</select>
          </div>
          <div class="form-group">
            <label>How many <span style="opacity:0.7;">(of ${available})</span></label>
            <input type="number" id="give-item-qty" value="${available}" min="1" max="${available}" />
          </div>
          <div class="form-group">
            <label>Into</label>
            <select id="give-item-zone"></select>
          </div>
        </form>
      `,
      buttons: {
        give: {
          label: "Give",
          callback: async (html: JQuery) => {
            const toActorId = html.find("#give-item-target").val() as string;
            const count = Math.min(
              available,
              Math.max(1, parseInt(html.find("#give-item-qty").val() as string, 10) || 1)
            );
            const toActor = (game as Game).actors?.get(toActorId);
            if (!toActor) return;
            if (!requireActiveGM()) return;
            const zone = (html.find("#give-item-zone").val() as string) || "stowed";
            const handed = portionOf(item, def, count);

            // Remove the given amount from the giver
            await FlagManager.updateInventory(fromActor, (inv) => {
              const src = inv.items.find((i) => i.id === itemId);
              if (src && !reduceItem(src, def, count)) {
                inv.items = inv.items.filter((i) => i.id !== itemId);
              }
              return inv;
            });

            // Add to recipient via socket (so GM handles the write if needed)
            SocketHandler.emitOrHandle(SOCKET_EVENTS.GM_GRANT, {
              actorId: toActorId,
              item: {
                definitionId: handed.definitionId,
                name: handed.name,
                quantity: handed.quantity,
                zone,
                isSecret: false,
                notes: "",
                customDefinition: handed.customDefinition,
                uses: handed.uses,
              },
            });

            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "give",
    });
    this.item = item;
  }

  private item!: InventoryItem;

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    // The target zones depend on both the recipient and how much is being
    // handed over, so the list is rebuilt whenever either changes.
    const def = CatalogManager.getDefinition(this.item.definitionId);
    const available = displayQuantity(this.item, def);
    const refresh = () => {
      const toActor = (game as Game).actors?.get(html.find("#give-item-target").val() as string);
      const count = Math.min(
        available,
        Math.max(1, parseInt(html.find("#give-item-qty").val() as string, 10) || 1)
      );
      // Capacity is checked against the portion actually being handed over
      populateGiveZoneSelect(html.find("#give-item-zone"), toActor ?? null, [
        portionOf(this.item, def, count),
      ]);
    };
    html.find("#give-item-target").on("change", refresh);
    html.find("#give-item-qty").on("change", refresh);
    refresh();
  }
}

/** One `<option>` for a give-target zone, flagging animals it would overload. */
function giveZoneOptionHTML(o: ZoneOption): string {
  const label = o.warning
    ? `⚠ ${escapeHTML(o.name)} — ${o.warning}`
    : `${escapeHTML(o.name)}${o.detail ? ` — ${o.detail}` : ""}`;
  return `<option value="${o.id}">${label}</option>`;
}

/**
 * Fill a zone `<select>` with the recipient's zones that can hold `items`,
 * keeping the previous choice when it is still valid.
 */
function populateGiveZoneSelect(select: JQuery, toActor: Actor | null, items: InventoryItem[]): void {
  const previous = select.val() as string | undefined;
  const options = toActor
    ? zonesAcceptingItems(FlagManager.getInventory(toActor), items, getEncumbranceMode())
    : [];

  select.html(options.map(giveZoneOptionHTML).join(""));
  if (previous && options.some((o) => o.id === previous)) select.val(previous);
}

/**
 * Zone picker for a recipient that has already been chosen — the second half of
 * the bulk "give to" flow, where the player was picked in the context menu.
 */
/**
 * How much of a single-item selection is being moved or given. Only offered
 * when exactly one row is selected and it holds more than one — splitting a
 * mixed selection has no sensible single amount.
 */
export function splittableCount(items: InventoryItem[]): number {
  if (items.length !== 1) return 0;
  const def = CatalogManager.getDefinition(items[0].definitionId);
  const count = displayQuantity(items[0], def);
  return count > 1 ? count : 0;
}

function amountFieldHTML(available: number, id: string): string {
  if (available === 0) return "";
  return `
    <div class="form-group">
      <label>How many <span style="opacity:0.7;">(of ${available})</span></label>
      <input type="number" id="${id}" value="${available}" min="1" max="${available}" />
    </div>`;
}

function readAmount(html: JQuery, id: string, available: number): number {
  if (available === 0) return 0;
  return Math.min(available, Math.max(1, parseInt(html.find(`#${id}`).val() as string, 10) || 1));
}

class PickGiveZoneDialog extends Dialog {
  constructor(
    toActor: Actor,
    items: InventoryItem[],
    onPick: (zoneId: string, amount: number) => void
  ) {
    const options = zonesAcceptingItems(
      FlagManager.getInventory(toActor),
      items,
      getEncumbranceMode()
    );
    const optionsHTML = options.map(giveZoneOptionHTML).join("");
    const count = items.length;
    const available = splittableCount(items);

    super({
      title: `Give to ${toActor.name}`,
      content: `
        <form>
          <p style="margin:0 0 8px;opacity:0.8;">
            ${count} item${count === 1 ? "" : "s"} → ${escapeHTML(toActor.name ?? "")}
          </p>
          ${amountFieldHTML(available, "pick-give-amount")}
          <div class="form-group">
            <label>Into</label>
            <select id="pick-give-zone">${optionsHTML}</select>
          </div>
          <p style="font-size:0.85em;color:#888;margin-top:4px;">
            Containers without room are hidden. Animals and vehicles stay
            selectable — overloading them is allowed, and marked with ⚠.
          </p>
        </form>
      `,
      buttons: {
        give: {
          label: "Give",
          callback: (html: JQuery) => {
            const zoneId = html.find("#pick-give-zone").val() as string;
            if (zoneId) onPick(zoneId, readAmount(html, "pick-give-amount", available));
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "give",
    });
  }
}

/** Amount + target zone for moving part of a stack within the inventory. */
class MovePartDialog extends Dialog {
  constructor(
    item: InventoryItem,
    zoneOptions: { id: string; name: string }[],
    available: number,
    onPick: (zoneId: string, amount: number) => void
  ) {
    const optionsHTML = zoneOptions
      .map((z) => `<option value="${z.id}">${escapeHTML(z.name)}</option>`)
      .join("");

    super({
      title: `Move ${item.name}`,
      content: `
        <form>
          ${amountFieldHTML(available, "move-part-amount")}
          <div class="form-group">
            <label>Move to</label>
            <select id="move-part-zone">${optionsHTML}</select>
          </div>
        </form>
      `,
      buttons: {
        move: {
          label: "Move",
          callback: (html: JQuery) => {
            const zoneId = html.find("#move-part-zone").val() as string;
            if (zoneId) onPick(zoneId, readAmount(html, "move-part-amount", available));
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "move",
    });
  }
}

// ─── Give Zone Dialog ─────────────────────────────────────────────────────────

class GiveZoneDialog extends Dialog {
  constructor(fromActor: Actor, zoneId: string, onComplete: () => void) {
    const partyMembers = getPartyActors().filter((actor) => actor.id !== fromActor.id);

    const inventory = FlagManager.getInventory(fromActor);
    const zone = (inventory.extraZones ?? []).find((ez) => ez.id === zoneId);
    if (!zone) {
      super({ title: "Give Zone", content: "<p>Zone not found.</p>", buttons: { ok: { label: "OK" } }, default: "ok" });
      return;
    }

    if (partyMembers.length === 0) {
      super({ title: "Give Zone", content: "<p>No other party members to give to.</p>", buttons: { ok: { label: "OK" } }, default: "ok" });
      return;
    }

    const memberOptions = partyMembers
      .map((a) => `<option value="${a.id}">${a.name}</option>`)
      .join("");

    const itemCount = inventory.items.filter((i) => i.zone === zoneId).length;

    super({
      title: `Give ${zone.name}`,
      content: `
        <form>
          <div class="form-group">
            <label>Give to</label>
            <select id="give-zone-target">${memberOptions}</select>
          </div>
          <p style="font-size:0.9em;color:#888;margin-top:4px;">
            This will transfer the zone with all its contents (${itemCount} item${itemCount !== 1 ? "s" : ""}) and coins.
          </p>
        </form>
      `,
      buttons: {
        give: {
          label: "Give",
          callback: (html: JQuery) => {
            const toActorId = html.find("#give-zone-target").val() as string;
            if (!toActorId) return;
            // The whole move runs on the GM's client — without one it silently
            // does nothing at all
            if (!requireActiveGM()) return;
            SocketHandler.emitOrHandle(SOCKET_EVENTS.GIVE_ZONE, {
              fromActorId: fromActor.id,
              toActorId,
              zoneId,
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
    const partyMembers = getPartyActors().filter((actor) => actor.id !== fromActor.id);

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
            // Both sides of the transfer are actor writes, so this is a GM
            // action like giving an item. With no GM connected the message goes
            // nowhere and nothing at all happens — silently, until now.
            if (!requireActiveGM()) return;
            SocketHandler.emitOrHandle(SOCKET_EVENTS.GIVE_COINS, {
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
              // Seed from the legacy total into "equipped" — seeding into "stowed"
              // would relocate an existing purse. The grant itself lands in
              // "stowed", which is the Unsorted section in weight mode: granted
              // coins should not silently count as carried on the body.
              inv.coinsByZone ??= { equipped: { ...inv.coins } };
              addCoinsToZone(inv.coinsByZone, { cp, sp, gp, pp }, "stowed");
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
  /**
   * `otherActor` adds a second inventory's zones as targets. That is what makes
   * coins in the shared store retrievable: without it, money paid into a shared
   * purse could only ever be moved between shared zones.
   */
  constructor(
    actor: Actor,
    fromZoneId: string,
    inventory: import("../types").CharacterInventory,
    onComplete: () => void,
    otherActor?: Actor
  ) {
    const encMode = ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";
    const extraZones = inventory.extraZones ?? [];
    const fromCoins = (inventory.coinsByZone ?? {})[fromZoneId] ?? { cp: 0, sp: 0, gp: 0, pp: 0 };
    const fromName = zoneIdToName(fromZoneId, extraZones);

    // Build target zone list (all zones except the source)
    // In weight mode there is no Stowed or Belt Pouch zone
    const standardZones = [
      { id: "equipped", name: "Equipped" },
      ...(encMode !== "weight" ? [
        { id: "stowed", name: "Stowed" },
        { id: "tiny", name: "Belt Pouch" },
      ] : []),
    ];
    // Option values carry the owning actor, since zone IDs alone would not say
    // which inventory to write to.
    const zoneOption = (target: Actor, id: string, name: string, prefix: string) =>
      `<option value="${target.id}:${id}">${prefix}${escapeHTML(name)}</option>`;

    const ownOptions = [...standardZones, ...extraZones.map((ez) => ({ id: ez.id, name: ez.name }))]
      .filter((z) => z.id !== fromZoneId)
      .map((z) => zoneOption(actor, z.id, z.name, ""));

    const otherInventory = otherActor ? FlagManager.getInventory(otherActor) : null;
    const otherOptions = otherActor && otherInventory
      ? [
          // The shared actor's own Equipped/Stowed are never rendered anywhere,
          // so coins sent there would vanish from the UI — only its containers
          // are valid targets.
          ...(isSharedActor(otherActor) ? [] : standardZones),
          ...(otherInventory.extraZones ?? []).map((ez) => ({ id: ez.id, name: ez.name })),
        ].map((z) => zoneOption(otherActor, z.id, z.name, `${otherActor.name} — `))
      : [];

    const toOptions = [...ownOptions, ...otherOptions].join("");

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
            const selection = html.find("#move-coins-to").val() as string;
            // "<actorId>:<zoneId>" — the zone ID may not be in `actor`
            const sep = selection.indexOf(":");
            const toActorId = selection.slice(0, sep);
            const toZoneId = selection.slice(sep + 1);
            const toActor = toActorId === actor.id ? actor : (game as Game).actors?.get(toActorId);
            if (!toActor) return;
            const pp = Math.min(fromCoins.pp, Math.max(0, parseInt(html.find("#move-pp").val() as string, 10) || 0));
            const gp = Math.min(fromCoins.gp, Math.max(0, parseInt(html.find("#move-gp").val() as string, 10) || 0));
            const sp = Math.min(fromCoins.sp, Math.max(0, parseInt(html.find("#move-sp").val() as string, 10) || 0));
            const cp = Math.min(fromCoins.cp, Math.max(0, parseInt(html.find("#move-cp").val() as string, 10) || 0));
            if (pp + gp + sp + cp === 0) return;

            const sameActor = toActor.id === actor.id;
            await FlagManager.updateInventory(actor, (inv) => {
              inv.coinsByZone ??= { equipped: { ...inv.coins } };
              const from = (inv.coinsByZone[fromZoneId] ??= { cp: 0, sp: 0, gp: 0, pp: 0 });
              from.pp = Math.max(0, from.pp - pp);
              from.gp = Math.max(0, from.gp - gp);
              from.sp = Math.max(0, from.sp - sp);
              from.cp = Math.max(0, from.cp - cp);
              if (sameActor) addCoinsToZone(inv.coinsByZone, { cp, sp, gp, pp }, toZoneId);
              return inv;
            });
            if (!sameActor) {
              await FlagManager.updateInventory(toActor, (inv) => {
                inv.coinsByZone ??= { equipped: { ...inv.coins } };
                addCoinsToZone(inv.coinsByZone, { cp, sp, gp, pp }, toZoneId);
                return inv;
              });
              SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
            }
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "move",
    });
  }
}

// ─── Add Custom Animal Dialog (GM only) ─────────────────────────────────────

class AddCustomAnimalDialog extends Dialog {
  constructor(actor: Actor, encMode: "slots" | "weight", onComplete: () => void) {
    const iconOptions = [
      { value: "fa-horse", label: "Horse" },
      { value: "fa-dog", label: "Dog / Wolf" },
      { value: "fa-cat", label: "Cat" },
      { value: "fa-crow", label: "Bird" },
      { value: "fa-dragon", label: "Dragon" },
      { value: "fa-spider", label: "Spider" },
      { value: "fa-paw", label: "Paw (generic)" },
      { value: "fa-caravan", label: "Cart / Vehicle" },
      { value: "fa-ship", label: "Boat" },
    ];
    const iconOptionsHtml = iconOptions.map(
      (o) => `<option value="${o.value}">${o.label}</option>`
    ).join("");

    super({
      title: "Add Custom Animal / Vehicle",
      content: `
        <form>
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="animal-name" placeholder="e.g. Alden the Wolf" />
          </div>
          <div class="form-group">
            <label>Type / Subcategory</label>
            <input type="text" id="animal-subcategory" placeholder="e.g. Wolves, Horses, Land Vehicles" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            <select id="animal-icon">${iconOptionsHtml}</select>
          </div>
          <div class="form-group">
            <label>Speed (ft)</label>
            <input type="number" id="animal-speed" value="40" min="0" />
          </div>
          <div class="form-group">
            <label>Weight Capacity (coin wt)</label>
            <input type="number" id="animal-weight-cap" value="0" min="0" />
          </div>
          <div class="form-group">
            <label>Slot Capacity</label>
            <input type="number" id="animal-slot-cap" value="0" min="0" />
          </div>
          <div class="form-group">
            <label>Qualities (comma-separated)</label>
            <input type="text" id="animal-qualities" placeholder="e.g. Loyal, Fast, Night Vision" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="animal-desc" placeholder="Optional description…" rows="2" style="width:100%;resize:vertical;"></textarea>
          </div>
        </form>
      `,
      buttons: {
        add: {
          label: "Add Animal",
          callback: async (html: JQuery) => {
            const name = (html.find("#animal-name").val() as string).trim();
            if (!name) { ui.notifications?.warn("Name is required."); return; }
            const subcategory = (html.find("#animal-subcategory").val() as string).trim();
            const icon = html.find("#animal-icon").val() as string;
            const speed = Math.max(0, parseInt(html.find("#animal-speed").val() as string, 10) || 0);
            const weightCapacity = Math.max(0, parseInt(html.find("#animal-weight-cap").val() as string, 10) || 0);
            const maxSlots = Math.max(0, parseInt(html.find("#animal-slot-cap").val() as string, 10) || 0);
            const qualitiesRaw = (html.find("#animal-qualities").val() as string).trim();
            const qualities = qualitiesRaw ? qualitiesRaw.split(",").map((q) => q.trim()).filter(Boolean) : [];
            const description = (html.find("#animal-desc").val() as string).trim();

            const isVehicleSub = ["land vehicles", "water vehicles"].includes(subcategory.toLowerCase());

            await FlagManager.updateInventory(actor, (inv) => {
              const itemId = foundry.utils.randomID();
              const customDef: Partial<import("../types").ItemDefinition> = {
                isCustom: true,
                icon,
                category: "Animals & Vehicles",
                subcategory,
                size: "normal",
                weight: 0,
                qualities,
                grantsZone: { name, maxSlots, weightCapacity, speed },
              };
              if (description) customDef.description = description;

              inv.items.push({
                id: itemId,
                definitionId: "",
                name,
                quantity: 1,
                zone: "equipped",
                isSecret: false,
                notes: "",
                customDefinition: customDef,
              });

              inv.extraZones ??= [];
              inv.extraZones.push({
                id: foundry.utils.randomID(),
                name,
                maxSlots,
                weightCapacity,
                itemId,
                icon,
                ...(speed > 0 ? { speed } : {}),
                ...(isVehicleSub ? { isVehicle: true } : {}),
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
}

// ─── Rename Item Dialog ─────────────────────────────────────────────────────

class RenameItemDialog extends Dialog {
  constructor(actor: Actor, itemId: string, currentName: string, onComplete: () => void) {
    super({
      title: "Rename Item",
      content: `
        <form>
          <div class="form-group">
            <label>New Name</label>
            <input type="text" id="rename-item-name" value="${currentName.replace(/"/g, "&quot;")}" />
          </div>
        </form>
      `,
      buttons: {
        rename: {
          label: "Rename",
          callback: async (html: JQuery) => {
            const newName = (html.find("#rename-item-name").val() as string).trim();
            if (!newName) return;
            await FlagManager.updateInventory(actor, (inv) => {
              const item = inv.items.find((i) => i.id === itemId);
              if (item) item.name = newName;
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
}
