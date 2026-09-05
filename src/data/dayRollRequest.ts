/**
 * A player asking for one of the day's rolls, and the Referee's client making it.
 *
 * `dayRollRights.ts` decides *whether* a roll may happen; this decides *how* it
 * happens, and the split is the whole shape of the feature:
 *
 * - **The questions are asked where the fingers are.** Who went for wood, who
 *   sleeps under what, how many spells a caster is attempting — those are the
 *   player's answers, so the dialog opens on the player's own client and the
 *   choice it produces is what travels.
 * - **The dice and the writing happen on the Referee's client.** The day state
 *   is a world setting and only a GM may write one, and every `roll*` function
 *   already refuses to run anywhere else. So the choice is emitted, the GM's
 *   client rolls it, and the result reaches everybody as a settings update —
 *   the same path a Referee's own roll takes.
 * - **The rights are checked twice, and the second check is the real one.** A
 *   player's client checks first so that a refusal costs nothing and says why;
 *   the GM's client checks again, and there it also asks the one question a
 *   player cannot answer for themselves: does that user actually own that
 *   character. Foundry's socket carries whatever the sender puts in it.
 *
 * The one duty that does not fit the shape is cooking, which asks a second
 * question — who eats — that can only be asked once the pot is a fact. The pot
 * becomes a fact on the GM's client, so the player's client waits for the day
 * state to come back and then sends a second request. Whoever stirred it dishes
 * it out; see `verdictFor`.
 *
 * On the import cycle with `SocketHandler`: it imports `applyDayRoll` and this
 * imports it back. Both references sit inside functions, never at module scope,
 * so neither file needs the other to have finished evaluating.
 */

import { SOCKET_EVENTS } from "../constants";
import { SocketHandler } from "../socket/SocketHandler";
import { getDayState, markRolledBy, setDutyDone, type DayState } from "./dayDuties";
import { getCampState } from "./campRolls";
import {
  campLeaderId,
  mayRoll,
  playersMayRoll,
  scopeOf,
  type RightsInput,
  type Verdict,
} from "./dayRollRights";
import {
  rollCampActivity,
  rollFire,
  rollFirewood,
  rollSleep,
  rollWatches,
  serveMeal,
  type Gatherer,
  type MealChoice,
  type SleeperChoice,
  type WatchKeeperChoice,
} from "./campRolls";
import { rollEncounter, rollFindingFood, rollGettingLost, rollWeather } from "./dayRolls";
import {
  noteSpellsPreparedFreely,
  rollSpellPreparation,
  type CasterChoice,
} from "./morningRolls";
import type { CampActivity } from "./camping";
import type { FoodMethod } from "./findingFood";
import {
  promptCampActivity,
  promptEaters,
  promptFire,
  promptFirewood,
  promptSleep,
  promptWatches,
  runCampDuty,
} from "../apps/CampDuties";
import { promptSpellPreparation, runMorningDuty } from "../apps/MorningDuties";
import { promptFindFood } from "../apps/FindFoodDialog";

// ─── What travels ─────────────────────────────────────────────────────────────

/**
 * The answers a dialog produced, in a shape that survives a socket.
 *
 * Every member is plain data — ids, names, numbers, booleans. Nothing here may
 * be an Actor, a Roll or anything else with methods on it: Foundry serialises
 * the payload, and a class would arrive as a bare object with its behaviour
 * quietly missing.
 */
export type DayRollChoice =
  /** A duty with no table behind it — the campsite, the water. Just the tick. */
  | { kind: "tick" }
  | { kind: "firewood"; gatherers: Gatherer[]; modifier: number }
  | { kind: "fire"; chance: number; fuel: { holderId: string; itemId: string; hours: number }[] }
  | {
      kind: "activity";
      activity: CampActivity;
      /** Whose Wisdom is cooking, or whose Charisma is singing. */
      cookId: string;
      meal?: MealChoice;
      doomTarget?: number;
    }
  /** The second half of cooking: who sits down to it. */
  | { kind: "serve"; eaterIds: string[] }
  | { kind: "watches"; keepers: WatchKeeperChoice[]; nightHours: number }
  | { kind: "sleep"; sleepers: SleeperChoice[]; campfire: boolean }
  | {
      kind: "forage";
      method: FoodMethod;
      target: number;
      fullDay: boolean;
      situational: number;
      forager?: string;
      storeToId?: string;
    }
  | { kind: "spells"; casters: CasterChoice[] };

