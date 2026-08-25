import { MODULE_ID, SETTINGS } from "../constants";
import { hashString, mulberry32 } from "./seededRandom";
import type { ShopEntry } from "../types";

/**
 * Which of a shop's chancy lines are actually in stock this visit.
 *
 * The settlement notes are full of these: a 2-in-6 chance on each alchemical
 * preparation, 3-in-6 on each rare wine, 2-in-6 on each psychedelic compound
 * from a discreet seller. The entry carries the chance; whether it is there
 * today is worked out here.
 *
 * **Derived, never stored** — the same decision the inn's daily menu made, for
 * the same reason: players cannot write world settings, so a stored roll would
 * leave a player-opened shop empty until a GM opened it first. Every client
 * derives the identical answer from (shop, entry, visit counter), and the
 * Referee's "new visit" is an increment of that counter.
 *
 * This is deliberately **not** a Foundry `Roll`. The rolls that go through
 * Foundry's dice are the ones the Referee makes at the table and wants to see
 * animate; what a shop happens to have on the shelf is scenery, and rolling it
 * would put six lines of dice in the chat every time somebody walked into a
 * shop.
 */

/** How many times the Referee has moved this shop's stock on. */
export function shopVisit(shopKey: string): number {
  const all = ((game as Game).settings.get(MODULE_ID, SETTINGS.SHOP_VISITS) as Record<string, number>) ?? {};
  return all[shopKey] ?? 0;
}

/** Re-roll everything this shop stocks on a chance. GM only — it is a world write. */
export async function bumpShopVisit(shopKey: string): Promise<void> {
  const g = game as Game;
  const all = (g.settings.get(MODULE_ID, SETTINGS.SHOP_VISITS) as Record<string, number>) ?? {};
  all[shopKey] = (all[shopKey] ?? 0) + 1;
  await g.settings.set(MODULE_ID, SETTINGS.SHOP_VISITS, all);
}

/**
 * Is this entry on the shelf right now?
 *
 * An entry with no `availability` is always there, which is what every line
 * stocked before this existed reads back as. A chance of 6 or more is likewise
 * always — the Referee wrote "6 in 6", and refusing it would be pedantry.
 */
export function inStock(entry: ShopEntry, shopKey: string, visit = shopVisit(shopKey)): boolean {
  const chance = entry.availability;
  if (chance === undefined || chance >= 6) return true;
  if (chance <= 0) return false;
  const rand = mulberry32(hashString(`${shopKey}|${entry.id}|${visit}`));
  return Math.floor(rand() * 6) + 1 <= chance;
}
