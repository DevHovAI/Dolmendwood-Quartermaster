import { MODULE_ID, SETTINGS } from "../constants";

/**
 * Where the party is, and when.
 *
 * Every table the Referee rolls on is conditional: the weather depends on the
 * season, getting lost on the terrain and whether there is a road underfoot,
 * the quarry of a hunt on the terrain again, encounters on the region. None of
 * it can be derived — Foundry knows nothing about Dolmenwood's hex map or its
 * calendar — so it is stated here once and kept.
 *
 * **Deliberately not part of `DayState`.** That record is wiped at every
 * roll-over, and rightly so: ticks and Travel Points belong to one day. Where
 * the party is does not. A party in the High Wold is still in the High Wold
 * tomorrow, and being asked for the season every morning would be worse than
 * having no rolls at all. This is sticky until the Referee changes it — or
 * until their tokens walk into another hex, which the bar notices and says.
 */

export type Season =
  | "winter"
  | "spring"
  | "summer"
  | "autumn"
  | "hitching"
  | "colliggwyld"
  | "chame"
  | "vague";

/**
 * A named terrain type, not a difficulty band.
 *
 * The band was enough for getting lost, which only wants the 1/2/3-in-6. It is
 * not enough for hunting: the Game Animals table (Campaign Book p121) has one
 * column per named terrain, and there are exactly twelve of them — the same
 * twelve the Terrain Types table sorts into bands. So the named type is what is
 * stored and the band is derived from it, rather than the other way round.
 */
export type Terrain =
  | "farmland"
  | "fungal-forest"
  | "hills"
  | "meadow"
  | "open-forest"
  | "bog"
  | "hilly-forest"
  | "tangled-forest"
  | "boggy-forest"
  | "craggy-forest"
  | "swamp"
  | "thorny-forest";

export type TerrainBand = "light" | "moderate" | "difficult";

/** Road, track, or off both (PB p154). Decides whether there is a lost roll at all. */
export type Way = "road" | "track" | "wild";

export interface DayContext {
  season: Season;
  terrain: Terrain;
  way: Way;
  /**
   * Set once a token has crossed a hex boundary since the context was last
   * confirmed. A marker, not a tally: how many hexes were crossed does not
   * change what the Referee has to do about it, which is look at the terrain
   * once. The scene is kept only so a move on a different map starts over.
   */
  moved?: { sceneName: string };
}

/**
 * The four seasons and the four unseasons, in the order the year runs.
 *
 * The unseasons are listed after the seasons rather than woven among them: they
 * are rare (a 1-in-4, a 1-in-20, a 1-in-10) and a Referee scanning for "Autumn"
 * should not have to pass Colliggwyld to reach it. `months` is what actually
 * identifies them at the table, since the party tracks the date, not the label.
 *
 * `host` is the ordinary season an unseason falls inside. It is what foraging
 * yields go by — Vague falls in the winter months, so foraging in one gives the
 * winter's 1d4 — and is a separate question from which *weather* table an
 * unseason borrows, which the book states outright for only two of them.
 */
