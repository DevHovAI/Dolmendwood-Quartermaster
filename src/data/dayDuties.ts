import { MODULE_ID, SETTINGS } from "../constants";
import { getInnDay, advanceInnDay } from "./innMenu";
import { rollOverCharacterDays } from "./characterDay";
import type { CampState, MorningState } from "./camping";
import type { WeatherResult } from "./weather";
import type { LostResult } from "./gettingLost";
import type { FoodResult } from "./findingFood";
import type { EncounterResult } from "./encounters";

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

export const DUTY_MODES: { id: DutyMode; labelKey: string; icon: string }[] = [
  { id: "dawn", labelKey: "DOLMENWOOD.Duty.Mode.Dawn", icon: "fa-sunrise" },
  { id: "travel", labelKey: "DOLMENWOOD.Duty.Mode.Travel", icon: "fa-person-hiking" },
  { id: "camp", labelKey: "DOLMENWOOD.Duty.Mode.Camp", icon: "fa-campground" },
  { id: "settlement", labelKey: "DOLMENWOOD.Duty.Mode.Settlement", icon: "fa-house-chimney" },
];

/**
 * Setting up a camp is one job done in one stretch, not seven unrelated errands.
 * Its steps live behind one tick in the strip and open in their own window: seven
 * of them side by side made the Camp tab twice the width of every other one.
 */
export const DUTY_GROUPS: Record<string, { labelKey: string; icon: string }> = {
  "camp-setup": { labelKey: "DOLMENWOOD.Duty.Group.CampSetup", icon: "fa-campground" },
};

export interface Duty {
  id: string;
  /** Sprachschluessel, nicht der Text — mit t() lesen. */
  labelKey: string;
  icon: string;
  modes: DutyMode[];
  /** Sprachschluessel des Hover-Textes, nicht der Text. */
  hintKey: string;
  /** Draws this duty inside the named band from DUTY_GROUPS. */
  group?: keyof typeof DUTY_GROUPS;
}

