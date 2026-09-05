import { briefHex } from "./hexBriefing";
import { t } from "../helpers/i18n";
import { MODULE_ID, SETTINGS } from "../constants";
import { SETTLEMENTS, type Settlement } from "./settlementEncounters";

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
   * Which regional encounter column the party's hex reads (Campaign Book p115).
   *
   * Sticky like the rest of this record and changed about as often: a region is
   * a dozen hexes across, so a party crossing one boundary is usually still in
   * the same one. Aquatic is among the twelve and is not a place — it is the
   * column for a day spent on a river or a lake, and picking it is how the
   * Referee says so.
   */
  region: Region;
  /**
   * Which settlement the party is in, when they are in one at all.
   *
   * A separate field from `region` on purpose, and deliberately not an entry in
   * its list: the two answer different questions and are both true at once.
   * Prigwort is in the High Wold, and the moment the party walks out of the
   * gate the region governs what they meet again. Folding towns into the region
   * list would have made leaving town look like leaving the High Wold.
   *
   * `"elsewhere"` covers every place the book does not detail — most of the
   * map's hamlets — and means the settlement roll has no table to read.
   */
  settlement: Settlement | "elsewhere";
  /**
   * The hex the party is standing in, as the Referee reads it off the map.
   *
   * The one fact they always have and the module never could: from it come the
   * terrain, its Travel Point cost, the region, the chance of losing the way,
   * and whether anything grows here the ordinary tables do not know about. Kept
   * as the string rather than resolved, because a hex the book does not detail
   * is still worth writing down — the Referee sets the terrain by hand and the
   * number stays on the bar.
   */
  hex?: string;
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
  labelKey: string;
  icon: string;
  monthsKey: string;
  host: "winter" | "spring" | "summer" | "autumn";
  hintKey: string;
}[] = [
  {
    id: "winter",
    labelKey: "DOLMENWOOD.Ctx.Season.Winter.Label",
    icon: "fa-snowflake",
    monthsKey: "DOLMENWOOD.Ctx.Season.Winter.Months",
    host: "winter",
    hintKey: "DOLMENWOOD.Ctx.Season.Winter.Hint",
  },
  {
    id: "spring",
    labelKey: "DOLMENWOOD.Ctx.Season.Spring.Label",
    icon: "fa-seedling",
    monthsKey: "DOLMENWOOD.Ctx.Season.Spring.Months",
    host: "spring",
    hintKey: "DOLMENWOOD.Ctx.Season.Spring.Hint",
  },
  {
    id: "summer",
    labelKey: "DOLMENWOOD.Ctx.Season.Summer.Label",
    icon: "fa-sun",
    monthsKey: "DOLMENWOOD.Ctx.Season.Summer.Months",
    host: "summer",
    hintKey: "DOLMENWOOD.Ctx.Season.Summer.Hint",
  },
  {
    id: "autumn",
    labelKey: "DOLMENWOOD.Ctx.Season.Autumn.Label",
    icon: "fa-leaf",
    monthsKey: "DOLMENWOOD.Ctx.Season.Autumn.Months",
    host: "autumn",
    hintKey: "DOLMENWOOD.Ctx.Season.Autumn.Hint",
  },
  {
    id: "hitching",
    labelKey: "DOLMENWOOD.Ctx.Season.Hitching.Label",
    icon: "fa-moon-over-sun",
    monthsKey: "DOLMENWOOD.Ctx.Season.Hitching.Months",
    host: "winter",
    hintKey: "DOLMENWOOD.Ctx.Season.Hitching.Hint",
  },
  {
    id: "colliggwyld",
    labelKey: "DOLMENWOOD.Ctx.Season.Colliggwyld.Label",
    icon: "fa-mushroom",
    monthsKey: "DOLMENWOOD.Ctx.Season.Colliggwyld.Months",
    host: "spring",
    hintKey: "DOLMENWOOD.Ctx.Season.Colliggwyld.Hint",
  },
  {
    id: "chame",
    labelKey: "DOLMENWOOD.Ctx.Season.Chame.Label",
    icon: "fa-staff-snake",
    monthsKey: "DOLMENWOOD.Ctx.Season.Chame.Months",
    host: "summer",
    hintKey: "DOLMENWOOD.Ctx.Season.Chame.Hint",
  },
  {
    id: "vague",
    labelKey: "DOLMENWOOD.Ctx.Season.Vague.Label",
    icon: "fa-smog",
    monthsKey: "DOLMENWOOD.Ctx.Season.Vague.Months",
    host: "winter",
    hintKey: "DOLMENWOOD.Ctx.Season.Vague.Hint",
  },
];