export const SEASONS: {
  id: Season;
  label: string;
  icon: string;
  months: string;
  host: "winter" | "spring" | "summer" | "autumn";
  hint: string;
}[] = [
  {
    id: "winter",
    label: "Winter",
    icon: "fa-snowflake",
    months: "Grimvold, Lymewald, Haggryme",
    host: "winter",
    hint: "Winter's hold is light since the Cold Prince was vanquished — the waters seldom freeze, and snow rarely piles deep. Foraging yields only 1d4.",
  },
  {
    id: "spring",
    label: "Spring",
    icon: "fa-seedling",
    months: "Symswald, Harchment, Iggwyld",
    host: "spring",
    hint: "Sunny and clement. Dolmenwood is widely held to be at its most beautiful.",
  },
  {
    id: "summer",
    label: "Summer",
    icon: "fa-sun",
    months: "Chysting, Lillipythe, Haelhold",
    host: "summer",
    hint: "Hot, humid, and abuzz with insects. Sprite season — Lillipythe is awash with them.",
  },
  {
    id: "autumn",
    label: "Autumn",
    icon: "fa-leaf",
    months: "Reedwryme, Obthryme, Braghold",
    host: "autumn",
    hint: "The best foraging of the year: 1d8 rations rather than the usual 1d6.",
  },
  {
    id: "hitching",
    label: "Hitching",
    icon: "fa-moon-over-sun",
    months: "unseason — first 20 days of Grimvold",
    host: "winter",
    hint: "Unseason. The trees drip with dew, balmy mists fill the woods, and the fey moon shines beside the true one. Has a weather table of its own; falls in winter, so foraging yields 1d4.",
  },
  {
    id: "colliggwyld",
    label: "Colliggwyld",
    icon: "fa-mushroom",
    months: "unseason — the month of Iggwyld",
    host: "spring",
    hint: "Unseason. Giant fungi bloom throughout the Wood, and foraged fungi are found in DOUBLE quantity. Uses the spring weather table.",
  },
  {
    id: "chame",
    label: "Chame",
    icon: "fa-staff-snake",
    months: "unseason — 2d10 days from early Haelhold",
    host: "summer",
    hint: "Unseason. Serpents fill the wood. Any encounter has a 2-in-6 chance of being snakes or wyrms instead. Uses the summer weather table.",
  },
  {
    id: "vague",
    label: "Vague",
    icon: "fa-smog",
    months: "unseason — 1d6 days in Lymewald or Haggryme",
    host: "winter",
    hint: "Unseason. A sinister fog rolls from the earth and the dead rise with it. Any encounter has a 2-in-6 chance of being undead. Has a weather table of its own; falls in winter, so foraging yields 1d4.",
  },
];

/** What a band costs and risks (Terrain Types, Player's Book p156). */
export const TERRAIN_BANDS: Record<
  TerrainBand,
  { label: string; chanceIn6: number; cost: number; travel: string }
> = {
  light: {
    label: "Light",
    chanceIn6: 1,
    cost: 2,
    travel: "Mounts and vehicles may enter.",
  },
  moderate: {
    label: "Moderate",
    chanceIn6: 2,
    cost: 3,
    travel: "Mounts must be led; no vehicles.",
  },
  difficult: {
    label: "Difficult",
    chanceIn6: 3,
    cost: 4,
    travel: "No mounts or vehicles.",
  },
};

export const TERRAINS: { id: Terrain; label: string; band: TerrainBand; blurb: string }[] = [
  { id: "farmland", label: "Farmland", band: "light", blurb: "Tilled fields and lanes" },
  { id: "fungal-forest", label: "Fungal forest", band: "light", blurb: "Giant fungi, few trees" },
  { id: "hills", label: "Hills", band: "light", blurb: "Undulating grassland" },
  { id: "meadow", label: "Meadow", band: "light", blurb: "Flat grassland" },
  { id: "open-forest", label: "Open forest", band: "light", blurb: "Light, airy woods" },
  { id: "bog", label: "Bog", band: "moderate", blurb: "Treeless mire" },
  { id: "hilly-forest", label: "Hilly forest", band: "moderate", blurb: "Undulating woods" },
  { id: "tangled-forest", label: "Tangled forest", band: "moderate", blurb: "Dense, gloomy woods" },
  { id: "boggy-forest", label: "Boggy forest", band: "difficult", blurb: "Wet, muddy woods" },
  { id: "craggy-forest", label: "Craggy forest", band: "difficult", blurb: "Broken terrain, cliffs" },
  { id: "swamp", label: "Swamp", band: "difficult", blurb: "Wetland, sparse trees" },
  { id: "thorny-forest", label: "Thorny forest", band: "difficult", blurb: "Dense thorn thickets" },
];

export const WAYS: { id: Way; label: string; icon: string; hint: string }[] = [
  {
    id: "road",
    label: "Road",
    icon: "fa-road",
    hint: "An actively maintained road. Travel is quick and there is no chance of getting lost at all — the roll is made only when the party leaves it.",
  },
  {
    id: "track",
    label: "Track",
    icon: "fa-route",
    hint: "A smaller path, seldom frequented and sporadically maintained. Travel is quick, with a small risk of losing the way.",
  },
  {
    id: "wild",
    label: "Wild",
    icon: "fa-tree",
    hint: "Off roads and tracks. Speed and the chance of getting lost both come from the terrain.",
  },
];