export interface DayRollPayload {
  dutyId: string;
  /** The character it is rolled for — and, for a group roll, who pressed it. */
  actorId: string;
  choice: DayRollChoice;
}

// ─── The Referee's own client, rolling for themselves ─────────────────────────

/**
 * One duty, prompt and dice and card, on this client.
 *
 * The Referee's strip calls this, and so does `requestDayRoll` when the person
 * pressing happens to be a GM: there is no reason to send a message to
 * yourself, and cooking's second question is far simpler when the roll it waits
 * for has already happened by the time the first `await` returns.
 */
export async function runDayDutyHere(dutyId: string): Promise<void> {
  if (dutyId === "weather") return void (await rollWeather());
  if (dutyId === "lost") return void (await rollGettingLost());
  if (dutyId === "encounter-day") return void (await rollEncounter("day"));
  if (dutyId === "encounter-night") return void (await rollEncounter("night"));
  if (dutyId === "healing" || dutyId === "prepare-spells") return runMorningDuty(dutyId);
  if (dutyId === "forage") {
    const choice = await promptFindFood();
    if (!choice) return;
    await rollFindingFood(
      choice.method,
      choice.target,
      choice.fullDay,
      choice.situational,
      choice.forager,
      choice.storeToId
    );
    return;
  }
  await runCampDuty(dutyId);
}

// ─── The player's client, asking ──────────────────────────────────────────────

/**
 * A player pressing the die on their own strip.
 *
 * Refusals are said out loud, with the reason the rights model gave — a dead
 * button that explains nothing is the thing that whole model exists to avoid.
 */
export async function requestDayRoll(dutyId: string, actorId: string): Promise<void> {
  const g = game as Game;
  if (g.user?.isGM) return runDayDutyHere(dutyId);

  const verdict = mayRoll(dutyId, rightsInputFor(actorId, getDayState()));
  if (!verdict.allowed) {
    ui.notifications?.warn(verdict.reason ?? "That one is not yours to roll.");
    return;
  }
  // Without a GM online the message goes nowhere at all, and the player would
  // be walked through a dialog that then quietly did nothing.
  if (!activeGM()) {
    ui.notifications?.warn("No GM is connected, so that roll could not be made.");
    return;
  }

  const choice = await promptFor(dutyId);
  if (!choice) return;
  send({ dutyId, actorId, choice });

  // Cooking asks who eats, and can only ask once the pot is a fact — which
  // happens on the GM's client, a round trip away.
  if (dutyId === "cooking") await askWhoEats(actorId);
}

/** The dialog each duty opens before anything is sent. */
async function promptFor(dutyId: string): Promise<DayRollChoice | null> {
  // The two steps of making camp that have no table behind them: somebody
  // cleared the ground, somebody filled the waterskins. Only the tick travels.
  if (dutyId === "campsite" || dutyId === "water") return { kind: "tick" };

  if (dutyId === "firewood") {
    const choice = await promptFirewood();
    return choice ? { kind: "firewood", ...choice } : null;
  }
  if (dutyId === "fire") {
    const choice = await promptFire();
    return choice ? { kind: "fire", chance: choice.chance, fuel: choice.fuel } : null;
  }
  if (dutyId === "cooking" || dutyId === "entertainment") {
    const activity: CampActivity = dutyId === "cooking" ? "cooking" : "camaraderie";
    const choice = await promptCampActivity(activity);
    if (!choice) return null;
    return {
      kind: "activity",
      activity,
      cookId: choice.actorId,
      ...(choice.meal ? { meal: choice.meal } : {}),
      ...(choice.doomTarget !== undefined ? { doomTarget: choice.doomTarget } : {}),
    };
  }
  if (dutyId === "watches") {
    const choice = await promptWatches();
    return choice ? { kind: "watches", ...choice } : null;
  }
  if (dutyId === "sleep") {
    const choice = await promptSleep();
    return choice ? { kind: "sleep", ...choice } : null;
  }
  if (dutyId === "forage") {
    const choice = await promptFindFood();
    return choice ? { kind: "forage", ...choice, situational: choice.situational ?? 0 } : null;
  }
  if (dutyId === "prepare-spells") {
    const choice = await promptSpellPreparation();
    return choice ? { kind: "spells", casters: choice.casters } : null;
  }
  return null;
}

