import { ABILITY_CHECK_TARGET } from "./checks";

/**
 * The camp's own rules — the arithmetic behind the Camping procedure
 * (Player's Book p158-159).
 *
 * Deliberately **pure**: no `game`, no dice, no chat. Everything here is a
 * lookup or a sum, so the whole of it can be checked offline against the
 * printed tables, which is where the errors in a table like this hide. The
 * rolling, the cards and the writing live in `campRolls.ts`.
 *
 * The one thing to keep straight is which numbers are *chances* and which are
 * *checks*. Building a fire in bad weather and falling asleep on watch are
 * chances — roll at or under, no natural rules. Cooking, camaraderie and the
 * night's sleep are Ability Checks, so they go through `checks.ts` and take the
 * natural 1 / natural 6 absolutes with them.
 */

// ─── Fetching firewood (p158) ─────────────────────────────────────────────────

/**
 * The book's own examples of bad conditions, as a modifier on the amount of
 * wood found — not on a check. "-1 for damp conditions, -2 in snow, -4 in heavy
 * rain", and the Referee may judge others; these are the three it prints.
 *
 * The day's weather can say which one applies: a wet-conditions letter on the
 * weather roll is exactly the case the book is describing.
 */
export const FIREWOOD_CONDITIONS: { modifier: number; label: string }[] = [
  { modifier: 0, label: "Dry conditions" },
  { modifier: -1, label: "Damp" },
  { modifier: -2, label: "Snow" },
  { modifier: -4, label: "Heavy rain" },
];

/**
 * What one character's trip into the trees is worth: 1d6 hours of campfire,
 * plus whatever the weather takes off it.
 *
 * **Floored at zero, not at one.** A character sent out in heavy rain who rolls
 * a 3 comes back with nothing, and the sum must not go backwards when they do —
 * an empty-handed gatherer subtracting from the party's woodpile is the shape
 * of bug that only shows up on a bad night.
 */
export function firewoodHours(roll: number, modifier: number): number {
  return Math.max(0, roll + modifier);
}

export function firewoodTotal(rolls: number[], modifier: number): number {
  return rolls.reduce((sum, roll) => sum + firewoodHours(roll, modifier), 0);
}

/** How long a night's rest is taken to be, for saying whether the fire outlasts it. */
export const NIGHT_HOURS = 8;

// ─── Building a fire (p158) ───────────────────────────────────────────────────

/**
 * "In normal conditions, fire building automatically succeeds. In troublesome
 * circumstances, the Referee may rule that there is only a 4-in-6 (or worse)
 * chance."
 *
 * So the chance is the Referee's judgement, and 6 means they did not judge one
 * at all. Kept as a number rather than an "auto" flag because 6-in-6 *is*
 * automatic, and one number is easier to read back than a number and a flag
 * that can disagree with it.
 */
export const FIRE_AUTOMATIC = 6;

export const FIRE_CHANCES: { chance: number; label: string }[] = [
  { chance: FIRE_AUTOMATIC, label: "Normal conditions — no roll" },
  { chance: 5, label: "5-in-6 — a little damp" },
  { chance: 4, label: "4-in-6 — troublesome (the book's example)" },
  { chance: 3, label: "3-in-6 — wet wood, gusting wind" },
  { chance: 2, label: "2-in-6 — barely possible" },
  { chance: 1, label: "1-in-6 — a miracle would be needed" },
];

/** A chance roll: at or under lights the fire. No natural rules — it is not a check. */
export function fireLit(roll: number, chance: number): boolean {
  return roll <= chance;
}

// ─── Cooking and camaraderie (p158) ───────────────────────────────────────────

/**
 * The two optional evening activities, which are the same shape in different
 * clothes: an Ability Check, +1 to everyone's Constitution Check to rest on a
 * success, and on a **natural 1** a Save Versus Doom against something worse.
 *
 * What the failed save costs is where they part company, and it is not
 * symmetrical: a ruined meal wastes the ingredients and grants nothing, while
 * a failed turn at entertaining actively sours the camp for -1.
 */