export const DUTIES: Duty[] = [
  // ── Day start: what every morning owes, wherever it began ──
  {
    id: "weather",
    labelKey: "DOLMENWOOD.Duty.Weather.Label",
    icon: "fa-cloud-sun-rain",
    modes: ["dawn"],
    hintKey: "DOLMENWOOD.Duty.Weather.Hint",
  },
  {
    id: "healing",
    labelKey: "DOLMENWOOD.Duty.Healing.Label",
    icon: "fa-heart-pulse",
    modes: ["dawn"],
    hintKey: "DOLMENWOOD.Duty.Healing.Hint",
  },
  {
    id: "prepare-spells",
    labelKey: "DOLMENWOOD.Duty.PrepareSpells.Label",
    icon: "fa-wand-sparkles",
    modes: ["dawn"],
    hintKey: "DOLMENWOOD.Duty.PrepareSpells.Hint",
  },

  // ── Travel ──
  {
    id: "lost",
    labelKey: "DOLMENWOOD.Duty.Lost.Label",
    icon: "fa-map-location-dot",
    modes: ["travel"],
    hintKey: "DOLMENWOOD.Duty.Lost.Hint",
  },
  {
    id: "encounter-day",
    labelKey: "DOLMENWOOD.Duty.EncounterDay.Label",
    icon: "fa-sun",
    modes: ["travel", "settlement"],
    hintKey: "DOLMENWOOD.Duty.EncounterDay.Hint",
  },
  {
    id: "forage",
    labelKey: "DOLMENWOOD.Duty.Forage.Label",
    icon: "fa-wheat-awn",
    modes: ["travel"],
    hintKey: "DOLMENWOOD.Duty.Forage.Hint",
  },

  // ── Making camp: one job, seven steps ──
  {
    id: "campsite",
    labelKey: "DOLMENWOOD.Duty.Campsite.Label",
    icon: "fa-tents",
    modes: ["camp"],
    group: "camp-setup",
    hintKey: "DOLMENWOOD.Duty.Campsite.Hint",
  },
  {
    id: "firewood",
    labelKey: "DOLMENWOOD.Duty.Firewood.Label",
    icon: "fa-fire-burner",
    modes: ["camp"],
    group: "camp-setup",
    hintKey: "DOLMENWOOD.Duty.Firewood.Hint",
  },
  {
    id: "water",
    labelKey: "DOLMENWOOD.Duty.Water.Label",
    icon: "fa-droplet",
    modes: ["camp"],
    group: "camp-setup",
    hintKey: "DOLMENWOOD.Duty.Water.Hint",
  },
  {
    id: "fire",
    labelKey: "DOLMENWOOD.Duty.Fire.Label",
    icon: "fa-fire",
    modes: ["camp"],
    group: "camp-setup",
    // Not "every row": a campfire is worth nothing at all to a character lying
    // on bare ground — see the table itself in camping.ts.
    hintKey: "DOLMENWOOD.Duty.Fire.Hint",
  },
  {
    id: "cooking",
    labelKey: "DOLMENWOOD.Duty.Cooking.Label",
    icon: "fa-utensils",
    modes: ["camp"],
    group: "camp-setup",
    hintKey: "DOLMENWOOD.Duty.Cooking.Hint",
  },
  {
    id: "entertainment",
    labelKey: "DOLMENWOOD.Duty.Entertainment.Label",
    icon: "fa-guitar",
    modes: ["camp"],
    group: "camp-setup",
    hintKey: "DOLMENWOOD.Duty.Entertainment.Hint",
  },
  {
    id: "watches",
    labelKey: "DOLMENWOOD.Duty.Watches.Label",
    icon: "fa-tower-observation",
    modes: ["camp"],
    group: "camp-setup",
    hintKey: "DOLMENWOOD.Duty.Watches.Hint",
  },

  // ── The night ──
  {
    id: "encounter-night",
    labelKey: "DOLMENWOOD.Duty.EncounterNight.Label",
    icon: "fa-moon",
    modes: ["camp", "settlement"],
    hintKey: "DOLMENWOOD.Duty.EncounterNight.Hint",
  },
  {
    id: "sleep",
    labelKey: "DOLMENWOOD.Duty.Sleep.Label",
    icon: "fa-bed",
    modes: ["camp"],
    // Step 5, and the last thing the camp does — which is why it is not inside
    // the "Making camp" group: it is rolled after the night's encounter check,
    // and it is the only camp roll whose result follows the characters into
    // tomorrow.
    hintKey: "DOLMENWOOD.Duty.Sleep.Hint",
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
  /**
   * Duty id → the characters it has already been rolled for today.
   *
   * **The players' once-a-day lock, and it lives here on purpose.** The rule is
   * that a player may make each of their rolls once and that it comes back with
   * the next in-game day — so it is kept in the one record that is already
   * cleared on roll-over, rather than in a second place that could disagree
   * with the first about which day it is. See `dayRollRights.ts` for what is
   * asked of it; the Referee is never limited by it.
   */
  rolledBy?: Record<string, string[]>;
  /**
   * The duties the Referee has opened to the players today.
   *
   * **Nothing is open until a key is turned** (his ask, 2026-09-02), so the
   * empty list is both the default and the common state — which is why it is a
   * list of the open ones rather than a record of flags for all of them. It
   * falls closed again with the day, like the rolls themselves: an evening is
   * opened a step at a time, and tomorrow evening is a different one.
   */
  openDuties?: string[];
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
   * The two wandering-monster checks, kept apart.
   *
   * One field each rather than a list: the book makes exactly one check by day
   * and one by night, they are separate duties on the strip, and each has to be
   * able to be taken back and rolled again without disturbing the other.
   */
  encounterDay?: EncounterResult;
  encounterNight?: EncounterResult;
  /**
   * What the camp rolled tonight: the woodpile, the fire, supper, songs, the
   * watch, and who slept.
   *
   * One field for the six rather than six fields, because they are read
   * together — the night's Constitution Checks want to know whether the fire is
   * burning and whether anybody cooked, and a card that had to gather that from
   * six places would gather it wrongly one day. Cleared with the rest of the
   * day: last night's fire is not tonight's.
   */
  camp?: CampState;
  /**
   * What waking up produced: who healed, and which spells the night cost.
   *
   * Apart from `camp` because it is not the camp's — a party that slept at an
   * inn still wakes up, heals and prepares spells.
   */
  morning?: MorningState;
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
      encounterDay: undefined,
      encounterNight: undefined,
      camp: undefined,
      morning: undefined,
      // A new day gives every player their rolls back — that is the whole rule.
      rolledBy: {},
      openDuties: [],
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
    // A new day gives every player their rolls back — that is the whole rule.
    rolledBy: {},
    // And closes every key the Referee turned last night.
    openDuties: [],
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
/** The hour a Dolmenwood party gets up: waking, spells, and then the road. */
export const DAY_STARTS_AT_HOUR = 7;

/**
 * Push the world clock to the next morning.
 *
 * The other half of the calendar link, which ran one way for a long time: a
 * calendar module’s midnight moved our counter, but our own ▶ left the clock
 * where it was, so the two drifted apart in exactly the way the setting exists
 * to prevent.
 *
 * **Time is only ever advanced, never set.** `game.time.advance` takes a delta,
 * every calendar module in play reads the same `worldTime`, and going forwards
 * by a computed amount needs no module’s API. Where Simple Calendar is present
 * it is asked what o’clock it is, since a Dolmenwood day need not be 24 hours;
 * otherwise the seconds since midnight are the remainder of the division.
 */
async function advanceWorldClockToMorning(): Promise<void> {
  const g = game as Game;
  const worldTime = g.time?.worldTime;
  if (typeof worldTime !== "number") return;

  const api = (
    globalThis as { SimpleCalendar?: { api?: { timestampToDate?: (t: number) => unknown } } }
  ).SimpleCalendar?.api;
  const date = api?.timestampToDate?.(worldTime) as
    | { hour?: number; minute?: number; second?: number }
    | undefined;
  const secondsIntoDay =
    date && typeof date.hour === "number"
      ? date.hour * 3600 + (date.minute ?? 0) * 60 + (date.second ?? 0)
      : ((worldTime % 86400) + 86400) % 86400;

  const morning = DAY_STARTS_AT_HOUR * 3600;
  // Always forwards, and always to the *next* morning: pressing the button at
  // 06:00 means the day is over, not that it has not begun.
  const delta = 86400 - secondsIntoDay + morning;
  await advanceWorldClock(delta);
}

/**
 * Move the world clock by a number of seconds.
 *
 * The one place the clock is touched, so there is one answer to "does this
 * module set the time?" — it does not. `game.time.advance` takes a delta, every
 * calendar module in play reads the same `worldTime`, and a delta needs no
 * module's API. A **negative** delta is still a delta: handing a Travel Point
 * back has to walk the clock back with it, or one misclick strands the
 * afternoon somewhere it never was.
 */
async function advanceWorldClock(seconds: number, smooth = false): Promise<void> {
  if (!seconds) return;
  const g = game as Game;
  if (typeof g.time?.worldTime !== "number") return;
  const advance = (s: number) =>
    (g.time as unknown as { advance: (s: number) => Promise<unknown> }).advance(s);

  const span = smooth ? lapseSeconds() : 0;
  if (!span) {
    await advance(seconds);
    return;
  }
  queueLapse(seconds, span, advance);
}

/** How many wall-clock seconds a travelled span is walked over. 0 is a jump. */
function lapseSeconds(): number {
  const raw = (game as Game).settings?.get(MODULE_ID, SETTINGS.CLOCK_LAPSE);
  return Math.max(0, Math.min(10, Number(raw ?? 3)));
}

/**
 * The time-lapse: the clock walked forward in steps instead of jumping.
 *
 * **Dolmenmaster's ask, 2026-09-05** — a party token crossing a hex should have
 * the afternoon visibly pass, not blink from two o'clock to half past three.
 * Every clock module at the table reads the same `worldTime`, so Smalltime and
 * Simple Calendar sweep along with it for free; nothing here knows they exist.
 *
 * **It is deliberately not awaited by its caller.** The chat card for the move
 * should appear the moment the token lands — making the Referee wait three
 * seconds for it would be paying for the animation twice. The clock catches up
 * behind the card, which is what a time-lapse looks like anyway.
 *
 * **One at a time.** Two quick moves would otherwise interleave their steps and
 * the clock would stutter back and forth, so each waits for the one before it.
 * The total is exact whatever the arithmetic does in between: the last step
 * carries whatever the integer division left over, and a negative span walks
 * backwards the same way — the − button beside the counter has to undo an
 * afternoon it gave.
 */
let lapseChain: Promise<void> = Promise.resolve();

function queueLapse(
  seconds: number,
  span: number,
  advance: (s: number) => Promise<unknown>
): void {
  const STEP_MS = 250;
  const steps = Math.max(1, Math.round((span * 1000) / STEP_MS));
  lapseChain = lapseChain
    .then(async () => {
      const per = Math.trunc(seconds / steps);
      let left = seconds;
      for (let i = 0; i < steps; i++) {
        const chunk = i === steps - 1 ? left : per;
        left -= chunk;
        if (chunk) await advance(chunk);
        if (i < steps - 1) await new Promise((r) => setTimeout(r, STEP_MS));
      }
    })
    .catch((err) => {
      console.error(`${MODULE_ID} | world clock`, err);
    });
}

/**
 * How long the party is actually on the road: **twelve hours in a normal day,
 * sixteen on a forced march** — breaks included in both.
 *
 * Twelve is the figure on Dolmenmaster's own travel sheet. Sixteen is the Player's
 * Book's (p156), and it is what the bar's forced-march tooltip has always
 * promised; asked which should win, he said the book (2026-08-27).
 *
 * The rule is then one division: the day's Travel Points are spread across the
 * day's hours, so each one costs `hours ÷ budget`. A normal day reproduces the
 * sheet exactly — 8 points at 1h30, 6 at 2h, 4 at 3h, 2 at 6h.
 *
 * **The forced march column no longer matches the sheet, and that is the
 * change he asked for.** Sixteen hours is a longer day than the sheet assumed,
 * so the same points are spread thinner: 12 at 1h20 rather than 1h, 9 at 1h47,
 * 6 at 2h40, 3 at 5h20. The numbers stop being round, which is what happens
 * when 16 is divided by 9; the arithmetic is right and the sheet's column was
 * built on twelve.
 */
export const TRAVEL_HOURS_PER_DAY = 12;
export const FORCED_MARCH_HOURS_PER_DAY = 16;

/**
 * What one Travel Point costs the clock, in seconds.
 *
 * Undefined where there is no budget to divide by — a party with no convoy to
 * read a Speed from has no allowance either, and the bar already says so rather
 * than inventing one.
 */
export function travelPointSeconds(
  budget: number | undefined,
  forcedMarch = false
): number | undefined {
  if (budget === undefined || budget <= 0) return undefined;
  const hours = forcedMarch ? FORCED_MARCH_HOURS_PER_DAY : TRAVEL_HOURS_PER_DAY;
  return Math.round((hours * 3600) / budget);
}

/** "1h 30min", "2h", "20min" — a duration the way the travel sheet writes one. */
export function describeDuration(seconds: number | undefined): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (!hours) return `${minutes}min`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

export async function startNewDay(): Promise<void> {
  await advanceInnDay();
  await reconcileDay();

  // Only where the table has linked the two. A world with no calendar in play
  // has a worldTime of 0 that nobody looks at, and moving it would be a
  // surprise rather than a service.
  if ((game as Game).settings.get(MODULE_ID, SETTINGS.FOLLOW_WORLD_TIME)) {
    await advanceWorldClockToMorning();
  }

  // Re-aligned *after* the clock has been pushed, or the hook that watches it
  // would see a new day and advance the counter a second time.
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
 * Turn the key on one duty, opening it to the players — or turn it back.
 *
 * `writeState` is GM-only, which is exactly right: the key is the Referee
 * saying "this part of the evening is happening now", and it would be a strange
 * lock that the locked-out could open.
 */
export async function setDutyOpen(id: string, open: boolean): Promise<void> {
  const state = getDayState();
  const list = state.openDuties ?? [];
  const next = open ? (list.includes(id) ? list : [...list, id]) : list.filter((d) => d !== id);
  await writeState({ ...state, openDuties: next });
}

/** Record that a duty has been rolled for this character today. */
export async function markRolledBy(id: string, actorId: string): Promise<void> {
  const state = getDayState();
  const rolled = state.rolledBy?.[id] ?? [];
  if (rolled.includes(actorId)) return;
  await writeState({
    ...state,
    rolledBy: { ...(state.rolledBy ?? {}), [id]: [...rolled, actorId] },
  });
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
  patch:
    | Pick<DayState, "weather">
    | Pick<DayState, "lost">
    | Pick<DayState, "food">
    | Pick<DayState, "encounterDay">
    | Pick<DayState, "encounterNight">
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
 * Record what the camp rolled, and tick the duty that rolled it.
 *
 * Takes the duty id rather than deriving it from the patch, because the two do
 * not always share a name: the duty is called `entertainment` and the record it
 * writes is `camaraderie`. A patch whose value is `undefined` clears the field
 * and unticks the duty, which is what the strip's undo arrow does.
 */
export async function setCampResult(
  dutyId: string,
  patch: Partial<CampState>
): Promise<void> {
  const state = getDayState();
  const camp = { ...(state.camp ?? {}), ...patch };
  const value = Object.values(patch)[0];
  await writeState({
    ...state,
    camp,
    done: { ...state.done, [dutyId]: value !== undefined },
  });
}

/** The same, for what waking up produced. See `setCampResult`. */
export async function setMorningResult(
  dutyId: string,
  patch: Partial<MorningState>
): Promise<void> {
  const state = getDayState();
  const morning = { ...(state.morning ?? {}), ...patch };
  const value = Object.values(patch)[0];
  await writeState({
    ...state,
    morning,
    done: { ...state.done, [dutyId]: value !== undefined },
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
    // Resetting the day hands the players' rolls back with everything else.
    rolledBy: {},
    openDuties: [],
    travelPointsUsed: 0,
    forcedMarch: false,
    travelPointBudget: undefined,
    weather: undefined,
    lost: undefined,
    food: undefined,
    encounterDay: undefined,
    encounterNight: undefined,
    camp: undefined,
    morning: undefined,
  });
}

/**
 * Spend or hand back Travel Points — and let the day wear on as they go.
 *
 * Clamped at both ends: nothing spent at one, the whole budget at the other, so
 * the readout can never go negative. `budget` comes from the caller because it
 * is derived from the convoy's speed, which this module deliberately does not
 * reach for.
 *
 * **The clock follows the points**, Dolmenmaster's ask and the travel sheet's own
 * arithmetic: a party of Speed 30 has eight points in a twelve-hour day, so
 * each one walked is an hour and a half off the afternoon. Three things about
 * that are deliberate:
 *
 * - **It moves by what actually changed**, not by what was asked for. Clicking
 *   ▶ on the last point of the day spends nothing, so it must cost nothing.
 * - **It is symmetric.** Handing a point back rewinds the same span, because
 *   the button beside it exists for the click that should not have happened.
 * - **It is tied to the same setting as the day counter.** A table with no
 *   calendar in play has a `worldTime` of 0 that nobody looks at, and moving it
 *   under them would be a surprise rather than a service.
 *
 * A forced march declared *after* points are walked does not re-time them. The
 * hours are already gone, and the budget the caller hands in is the one in
 * force for this click.
 */
export async function spendTravelPoints(delta: number, budget: number): Promise<void> {
  const state = getDayState();
  const used = Math.min(Math.max(0, budget), Math.max(0, state.travelPointsUsed + delta));
  // What the counter actually moved by — **capped at the size of the click**.
  // The two come apart in exactly one situation: a forced march called off
  // leaves more points spent than the smaller budget allows, and the next click
  // snaps the counter the whole way back. That is right for a counter and wrong
  // for a clock: one press of − should give back one point's worth of
  // afternoon, not two, and the module does not record what rate each point was
  // walked at to give back any more honestly than that.
  const moved = used - state.travelPointsUsed;
  const walked = Math.sign(moved) * Math.min(Math.abs(moved), Math.abs(delta));
  await writeState({ ...state, travelPointsUsed: used });

  if (!walked) return;
  // The day in force for *this* click. A forced march declared after points are
  // walked does not re-time them: those hours are already gone.
  const perPoint = travelPointSeconds(budget, state.forcedMarch);
  if (perPoint && (game as Game).settings.get(MODULE_ID, SETTINGS.FOLLOW_WORLD_TIME)) {
    // Smooth, because this is the one clock move a person is watching happen.
    // Rolling over to the next morning jumps: nobody wants to sit through the
    // night at four steps a second.
    await advanceWorldClock(walked * perPoint, true);
  }
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
