import { TRAVEL_DAYS_PER_REST } from "../constants";
import { FlagManager } from "./FlagManager";
import { getInnDay } from "./innMenu";
import { getPartyActors } from "./sharedStore";
import { definitionFor } from "./itemDefs";
import { isBundle, reduceItem } from "./consumables";
import type { CharacterDay, InventoryItem } from "../types";

/**
 * What each character has done today, and what they owe themselves.
 *
 * Three clocks run per character, because all three penalties land on
 * individuals rather than the party:
 *
 * - **Hunger** (Player's Book p153) — a day without food costs -1 Attack, and by
 *   day seven 1 Constitution a day until death.
 * - **Sleep** (p159) — failing to get a good night's rest leaves a character
 *   exhausted *until* they get one, cumulatively -1 per day, and gives each
 *   spell they try to prepare a 1-in-6 chance of failing.
 * - **Rest** (p157) — a week is six travel days and one of rest, so a seventh
 *   travel day without one brings the same exhaustion. Multiple sources stack
 *   to a maximum of -4 (p151).
 *
 * Stored on the actor's own inventory flag, for the same reason the trash is:
 * a player eating a ration writes their own actor, which needs no GM online and
 * no socket. `reconcileZones`, `reconcileSingleContainers` and `syncCoins` all
 * walk `inv.items` alone, so this passes through every write untouched.
 *
 * **One source of truth.** Eating at an inn and eating a ration in the woods both
 * set the same `ate` flag. An earlier version derived "eaten" from the inn log
 * while also allowing a manual tick, and the manual tick then silently overrode
 * a later-true derivation — a state a GM could not get out of.
 */

function emptyDay(day: number): CharacterDay {
  return {
    day,
    ate: false,
    sleptWell: false,
    daysWithoutFood: 0,
    daysWithoutSleep: 0,
    travelDaysSinceRest: 0,
    forcedMarchesSinceRest: 0,
  };
}

/**
 * Records written before sleep quality was tracked carry `slept` and no sleep
 * clock. Reading them through here keeps a test world from throwing away its
 * hunger and rest counts.
 */
function normalise(raw: CharacterDay & { slept?: boolean }): CharacterDay {
  return {
    day: raw.day,
    ate: raw.ate ?? false,
    sleptWell: raw.sleptWell ?? raw.slept ?? false,
    daysWithoutFood: raw.daysWithoutFood ?? 0,
    daysWithoutSleep: raw.daysWithoutSleep ?? 0,
    travelDaysSinceRest: raw.travelDaysSinceRest ?? 0,
    forcedMarchesSinceRest: raw.forcedMarchesSinceRest ?? 0,
  };
}

/**
 * Today's record for one character.
 *
 * A stored record from an earlier day keeps its clocks but loses `ate` and
 * `sleptWell`: those are about today and nothing has happened yet. The clocks
 * are only advanced by `rollOverCharacterDays`, so merely reading never inflates
 * them.
 */
export function getCharacterDay(actor: Actor): CharacterDay {
  const day = getInnDay();
  const stored = FlagManager.getInventory(actor).day;
  if (!stored) return emptyDay(day);
  const clean = normalise(stored);
  if (clean.day !== day) return { ...clean, day, ate: false, sleptWell: false };
  return clean;
}

async function patchCharacterDay(actor: Actor, patch: Partial<CharacterDay>): Promise<void> {
  const next = { ...getCharacterDay(actor), ...patch };
  await FlagManager.updateInventory(actor, (inv) => {
    inv.day = next;
    return inv;
  });
}

/** Eating ends hunger the moment it happens — the penalty is not owed any more. */
export async function setAte(actor: Actor, ate: boolean): Promise<void> {
  await patchCharacterDay(actor, ate ? { ate, daysWithoutFood: 0 } : { ate });
}

