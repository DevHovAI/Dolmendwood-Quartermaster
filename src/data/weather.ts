import type { Season } from "./dayContext";

/**
 * The day's weather (Campaign Book p112).
 *
 * One 2d6 roll a day on the table for the season. Six tables: the four seasons
 * and the two unseasons that have weather of their own. Colliggwyld and Chame
 * do not — the book sends them to spring and summer respectively.
 *
 * The effect letters are the point of the whole thing. They are an optional
 * rule in the book, and they are what lets a roll here reach the rest of the
 * bar rather than just printing a line of flavour text.
 */

/** Travel impeded: the day's Travel Points are reduced by 2. */
export type WeatherEffect = "I" | "V" | "W";

export interface WeatherEntry {
  /** 2d6 */
  roll: number;
  text: string;
  effects: WeatherEffect[];
}

export const WEATHER_EFFECTS: Record<WeatherEffect, { label: string; icon: string; hint: string }> =
  {
    I: {
      label: "Travel impeded",
      icon: "fa-person-falling",
      hint: "The party's daily Travel Points are reduced by 2. If that brings them to 0 or below, the party can only progress by forced marching.",
    },
    V: {
      label: "Poor visibility",
      icon: "fa-eye-low-vision",
      hint: "Encounter distance is halved, and the chance of getting lost while travelling wild rises by 1-in-6.",
    },
    W: {
      label: "Wet conditions",
      icon: "fa-droplet",
      hint: "Building a campfire is difficult. Gathering firewood yields less: -1 damp, -2 snow, -4 heavy rain.",
    },
  };

/** The seasons with a weather table of their own. */
export type WeatherTableId = "winter" | "spring" | "summer" | "autumn" | "hitching" | "vague";

const w = (roll: number, text: string, effects: string): WeatherEntry => ({
  roll,
  text,
  effects: effects.split("") as WeatherEffect[],
});

export const WEATHER_BY_SEASON: Record<WeatherTableId, WeatherEntry[]> = {
  winter: [
    w(2, "Deep freeze, hoarfrost", ""),
    w(3, "Snow storm", "IVW"),
    w(4, "Relentless wind", ""),
    w(5, "Bitter, silent", ""),
    w(6, "Frigid, icy", ""),
    w(7, "Clear, cold", ""),
    w(8, "Freezing rain", "VW"),
    w(9, "Cold wind, gloomy", ""),
    w(10, "Frigid mist", "V"),
    w(11, "Icy, steady snow", "VW"),
    w(12, "Relentless blizzard", "IVW"),
  ],
  spring: [
    w(2, "Cold, gentle snow", "W"),
    w(3, "Chilly, damp", "W"),
    w(4, "Windy, cloudy", ""),
    w(5, "Brisk, clear", ""),
    w(6, "Clement, cheery", ""),
    w(7, "Warm, sunny", ""),
    w(8, "Bright, fresh", ""),
    w(9, "Blustery, drizzle", "W"),
    w(10, "Pouring rain", "VW"),
    w(11, "Gloomy, cool", ""),
    w(12, "Chill mist", "V"),
  ],
  summer: [
    w(2, "Cool winds", ""),
    w(3, "Low cloud, mist", "V"),
    w(4, "Warm, gentle rain", "W"),
    w(5, "Brooding thunder", ""),
    w(6, "Balmy, clear", ""),
    w(7, "Hot, humid", ""),
    w(8, "Overcast, muggy", ""),
    w(9, "Sweltering, still", ""),
    w(10, "Baking, dry", ""),
    w(11, "Warm wind", ""),
    w(12, "Thunder storm", "VW"),
  ],
  autumn: [
    w(2, "Torrential rain", "VW"),
    w(3, "Rolling fog", "V"),
    w(4, "Driving rain", "VW"),
    w(5, "Bracing wind", ""),
    w(6, "Balmy, clement", ""),
    w(7, "Clear, chilly", ""),
    w(8, "Drizzle, damp", "W"),
    w(9, "Cloudy, misty", "V"),
    w(10, "Brooding clouds", ""),
    w(11, "Frosty, chill", ""),
    w(12, "Icy, gentle snow", "W"),
  ],
  hitching: [
    w(2, "Torrential rain", "VW"),
    w(3, "Clear, fresh dew", "W"),
    w(4, "Sleepy, purple mist", "V"),
    w(5, "Interminable drizzle", "W"),
    w(6, "Balmy mist", "V"),
    w(7, "Thick fog, hot", "V"),
    w(8, "Misty, seeping damp", "VW"),
    w(9, "Hazy fog, dripping", "VW"),
    w(10, "Sticky dew drips", "W"),
    w(11, "Gloomy, shadows drip", ""),
    w(12, "Befuddling green fog", "V"),
  ],
  vague: [
    w(2, "Hoarfrost, freezing fog", "V"),
    w(3, "Steady snow, icy mist", "VW"),
    // Printed with no effect letters, unlike every other mist on this table.
    // Transcribed as it stands rather than tidied.
    w(4, "Low mist, writhing soil", ""),
    w(5, "Sickly, yellow mist", "V"),
    w(6, "Thick, rolling fog", "V"),
    w(7, "Freezing fog", "V"),
    w(8, "Chill mist, winds wail", "V"),
    w(9, "Icy mist, eerie howling", "V"),
    w(10, "Violet mist rises", "V"),
    w(11, "Blizzard, earth tremors", "IVW"),
    w(12, "Blizzard, dense fog", "IVW"),
  ],
};

/**
 * Which table a season rolls on.
 *
 * "Colliggwyld and Chame do not have special weather tables of their own — use
 * the standard tables for spring and summer, respectively" (CB p112).
 */
export function weatherTableFor(season: Season): WeatherTableId {
  if (season === "colliggwyld") return "spring";
  if (season === "chame") return "summer";
  return season;
}

/** What the day's weather is doing to the party. Stored on the day, not derived. */
export interface WeatherResult {
  /** The season rolled for, which need not be the season now — the day is fixed. */
  season: Season;
  table: WeatherTableId;
  roll: number;
  text: string;
  effects: WeatherEffect[];
}

export function weatherEntry(table: WeatherTableId, roll: number): WeatherEntry | undefined {
  return WEATHER_BY_SEASON[table].find((e) => e.roll === roll);
}

export function hasEffect(result: WeatherResult | undefined, effect: WeatherEffect): boolean {
  return !!result?.effects.includes(effect);
}

/** How many Travel Points the weather costs today. The one number that leaves this module. */
export const TRAVEL_IMPEDED_COST = 2;

export function travelPointPenalty(result: WeatherResult | undefined): number {
  return hasEffect(result, "I") ? TRAVEL_IMPEDED_COST : 0;
}

/** A one-line summary for the strip: "Rolling fog (poor visibility)". */
export function weatherSummary(result: WeatherResult): string {
  if (!result.effects.length) return result.text;
  const named = result.effects.map((e) => WEATHER_EFFECTS[e].label.toLowerCase()).join(", ");
  return `${result.text} (${named})`;
}
