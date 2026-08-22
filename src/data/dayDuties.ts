import { MODULE_ID, SETTINGS } from "../constants";
import { getInnDay, advanceInnDay } from "./innMenu";
import { rollOverCharacterDays } from "./characterDay";
import type { WeatherResult } from "./weather";
import type { LostResult } from "./gettingLost";
import type { FoodResult } from "./findingFood";

/**
 * The day's duties — the Referee's per-day checklist.
 *
 * Dolmenwood has a per-day procedure for each place the party can be, and the
 * Player's Book spells them out: Travel (p156), Camping (p158), and Settlements
 * (p160). They overlap but are not the same list, so the bar shows the duties
 * for the mode the day is currently in. A day passes through several modes —
 * wake, travel, camp — so ticks live in one record keyed by duty id and survive
 * a mode switch.
 *
 * **Day start** is the module's own fourth tab rather than the book's: the three
 * things every day opens with, wherever the party slept, gathered in one place
 * instead of repeated in each of the other three.
 *
 * These are all **party-wide** ticks. Anything that lands on an individual
 * character — eating, sleeping, and the hunger, sleep and rest clocks they drive
 * — lives in `characterDay.ts`, because those penalties are per character.
 *
 * The table is deliberately declarative: one entry per duty, so removing a duty
 * is deleting a literal.
 */

export type DutyMode = "dawn" | "travel" | "camp" | "settlement";

export const DUTY_MODES: { id: DutyMode; label: string; icon: string }[] = [
  { id: "dawn", label: "Day start", icon: "fa-sunrise" },
  { id: "travel", label: "Travel", icon: "fa-person-hiking" },
  { id: "camp", label: "Camp", icon: "fa-campground" },
  { id: "settlement", label: "Settlement", icon: "fa-house-chimney" },
];

/**
 * Setting up a camp is one job done in one stretch, not seven unrelated errands.
 * Its steps live behind one tick in the strip and open in their own window: seven
 * of them side by side made the Camp tab twice the width of every other one.
 */
export const DUTY_GROUPS: Record<string, { label: string; icon: string }> = {
  "camp-setup": { label: "Making camp", icon: "fa-campground" },
};

export interface Duty {
  id: string;
  label: string;
  icon: string;
  modes: DutyMode[];
  /** What it is and where it comes from, shown on hover. */
  hint: string;
  /** Draws this duty inside the named band from DUTY_GROUPS. */
  group?: keyof typeof DUTY_GROUPS;
}

