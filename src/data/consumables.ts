import type { InventoryItem, ItemDefinition } from "../types";

/**
 * Consumables come in two shapes, and they want different handling.
 *
 * A **bundle** (firewood, torches, candles, chalk…) is just a way to buy loose
 * units. Nobody cares which bundle a torch came out of, so it is counted as one
 * running total: buy a second bundle of 8 and you have 16, full stop.
 *
 * A **quiver or quarrel case** is a real object you carry, and single arrows are
 * bought to fill it. There the two levels — how many containers, how full each
 * is — are the point, so those keep the container/uses view.
 */

/** Single-piece ammo folds into a container that tracks the count in `uses`. */
export const AMMO_CONTAINER_MAP: Record<string, { containerId: string; maxUses: number }> = {
  "arrow-single":   { containerId: "arrows-quiver", maxUses: 20 },
  "quarrel-single": { containerId: "quarrels-case", maxUses: 20 },
};

const AMMO_CONTAINER_IDS = new Set(
  Object.values(AMMO_CONTAINER_MAP).map((a) => a.containerId)
);

export function isAmmoContainer(definitionId: string): boolean {
  return AMMO_CONTAINER_IDS.has(definitionId);
}

/** True for consumables counted as one running total of loose units. */
export function isBundle(
  item: Pick<InventoryItem, "definitionId">,
  def: ItemDefinition | undefined
): boolean {
  return !!def?.maxUses && def.maxUses > 0 && !isAmmoContainer(item.definitionId);
}

/** The number to show and edit for an item: loose units for bundles, else the count. */
export function displayQuantity(item: InventoryItem, def: ItemDefinition | undefined): number {
  return isBundle(item, def) ? stackUnits(item, def!.maxUses!) : item.quantity;
}

// ─── Stacking ─────────────────────────────────────────────────────────────────

/**
 * Whether two rows of the same item may be added together.
 *
 * Deliberately strict: notes and the secret flag are per-row, so merging rows
 * that differ in either would silently throw one away. Quivers and quarrel
 * cases never stack — they are distinct objects and a row can only hold one
 * `uses` value, so two half-full quivers cannot be represented as one row.
 */
export function canStackTogether(
  a: InventoryItem,
  b: InventoryItem,
  def: ItemDefinition | undefined
): boolean {
  if (!a.definitionId || a.definitionId !== b.definitionId) return false;
  if (a.customDefinition || b.customDefinition) return false;
  if (a.isSecret !== b.isSecret) return false;
  if ((a.notes ?? "") !== (b.notes ?? "")) return false;
  if (def?.maxUses && !isBundle(a, def)) return false;
  return true;
}

/** The row in `zoneId` that `item` should be added to, if there is one. */
export function findStackTarget(
  items: InventoryItem[],
  item: InventoryItem,
  zoneId: string,
  def: ItemDefinition | undefined
): InventoryItem | undefined {
  return items.find(
    (candidate) =>
      candidate.id !== item.id &&
      candidate.zone === zoneId &&
      canStackTogether(candidate, item, def)
  );
}

/** Add `source`'s contents into `target`. Caller drops `source` afterwards. */
export function mergeInto(
  target: InventoryItem,
  source: InventoryItem,
  def: ItemDefinition | undefined
): void {
  if (isBundle(target, def)) {
    const maxUses = def!.maxUses!;
    setStackUnits(target, maxUses, stackUnits(target, maxUses) + stackUnits(source, maxUses));
  } else {
    target.quantity += source.quantity;
  }
}

/** Take `count` off an item. Returns false when nothing is left of it. */
export function reduceItem(
  item: InventoryItem,
  def: ItemDefinition | undefined,
  count: number
): boolean {
  if (isBundle(item, def)) {
    const maxUses = def!.maxUses!;
    return setStackUnits(item, maxUses, stackUnits(item, maxUses) - count);
  }
  item.quantity -= count;
  return item.quantity > 0;
}

/** A detached copy of `item` holding exactly `count` of it. */
export function portionOf(
  item: InventoryItem,
  def: ItemDefinition | undefined,
  count: number
): InventoryItem {
  const copy: InventoryItem = { ...item, id: foundry.utils.randomID() };
  if (isBundle(item, def)) setStackUnits(copy, def!.maxUses!, count);
  else copy.quantity = count;
  return copy;
}

/** Loose units in a stack: the full bundles plus what is left of the open one. */
export function stackUnits(item: InventoryItem, maxUses: number): number {
  return Math.max(0, (item.quantity - 1) * maxUses + (item.uses ?? maxUses));
}

/**
 * Write a unit total back as quantity + uses.
 * Returns false when nothing is left, so the caller can drop the item.
 */
export function setStackUnits(item: InventoryItem, maxUses: number, units: number): boolean {
  if (units <= 0) return false;
  item.quantity = Math.ceil(units / maxUses);
  const remainder = units % maxUses;
  item.uses = remainder === 0 ? maxUses : remainder;
  return true;
}