/**
 * Record whether a character got a *good* night's rest — not merely that they
 * lay down. The rules turn on the difference: an easy night is automatic, a
 * moderate or difficult one needs a Constitution Check, and an impossible one
 * fails outright (Player's Book p159).
 *
 * A good night ends exhaustion at once, because the rule reads "exhausted until
 * they get a good night's rest". It also settles the party's rest debt, but only
 * on a day nobody spent a Travel Point — a night in a bedroll halfway through a
 * march is not the rest day the party owes itself. `travelledToday` is passed in
 * rather than read here, so this module need not depend on the day state.
 */
export async function setSleptWell(
  actor: Actor,
  sleptWell: boolean,
  travelledToday: boolean
): Promise<void> {
  if (!sleptWell) {
    await patchCharacterDay(actor, { sleptWell });
    return;
  }
  await patchCharacterDay(actor, {
    sleptWell,
    daysWithoutSleep: 0,
    ...(travelledToday ? {} : { travelDaysSinceRest: 0, forcedMarchesSinceRest: 0 }),
  });
}

/** The party has taken its rest day — this character's rest clock goes to zero. */
export async function setRested(actor: Actor): Promise<void> {
  await patchCharacterDay(actor, { travelDaysSinceRest: 0, forcedMarchesSinceRest: 0 });
}

/**
 * Move every party member on to the new day.
 *
 * - Hunger: cleared by eating, otherwise a day longer.
 * - Sleep: cleared by a good night's rest, otherwise a day longer — the rule is
 *   "exhausted until they get a good night's rest", so nothing but sleep clears
 *   it.
 * - Rest: a day on which the party spent Travel Points adds to the debt. A day
 *   with no Travel Points spent settles it, but only for characters who actually
 *   slept well; a sleepless night in camp is not a rest day.
 *
 * `travelledToday` is whether any Travel Points were spent, not which mode the
 * bar was in — a party can sit in travel mode all day and never break camp.
 *
 * GM only: it writes every party actor at once.
 */
export async function rollOverCharacterDays(
  newDay: number,
  travelledToday: boolean,
  forcedMarchToday: boolean
): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;

  for (const actor of getPartyActors()) {
    const raw = FlagManager.getInventory(actor).day;
    const prev = raw ? normalise(raw) : emptyDay(newDay - 1);
    const next: CharacterDay = {
      day: newDay,
      ate: false,
      sleptWell: false,
      daysWithoutFood: prev.ate ? 0 : prev.daysWithoutFood + 1,
      daysWithoutSleep: prev.sleptWell ? 0 : prev.daysWithoutSleep + 1,
      travelDaysSinceRest: travelledToday
        ? prev.travelDaysSinceRest + 1
        : prev.sleptWell
          ? 0
          : prev.travelDaysSinceRest,
      // A forced march is only a forced march if the party actually marched.
      // The rest day that clears it is the same one the ordinary rest debt
      // wants: a day nobody spent a Travel Point on, slept through properly.
      forcedMarchesSinceRest:
        travelledToday && forcedMarchToday
          ? prev.forcedMarchesSinceRest + 1
          : travelledToday
            ? prev.forcedMarchesSinceRest
            : prev.sleptWell
              ? 0
              : prev.forcedMarchesSinceRest,
    };
    await FlagManager.updateInventory(actor, (inv) => {
      inv.day = next;
      return inv;
    });
  }
}

// ─── Eating from the inventory ─────────────────────────────────────────────────

/**
 * Is this row something a character can sit down and eat?
 *
 * Only the two ration entries carry `edible` in the catalogue; anything else
 * edible is something the GM marked so when creating it, which is why the flag
 * is read off the effective definition rather than a hardcoded list of ids.
 */
export function isEdible(item: Pick<InventoryItem, "definitionId" | "customDefinition">): boolean {
  return definitionFor(item)?.edible === true;
}

/**
 * Eat one portion: the row goes down by one, and a character has eaten today.
 *
 * `source` is whoever holds the food and `eater` is whoever swallows it. They
 * differ in the ordinary case — the party's rations live in the shared store,
 * which is a pack, not a person — so feeding the store instead of the character
 * would leave everyone hungry while the food disappeared.
 *
 * Written by whoever owns the actors, so a player feeds their own character with
 * no GM online. A bundle loses one unit rather than the whole row.
 */