export const DUTIES: Duty[] = [
  // ── Day start: what every morning owes, wherever it began ──
  {
    id: "weather",
    label: "Weather",
    icon: "fa-cloud-sun-rain",
    modes: ["dawn"],
    hint: "Step 1 of the Travel and Settlement procedures — roll the day's weather on the Campaign Book tables. Fog and blizzards also raise the chance of getting lost, and the season decides how hard it is to sleep out.",
  },
  {
    id: "healing",
    label: "Healing",
    icon: "fa-heart-pulse",
    modes: ["dawn"],
    hint: "Those who got a good night's rest heal 1 HP. A full day of rest in a settlement heals 1d3 instead, but precludes anything more strenuous than an inn chair.",
  },
  {
    id: "prepare-spells",
    label: "Prepare spells",
    icon: "fa-wand-sparkles",
    modes: ["dawn"],
    hint: "Spell-casters memorise or pray for the day's spells. A character who failed to get a good night's rest has a 1-in-6 chance of losing each spell they try to prepare.",
  },

  // ── Travel ──
  {
    id: "lost",
    label: "Getting lost",
    icon: "fa-map-location-dot",
    modes: ["travel"],
    hint: "Step 3 — one roll per travel day, made at the start of it. 1-in-6 in light terrain and on tracks, 2-in-6 moderate, 3-in-6 difficult; +1 in fog, +2 in darkness. No chance at all on a road.",
  },
  {
    id: "encounter-day",
    label: "Encounter (day)",
    icon: "fa-dice-d6",
    modes: ["travel", "settlement"],
    hint: "One daytime wandering-monster check. In the wilds the chance is the terrain's (1/2/3-in-6); in a settlement it is 2-in-6 while the party is out and about.",
  },
  {
    id: "forage",
    label: "Finding food",
    icon: "fa-wheat-awn",
    modes: ["travel"],
    hint: "Optional — one Survival Check per group per day to fish, forage, or hunt. Foraging yields 1d6 fresh rations, 1d4 in winter and 1d8 in autumn; a whole day given over to it grants +2.",
  },

  // ── Making camp: one job, seven steps ──
  {
    id: "campsite",
    label: "Campsite",
    icon: "fa-tents",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Step 1 — at least one character stays back to clear ground, pitch tents, and dig a fire pit.",
  },
  {
    id: "firewood",
    label: "Firewood",
    icon: "fa-fire-burner",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Each character fetching wood collects enough for 1d6 hours of fire. Damp -1, snow -2, heavy rain -4.",
  },
  {
    id: "water",
    label: "Water",
    icon: "fa-droplet",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Refill waterskins. Easy almost everywhere in Dolmenwood — but a character without water loses 3 Constitution a day.",
  },
  {
    id: "fire",
    label: "Fire",
    icon: "fa-fire",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Step 2 — automatic given a tinder box and wood; 4-in-6 or worse in troublesome conditions. A campfire moves every row of the sleep difficulty table in the party's favour.",
  },
  {
    id: "cooking",
    label: "Cooking",
    icon: "fa-utensils",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Optional Wisdom Check. Success gives everyone +1 on the Constitution Check to rest; a natural 1 means Save Versus Doom or the ingredients are ruined.",
  },
  {
    id: "entertainment",
    label: "Camaraderie",
    icon: "fa-guitar",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Optional Charisma Check. Success gives everyone +1 on the Constitution Check to rest; a natural 1 means Save Versus Doom or -1 instead.",
  },
  {
    id: "watches",
    label: "Watches",
    icon: "fa-tower-observation",
    modes: ["camp"],
    group: "camp-setup",
    hint: "Step 3 — usually four characters taking 2 hour watches across 8 hours. Under 6 hours of sleep is not a good night's rest, and a broken night makes spell preparation harder.",
  },

  // ── The night ──
  {
    id: "encounter-night",
    label: "Encounter (night)",
    icon: "fa-moon",
    modes: ["camp", "settlement"],
    hint: "One nighttime wandering-monster check — the terrain's chance while camping, 1-in-6 in a settlement if the party is active. Sleeping characters are automatically surprised.",
  },
];

export function dutiesForMode(mode: DutyMode): Duty[] {
  return DUTIES.filter((d) => d.modes.includes(mode));
}

// ─── State ─────────────────────────────────────────────────────────────────────

export interface DayState {
  /** The in-game day these ticks belong to; mirrors the inn day counter. */
  day: number;
  mode: DutyMode;
  /** Duty id → ticked. */
  done: Record<string, boolean>;
  /** Travel Points spent so far today; the budget itself is derived from Speed. */
  travelPointsUsed: number;
  /**
   * Is today a forced march? Raises the day's Travel Point budget by half and
   * costs every character who marched a rest day (Player's Book p156).
   */
  forcedMarch: boolean;
  /**
   * The day's Travel Point allowance, frozen when the day is first drawn.
   *
   * "Travel Points Per Day" is a per-day allowance read off the party's Speed
   * (Player's Book p156), and the day's procedure spends it down — so it must
   * not move under the party mid-march because somebody ate a ration, picked up
   * a hoard, or left a mule behind. Absent means "not yet frozen today"; the bar
   * derives it once from the convoy and writes it here, and a button beside the
   * counter re-derives it when the GM decides the party's circumstances really
   * have changed. This is the normal allowance; a forced march raises it live.
   */
  travelPointBudget?: number;
  /**
   * What the day's weather turned out to be, once rolled.
   *
   * A fact about this day, so it lives and dies with it. It is also read back:
   * the "travel impeded" letter takes 2 off the day's Travel Points, and "poor
   * visibility" raises the chance of losing the way.
   */
  weather?: WeatherResult;
  /** Today's roll for losing the way, and what it cost if it was lost. */
  lost?: LostResult;
  /** Today's attempt at finding food: which method, and what it produced. */
  food?: FoodResult;
  /**
   * The world-clock day this counter was last aligned with, when following a
   * calendar module. Absent while not following, or before the first sighting.
   */
  lastDayKey?: string;
}

function defaultState(day: number): DayState {
  return { day, mode: "dawn", done: {}, travelPointsUsed: 0, forcedMarch: false };
}