/**
 * Wait for the pot, then ask who eats.
 *
 * The wait is on the day state coming back rather than on a reply of our own:
 * the GM's write reaches every client as a settings update anyway, so hanging a
 * second socket event off the roll would only be a second thing that can
 * disagree with the first. If it never arrives — a refused request, a GM who
 * logged out mid-supper — the wait times out and nobody is asked anything.
 */
async function askWhoEats(actorId: string): Promise<void> {
  const meal = await waitForDayState((state) => state.camp?.cooking?.meal);
  if (!meal || meal.ruined || meal.portions <= 0) return;
  const diners = await promptEaters(meal.portions);
  if (!diners) return;
  send({ dutyId: "cooking", actorId, choice: { kind: "serve", eaterIds: diners.eaterIds } });
}

const DAY_STATE_WAIT_MS = 20_000;

/** Resolve with whatever the day state gains, or undefined if it never gains it. */
function waitForDayState<T>(
  read: (state: DayState) => T | undefined,
  ms = DAY_STATE_WAIT_MS
): Promise<T | undefined> {
  const already = read(getDayState());
  if (already !== undefined) return Promise.resolve(already);

  return new Promise<T | undefined>((resolve) => {
    let settled = false;
    const done = (value: T | undefined) => {
      if (settled) return;
      settled = true;
      Hooks.off("updateSetting", onSetting);
      clearTimeout(timer);
      resolve(value);
    };
    const onSetting = () => {
      const value = read(getDayState());
      if (value !== undefined) done(value);
    };
    const timer = setTimeout(() => done(undefined), ms);
    Hooks.on("updateSetting", onSetting);
  });
}

function send(payload: DayRollPayload): void {
  SocketHandler.emit(SOCKET_EVENTS.DAY_ROLL, payload);
}

function activeGM(): boolean {
  const g = game as Game;
  return (g.users?.contents ?? []).some((u) => u.isGM && u.active);
}

// ─── The Referee's client, doing it ───────────────────────────────────────────

/**
 * A request off the socket: check it properly, then roll it.
 *
 * Runs only on a GM's client — `SocketHandler` has already established that —
 * and `userId` is the player who asked, which is what makes the ownership
 * question answerable at all.
 */
export async function applyDayRoll(payload: DayRollPayload, userId: string): Promise<void> {
  if (!(game as Game).user?.isGM) return;

  const verdict = verdictFor(payload, userId);
  if (!verdict.allowed) {
    await tellUser(userId, verdict.reason ?? "That roll could not be made.");
    return;
  }

  await carryOut(payload, userId);

  // Serving is the tail of a roll already recorded, not a roll of its own.
  if (payload.choice.kind !== "serve") await markRolledBy(payload.dutyId, payload.actorId);
}

/**
 * The choice, applied. Every branch here is GM-side and writes the day.
 *
 * **Where a request could be worth cheating with, the value is taken from the
 * world rather than from the message.** A disabled input on a player's screen
 * is a courtesy; this is the lock. See the sleep branch.
 */
async function carryOut({ dutyId, choice }: DayRollPayload, userId: string): Promise<void> {
  const user = (game as Game).users?.get(userId);
  const fromGM = !!user?.isGM;
  switch (choice.kind) {
    case "tick":
      await setDutyDone(dutyId, true);
      return;
    case "firewood":
      await rollFirewood(choice.gatherers, choice.modifier);
      return;
    case "fire":
      await rollFire(choice.chance, choice.fuel);
      return;
    case "activity":
      await rollCampActivity(choice.activity, choice.cookId, choice.meal, choice.doomTarget);
      return;
    case "serve":
      await serveMeal(choice.eaterIds);
      return;
    case "watches":
      await rollWatches(choice.keepers, choice.nightHours);
      return;
    case "sleep": {
      // **The fire is a fact of the camp, not an answer on the form.** It eases
      // the Sleep Difficulty for everyone with bedding, so a player who could
      // tick it would be rolling a different table (Dolmenmaster, 2026-09-03:
      // *"sonst kann man ja cheaten"*). The Referee's own tick still stands —
      // a fire the module never saw lit is a ruling they are entitled to make.
      const campfire = fromGM ? choice.campfire : (getCampState().fire?.lit ?? true);
      // And a player beds down their own characters and nobody else's, however
      // the message arrived.
      const sleepers = fromGM
        ? choice.sleepers
        : choice.sleepers.filter((s) => ownedBy(s.actorId, user));
      if (!sleepers.length) return;
      await rollSleep(sleepers, campfire);
      return;
    }
    case "forage":
      await rollFindingFood(
        choice.method,
        choice.target,
        choice.fullDay,
        choice.situational,
        choice.forager,
        choice.storeToId
      );
      return;
    case "spells":
      // An empty list is the answer "nobody in the party lost sleep", not an
      // empty request: every caster then prepares their whole list without a
      // die, and the card and the credits are written here, once, on the
      // Referee's client. See `promptSpellPreparation`.
      if (choice.casters.length) await rollSpellPreparation(choice.casters);
      else await noteSpellsPreparedFreely();
      return;
  }
}

