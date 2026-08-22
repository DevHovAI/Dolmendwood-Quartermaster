import { terrainInfo, type Terrain, type Way } from "./dayContext";

/**
 * Losing the way (Player's Book p153, p156; Campaign Book p113).
 *
 * One roll per travel day, made at its start — or, if the party begins the day
 * on a road, at the moment they leave it. What it costs is on the Campaign
 * Book's 3d6 table, which the Referee may keep to themselves: several results
 * are meant to be discovered later, when the players' map stops matching the
 * ground.
 */

export interface LostChance {
  /** Chance in 6 of losing the way. 0 means no roll is made at all. */
  inSix: number;
  /** The terrain or track it comes from, before the weather. */
  base: number;
  /** How much of it the weather added. */
  weather: number;
  /** Why it is what it is, for the tooltip. */
  reason: string;
}

/**
 * The chance of getting lost today.
 *
 * Roads carry none: "Parties following a road travel quickly and have no risk
 * of getting lost" (PB p154). Off a road it is the terrain's own figure, the
 * same 1/2/3-in-6 that governs encounters.
 *
 * **A track's chance is a house number.** The book says only that a track
 * carries "a small risk", without printing one, so this uses the light-terrain
 * 1-in-6 — the smallest the Terrain Types table offers.
 *
 * The weather's `+1` is applied literally as the Campaign Book words it, "the
 * chance of getting lost **while travelling wild** is increased by 1-in-6"
 * (p112) — so a party keeping to a track in a blizzard gets no increase. That
 * reads oddly at the table and is a strict reading, not a considered one.
 */
export function lostChance(way: Way, terrain: Terrain, poorVisibility: boolean): LostChance {
  if (way === "road") {
    return {
      inSix: 0,
      base: 0,
      weather: 0,
      reason:
        "No chance at all: the party is following a maintained road. The roll is made only when they leave it.",
    };
  }

  if (way === "track") {
    return {
      inSix: 1,
      base: 1,
      weather: 0,
      reason:
        "1-in-6 on a track. The Player's Book calls it \"a small risk\" without printing a figure, so this module uses the smallest one the Terrain Types table offers. Poor visibility adds nothing here: the Campaign Book raises the chance for travelling wild only.",
    };
  }

  const t = terrainInfo(terrain);
  const weather = poorVisibility ? 1 : 0;
  return {
    inSix: t.chanceIn6 + weather,
    base: t.chanceIn6,
    weather,
    reason:
      `${t.chanceIn6}-in-6 travelling wild in ${t.label.toLowerCase()} (${t.bandLabel.toLowerCase()} terrain)` +
      (weather ? ", +1 for poor visibility (Campaign Book p112)" : "") +
      ".",
  };
}

export interface LostConsequence {
  min: number;
  max: number;
  text: string;
  /** Worth the Referee keeping to themselves rather than announcing. */
  secret?: boolean;
}

/**
 * Consequences of Getting Lost (CB p113), 3d6.
 *
 * The book offers the Referee two ways to run the off-course results: secretly,
 * tracking the true course while the players' map quietly goes wrong, or openly,
 * telling them the direction they are actually walking. `secret` marks the ones
 * where that choice applies, so the chat card can say so instead of spoiling it.
 */
export const LOST_CONSEQUENCES: LostConsequence[] = [
  { min: 3, max: 3, text: "Lost in time. Travel is along the intended course, but 1d4+1 days pass." },
  {
    min: 4,
    max: 4,
    text: "Accidentally stumble into a randomly selected fairy road (Fairy Roads, Campaign Book p26).",
  },
  { min: 5, max: 5, text: "Move in circles, ending the day where it began." },
  { min: 6, max: 7, text: "Travel 90° to the left of the intended course.", secret: true },
  { min: 8, max: 9, text: "Travel 45° to the left of the intended course.", secret: true },
  {
    min: 10,
    max: 11,
    text: "Travel along the intended course, but uncertain paths cause all Travel Point costs to be doubled.",
  },
  { min: 12, max: 13, text: "Travel 45° to the right of the intended course.", secret: true },
  { min: 14, max: 15, text: "Travel 90° to the right of the intended course.", secret: true },
  { min: 16, max: 16, text: "Move in circles, ending the day where it began." },
  {
    min: 17,
    max: 17,
    text: "Knocked unconscious by flashing, coloured lights. Awaken 1d4 hours later in the hex of a randomly selected nodal stone (Ley Lines and Standing Stones, Campaign Book p18).",
  },
  {
    min: 18,
    max: 18,
    text: "Enveloped in a bewildering fog. Emerge at the end of the day in a randomly selected hex, at least 2 hexes from the original.",
  },
];

export function lostConsequence(roll: number): LostConsequence | undefined {
  return LOST_CONSEQUENCES.find((c) => roll >= c.min && roll <= c.max);
}

/** What today's roll produced. Stored on the day; cleared with it. */
export interface LostResult {
  /** The d6 rolled against the chance. */
  roll: number;
  /** The chance it was rolled against. */
  chance: number;
  lost: boolean;
  /** Present only when the party actually got lost. */
  consequence?: { roll: number; text: string; secret: boolean };
  /**
   * A hunter can find the path again on a 3-in-6 chance (CB p113). Not rolled
   * here — whether the party has one is the Referee's call, and this is a
   * reminder rather than a second automatic roll.
   */
  hunterHint?: boolean;
}
