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

/**
 * What today's weather takes off the firewood roll.
 *
 * The Player's Book gives the Referee three examples and no table: "-1 for damp
 * conditions, -2 in snow, -4 in heavy rain" (p158). The day's weather already
 * says which of the three the party is standing in, so the module reads it
 * rather than asking — Leander's point, and it is right: the roll was made an
 * hour ago and the answer is on the card.
 *
 * **The wet-conditions letter decides whether there is a penalty at all**, and
 * the words decide how big. A dry day takes nothing off however cold it is: a
 * deep freeze is bad for the party and fine for firewood. Read in order, so the
 * decisive word wins — a snow storm is snow, not a storm.
 *
 * Always a suggestion. The dialog fills the select in with it and the Referee
 * can overrule, because "damp" and "snow" is a judgement the words on a d12
 * table cannot always settle.
 */
export function firewoodPenalty(result: WeatherResult | undefined): number {
  if (!hasEffect(result, "W")) return 0;
  const text = (result?.text ?? "").toLowerCase();
  const bands: [RegExp, number][] = [
    [/blizzard|snow|sleet/, -2],
    [/torrential|driving rain|pouring|downpour|thunder storm/, -4],
  ];
  for (const [pattern, penalty] of bands) if (pattern.test(text)) return penalty;
  // Everything else the letter marks is damp: drizzle, dew, seeping mist, a
  // gentle rain.
  return -1;
}

/** A one-line summary for the strip: "Rolling fog (poor visibility)". */
export function weatherSummary(result: WeatherResult): string {
  if (!result.effects.length) return result.text;
  const named = result.effects.map((e) => WEATHER_EFFECTS[e].label.toLowerCase()).join(", ");
  return `${result.text} (${named})`;
}

/**
 * A face for the day, off the words the book uses for it.
 *
 * Read in order, so the decisive word wins: a blizzard is snow before it is
 * fog, and freezing rain is rain before it is cold. The effect icons are no
 * use here — they picture what the weather *does* to the party (a figure
 * falling over for impeded travel), not what it looks like out of the window.
 */
export function weatherIcon(result: WeatherResult | undefined): string {
  const text = (result?.text ?? "").toLowerCase();
  const faces: [RegExp, string][] = [
    [/blizzard|snow|hoarfrost|deep freeze|sleet/, "fa-snowflake"],
    [/thunder|lightning|storm/, "fa-cloud-bolt"],
    [/driving rain|downpour|torrential|freezing rain|rain/, "fa-cloud-showers-heavy"],
    [/drizzle|damp|shower/, "fa-cloud-rain"],
    [/fog|mist|murk/, "fa-smog"],
    [/gale|blustery|wind|breez/, "fa-wind"],
    [/baking|scorching|sweltering|hot/, "fa-temperature-arrow-up"],
    [/freez|bitter|frost|icy|cold|chill/, "fa-temperature-arrow-down"],
    [/overcast|brooding|cloud|gloom|grey|gray/, "fa-cloud"],
    [/clear|bright|balmy|clement|fresh|fine|sun/, "fa-sun"],
  ];
  return faces.find(([pattern]) => pattern.test(text))?.[1] ?? "fa-cloud-sun";
}

/**
 * The sky over the map, for a weather module to draw.
 *
 * The sibling of `weatherIcon` above, and built the same way: the book's own
 * words pick the picture, read in order so the decisive one wins. The chip
 * pictures what the day *does* to the party; this pictures what it looks like
 * out of the window.
 *
 * **The letters gate and the words picture.** A row with no effect letter on it
 * draws nothing at all, however it is worded — the map speaks up only for
 * weather the rules already say costs the party something, which is the same
 * test as "is there anything out there to see". That is what keeps a brooding
 * summer sky, a muggy afternoon and a bracing wind off the map: eleven rows
 * whose whole news is a cloud, and a drifting cloud sprite over a drawn hex map
 * is the thing that made this look like a toy the first time round. It also
 * keeps the picture honest with the numbers: "Brooding thunder" carries no wet
 * letter, the firewood roll is about to treat the day as dry, and nothing rains.
 *
 * **A tint only where the book names a colour.** Dolmenwood's two unseasons
 * have fae weather of their own — a purple mist, a sickly yellow one, a
 * befuddling green fog — and they are the whole reason this is worth drawing.
 * Everything else stays the grey a fog is.
 *
 * The numbers here are the book's reading, not the drawing: how much falls and
 * how thick the air is, on FXMaster's own scales. What that becomes on screen —
 * opacity, scale, whether it is drawn under the tokens — is `weatherFx.ts`,
 * along with the strength the table has asked for.
 */
export type Falling = "rain" | "snow" | "snowstorm" | "hail";