const DEFAULT_CONTEXT: DayContext = {
  season: "autumn",
  terrain: "tangled-forest",
  way: "track",
};

/**
 * Fill in anything a stored record is missing or no longer recognises.
 *
 * `terrain` used to hold a difficulty band ("light", "moderate", "difficult")
 * before hunting forced the named types; a world saved then falls back to the
 * default rather than guessing which of the four difficult terrains was meant.
 * One dropdown to re-pick, once.
 */
function normalise(stored: Partial<DayContext> | undefined): DayContext {
  if (!stored) return { ...DEFAULT_CONTEXT };
  return {
    season: SEASONS.some((s) => s.id === stored.season)
      ? (stored.season as Season)
      : DEFAULT_CONTEXT.season,
    terrain: TERRAINS.some((t) => t.id === stored.terrain)
      ? (stored.terrain as Terrain)
      : DEFAULT_CONTEXT.terrain,
    way: WAYS.some((w) => w.id === stored.way) ? (stored.way as Way) : DEFAULT_CONTEXT.way,
    ...(stored.moved?.sceneName ? { moved: { sceneName: stored.moved.sceneName } } : {}),
  };
}

export function getDayContext(): DayContext {
  const stored = (game as Game).settings?.get(MODULE_ID, SETTINGS.DAY_CONTEXT) as
    | Partial<DayContext>
    | undefined;
  return normalise(stored);
}

/**
 * Change the context.
 *
 * Setting any of the three fields by hand also clears the "you have moved"
 * warning: answering it is what the warning was asking for, and making the
 * Referee dismiss it separately afterwards would be a second click for nothing.
 */
export async function setDayContext(patch: Partial<DayContext>): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const answered = patch.season !== undefined || patch.terrain !== undefined || patch.way !== undefined;
  const next = { ...getDayContext(), ...patch };
  if (answered) delete next.moved;
  await g.settings.set(MODULE_ID, SETTINGS.DAY_CONTEXT, next);
}

/** "It is still right" — drop the warning without changing anything. */
export async function confirmDayContext(): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const next = { ...getDayContext() };
  delete next.moved;
  await g.settings.set(MODULE_ID, SETTINGS.DAY_CONTEXT, next);
}

/**
 * Mark the context as worth a second look, because a token crossed a hex.
 *
 * Called by the move hook, which has already decided a hex was actually
 * crossed. It never touches the season, terrain, or way: nothing on a Foundry
 * scene says whether a hex is bog or meadow, so guessing would be worse than
 * asking.
 *
 * Writes only when the flag is not already standing for this map — the party
 * crossing six hexes in an afternoon should cost one settings write, not six,
 * and the Referee has the same single thing to do either way.
 */
export async function noteHexStep(sceneName: string): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const ctx = getDayContext();
  if (ctx.moved?.sceneName === sceneName) return;
  await g.settings.set(MODULE_ID, SETTINGS.DAY_CONTEXT, { ...ctx, moved: { sceneName } });
}

export function seasonInfo(id: Season) {
  return SEASONS.find((s) => s.id === id) ?? SEASONS[0];
}

export function terrainInfo(id: Terrain) {
  const entry = TERRAINS.find((t) => t.id === id) ?? TERRAINS[0];
  // Destructured, not spread wholesale: the band carries a `label` of its own
  // ("Moderate") which would otherwise overwrite the terrain's ("Tangled forest").
  const { label: bandLabel, ...band } = TERRAIN_BANDS[entry.band];
  return { ...entry, ...band, bandLabel };
}

export function wayInfo(id: Way) {
  return WAYS.find((w) => w.id === id) ?? WAYS[0];
}

/** The terrains grouped into their bands, for a dropdown that reads like the book's table. */
export function terrainGroups() {
  return (Object.keys(TERRAIN_BANDS) as TerrainBand[]).map((band) => ({
    band,
    label: `${TERRAIN_BANDS[band].label} — ${TERRAIN_BANDS[band].chanceIn6}-in-6, ${TERRAIN_BANDS[band].cost} TP`,
    terrains: TERRAINS.filter((t) => t.band === band),
  }));
}