export type CampActivity = "cooking" | "camaraderie";

export const CAMP_ACTIVITIES: Record<
  CampActivity,
  {
    dutyId: string;
    label: string;
    icon: string;
    /** The ability whose modifier is added — Wisdom cooks, Charisma entertains. */
    ability: "wis" | "cha";
    /** What a success is worth to the night's rest. */
    bonus: number;
    success: string;
    failure: string;
    /** What a natural 1 threatens, if the Save Versus Doom then fails. */
    doom: string;
  }
> = {
  cooking: {
    dutyId: "cooking",
    label: "Cooking",
    icon: "fa-utensils",
    ability: "wis",
    bonus: 1,
    success:
      "An especially tasty dish. Everyone who eats it gains +1 on any Constitution Check to rest.",
    failure: "Palatable, but not exemplary. No bonus to the night's rest.",
    doom: "The meal is ruined and utterly inedible — burned, spilled — and the ingredients used are wasted.",
  },
  camaraderie: {
    dutyId: "entertainment",
    label: "Camaraderie",
    icon: "fa-guitar",
    ability: "cha",
    bonus: 1,
    success: "Spirits lift. Everyone gains +1 on any Constitution Check to rest.",
    failure: "The attempt falls flat. No bonus to the night's rest.",
    doom: "Ridicule and discord: -1 on any Constitution Check to rest.",
  },
};

/** What a failed Save Versus Doom after a natural 1 does to the night's rest. */
export const DISCORD_PENALTY = -1;

/**
 * Everything the evening did to the Constitution Checks that follow.
 *
 * Read from the two activities rather than stored, so taking a roll back takes
 * its bonus with it. A ruined meal is worth nothing rather than worth -1: the
 * book takes the ingredients, not the party's sleep.
 */
export interface EveningOutcome {
  /** Did the check succeed, and did a natural 1 then fail its Save Versus Doom? */
  succeeded: boolean;
  doomed?: boolean;
}

export function restModifier(
  cooking: EveningOutcome | undefined,
  camaraderie: EveningOutcome | undefined
): number {
  let modifier = 0;
  if (cooking?.succeeded) modifier += CAMP_ACTIVITIES.cooking.bonus;
  if (camaraderie?.succeeded) modifier += CAMP_ACTIVITIES.camaraderie.bonus;
  if (camaraderie?.doomed) modifier += DISCORD_PENALTY;
  return modifier;
}

// ─── Watches through the night (p159, optional rule) ──────────────────────────

/**
 * "A basic 1-in-10 chance of each character falling asleep during their watch.
 * Characters with Constitution 15 or higher have only a 1-in-20 chance, while
 * characters with Constitution 6 or lower have a 1-in-6 chance."
 *
 * Three different dice, one chance each — so this returns the die to roll, and
 * the roll succeeds in staying awake on anything but a 1. An optional rule the
 * book flags as slapstick, which is why nothing else in the module reads the
 * result: it throws the watch order out, and that is the Referee's to narrate.
 */
export function fallAsleepFaces(constitution: number): 6 | 10 | 20 {
  if (constitution >= 15) return 20;
  if (constitution <= 6) return 6;
  return 10;
}

export function fellAsleepOnWatch(roll: number): boolean {
  return roll === 1;
}

/** The shortest watch-broken night that still counts as a night's sleep (p159). */
export const MIN_SLEEP_HOURS = 6;

/**
 * How the night divides among the watchers, and what it costs them.
 *
 * "The party's rest period typically lasts around 8 hours, with 4 characters
 * taking 2 hour watches during that time. Characters who sleep for less than 6
 * hours fail to get a good night's rest."
 *
 * So the arithmetic the book leaves implicit is worth doing: **four watchers is
 * the number that works.** Three over the same eight hours are awake for two
 * hours and forty minutes each and sleep five and a third — under six, and the
 * night is lost for all of them however comfortable the camp. That is why the
 * watch roll hands its answer to the sleep roll rather than leaving the Referee
 * to notice.
 *
 * The **order** is not decided here and is not random: it is the Referee's, set
 * in the dialog, and only the *number* of watchers changes the arithmetic.
 */
