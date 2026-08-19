import type { CharacterDay } from "../types";

/**
 * What hunger costs, and what it does to a character's pace.
 *
 * A leaf module on purpose: the encumbrance calculator needs the Speed penalty,
 * and `characterDay` — where the rest of the day's bookkeeping lives — reaches
 * for the flag manager, the inn, and the shared store. Importing that chain into
 * the calculator would tie the whole module graph in a knot for one table.
 */

/**
 * Effects of Hunger, Player's Book p153, as one row per day gone without food.
 * The seventh row also applies to every day beyond it — hunger stops worsening
 * there and starts killing instead.
 *
 * This is the Mortals & Demi-Fey column. Fairy characters lose Wisdom instead,
 * on their own scale, which is not modelled: nothing tells this module what
 * kindred an actor is, and the Foundry system underneath it does not record one.
 *
 * Numbers rather than a phrase, because hunger's Attack penalty is added to
 * exhaustion's before it is shown, and two figures to add cannot be strings.
 */
export interface HungerEffect {
  attack: number;
  speed: number;
  /** Constitution lost every further day, from day seven. Death at 0. */
  constitutionPerDay: number;
}

const HUNGER_EFFECTS: HungerEffect[] = [
  { attack: 1, speed: 0, constitutionPerDay: 0 },
  { attack: 1, speed: 10, constitutionPerDay: 0 },
  { attack: 2, speed: 10, constitutionPerDay: 0 },
  { attack: 2, speed: 20, constitutionPerDay: 0 },
  { attack: 3, speed: 20, constitutionPerDay: 0 },
  { attack: 4, speed: 30, constitutionPerDay: 0 },
  { attack: 4, speed: 30, constitutionPerDay: 1 },
];

/** What a character's hunger costs right now, or undefined if they have eaten. */
export function hungerEffect(daysWithoutFood: number): HungerEffect | undefined {
  if (daysWithoutFood < 1) return undefined;
  return HUNGER_EFFECTS[Math.min(daysWithoutFood, HUNGER_EFFECTS.length) - 1];
}

/** How many feet of Speed this character's hunger is costing them right now. */
export function hungerSpeedPenalty(day: CharacterDay | undefined): number {
  return hungerEffect(day?.daysWithoutFood ?? 0)?.speed ?? 0;
}

/**
 * Take hunger off a marching speed.
 *
 * "Speed is never reduced below 10" (Player's Book p153) — the floor belongs to
 * the hunger rule, so a load that already stops a character dead keeps them at
 * 0 rather than being lifted to 10 by going hungry.
 */
export function speedAfterHunger(speed: number, day: CharacterDay | undefined): number {
  const penalty = hungerSpeedPenalty(day);
  if (penalty <= 0 || speed <= 0) return speed;
  return Math.max(10, speed - penalty);
}