/** Does that user own that character? The one question a message cannot answer. */
function ownedBy(actorId: string, user: unknown): boolean {
  const actor = (game as Game).actors?.get(actorId);
  return !!actor && !!user && actor.testUserPermission(user as User, "OWNER");
}

/**
 * The check that matters, because it is the one the asker cannot write.
 *
 * Ownership first: a player may put anything at all in a socket message, and
 * "that is not your character" is the answer to most of it. Then the ordinary
 * rights, read from the world rather than from the message — the key, the
 * setting, and the day's own record of who has already rolled.
 */
export function verdictFor(payload: DayRollPayload, userId: string): Verdict {
  const g = game as Game;
  const user = g.users?.get(userId);
  if (!user) return { allowed: false, reason: "That request came from nobody." };
  if (user.isGM) return { allowed: true };

  const actor = g.actors?.get(payload.actorId);
  if (!actor) return { allowed: false, reason: "That character is not in this world." };
  if (!actor.testUserPermission(user, "OWNER")) {
    return { allowed: false, reason: "That is not your character." };
  }

  const state = getDayState();

  // Dishing out the meal is the second half of the roll that made it, so it is
  // asked about as that roll rather than as a new one — which has already been
  // recorded, and would therefore refuse itself.
  if (payload.choice.kind === "serve") {
    const stirred = state.rolledBy?.["cooking"] ?? [];
    return stirred.includes(payload.actorId)
      ? { allowed: true }
      : { allowed: false, reason: "Whoever cooked it serves it." };
  }

  const verdict = mayRoll(payload.dutyId, rightsInputFor(payload.actorId, state));
  if (!verdict.allowed) return verdict;

  // Last, because it is the only refusal here that no honest client can
  // provoke: the rights come first so that an ordinary "not yet" or "not
  // yours" is what gets said. The kind of answer still has to match the duty it
  // claims to be, or a player entitled to a group roll could send a sleep roll
  // in its place.
  return fits(payload.dutyId, payload.choice.kind)
    ? verdict
    : { allowed: false, reason: "That answer does not belong to that duty." };
}

/** Which choice each duty is allowed to arrive with. */
const CHOICE_FOR_DUTY: Record<string, DayRollChoice["kind"]> = {
  campsite: "tick",
  water: "tick",
  firewood: "firewood",
  fire: "fire",
  cooking: "activity",
  entertainment: "activity",
  watches: "watches",
  sleep: "sleep",
  forage: "forage",
  "prepare-spells": "spells",
};

function fits(dutyId: string, kind: DayRollChoice["kind"]): boolean {
  return CHOICE_FOR_DUTY[dutyId] === kind;
}

function rightsInputFor(actorId: string, state: DayState): RightsInput {
  return {
    isGM: false,
    playersMayRoll: playersMayRoll(),
    actorId,
    campLeaderId: campLeaderId(),
    rolledBy: state.rolledBy ?? {},
    openDuties: state.openDuties,
  };
}

/**
 * Tell the one player why nothing happened.
 *
 * A whisper rather than a notification: the refusal is raised on the GM's
 * client, and `ui.notifications` there would tell the wrong person entirely.
 */
async function tellUser(userId: string, reason: string): Promise<void> {
  await ChatMessage.create({
    content: `<p class="dw-day-roll-refused">${reason}</p>`,
    whisper: [userId],
  } as Parameters<typeof ChatMessage.create>[0]);
}

/** Only these ever reach a player's strip; everything else is the Referee's. */
export function isPlayerRollable(dutyId: string): boolean {
  return scopeOf(dutyId) !== "referee";
}