export interface WatchShare {
  hoursOnWatch: number;
  hoursAsleep: number;
  /** Under six hours asleep, so no good night's rest whatever the conditions. */
  shortNight: boolean;
}

export function watchShares(keepers: number, nightHours = NIGHT_HOURS): WatchShare {
  if (keepers <= 0) return { hoursOnWatch: 0, hoursAsleep: nightHours, shortNight: nightHours < MIN_SLEEP_HOURS };
  const hoursOnWatch = nightHours / keepers;
  const hoursAsleep = nightHours - hoursOnWatch;
  return { hoursOnWatch, hoursAsleep, shortNight: hoursAsleep < MIN_SLEEP_HOURS };
}

/** "2h", "2h 40m" — hours as a table says them aloud. */
export function hoursLabel(hours: number): string {
  const whole = Math.floor(hours + 1e-9);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${whole}h`;
  if (whole === 0) return `${minutes}m`;
  return `${whole}h ${minutes}m`;
}

// ─── Waking up (p158, step 6 of the Camping procedure) ────────────────────────

/**
 * The morning owes two things, and the book puts both in the camping procedure
 * rather than anywhere else: "Characters who slept well heal 1 HP. Spell-casters
 * may prepare new spells for the day."
 *
 * Both turn on last night, which is why the character's day record carries it
 * forward past the roll-over.
 */

/** A good night in the wild is worth exactly one Hit Point (p159). */
export const OVERNIGHT_HEALING = 1;

/**
 * How much this character actually gains: never past their maximum, and nothing
 * at all for a sheet with no maximum on it, because "full" and "unknown" would
 * otherwise look the same and hand out a point that no bar can show.
 */
export function healingFor(hp: number, hpMax: number): number {
  if (hpMax <= 0) return 0;
  return Math.max(0, Math.min(OVERNIGHT_HEALING, hpMax - hp));
}

/**
 * "For each spell the character attempts to memorise or pray for, there is a
 * 1-in-6 chance of failure. If the roll fails, the attempt fails — the spell
 * slot remains empty and unusable this day."
 *
 * A chance, not a check, so no natural rules: one die per spell, a 1 loses it.
 */
export const SPELL_LOSS_IN_6 = 1;

export function spellLost(roll: number): boolean {
  return roll <= SPELL_LOSS_IN_6;
}

// ─── Sleep (p159) ─────────────────────────────────────────────────────────────

export type Bedding = "none" | "some" | "both";
export type HostSeason = "winter" | "spring" | "summer" | "autumn";
export type SleepDifficulty = "easy" | "moderate" | "difficult" | "impossible";

export const BEDDING: { id: Bedding; label: string }[] = [
  { id: "none", label: "No bedding" },
  { id: "some", label: "Bedroll or tent" },
  { id: "both", label: "Bedroll and tent" },
];

/** The catalogue ids that answer "what is this character sleeping on?". */
export const BEDROLL_ID = "bedroll";
export const TENT_ID = "tent";

export function beddingFrom(hasBedroll: boolean, hasTent: boolean): Bedding {
  if (hasBedroll && hasTent) return "both";
  if (hasBedroll || hasTent) return "some";
  return "none";
}

export const SLEEP_DIFFICULTIES: Record<
  SleepDifficulty,
  { label: string; hint: string; icon: string }
> = {
  easy: {
    label: "Easy",
    hint: "The character gets a good night's rest, no roll needed.",
    icon: "fa-bed",
  },
  moderate: {
    label: "Moderate",
    hint: "A Constitution Check to get a good night's rest.",
    icon: "fa-dice-d6",
  },
  difficult: {
    label: "Difficult",
    hint: "A Constitution Check at -2 to get a good night's rest.",
    icon: "fa-cloud-moon",
  },
  impossible: {
    label: "Impossible",
    hint: "The character fails to get a good night's rest, whatever they roll.",
    icon: "fa-face-tired",
  },
};

/**
 * The Sleep Difficulty table, copied from the printed one (Player's Book p159).
 *
 * Written out row for row rather than derived from a rule, because it is not a
 * rule — it is a table, and the one thing that would be lost by "improving" it
 * is the row that surprises: **a campfire is no help at all to a character
 * lying on bare ground.** `campfire.none` is identical to `nofire.none` in
 * every season, which reads like a copying mistake and is not one. Anyone
 * tempted to fold the fire into a modifier should look at that row first.
 */
export const SLEEP_DIFFICULTY: Record<
  "nofire" | "campfire",
  Record<Bedding, Record<HostSeason, SleepDifficulty>>
> = {
  nofire: {
    none: { winter: "impossible", spring: "difficult", summer: "moderate", autumn: "difficult" },
    some: { winter: "impossible", spring: "moderate", summer: "easy", autumn: "moderate" },
    both: { winter: "difficult", spring: "moderate", summer: "easy", autumn: "moderate" },
  },
  campfire: {
    none: { winter: "impossible", spring: "difficult", summer: "moderate", autumn: "difficult" },
    some: { winter: "difficult", spring: "easy", summer: "easy", autumn: "easy" },
    both: { winter: "moderate", spring: "easy", summer: "easy", autumn: "easy" },
  },
};

export function sleepDifficulty(
  campfire: boolean,
  bedding: Bedding,
  season: HostSeason
): SleepDifficulty {
  return SLEEP_DIFFICULTY[campfire ? "campfire" : "nofire"][bedding][season];
}

/** A difficult night is a Constitution Check at -2; nothing else carries one. */
export const DIFFICULT_SLEEP_PENALTY = -2;

/**
 * What one character has to do to sleep well, given the night they are in.
 *
 * `roll` says whether a die is needed at all — two of the four difficulties are
 * settled before anyone picks one up — and a character whose watch left them
 * under six hours fails without one, whatever the table says.
 */
export interface SleepPlan {
  difficulty: SleepDifficulty;
  /** Is there a Constitution Check to make? */
  roll: boolean;
  /** The evening's bonus plus the difficult night's -2, ready to add to 1d6. */
  modifier: number;
  target: number;
  /** Settled without a die: the outcome, and why. */
  decided?: { sleptWell: boolean; why: string };
}

export function planSleep(
  difficulty: SleepDifficulty,
  restModifierTotal: number,
  shortNight: boolean
): SleepPlan {
  const modifier =
    restModifierTotal + (difficulty === "difficult" ? DIFFICULT_SLEEP_PENALTY : 0);
  const base = { difficulty, modifier, target: ABILITY_CHECK_TARGET };

  // The watch rule overrides the table in both directions: six hours is not a
  // night's sleep even in a tent by a fire in summer.
  if (shortNight) {
    return {
      ...base,
      roll: false,
      decided: {
        sleptWell: false,
        why: `Under ${MIN_SLEEP_HOURS} hours asleep — not a good night's rest, whatever the conditions.`,
      },
    };
  }
  if (difficulty === "easy") {
    return { ...base, roll: false, decided: { sleptWell: true, why: "Easy conditions — no roll needed." } };
  }
  if (difficulty === "impossible") {
    return {
      ...base,
      roll: false,
      decided: { sleptWell: false, why: "Impossible conditions — no rest is to be had here." },
    };
  }
  return { ...base, roll: true };
}

