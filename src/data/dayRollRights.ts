/**
 * Who may roll what, on whose behalf, and how often.
 *
 * **Leander's ask, 2026-09-02:** a setting that lets the players make the day's
 * rolls from their own bar instead of asking across the table. What they get is
 * deliberately not the Referee's strip: three duties are their own character's
 * business, the camp's group steps are the party's, and everything else — the
 * weather, getting lost, the two wandering-monster checks — stays where it was.
 *
 * **This file is only the rules.** It decides nothing about dice, dialogs or
 * sockets, so `check-dayrights.js` can walk every combination of duty, user and
 * day without Foundry running. The doing is in `dayRollRequest.ts`.
 *
 * Four rules, and they are all the file:
 *
 * 0. **Nothing is open until the Referee opens it.** Each rollable duty carries
 *    a key on the Referee's own strip, and a player sees a die only for the
 *    ones that are turned. His ask, 2026-09-02: *"dass die spieler nur dinge
 *    aus der tagesphase würfeln können, die der dm gerade aktiv geschaltet
 *    hat"* — so the evening is handed out a piece at a time, foraging in the
 *    afternoon and the camp's steps when the party actually makes camp. The
 *    keys fall closed again with the day, exactly as the rolls do.
 * 1. **Own-character duties** — preparing spells, fetching firewood, bedding
 *    down. A player rolls these for a character they own and for nobody else,
 *    once per character per day. What decides membership is where the result
 *    lands, not which part of the day it sits in.
 * 2. **The party's duties** — finding food, and the rest of making camp. One
 *    roll for everyone, once per day, and the answer to "which player" is the
 *    party leader if the table has named one and anybody at all if it has not
 *    (Leander's own resolution: *"2 bauen und wenn keiner benannt ist, dann
 *    wirkt 1"*).
 * 3. **The Referee's** — everything not named above. Unchanged, and never
 *    gated by a key: the keys exist to open things to players, not to lock the
 *    Referee out of their own strip.
 *
 * **The lock resets with the in-game day and with nothing else.** It rides in
 * the day state, which is already cleared on roll-over, so a new day is a clean
 * sheet by construction rather than by a second mechanism that could disagree
 * with the first.
 */

import { MODULE_ID, SETTINGS } from "../constants";

/**
 * A duty each character rolls for themselves, and only for themselves.
 *
 * **What puts a duty here is where its result lands**, not which part of the
 * day it belongs to. Fetching firewood and bedding down are both steps of
 * making camp, and both are personal: the wood goes into the gatherer's own
 * pack, and a bad night's sleep is carried by that character alone — into the
 * next day, as exhaustion. Sleeping was already a Constitution Check per
 * sleeper inside one dialog; this only moves whose finger is on it (Leander,
 * 2026-09-03).
 *
 * **Both of these accumulate**, which is what makes them different from a group
 * roll in the code as well as in the rules: several players roll the same duty
 * on the same night and each result is added to the night's record rather than
 * replacing it.
 */
export const OWN_DUTIES = new Set(["prepare-spells", "firewood", "sleep"]);

/**
 * The party's rolls: one for everyone, once.
 *
 * **Finding food is here because the book puts it here.** Player's Book p152:
 * *"A single Survival Check is made for each group of characters travelling
 * together, using the best Skill Target of all characters."* Splitting up to
 * roll more often is a real option — and it costs each smaller group its own
 * chance of getting lost and its own wandering-monster check, neither of which
 * this module models. So one roll a day for the party, and a Referee who wants
 * the party split rolls it by hand (Leander, 2026-09-03: *"falls die gruppe
 * sich aufteilen will, kann ich als DM das ja steuern und durchwürfeln"*).
 *
 * **Two steps of making camp are NOT here** — fetching firewood and bedding
 * down. Both are personal in their consequences rather than in their setting;
 * see `OWN_DUTIES` above.
 */
export const GROUP_DUTIES = new Set([
  "forage",
  "campsite",
  "water",
  "fire",
  "cooking",
  "entertainment",
  "watches",
]);

export type RollScope = "own" | "group" | "referee";

export function scopeOf(dutyId: string): RollScope {
  if (OWN_DUTIES.has(dutyId)) return "own";
  if (GROUP_DUTIES.has(dutyId)) return "group";
  return "referee";
}