export async function eatItem(
  source: Actor,
  itemId: string,
  eater: Actor = source
): Promise<boolean> {
  const item = FlagManager.getInventory(source).items.find((i) => i.id === itemId);
  if (!item || !isEdible(item)) return false;

  const def = definitionFor(item);
  const sameActor = source.id === eater.id;
  const day = { ...getCharacterDay(eater), ate: true, daysWithoutFood: 0 };

  await FlagManager.updateInventory(source, (draft) => {
    const target = draft.items.find((i) => i.id === itemId);
    if (target) {
      // reduceItem takes a unit off a bundle and reports whether anything is
      // left; a plain row simply loses one from its quantity.
      const survives = isBundle(target, def)
        ? reduceItem(target, def, 1)
        : --target.quantity > 0;
      if (!survives) draft.items = draft.items.filter((i) => i.id !== itemId);
    }
    if (sameActor) draft.day = day;
    return draft;
  });

  if (!sameActor) {
    await FlagManager.updateInventory(eater, (draft) => {
      draft.day = day;
      return draft;
    });
  }

  return true;
}

// ─── Reading the party ─────────────────────────────────────────────────────────

// ─── What the clocks cost ──────────────────────────────────────────────────────

// The hunger table itself lives in `hunger.ts`, a leaf the encumbrance
// calculator can import without dragging this module's dependencies with it.
// Re-exported here so callers still find it beside the clocks it belongs to.
export { hungerEffect, hungerSpeedPenalty, speedAfterHunger, type HungerEffect } from "./hunger";

/**
 * Exhaustion, in points of Attack and Damage.
 *
 * Three sources, all of them "until they rest":
 *
 * - A night without a good rest costs a point, and further nights keep adding
 *   one: "failure to properly sleep for multiple days incurs cumulative
 *   exhaustion penalties (-1 per day)", Player's Book p159.
 * - An overdue rest day costs one flat point however long it stays overdue
 *   (p157).
 * - Every forced march since the last rest day costs a point — "following a
 *   forced march, characters must rest for a full day or become exhausted…
 *   characters who forced march again without resting suffer cumulative
 *   exhaustion penalties (-1 per day)", p156.
 *
 * They stack to no more than -4 — the ceiling p151 puts on exhaustion from all
 * sources at once, not on any one of them alone.
 */
export function exhaustionPenalty(
  daysWithoutSleep: number,
  travelDaysSinceRest: number,
  forcedMarchesSinceRest = 0
): number {
  const fromSleep = Math.max(0, daysWithoutSleep);
  const fromRest = travelDaysSinceRest >= TRAVEL_DAYS_PER_REST ? 1 : 0;
  const fromMarch = Math.max(0, forcedMarchesSinceRest);
  return Math.min(4, fromSleep + fromRest + fromMarch);
}

export interface PartyDayRow {
  actorId: string;
  name: string;
  ate: boolean;
  sleptWell: boolean;
  daysWithoutFood: number;
  daysWithoutSleep: number;
  travelDaysSinceRest: number;
  forcedMarchesSinceRest: number;
  /** Whether this character is carrying anything they could eat right now. */
  hasFood: boolean;
}

export function partyDayRows(): PartyDayRow[] {
  return getPartyActors().map((actor) => {
    const inv = FlagManager.getInventory(actor);
    const day = getCharacterDay(actor);
    return {
      actorId: actor.id ?? "",
      name: actor.name ?? "Unnamed",
      ate: day.ate,
      sleptWell: day.sleptWell,
      daysWithoutFood: day.daysWithoutFood,
      daysWithoutSleep: day.daysWithoutSleep,
      travelDaysSinceRest: day.travelDaysSinceRest,
      forcedMarchesSinceRest: day.forcedMarchesSinceRest,
      hasFood: inv.items.some((i) => isEdible(i)),
    };
  });
}