// ─── What a night in camp leaves behind ───────────────────────────────────────

/**
 * The results the camp writes onto the day, kept here beside the rules that
 * produce them and away from `dayDuties.ts`, which only has to store them.
 *
 * Same arrangement as the weather and the wandering monsters: the day state
 * holds the record, the rules file owns its shape, and the rolling file owns
 * the dice. Nothing here reaches for `game`.
 */

export interface FirewoodGatherer {
  name: string;
  roll: number;
  /** After the conditions, floored at zero — see `firewoodHours`. */
  hours: number;
}

export interface FirewoodResult {
  modifier: number;
  hours: number;
  gatherers: FirewoodGatherer[];
}

export interface FireResult {
  lit: boolean;
  /** 6 means the Referee judged no roll was needed. */
  chance: number;
  roll?: number;
}

export interface CampActivityResult {
  activity: CampActivity;
  actorId: string;
  name: string;
  roll: number;
  modifier: number;
  success: boolean;
  natural?: "fail" | "success";
  /** Only ever set after a natural 1, which is the one thing that calls for it. */
  doom?: { roll: number; target: number; saved: boolean };
  /** What went into the pot and who ate it. Cooking only. */
  meal?: MealResult;
}

/**
 * The meal itself, which is a separate question from whether it was any good.
 *
 * The ingredients are spent either way — the book only takes them *back* out of
 * the party's day on a natural 1 with a failed save, and then nobody eats at
 * all. That is why `eaters` can be empty while `ingredients` is not.
 */
