import { definitionFor } from "./itemDefs";
import type { CharacterInventory, InventoryItem, ItemDefinition } from "../types";

/**
 * Consumables come in two shapes, and they want different handling.
 *
 * A **bundle** (firewood, torches, candles, chalk…) is just a way to buy loose
 * units. Nobody cares which bundle a torch came out of, so it is counted as one
 * running total: buy a second bundle of 8 and you have 16, full stop.
 *
 * A **single container** — a quiver, a quarrel case, a bottle, a cask — is a
 * real object you carry, and the units are what fills it. There the two levels
 * (how many objects, how full each one is) are the point, so each object gets
 * its own row showing "7/10", and it cannot be filled past its capacity.
 *
 * Quivers and cases are recognised by their catalog id; anything else says so on
 * its definition with `singleContainer`, which is how the inn's bottles and
 * casks qualify without needing a catalog entry of their own.
 */

/** Single-piece ammo folds into a container that tracks the count in `uses`. */
export const AMMO_CONTAINER_MAP: Record<string, { containerId: string; maxUses: number }> = {
  "arrow-single":   { containerId: "arrows-quiver", maxUses: 20 },
  "quarrel-single": { containerId: "quarrels-case", maxUses: 20 },
};

/** Container definition id → how many pieces it holds when full. */
const AMMO_CONTAINER_CAPACITY: Record<string, number> = Object.fromEntries(
  Object.values(AMMO_CONTAINER_MAP).map((a) => [a.containerId, a.maxUses])
);

export function isAmmoContainer(definitionId: string): boolean {
  return definitionId in AMMO_CONTAINER_CAPACITY;
}

/** How many pieces this ammo container holds, or undefined if it is not one. */
export function ammoContainerCapacity(definitionId: string): number | undefined {
  return AMMO_CONTAINER_CAPACITY[definitionId];
}

/**
 * How many units one object of this kind holds — undefined when it is not a
 * single container at all. Covers both the catalog's quivers and anything whose
 * definition declares `singleContainer`.
 */
export function containerCapacity(
  item: Pick<InventoryItem, "definitionId">,
  def: ItemDefinition | undefined
): number | undefined {
  const ammo = AMMO_CONTAINER_CAPACITY[item.definitionId];
  if (ammo !== undefined) return ammo;
  return def?.singleContainer && def.maxUses ? def.maxUses : undefined;
}

/** True for one-object-per-row items: quivers, cases, bottles, casks. */
export function isSingleContainer(
  item: Pick<InventoryItem, "definitionId">,
  def: ItemDefinition | undefined
): boolean {
  return containerCapacity(item, def) !== undefined;
}

/**
 * One row = one container. `uses` holds a single fill level, so a row with
 * quantity 3 cannot say how full each of the three quivers is — the display
 * would have to show a count and a fill level that do not belong together.
 * Splitting keeps the total piece count exactly as stackUnits reads it: full
 * containers first, one open remainder last.
 */
export function splitAmmoContainer(item: InventoryItem, maxUses: number): InventoryItem[] {
  const count = Math.max(1, item.quantity);
  let remaining = stackUnits(item, maxUses);
  const rows: InventoryItem[] = [];
  for (let i = 0; i < count; i++) {
    const row = i === 0 ? item : { ...item, id: foundry.utils.randomID() };
    row.quantity = 1;
    row.uses = Math.max(0, Math.min(maxUses, remaining));
    remaining -= row.uses;
    rows.push(row);
  }
  return rows;
}

/**
 * Split any stacked single container in an inventory into one row each.
 * Runs on every write so rows that predate the rule heal themselves; new ones
 * are already split by addItemWithZones.
 */
export function reconcileSingleContainers(inv: CharacterInventory): void {
  const extra: InventoryItem[] = [];
  for (const item of inv.items) {
    // Heal bottles and casks bought before the flag existed. Their definition
    // travels with the row, so they would otherwise keep counting like bundles
    // forever. Safe to key on maxUses alone: no other custom item can have it —
    // the "Grant Custom Item" dialog has no field for uses at all.
    const custom = item.customDefinition;
    if (custom?.maxUses && custom.singleContainer === undefined) {
      custom.singleContainer = true;
      if (item.uses === undefined) item.uses = custom.maxUses;
    }

    const maxUses = containerCapacity(item, definitionFor(item));
    if (maxUses === undefined || item.quantity <= 1) continue;
    extra.push(...splitAmmoContainer(item, maxUses).slice(1));
  }
  inv.items.push(...extra);
}

/** True for consumables counted as one running total of loose units. */
export function isBundle(
  item: Pick<InventoryItem, "definitionId">,
  def: ItemDefinition | undefined
): boolean {
  return !!def?.maxUses && def.maxUses > 0 && !isSingleContainer(item, def);
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