export interface WeatherSky {
  /** What comes down, if anything. Plenty of days are only thick air. */
  falls?: Falling;
  /** How much of it, on FXMaster's own density scale, at ordinary strength. */
  density?: number;
  /** How much cloud is overhead. Almost every day has some; a fair day has none. */
  cloud?: number;
  /** The book names thunder on this row, so the sky answers now and then. */
  lightning?: boolean;
  /** A glimmer in the air. Faint every day; six times that in an unseason. */
  glimmer?: number;
  /** How thick the air is, as fog on FXMaster's own density scale. */
  haze?: number;
  /** A tint for whichever of the two is present, where the book names one. */
  color?: string;
  /** The book describes this one by its wind, so what is up there is driven. */
  driven?: boolean;
}

/** The cast the ice family takes: a fog at freezing is not the same grey. */
const ICE = "#cfe6ff";

/**
 * The densities are anchored on a figure measured rather than guessed.
 *
 * Leander tuned FXMaster by hand against the Dolmenwood world map (2026-09-01)
 * and arrived at 0.51 for fog, 0.5 for rain, 0.27 for sleet, 0.21 for snow and
 * 0.13 for a snowstorm. Those five are what the plain rows are set to here,
 * and every other row of that kind is placed around its own anchor — a drizzle at two fifths of the rain,
 * a torrential downpour at not quite double; a gentle snow at half the snow.
 * The anchors are nothing like each other — they fall by a factor of three
 * from rain to snowstorm — which is exactly why each had to be measured on its
 * own rather than reasoned from its neighbour. FXMaster's own presets run at 1.5 to 5 for the
 * same rows, which is a weather demo rather than a map somebody reads a hex
 * grid off for three hours.
 */
const SKIES: [RegExp, WeatherSky][] = [
  // The unseasons' own colours come first, because a green fog is green before
  // it is a fog and nothing below would leave the tint on.
  [/green/, { haze: 0.58, color: "#7bd47b" }],
  [/purple|violet/, { haze: 0.45, color: "#8f6fd0" }],
  [/yellow|sickly/, { haze: 0.45, color: "#d6cf6b" }],

  // Snow before storm — the same reading `firewoodPenalty` makes of the same
  // words: a snow storm is snow, not a storm.
  [/blizzard|snow storm/, { falls: "snowstorm", density: 0.13, haze: 0.22 }],
  [/gentle snow/, { falls: "snow", density: 0.12 }],
  [/snow/, { falls: "snow", density: 0.21 }],
  [/sleet|freezing rain/, { falls: "hail", density: 0.27, color: "#9aa5ad" }],
  [/hail/, { falls: "hail", density: 0.27 }],

  // Rain. The heavy rows carry a little haze as well, because that is what a
  // downpour actually does to what you can see — and it is the letter the book
  // puts on every one of them.
  [/thunder ?storm/, { falls: "rain", density: 0.8, haze: 0.27 }],
  [/torrential|pouring|driving rain|downpour/, { falls: "rain", density: 0.9, haze: 0.22 }],
  [/drizzle/, { falls: "rain", density: 0.2 }],
  [/gentle rain/, { falls: "rain", density: 0.3 }],
  [/rain/, { falls: "rain", density: 0.5 }],

  // Thick air, in the book's own gradations. Above cloud deliberately: "Low
  // cloud, mist" and "Cloudy, misty" both carry the poor-visibility letter, and
  // it is the mist that earns it.
  [/thick, rolling/, { haze: 0.65, driven: true }],
  [/rolling/, { haze: 0.55, driven: true }],
  [/freezing fog/, { haze: 0.58, color: ICE }],
  [/thick fog/, { haze: 0.65 }],
  [/fog/, { haze: 0.51 }],
  [/icy mist|chill mist|frigid mist/, { haze: 0.3, color: ICE }],
  [/mist/, { haze: 0.27 }],
  // A day the book calls only damp still hangs in the air. The wet letter is on
  // the row and the firewood roll is about to take a point off for it.
  [/damp/, { haze: 0.15 }],
];

/**
 * How much cloud is overhead, which on most days is the only answer there is.
 *
 * **Cloud is the ground state and a fair day is the exception**, which is the
 * opposite of how this file first had it. The first cut drew no cloud at all,
 * on the reasoning that a row whose whole news is "overcast" costs the party
 * nothing and so should cost the map nothing either. That is right about the
 * rules and wrong about the sky: cloud is simply *there*, nearly always, and a
 * map with a clear blue sky over a gloomy, cool day is drawing a fact that is
 * not true (Leander, 2026-09-01: "wolken sind halt immer da").
 *
 * So the letters still gate what *falls* and how thick the air is — those are
 * events, and the book says which days have them — and cloud is drawn on every
 * day the module already calls unfair. `isSunny` is that test and it is not a
 * new one: the Campaign Book's hex 0811 has already been asking it every day
 * to decide whether the farm girls are out.
 */