export interface MealResult {
  ingredients: { name: string; holder: string; portions: number }[];
  /** How many characters the pot can feed — one portion each. */
  portions: number;
  /** Who actually ate, by name. Empty where the meal was ruined. */
  eaters: string[];
  ruined: boolean;
}

export interface WatchKeeper {
  actorId: string;
  name: string;
  /** Which watch this one stood, first to last — the Referee's order. */
  order: number;
  hoursOnWatch: number;
  hoursAsleep: number;
  /** 1-in-6, 1-in-10 or 1-in-20, by Constitution. */
  faces: number;
  roll: number;
  asleep: boolean;
}

export interface WatchResult {
  nightHours: number;
  /** True where the watchers were too few to leave six hours' sleep each. */
  shortNight: boolean;
  keepers: WatchKeeper[];
}

export interface SleeperResult {
  actorId: string;
  name: string;
  bedding: Bedding;
  difficulty: SleepDifficulty;
  shortNight: boolean;
  modifier: number;
  /** Absent where the night was settled without a die. */
  roll?: number;
  natural?: "fail" | "success";
  sleptWell: boolean;
  /** Why, where no die was thrown. */
  why?: string;
}

export interface SleepResult {
  campfire: boolean;
  season: HostSeason;
  /** The evening's doing: supper, songs, or discord. */
  bonus: number;
  sleepers: SleeperResult[];
}

/** Everything the camp rolled tonight. Lives on the day and dies with it. */
export interface CampState {
  firewood?: FirewoodResult;
  fire?: FireResult;
  cooking?: CampActivityResult;
  camaraderie?: CampActivityResult;
  watches?: WatchResult;
  sleep?: SleepResult;
}

// ─── What the morning leaves behind ───────────────────────────────────────────

/**
 * Waking up is the camping procedure's own step 6, so its records live here
 * beside the night's — but they hang off the day's `morning`, not its `camp`,
 * because a party that slept at an inn still wakes up.
 */

export interface HealingResult {
  /** Who took the Hit Point, and what they went from and to. */
  healed: { name: string; from: number; to: number }[];
  /** Everyone else, and the reason: a bad night, already full, already healed. */
  passed: { name: string; why: string }[];
}

export interface SpellCasterResult {
  name: string;
  /** How many spells they set about preparing. */
  spells: number;
  /** One die per spell, in the order they were rolled. */
  rolls: number[];
  lost: number;
}

export interface SpellPrepResult {
  casters: SpellCasterResult[];
  lost: number;
}

/** The morning's two duties, stored the way the camp's six are. */
export interface MorningState {
  healing?: HealingResult;
  spells?: SpellPrepResult;
}