export function getDayState(): DayState {
  const stored = (game as Game).settings?.get(MODULE_ID, SETTINGS.DAY_STATE) as
    | DayState
    | undefined;
  const day = getInnDay();
  if (!stored) return defaultState(day);
  if (stored.day !== day) {
    // The day moved on somewhere else — most likely the inn's own new-day
    // button. Show a clean sheet at once; reconcileDay persists it.
    return {
      ...stored,
      day,
      done: {},
      travelPointsUsed: 0,
      forcedMarch: false,
      travelPointBudget: undefined,
      // Yesterday's weather and yesterday's wrong turning are not this day's.
      weather: undefined,
      lost: undefined,
      food: undefined,
    };
  }
  return { ...stored, travelPointsUsed: stored.travelPointsUsed ?? 0, forcedMarch: stored.forcedMarch ?? false };
}

async function writeState(state: DayState): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  await g.settings.set(MODULE_ID, SETTINGS.DAY_STATE, state);
}

/**
 * Catch the stored state up to the day counter.
 *
 * The day can advance from the inn window as well as from the bar, so rather
 * than coupling the two this notices the mismatch and rolls over: ticks and
 * Travel Points are cleared, and every character's clocks move with it.
 */
export async function reconcileDay(): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const stored = g.settings.get(MODULE_ID, SETTINGS.DAY_STATE) as DayState | undefined;
  const day = getInnDay();
  if (stored && stored.day === day) return;

  // What makes a day a travel day is that the party actually moved — it can sit
  // in travel mode all day and never break camp.
  await rollOverCharacterDays(day, (stored?.travelPointsUsed ?? 0) > 0, stored?.forcedMarch ?? false);
  await writeState({
    day,
    // A new day opens at its start, whatever the last one ended as.
    mode: "dawn",
    done: {},
    travelPointsUsed: 0,
    // A forced march is a decision taken for one day, never carried into the next.
    forcedMarch: false,
    ...(stored?.lastDayKey ? { lastDayKey: stored.lastDayKey } : {}),
  });
}

/**
 * Advance the in-game day. Rolls the inn menus over too — one day, one counter.
 *
 * The world-clock marker is re-aligned afterwards, so a day advanced from the
 * bar is not then advanced a second time when the calendar module catches up.
 */
export async function startNewDay(): Promise<void> {
  await advanceInnDay();
  await reconcileDay();
  const key = worldDayKey();
  if (key) await writeState({ ...getDayState(), lastDayKey: key });
}

export async function setDutyMode(mode: DutyMode): Promise<void> {
  await writeState({ ...getDayState(), mode });
}

/**
 * Declare the day a forced march, or take it back.
 *
 * A whole-party decision rather than a per-character one: the party marches
 * together or not at all, and the book prices it that way. What it costs lands
 * on the characters at the day's roll-over, not here — until midnight it is
 * still a plan, and a GM who mis-clicks should be able to undo it.
 */
export async function setForcedMarch(forcedMarch: boolean): Promise<void> {
  await writeState({ ...getDayState(), forcedMarch });
}

/**
 * Freeze the day's Travel Point allowance, or clear it so it is derived afresh.
 *
 * The number comes from the caller: it is read off the convoy's speed, and this
 * module deliberately does not reach for that — the same reason
 * `spendTravelPoints` takes the budget as an argument.
 */
export async function setTravelPointBudget(budget: number | undefined): Promise<void> {
  await writeState({ ...getDayState(), travelPointBudget: budget });
}

export async function setDutyDone(id: string, done: boolean): Promise<void> {
  const state = getDayState();
  await writeState({ ...state, done: { ...state.done, [id]: done } });
}

/**
 * Record what a table produced today.
 *
 * The result and the tick are written together: a rolled duty is a done duty,
 * and leaving the GM to tick it afterwards was the sort of second step that
 * makes a feature feel unfinished. Clearing a result (undefined) unticks it
 * again, so a mis-click can be taken back and re-rolled.
 */
export async function setDutyResult(
  id: string,
  patch: Pick<DayState, "weather"> | Pick<DayState, "lost"> | Pick<DayState, "food">
): Promise<void> {
  const state = getDayState();
  const value = Object.values(patch)[0];
  await writeState({
    ...state,
    ...patch,
    done: { ...state.done, [id]: value !== undefined },
  });
}

/**
 * Tick or clear several duties in one write.
 *
 * A loop of setDutyDone calls would write the world setting once per duty:
 * seven round trips, seven hook cycles, and seven re-renders for one click.
 */
export async function setDutiesDone(ids: string[], done: boolean): Promise<void> {
  const state = getDayState();
  const next = { ...state.done };
  for (const id of ids) next[id] = done;
  await writeState({ ...state, done: next });
}

