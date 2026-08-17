import { MODULE_ID, SETTINGS } from "../constants";
import { definitionFor } from "./itemDefs";
import { subcategoryToIcon } from "../helpers/handlebars";
import { effectiveWeightCapacity, effectiveMaxSlots } from "./zoneCapacity";
import {
  stackUnits,
  findStackTarget,
  mergeInto,
  containerCapacity,
  splitAmmoContainer,
} from "./consumables";
import type { CharacterInventory, ExtraZone, InventoryItem, ItemDefinition } from "../types";

export type EncumbranceMode = "slots" | "weight";

/**
 * Zone-granting items (animals, vehicles, containers) are hidden from the normal
 * item lists because they render as zone headers instead. If such an item exists
 * without its ExtraZone, it becomes invisible AND undeletable while still counting
 * toward weight — a "ghost". Every add path must therefore go through this module.
 */

export function getEncumbranceMode(): EncumbranceMode {
  return ((game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as EncumbranceMode;
}

/** Local alias — the shared resolver lives in itemDefs.ts so every module can use it. */
function effectiveDefinition(item: InventoryItem): ItemDefinition | undefined {
  return definitionFor(item);
}

/** True if this definition creates an ExtraZone in the given encumbrance mode. */
export function definitionGrantsZone(
  def: ItemDefinition | undefined,
  encMode: EncumbranceMode
): boolean {
  if (!def) return false;
  if (def.grantsZone) return true;
  return !!def.grantsStorageZone && encMode === "weight";
}

/** The zone name a definition would produce, or undefined if it grants none. */
function grantedZoneName(def: ItemDefinition | undefined): string | undefined {
  return def?.grantsZone?.name ?? def?.grantsStorageZone?.name;
}

/** Append " 2", " 3", … so two backpacks don't end up as two zones with one name. */
function uniqueZoneName(inv: CharacterInventory, base: string): string {
  const taken = new Set((inv.extraZones ?? []).map((z) => z.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/**
 * Build the ExtraZone for a zone-granting item. Storage zones additionally pin the
 * container item to "equipped" — it lives on the character, not inside itself.
 * Returns null if the definition grants no zone in this mode.
 */
function buildZone(
  inv: CharacterInventory,
  item: InventoryItem,
  def: ItemDefinition,
  encMode: EncumbranceMode
): ExtraZone | null {
  if (def.grantsZone) {
    const isVehicleSub = ["land vehicles", "water vehicles"].includes(
      (def.subcategory ?? "").toLowerCase()
    );
    return {
      id: foundry.utils.randomID(),
      name: uniqueZoneName(inv, def.grantsZone.name),
      maxSlots: def.grantsZone.maxSlots,
      weightCapacity: def.grantsZone.weightCapacity ?? 0,
      itemId: item.id,
      icon: subcategoryToIcon(def.subcategory),
      ...(def.grantsZone.speed !== undefined ? { speed: def.grantsZone.speed } : {}),
      ...(isVehicleSub ? { isVehicle: true } : {}),
    };
  }

  if (def.grantsStorageZone && encMode === "weight") {
    item.zone = "equipped";
    return {
      id: foundry.utils.randomID(),
      name: uniqueZoneName(inv, def.grantsStorageZone.name),
      maxSlots: 0,
      weightCapacity: def.grantsStorageZone.weightCapacity,
      type: "storage" as const,
      selfWeight: def.weight ?? 0,
      itemId: item.id,
      ...(def.grantsStorageZone.isBeltPouch ? { isBeltPouch: true } : {}),
      ...(def.grantsStorageZone.allowedItemTags?.length
        ? { allowedItemTags: def.grantsStorageZone.allowedItemTags }
        : {}),
    };
  }

  return null;
}

/**
 * Push an item into the inventory, creating its ExtraZone(s) when the definition
 * grants any. Zone-granting items are always split to quantity 1 so that every
 * item maps to exactly one zone. Returns the items actually pushed.
 */
export function addItemWithZones(
  inv: CharacterInventory,
  item: InventoryItem,
  encMode: EncumbranceMode,
  defOverride?: ItemDefinition
): InventoryItem[] {
  const def = defOverride ?? effectiveDefinition(item);

  // Identical items land on the stack already in that zone rather than opening
  // a second row — buying a second bundle of 8 firewood reads 16, and a second
  // rope joins the first. canStackTogether decides what "identical" means.
  //
  // Zone-granting items are the exception: each one must stay its own row so it
  // maps to exactly one zone. Merging two backpacks into quantity 2 would leave
  // the second zone orphaned.
  if (!definitionGrantsZone(def, encMode)) {
    const existing = findStackTarget(inv.items, item, item.zone, def);
    if (existing) {
      mergeInto(existing, item, def);
      return [existing];
    }
  }

  if (!definitionGrantsZone(def, encMode)) {
    // Quivers, cases, bottles and casks are distinct objects with their own fill
    // level, so buying three means three rows rather than one row of three.
    const capacity = containerCapacity(item, def);
    if (capacity !== undefined && item.quantity > 1) {
      const rows = splitAmmoContainer(item, capacity);
      inv.items.push(...rows);
      return rows;
    }
    inv.items.push(item);
    return [item];
  }

  const count = Math.max(1, item.quantity);
  const pushed: InventoryItem[] = [];
  inv.extraZones ??= [];

  for (let i = 0; i < count; i++) {
    const copy: InventoryItem =
      i === 0
        ? { ...item, quantity: 1 }
        : { ...item, id: foundry.utils.randomID(), quantity: 1 };
    inv.items.push(copy);
    const zone = buildZone(inv, copy, def!, encMode);
    if (zone) inv.extraZones.push(zone);
    pushed.push(copy);
  }

  return pushed;
}

/**
 * Repair inventories that contain zone-granting items without their zone (added
 * before every add path created zones), and adopt legacy zones that predate the
 * itemId link so they aren't duplicated. Called on every inventory write.
 */
export function reconcileZones(inv: CharacterInventory, encMode: EncumbranceMode): void {
  const claimed = new Set(
    (inv.extraZones ?? [])
      .map((z) => z.itemId)
      .filter((id): id is string => !!id)
  );

  // Legacy zones carry no itemId — link them to a matching item by name first,
  // otherwise the pass below would mint a second zone for the same container.
  for (const zone of inv.extraZones ?? []) {
    if (zone.itemId) continue;
    const match = inv.items.find(
      (i) => !claimed.has(i.id) && grantedZoneName(effectiveDefinition(i)) === zone.name
    );
    if (match) {
      zone.itemId = match.id;
      claimed.add(match.id);
    }
  }

  const split: InventoryItem[] = [];

  for (const item of inv.items) {
    const def = effectiveDefinition(item);
    if (!definitionGrantsZone(def, encMode)) continue;

    // A zone-granting item must be quantity 1 so it maps to exactly one zone.
    const surplus = Math.max(0, item.quantity - 1);
    if (surplus > 0) {
      item.quantity = 1;
      for (let i = 0; i < surplus; i++) {
        split.push({ ...item, id: foundry.utils.randomID(), quantity: 1 });
      }
    }

    if (!claimed.has(item.id)) {
      inv.extraZones ??= [];
      const zone = buildZone(inv, item, def!, encMode);
      if (zone) {
        inv.extraZones.push(zone);
        claimed.add(item.id);
      }
    }
  }

  for (const item of split) {
    inv.items.push(item);
    inv.extraZones ??= [];
    const zone = buildZone(inv, item, effectiveDefinition(item)!, encMode);
    if (zone) inv.extraZones.push(zone);
  }
}

// ─── Zone placement rules ─────────────────────────────────────────────────────

/** Weight of ONE unit of an item, scaled by remaining uses when applicable. */
export function itemEffectiveWeight(item: InventoryItem): number {
  const def = effectiveDefinition(item);
  const baseWeight = def?.weight ?? 0;
  const usesRatio = (def?.maxUses && item.uses !== undefined) ? item.uses / def.maxUses : 1;
  return baseWeight * usesRatio;
}

/**
 * Weight of a whole inventory row.
 *
 * Not `itemEffectiveWeight × quantity`: that scales *every* copy by the open
 * bundle's ratio, so 2 bundles of firewood with 4 of 8 left came out at 200 wt
 * instead of 300 — the full bundle got charged the partial one's discount.
 * Counting units and multiplying by the per-unit weight is exact in every case.
 */
export function itemStackWeight(item: InventoryItem): number {
  const def = effectiveDefinition(item);
  const baseWeight = def?.weight ?? 0;
  const maxUses = def?.maxUses;
  if (maxUses && maxUses > 0) {
    return (baseWeight / maxUses) * stackUnits(item, maxUses);
  }
  return baseWeight * item.quantity;
}

/** Check whether an item's tags allow it into a zone with allowedItemTags. Returns true if zone has no tag restriction. */
export function isItemAllowedInZone(item: InventoryItem, zone: ExtraZone): boolean {
  if (!zone.allowedItemTags?.length) return true;
  const itemTags = effectiveDefinition(item)?.tags ?? [];
  return itemTags.some((tag) => zone.allowedItemTags!.includes(tag));
}

/** Slot cost of one unit of an item (slot mode). */
function itemSlotCost(item: InventoryItem): number {
  const size = effectiveDefinition(item)?.size ?? "normal";
  return size === "large" ? 2 : size === "normal" ? 1 : 0;
}

export interface ZoneUsage {
  used: number;
  /** 0 means the zone declares no limit. */
  capacity: number;
  unit: "wt" | "slots";
}

/** How full a zone currently is, in whichever unit the active mode counts. */
export function zoneUsage(
  inventory: CharacterInventory,
  zone: ExtraZone,
  encMode: EncumbranceMode
): ZoneUsage {
  const items = inventory.items.filter((i) => i.zone === zone.id);
  if (encMode === "weight") {
    const coins = inventory.coinsByZone?.[zone.id];
    const coinWeight = coins ? coins.cp + coins.sp + coins.gp + coins.pp : 0;
    return {
      used: items.reduce((acc, i) => acc + itemStackWeight(i), 0) + coinWeight,
      capacity: effectiveWeightCapacity(zone),
      unit: "wt",
    };
  }
  return {
    used: items.reduce((acc, i) => acc + itemSlotCost(i) * i.quantity, 0),
    capacity: effectiveMaxSlots(zone),
    unit: "slots",
  };
}

export interface ZoneOption {
  id: string;
  name: string;
  /** e.g. "120 wt free" — empty when the zone declares no limit. */
  detail: string;
  /** Set when the zone takes the load but suffers for it. */
  warning?: string;
}

/**
 * Zones of `inventory` that can take *all* of `items` together, for the target
 * picker when handing things to another character.
 *
 * Three kinds of zone, three rules:
 * - Built-in zones are always offered — no hard cap, only speed tiers.
 * - Containers (`type === "storage"`) have a real cap and are dropped from the
 *   list when the load would not fit, cumulatively across all items.
 * - Animals and vehicles are *never* dropped: overloading them is legal and
 *   only costs speed, so they stay selectable and carry a warning instead.
 *
 * Dropped zones are left out entirely — they are not being carried.
 */
export function zonesAcceptingItems(
  inventory: CharacterInventory,
  items: InventoryItem[],
  encMode: EncumbranceMode
): ZoneOption[] {
  const standard: ZoneOption[] =
    encMode === "weight"
      ? [
          { id: "equipped", name: "Equipped", detail: "" },
          { id: "stowed", name: "Unsorted", detail: "" },
        ]
      : [
          { id: "equipped", name: "Equipped", detail: "" },
          { id: "stowed", name: "Stowed", detail: "" },
          { id: "tiny", name: "Belt Pouch", detail: "" },
        ];

  const options = [...standard];

  for (const zone of inventory.extraZones ?? []) {
    if (zone.isDropped) continue;
    const isContainer = zone.type === "storage";

    const trial = structuredClone(inventory);
    let rejected = false;
    for (const item of items) {
      // Tag restrictions and the belt-pouch weight limit are hard for every
      // kind of zone; the storage capacity check inside only fires for containers.
      if (zoneRejection(trial, zone.id, item)) { rejected = true; break; }
      trial.items.push({ ...item, id: foundry.utils.randomID(), zone: zone.id });
    }
    if (rejected) continue;

    const before = zoneUsage(inventory, zone, encMode);
    const after = zoneUsage(trial, zone, encMode);
    const detail = before.capacity > 0
      ? `${Math.max(0, before.capacity - before.used)} ${before.unit} free`
      : "";

    let warning: string | undefined;
    if (!isContainer && after.capacity > 0 && after.used > after.capacity) {
      const load = `${after.used} / ${after.capacity} ${after.unit}`;
      // Mirrors EncumbranceCalculator, which only derives animal speed in
      // weight mode — in slot mode maxSlots costs nothing but room.
      if (encMode !== "weight") {
        warning = `over capacity (${load})`;
      } else if (zone.isVehicle) {
        warning = `over cargo capacity — cannot be pulled (${load})`;
      } else if (after.used > after.capacity * 2) {
        warning = `over capacity — cannot move (${load})`;
      } else {
        warning = `overloaded — half speed (${load})`;
      }
    }

    options.push({ id: zone.id, name: zone.name, detail, ...(warning ? { warning } : {}) });
  }

  return options;
}

/**
 * Why an item may not be placed into a zone, or null when it may.
 * Shared by drag-and-drop moves and by the add-item dialogs so both enforce the
 * same rules. Built-in zones (equipped/stowed/tiny) are unrestricted; only extra
 * zones carry constraints.
 * `ignoreItemId` omits an item from the zone's weight sum — used when that item
 * is the one being moved.
 */
export function zoneRejection(
  inventory: CharacterInventory,
  zoneId: string,
  item: InventoryItem,
  ignoreItemId?: string
): string | null {
  const zone = (inventory.extraZones ?? []).find((ez) => ez.id === zoneId);
  if (!zone) return null;

  if (!isItemAllowedInZone(item, zone)) {
    return `"${zone.name}" can only store items tagged: ${zone.allowedItemTags!.join(", ")}.`;
  }

  if (zone.type === "storage" && zone.weightCapacity > 0) {
    const itemWeight = itemStackWeight(item);
    const currentZoneWeight = inventory.items
      .filter((i) => i.zone === zoneId && i.id !== ignoreItemId)
      .reduce((acc, i) => acc + itemStackWeight(i), 0);
    if (currentZoneWeight + itemWeight > zone.weightCapacity) {
      return (
        `"${zone.name}" can hold ${zone.weightCapacity} wt. ` +
        `Currently ${currentZoneWeight} wt; item is ${itemWeight} wt.`
      );
    }
  }

  if (zone.isBeltPouch) {
    const weight = itemEffectiveWeight(item);
    if (weight > 10) {
      return `Only items weighing 10 wt or less fit in a belt pouch (item weighs ${weight} wt).`;
    }
  }

  return null;
}
