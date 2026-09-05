import { terrainInfo, type Terrain, type Way } from "./dayContext";
import { t } from "../helpers/i18n";

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
      reason: t("DOLMENWOOD.Lost.Reason.Road"),
    };
  }

  if (way === "track") {
    return {
      inSix: 1,
      base: 1,
      weather: 0,
      reason: t("DOLMENWOOD.Lost.Reason.Track"),
    };
  }

  const terr = terrainInfo(terrain);
  const weather = poorVisibility ? 1 : 0;
  return {
    inSix: terr.chanceIn6 + weather,
    base: terr.chanceIn6,
    weather,
    reason: t(weather ? "DOLMENWOOD.Lost.Reason.WildFog" : "DOLMENWOOD.Lost.Reason.Wild", {
      chance: terr.chanceIn6,
      terrain: t(terr.labelKey),
      band: t(terr.bandLabelKey).toLowerCase(),
    }),
  };
}

export interface LostConsequence {
  min: number;
  max: number;
  /** Sprachschluessel, nicht der Text. */
  textKey: string;
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
  { min: 3, max: 3, textKey: "DOLMENWOOD.Lost.Consequence.R3" },
  {
    min: 4,
    max: 4,
    textKey: "DOLMENWOOD.Lost.Consequence.R4",
  },
  { min: 5, max: 5, textKey: "DOLMENWOOD.Lost.Consequence.R5" },
  { min: 6, max: 7, textKey: "DOLMENWOOD.Lost.Consequence.R6", secret: true },
  { min: 8, max: 9, textKey: "DOLMENWOOD.Lost.Consequence.R8", secret: true },
  {
    min: 10,
    max: 11,
    textKey: "DOLMENWOOD.Lost.Consequence.R10",
  },
  { min: 12, max: 13, textKey: "DOLMENWOOD.Lost.Consequence.R12", secret: true },
  { min: 14, max: 15, textKey: "DOLMENWOOD.Lost.Consequence.R14", secret: true },
  { min: 16, max: 16, textKey: "DOLMENWOOD.Lost.Consequence.R16" },
  {
    min: 17,
    max: 17,
    textKey: "DOLMENWOOD.Lost.Consequence.R17",
  },
  {
    min: 18,
    max: 18,
    textKey: "DOLMENWOOD.Lost.Consequence.R18",
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
  consequence?: {
    roll: number;
    /** English, as it was stored before the German pass. Absent since. */
    text?: string;
    /** Missing on a day rolled before the German pass; `text` stands in. */
    textKey?: string;
    secret: boolean;
  };
  /**
   * A hunter can find the path again on a 3-in-6 chance (CB p113). Not rolled
   * here — whether the party has one is the Referee's call, and this is a
   * reminder rather than a second automatic roll.
   */
  hunterHint?: boolean;
}