/** What a band costs and risks (Terrain Types, Player's Book p156). */
export const TERRAIN_BANDS: Record<
  TerrainBand,
  { labelKey: string; chanceIn6: number; cost: number; travelKey: string }
> = {
  light: {
    labelKey: "DOLMENWOOD.Ctx.Band.Light.Label",
    chanceIn6: 1,
    cost: 2,
    travelKey: "DOLMENWOOD.Ctx.Band.Light.Travel",
  },
  moderate: {
    labelKey: "DOLMENWOOD.Ctx.Band.Moderate.Label",
    chanceIn6: 2,
    cost: 3,
    travelKey: "DOLMENWOOD.Ctx.Band.Moderate.Travel",
  },
  difficult: {
    labelKey: "DOLMENWOOD.Ctx.Band.Difficult.Label",
    chanceIn6: 3,
    cost: 4,
    travelKey: "DOLMENWOOD.Ctx.Band.Difficult.Travel",
  },
};

export const TERRAINS: { id: Terrain; labelKey: string; band: TerrainBand; blurbKey: string }[] = [
  { id: "farmland", labelKey: "DOLMENWOOD.Ctx.Terrain.Farmland.Label", band: "light", blurbKey: "DOLMENWOOD.Ctx.Terrain.Farmland.Blurb" },
  { id: "fungal-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.FungalForest.Label", band: "light", blurbKey: "DOLMENWOOD.Ctx.Terrain.FungalForest.Blurb" },
  { id: "hills", labelKey: "DOLMENWOOD.Ctx.Terrain.Hills.Label", band: "light", blurbKey: "DOLMENWOOD.Ctx.Terrain.Hills.Blurb" },
  { id: "meadow", labelKey: "DOLMENWOOD.Ctx.Terrain.Meadow.Label", band: "light", blurbKey: "DOLMENWOOD.Ctx.Terrain.Meadow.Blurb" },
  { id: "open-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.OpenForest.Label", band: "light", blurbKey: "DOLMENWOOD.Ctx.Terrain.OpenForest.Blurb" },
  { id: "bog", labelKey: "DOLMENWOOD.Ctx.Terrain.Bog.Label", band: "moderate", blurbKey: "DOLMENWOOD.Ctx.Terrain.Bog.Blurb" },
  { id: "hilly-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.HillyForest.Label", band: "moderate", blurbKey: "DOLMENWOOD.Ctx.Terrain.HillyForest.Blurb" },
  { id: "tangled-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.TangledForest.Label", band: "moderate", blurbKey: "DOLMENWOOD.Ctx.Terrain.TangledForest.Blurb" },
  { id: "boggy-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.BoggyForest.Label", band: "difficult", blurbKey: "DOLMENWOOD.Ctx.Terrain.BoggyForest.Blurb" },
  { id: "craggy-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.CraggyForest.Label", band: "difficult", blurbKey: "DOLMENWOOD.Ctx.Terrain.CraggyForest.Blurb" },
  { id: "swamp", labelKey: "DOLMENWOOD.Ctx.Terrain.Swamp.Label", band: "difficult", blurbKey: "DOLMENWOOD.Ctx.Terrain.Swamp.Blurb" },
  { id: "thorny-forest", labelKey: "DOLMENWOOD.Ctx.Terrain.ThornyForest.Label", band: "difficult", blurbKey: "DOLMENWOOD.Ctx.Terrain.ThornyForest.Blurb" },
];

export type Region =
  | "aldweald"
  | "aquatic"
  | "dwelmfurgh"
  | "fever-marsh"
  | "hags-addle"
  | "high-wold"
  | "mulchgrove"
  | "nagwood"
  | "northern-scratch"
  | "table-downs"
  | "tithelands"
  | "valley-of-wise-beasts";

/**
 * The twelve regional columns (CB p115).
 *
 * **Aquatic is one of the twelve, and is not a place.** It is the column for
 * encounters on rivers and lakes, and the book says to roll on it directly
 * rather than rolling for a type first — so choosing it here is how a Referee
 * says the party is on the water today.
 */