/** What the day state remembers: duty id → the actor ids it has been rolled for. */
export type RolledBy = Record<string, string[]>;

/**
 * Has this duty already been rolled for this character today?
 *
 * A group duty is recorded against the actor whose player pressed it, but asked
 * about without one: it is the party's roll, and the second player to reach it
 * must be refused however many characters they own.
 */
export function alreadyRolled(rolledBy: RolledBy, dutyId: string, actorId?: string): boolean {
  const rolled = rolledBy[dutyId];
  if (!rolled || rolled.length === 0) return false;
  if (scopeOf(dutyId) === "own" && actorId) return rolled.includes(actorId);
  return true;
}

export function withRoll(rolledBy: RolledBy, dutyId: string, actorId: string): RolledBy {
  const rolled = rolledBy[dutyId] ?? [];
  if (rolled.includes(actorId)) return rolledBy;
  return { ...rolledBy, [dutyId]: [...rolled, actorId] };
}

/**
 * Which duties the Referee has turned the key on today.
 *
 * A list rather than a record of booleans: "open" is the exception and the
 * common state is the empty list, which is also what a fresh day starts with.
 */
export function isOpen(openDuties: string[] | undefined, dutyId: string): boolean {
  return !!openDuties?.includes(dutyId);
}

export function withOpen(
  openDuties: string[] | undefined,
  dutyId: string,
  open: boolean
): string[] {
  const list = openDuties ?? [];
  if (open) return list.includes(dutyId) ? list : [...list, dutyId];
  return list.filter((d) => d !== dutyId);
}

export interface RightsInput {
  isGM: boolean;
  /** Has the table switched the players' half on? */
  playersMayRoll: boolean;
  /** The actor the player is rolling as — one they own. */
  actorId?: string;
  /** The named camp leader, or "" for "anybody". */
  campLeaderId: string;
  rolledBy: RolledBy;
  /** The duties the Referee has opened to players today. */
  openDuties?: string[];
}

export interface Verdict {
  allowed: boolean;
  /** Why not — always said, never left to be guessed at from a dead button. */
  reason?: string;
}

const ALLOWED: Verdict = { allowed: true };

/**
 * May this user roll this duty right now?
 *
 * The Referee is never in anybody's way: they may roll anything at any time,
 * including a duty a player has already had. Taking a roll back is theirs alone
 * and is what un-does the lock.
 */
export function mayRoll(dutyId: string, input: RightsInput): Verdict {
  if (input.isGM) return ALLOWED;

  const scope = scopeOf(dutyId);
  if (scope === "referee") return { allowed: false, reason: "The Referee rolls this one." };

  if (!input.playersMayRoll) {
    return { allowed: false, reason: "The table has not switched the players' own rolls on." };
  }

  // **The key first, before anything about characters.** It is the Referee
  // saying "this part of the day is happening now", and until they do, nothing
  // else about the roll is worth asking.
  if (!isOpen(input.openDuties, dutyId)) {
    return { allowed: false, reason: "The Referee has not opened this one yet." };
  }

  if (!input.actorId) {
    return { allowed: false, reason: "No character of yours to roll it for." };
  }

  if (scope === "own") {
    return alreadyRolled(input.rolledBy, dutyId, input.actorId)
      ? { allowed: false, reason: "Already done today. It comes back with the next day." }
      : ALLOWED;
  }

  // A group step. Whoever the table named, or anybody if it named nobody.
  if (input.campLeaderId && input.campLeaderId !== input.actorId) {
    return { allowed: false, reason: "The party leader rolls this one." };
  }
  return alreadyRolled(input.rolledBy, dutyId)
    ? { allowed: false, reason: "Somebody has already done this today." }
    : ALLOWED;
}

// ─── Reading the world ────────────────────────────────────────────────────────

export function playersMayRoll(): boolean {
  return !!(game as Game).settings?.get(MODULE_ID, SETTINGS.PLAYER_DAY_ROLLS);
}

export function campLeaderId(): string {
  return ((game as Game).settings?.get(MODULE_ID, SETTINGS.CAMP_LEADER) as string) || "";
}
