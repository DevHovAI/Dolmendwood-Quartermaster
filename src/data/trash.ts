import { MODULE_ID, SETTINGS, TRASH_LIMIT_DEFAULT } from "../constants";
import { FlagManager } from "./FlagManager";
import {
  addItemWithZones,
  getEncumbranceMode,
  zonesAcceptingItems,
  type EncumbranceMode,
} from "./zoneGrants";
import type { CharacterInventory, InventoryItem, TrashedItem } from "../types";

/**
 * The bin.
 *
 * Deleting a row moves it here instead of dropping it, so a mis-click is not a
 * lost longsword. It is deliberately *not* a second inventory: entries never
 * count toward encumbrance, never appear in a zone, and fall out of the bottom
 * once the bin is full.
 *
 * **Stored per actor, inside the existing inventory flag.** A single central bin
 * actor was the alternative — the shape the shared store and loot boxes use —
 * but it would need `ownership.default = OWNER` for players to write to it, and
 * that would show every player everything anyone had deleted, secrets included.
 * Writing to one's own actor is a permission every player already has, so
 * deleting keeps working with no GM online. `reconcileZones`,
 * `reconcileSingleContainers` and `syncCoins` all walk `inv.items` alone, so the
 * separate array passes through every write untouched.
 *
 * Only deliberate deletion lands here — not using something up. A torch that
 * burns out and the last ration eaten are play, not accidents, and putting them
 * in the bin would bury the one mis-clicked item under a week of ash.
 */

// ─── Zone labels ───────────────────────────────────────────────────────────────

/**
 * What to call the zone a row was deleted from.
 *
 * Resolved at deletion time and stored on the entry, because the zone may be
 * gone by the time anyone looks: deleting a backpack bins the backpack *and*
 * removes its zone in the same write.
 */
export function zoneLabel(
  inv: CharacterInventory,
  zoneId: string,
  encMode: EncumbranceMode = getEncumbranceMode()
): string {
  if (zoneId === "equipped") return "Equipped";
  if (zoneId === "stowed") return encMode === "weight" ? "Unsorted" : "Stowed";
  if (zoneId === "tiny") return "Belt Pouch";
  return (inv.extraZones ?? []).find((z) => z.id === zoneId)?.name ?? "Unknown";
}

// ─── Discarding ────────────────────────────────────────────────────────────────

function trashLimit(): number {
  const raw = (game as Game).settings?.get(MODULE_ID, SETTINGS.TRASH_LIMIT) as number | undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : TRASH_LIMIT_DEFAULT;
}

/** Put a row in the bin without touching inv.items. */
function pushTrash(inv: CharacterInventory, item: InventoryItem, label: string): void {
  const limit = trashLimit();
  if (limit === 0) return; // bin turned off — deletion is final again

  inv.trash ??= [];
  inv.trash.push({
    entryId: foundry.utils.randomID(),
    item: structuredClone(item),
    deletedAt: Date.now(),
    deletedBy: (game as Game).user?.name ?? "Unknown",
    zoneName: label,
  });

  // Newest last, so the oldest fall off the front.
  if (inv.trash.length > limit) inv.trash = inv.trash.slice(-limit);
}

/**
 * Delete one row: out of the inventory, into the bin.
 *
 * Call this instead of filtering `inv.items` by hand wherever an item is meant
 * to cease existing. Every *move* — giving, changing zone, taking from a hoard,
 * buying — must keep filtering directly, or the item would be binned on its way
 * to its new home.
 */
export function discardItem(inv: CharacterInventory, itemId: string): void {
  const item = inv.items.find((i) => i.id === itemId);
  if (!item) return;
  pushTrash(inv, item, zoneLabel(inv, item.zone));
  inv.items = inv.items.filter((i) => i.id !== itemId);
}

/** Delete several rows at once — the multi-select path. */
export function discardItems(inv: CharacterInventory, itemIds: Set<string>): void {
  const encMode = getEncumbranceMode();
  for (const item of inv.items) {
    if (itemIds.has(item.id)) pushTrash(inv, item, zoneLabel(inv, item.zone, encMode));
  }
  inv.items = inv.items.filter((i) => !itemIds.has(i.id));
}

// ─── Reading ───────────────────────────────────────────────────────────────────

export function getTrash(actor: Actor): TrashedItem[] {
  return FlagManager.getInventory(actor).trash ?? [];
}

// ─── Restoring and emptying (GM only — enforced by the callers in TrashApp) ────

export interface RestoreResult {
  ok: boolean;
  /** Label of the zone it actually landed in. */
  zoneName?: string;
  /** True when the original zone could not take it and it went to the fallback. */
  fellBack?: boolean;
}

/**
 * Put an entry back where it came from.
 *
 * The original zone may be full, may have been given away, or may never have
 * come back (the pack horse the row was riding on). Falling back to the default
 * stow zone is better than refusing: the point of the bin is that nothing is
 * stuck in it. `zonesAcceptingItems` is the same check the loot window uses when
 * offering somewhere to put a taken item, so a zone that cannot hold it is never
 * chosen here either.
 */
export async function restoreTrashEntry(actor: Actor, entryId: string): Promise<RestoreResult> {
  const encMode = getEncumbranceMode();
  const inv = FlagManager.getInventory(actor);
  const entry = (inv.trash ?? []).find((t) => t.entryId === entryId);
  if (!entry) return { ok: false };

  const item = structuredClone(entry.item);
  const accepting = zonesAcceptingItems(inv, [item], encMode).map((z) => z.id);
  // Same fallback the zone-delete path uses, so an item that cannot go home
  // lands where the rest of a dismantled container's contents would.
  const fallback = encMode === "weight" ? "equipped" : "stowed";
  const target = accepting.includes(item.zone)
    ? item.zone
    : accepting.includes(fallback)
      ? fallback
      : accepting[0];
  if (!target) return { ok: false };
  const fellBack = target !== item.zone;
  item.zone = target as InventoryItem["zone"];

  // The row keeps its original id where nothing has claimed it, so a restored
  // container is relinked to anything that still points at it.
  if (inv.items.some((i) => i.id === item.id)) item.id = foundry.utils.randomID();

  let landedIn = "";
  await FlagManager.updateInventory(actor, (draft) => {
    draft.trash = (draft.trash ?? []).filter((t) => t.entryId !== entryId);
    addItemWithZones(draft, item, encMode);
    landedIn = zoneLabel(draft, item.zone, encMode);
    return draft;
  });

  return { ok: true, zoneName: landedIn, fellBack };
}

/** Throw away everything in one actor's bin, for good. */
/**
 * Throw one row away for good.
 *
 * The bin was all-or-nothing before: restore a row, or empty the lot. A bin
 * kept as an undo buffer fills with things nobody will ever want back, and
 * emptying it to be rid of one of them takes the rest with it.
 */
export async function deleteTrashEntry(actor: Actor, entryId: string): Promise<boolean> {
  const before = getTrash(actor).length;
  if (!before) return false;
  await FlagManager.updateInventory(actor, (draft) => {
    draft.trash = (draft.trash ?? []).filter((t) => t.entryId !== entryId);
    return draft;
  });
  return getTrash(actor).length < before;
}

export async function emptyTrash(actor: Actor): Promise<number> {
  const count = getTrash(actor).length;
  if (count === 0) return 0;
  await FlagManager.updateInventory(actor, (draft) => {
    draft.trash = [];
    return draft;
  });
  return count;
}