/** Clear today's ticks and spent Travel Points without moving the day on. */
export async function resetDuties(): Promise<void> {
  // The frozen allowance goes too: resetting the day is starting it over, and
  // it should be read off the party as they stand now.
  await writeState({
    ...getDayState(),
    done: {},
    travelPointsUsed: 0,
    forcedMarch: false,
    travelPointBudget: undefined,
    weather: undefined,
    lost: undefined,
    food: undefined,
  });
}

/**
 * Spend or hand back Travel Points.
 *
 * Clamped at both ends: nothing spent at one, the whole budget at the other, so
 * the readout can never go negative. `budget` comes from the caller because it
 * is derived from the convoy's speed, which this module deliberately does not
 * reach for.
 */
export async function spendTravelPoints(delta: number, budget: number): Promise<void> {
  const state = getDayState();
  const used = Math.min(Math.max(0, budget), Math.max(0, state.travelPointsUsed + delta));
  await writeState({ ...state, travelPointsUsed: used });
}

// ─── Following a calendar module ───────────────────────────────────────────────

/**
 * A key that changes exactly when the world moves on to another day.
 *
 * Deliberately built on **core's** `game.time.worldTime` rather than any one
 * module's API, because every calendar and clock module drives that same value —
 * Simple Calendar, SmallTime and about-time all do — and core fires
 * `updateWorldTime` when it changes. Simple Calendar is asked first where it is
 * installed, since it knows the world's own calendar and a Dolmenwood day need
 * not be 24 hours long; the division is only the fallback.
 *
 * This is a change detector, not arithmetic: it never needs to be comparable
 * across calendars, only different from the last one seen.
 */
export function worldDayKey(): string | undefined {
  const g = game as Game;
  const worldTime = g.time?.worldTime;
  if (typeof worldTime !== "number") return undefined;

  const api = (
    globalThis as { SimpleCalendar?: { api?: { timestampToDate?: (t: number) => unknown } } }
  ).SimpleCalendar?.api;
  const date = api?.timestampToDate?.(worldTime) as
    | { year?: number; month?: number; day?: number }
    | undefined;
  if (date && typeof date.year === "number" && typeof date.day === "number") {
    return `sc:${date.year}-${date.month ?? 0}-${date.day}`;
  }

  return `wt:${Math.floor(worldTime / 86400)}`;
}

/**
 * The one client that may move the day on.
 *
 * With two GMs connected, both would see the clock change and both would advance
 * the counter. Foundry nominates one active GM for exactly this kind of work;
 * where that is unavailable, any GM will do rather than nobody.
 */
function isPrimaryGM(): boolean {
  const g = game as Game;
  const activeGM = (g.users as unknown as { activeGM?: { id?: string } } | undefined)?.activeGM;
  if (activeGM) return activeGM.id === g.user?.id;
  return g.user?.isGM ?? false;
}

/**
 * Runs one at a time.
 *
 * A clock change fires `updateWorldTime` on every click, and this writes a
 * setting — so two overlapping runs would both read the *old* marker, both
 * conclude the day had changed, and each advance one. That is the 2-3 day jump
 * a burst of quick clicks produced. Chaining makes every run see what the
 * previous one wrote.
 */
let syncChain: Promise<void> = Promise.resolve();

/**
 * Move the day counter on when the world clock passes midnight.
 *
 * Only ever advances by a single day, however far the clock jumped: a Referee
 * skipping a week forward wants one new day's worth of duties, not seven rounds
 * of hunger applied in a loop behind their back. Winding the clock *backwards*
 * simply re-adopts the new day without touching anything.
 */
export function syncDayToWorldTime(): Promise<void> {
  syncChain = syncChain.then(runWorldTimeSync, runWorldTimeSync);
  return syncChain;
}

async function runWorldTimeSync(): Promise<void> {
  const g = game as Game;
  if (!isPrimaryGM()) return;
  if (!g.settings.get(MODULE_ID, SETTINGS.FOLLOW_WORLD_TIME)) return;

  const key = worldDayKey();
  if (!key) return;

  const state = getDayState();
  if (state.lastDayKey === key) return;

  // First sighting: adopt the world's day without advancing, or merely turning
  // the setting on would cost the party a day.
  if (!state.lastDayKey) {
    await writeState({ ...state, lastDayKey: key });
    return;
  }

  await startNewDay();
}