export const REGIONS: { id: Region; label: string }[] = [
  { id: "aldweald", label: "Aldweald" },
  { id: "aquatic", label: "Aquatic" },
  { id: "dwelmfurgh", label: "Dwelmfurgh" },
  { id: "fever-marsh", label: "Fever Marsh" },
  { id: "hags-addle", label: "Hag’s Addle" },
  { id: "high-wold", label: "High Wold" },
  { id: "mulchgrove", label: "Mulchgrove" },
  { id: "nagwood", label: "Nagwood" },
  { id: "northern-scratch", label: "Northern Scratch" },
  { id: "table-downs", label: "Table Downs" },
  { id: "tithelands", label: "Tithelands" },
  { id: "valley-of-wise-beasts", label: "Valley of Wise Beasts" },
];

export const WAYS: { id: Way; labelKey: string; icon: string; hintKey: string }[] = [
  {
    id: "road",
    labelKey: "DOLMENWOOD.Ctx.Way.Road.Label",
    icon: "fa-road",
    hintKey: "DOLMENWOOD.Ctx.Way.Road.Hint",
  },
  {
    id: "track",
    labelKey: "DOLMENWOOD.Ctx.Way.Track.Label",
    icon: "fa-route",
    hintKey: "DOLMENWOOD.Ctx.Way.Track.Hint",
  },
  {
    id: "wild",
    labelKey: "DOLMENWOOD.Ctx.Way.Wild.Label",
    icon: "fa-tree",
    hintKey: "DOLMENWOOD.Ctx.Way.Wild.Hint",
  },
];

const DEFAULT_CONTEXT: DayContext = {
  season: "autumn",
  terrain: "tangled-forest",
  way: "track",
  // The middle of the map and the middle of most campaigns: Prigwort, Lankshorn
  // and the road between them are all in the High Wold.
  region: "high-wold",
  settlement: "elsewhere",
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
    region: REGIONS.some((r) => r.id === stored.region)
      ? (stored.region as Region)
      : DEFAULT_CONTEXT.region,
    settlement:
      stored.settlement === "elsewhere" || SETTLEMENTS.some((x) => x.id === stored.settlement)
        ? (stored.settlement as Settlement | "elsewhere")
        : DEFAULT_CONTEXT.settlement,
    // Carried through as it was typed. This rebuilds the record field by
    // field, so anything not named here is silently dropped on every read —
    // which is exactly what happened to the hex the first time round: it was
    // written to the setting and never came back, so the bar showed no hex
    // line and foraging never found the hex's own yield.
    ...(stored.hex ? { hex: stored.hex } : {}),
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
  const answered =
    patch.season !== undefined ||
    patch.terrain !== undefined ||
    patch.way !== undefined ||
    patch.region !== undefined ||
    patch.settlement !== undefined ||
    patch.hex !== undefined;
  const before = getDayContext();
  const next = { ...before, ...patch };
  if (answered) delete next.moved;
  await g.settings.set(MODULE_ID, SETTINGS.DAY_CONTEXT, next);

  // **A new hex briefs itself** (Dolmenmaster, 2026-08-28). Here rather than at the
  // bar's two call sites, so every way of setting a hex brings the card with
  // it; and only on a *change*, or confirming a context would re-post it.
  if (patch.hex !== undefined && next.hex && next.hex !== before.hex) {
    await briefHex(next.hex);
  }
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
  // Destructured, not spread wholesale: the band carries a `labelKey` of its own
  // ("Moderate") which would otherwise overwrite the terrain's ("Tangled forest").
  const { labelKey: bandLabelKey, ...band } = TERRAIN_BANDS[entry.band];
  return { ...entry, ...band, bandLabelKey };
}

export function wayInfo(id: Way) {
  return WAYS.find((w) => w.id === id) ?? WAYS[0];
}

export function settlementLabel(id: Settlement | "elsewhere"): string {
  return SETTLEMENTS.find((s) => s.id === id)?.label ?? "Not in a detailed settlement";
}

export function regionInfo(id: Region) {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

/** The terrains grouped into their bands, for a dropdown that reads like the book's table. */
export function terrainGroups() {
  return (Object.keys(TERRAIN_BANDS) as TerrainBand[]).map((band) => ({
    band,
    label: t("DOLMENWOOD.Ctx.Band.Group", {
      band: t(TERRAIN_BANDS[band].labelKey),
      chance: TERRAIN_BANDS[band].chanceIn6,
      cost: TERRAIN_BANDS[band].cost,
    }),
    terrains: TERRAINS.filter((t) => t.band === band),
  }));
}