const CLOUDS: [RegExp, number][] = [
  // A sky with weather coming out of it is a heavier sky.
  [/blizzard|snow storm|thunder|torrential|pouring|driving rain|downpour/, 0.3],
  [/overcast|gloom|brooding|cloud/, 0.25],
];

/** What an ordinary unremarkable sky carries. Measured, like everything else. */
const CLOUD_BASE = 0.147;

/**
 * A glitter in the air, always, and more of it in an unseason.
 *
 * Not weather, strictly — it is Dolmenwood. The wood is fairy-haunted every
 * day of the year, so the faint figure is on every row of every table; and
 * Hitching and Vague are not weather at all so much as Fairy leaking through,
 * which the tables say out loud — a sleepy purple mist, a befuddling green fog,
 * violet mist *rising*. The coloured tints carry half of that and this is the
 * other half.
 *
 * **Nothing here reads words.** `WeatherResult.table` already says which table
 * the day was rolled on, so the rule is exact: an unseason is an unseason,
 * whatever the weather on the day happens to be doing.
 */
const GLIMMER = 0.05;
const GLIMMER_UNSEASON = 0.28;

/**
 * Thunder, which is on an axis of its own — the words, never the letters.
 *
 * Two rows name it and only one of them is wet. "Thunder storm" carries the
 * poor-visibility and wet letters and pours; **"Brooding thunder" carries none
 * at all**, and under the rule that governs everything else here it draws
 * nothing but cloud. Lightning is the one thing that can be added to a dry row
 * without contradicting it: it costs the party nothing, which is exactly why
 * the book gave that row no letter, and a dry sky lit from inside is precisely
 * what the words describe.
 */
const THUNDER = /thunder/;

/** Wind is not a picture of its own; it drives whatever is already up there. */
const WINDY = /wind|blustery|gale|breez|relentless/;

/**
 * What today's weather looks like, or nothing at all.
 *
 * Nothing is the commonest answer and a real one: more than half of these
 * sixty-six rows leave the map alone, either because the day carries no effect
 * letter or because what it does carry has no picture — dew is dew.
 * `weatherFx.ts` reads `undefined` as "take ours down".
 */
export function weatherSky(result: WeatherResult | undefined): WeatherSky | undefined {
  if (!result) return undefined;
  const text = result.text.toLowerCase();

  // What falls, and how thick the air is: only where the book puts a letter on
  // the row. Those are the day's events, and a day with none has none.
  const event = result.effects.length
    ? SKIES.find(([pattern]) => pattern.test(text))?.[1]
    : undefined;

  // What is overhead: on every day that is not a fair one, letters or no.
  const cloud = isSunny(result)
    ? undefined
    : CLOUDS.find(([pattern]) => pattern.test(text))?.[1] ?? CLOUD_BASE;

  // Fairy, everywhere, and nearer on the two tables that are Fairy's own.
  const unseason = result.table === "hitching" || result.table === "vague";

  const sky: WeatherSky = {
    ...event,
    ...(cloud === undefined ? {} : { cloud }),
    ...(THUNDER.test(text) ? { lightning: true } : {}),
    glimmer: unseason ? GLIMMER_UNSEASON : GLIMMER,
  };
  return sky.driven || !WINDY.test(text) ? sky : { ...sky, driven: true };
}

/** What the map is about to show, in a word or two, for a tooltip. */
export function skySummary(sky: WeatherSky | undefined): string {
  if (!sky) return "";
  const falling: Record<Falling, string> = {
    rain: "rain",
    snow: "snow",
    snowstorm: "driving snow",
    hail: "sleet",
  };
  const parts: string[] = [];
  if (sky.falls) parts.push(falling[sky.falls]);
  if (sky.haze) parts.push(sky.haze >= 0.45 ? "fog" : "haze in the air");
  // Last, and only where it is the whole story: on a day it is raining, the
  // cloud is not the news.
  if (sky.cloud && !parts.length) parts.push(sky.cloud >= 0.25 ? "heavy cloud" : "cloud");
  if (sky.lightning) parts.push("lightning");
  return parts.join(" and ");
}
/**
 * Whether the day's weather counts as sunny, for the one hex that asks.
 *
 * Hex 0811's farm girls are out "on sunny days", and the weather tables word
 * that half a dozen ways — "Warm, sunny", "Balmy, clear", "Brisk, clear". The
 * same words the icon reads, since the two questions are the same question.
 *
 * **Baking and sweltering were added 2026-09-01**, when the map started asking
 * the same question to decide whether to draw cloud. A baking, dry summer day
 * was coming out cloudy, which is absurd — and the farm girls should have been
 * out on it all along.
 */
export function isSunny(result: WeatherResult | undefined): boolean {
  return !!result && /sun|clear|bright|balmy|fine|fair|baking|sweltering/i.test(result.text);
}
