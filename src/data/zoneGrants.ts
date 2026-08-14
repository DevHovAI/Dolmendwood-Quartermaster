import { MODULE_ID, SETTINGS } from "../constants";
import { CatalogManager } from "./CatalogManager";
import { subcategoryToIcon } from "../helpers/handlebars";
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

function effectiveDefinition(item: InventoryItem): ItemDefinition | undefined {
  return (
    CatalogManager.getDefinition(item.definitionId) ??
    (item.customDefinition as ItemDefinition | undefined)
  );
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

  if (!definitionGrantsZone(def, encMode)) {
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
