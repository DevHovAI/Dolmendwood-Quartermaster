/**
 * What the party can actually supply, counted across every pack it owns.
 *
 * **Dolmenmaster's ask, 2026-09-03:** *"kannst du aus den inventaren der party die
 * hilfsmittel auslesen, sodass niemand etwas nutzen kann, was die party nicht
 * auch wirklich hat? Bedenke, dass ein zelt zum beispiel von mehreren
 * characters genutzt werden kann."*
 *
 * Two things were wrong before this file, and they pull in opposite directions:
 *
 * - **Too generous:** nothing stopped a dialog offering a tinder box, a fishing
 *   rod or a tent to a party that owns none. The tick was simply there.
 * - **Too mean:** bedding was read out of each character's *own* pack alone, so
 *   a tent in Alice's bag sheltered Alice and nobody else, and a tent in the
 *   shared party store sheltered nobody at all.
 *
 * **A tent holds two people, and that is the book's number rather than one this
 * module chose**: the catalogue entry for a tent reads *"Large enough for two
 * people"* (Player's Book equipment list). So an item is counted as *spaces*,
 * not as a yes-or-no per character: three tents and five bedrolls in a party of
 * six is six tent spaces and five bedrolls, wherever in the party they are
 * carried.
 *
 * **Everything is pure except `partyStock`.** The arithmetic of spaces and
 * claims is walked by `npm run rules:check` without Foundry running, which is
 * the point: a rule that quietly lets a seventh character into three tents is
 * the sort of thing nobody notices at the table. That checker went unwritten
 * for a while and this comment named it anyway; it exists now, and it covers
 * the night's sleep beside this.
 */

import { FlagManager } from "./FlagManager";
import { t, tn } from "../helpers/i18n";
import { getConvoyActors } from "./sharedStore";

/**
 * How many characters one of a thing covers.
 *
 * Absent means one — the ordinary case, and the reason this table is short. It
 * lists only what is genuinely shared, and each entry cites where its number
 * comes from so nobody has to guess later.
 */
export const COVERS: Record<string, number> = {
  // "Large enough for two people" — the catalogue's own description.
  tent: 2,
};

export function coversPerUnit(definitionId: string): number {
  return COVERS[definitionId] ?? 1;
}

export interface Stock {
  /** How many of the thing the party holds, across every pack and the store. */
  units: number;
  /** How many characters that many can cover. */
  spaces: number;
  /** Which characters are carrying them, for a dialog that wants to say. */
  carriers: { actorId: string; name: string; quantity: number }[];
}

/**
 * Count one item across the whole party.
 *
 * **The convoy, not the party**: `getConvoyActors` is the party plus the shared
 * store, and a tent bought out of the common purse lives in the store. Leaving
 * it out was half of what made this too mean.
 */
export function partyStock(definitionId: string): Stock {
  const carriers: Stock["carriers"] = [];
  let units = 0;

  for (const actor of getConvoyActors()) {
    const items = FlagManager.getInventory(actor).items ?? [];
    const quantity = items
      .filter((i) => i.definitionId === definitionId)
      .reduce((n, i) => n + (i.quantity ?? 0), 0);
    if (quantity <= 0) continue;
    units += quantity;
    carriers.push({
      actorId: actor.id ?? "",
      name: actor.name ?? t("DOLMENWOOD.Party.Unsorted.Someone"),
      quantity,
    });
  }

  return { units, spaces: units * coversPerUnit(definitionId), carriers };
}

/**
 * How many spaces are left once some characters have claimed one.
 *
 * Never below nought: a Referee who hands out a fourth place in three tents by
 * ticking the boxes anyway has made a ruling, and the window's job is to say
 * the count is over rather than to refuse it.
 */
export function spacesLeft(stock: Stock, claimed: number): number {
  return Math.max(0, stock.spaces - claimed);
}

/**
 * May this character still claim one?
 *
 * `claimedBy` is the list of characters already holding a space, so asking
 * about somebody who is already on it is always yes — a dialog re-rendering
 * must not take back what it has just been told.
 */
export function mayClaim(stock: Stock, claimedBy: string[], actorId: string): boolean {
  if (claimedBy.includes(actorId)) return true;
  return spacesLeft(stock, claimedBy.length) > 0;
}

/**
 * Hand out a limited number of places, carriers first.
 *
 * **Whoever bought it gets to use it.** A tent in Alice's pack shelters Alice
 * and one other, not two others; a party with four bedrolls and six members
 * gives them to the four who are carrying them. Beyond that the order is simply
 * the party's own, because there is no better answer and an arbitrary one that
 * looked clever would be worse than a predictable one the Referee can change by
 * clicking.
 *
 * Returns the ids that got a place, in party order.
 */
export function allocate(spaces: number, carriers: string[], everyone: string[]): string[] {
  if (spaces <= 0) return [];
  const carrying = new Set(carriers);
  const first = everyone.filter((id) => carrying.has(id));
  const rest = everyone.filter((id) => !carrying.has(id));
  const chosen = new Set([...first, ...rest].slice(0, spaces));
  // Back into party order, so the ticks run down the list rather than jumping.
  return everyone.filter((id) => chosen.has(id));
}

/**
 * **`noun` is a translation key, not a word.** The sentence used to be built
 * around a bare English plural — "No bedrolls anywhere in the party" — which
 * cannot be assembled that way in a language that inflects what it counts.
 * The caller passes the key for the thing; this picks the sentence.
 */
export function stockLine(stock: Stock, noun: string, claimed = 0): string {
  const thing = t(noun);
  if (stock.units === 0) return t("DOLMENWOOD.Camp.Stock.None", { noun: thing });
  const left = spacesLeft(stock, claimed);
  const places =
    stock.spaces === stock.units
      ? ""
      : tn("DOLMENWOOD.Camp.Stock.Places", stock.spaces);
  return t("DOLMENWOOD.Camp.Stock.Line", {
    units: stock.units,
    noun: thing,
    places,
    left,
  });
}
