import { MODULE_ID, SETTINGS } from "../constants";
import { HEXES, hexInfo } from "./hexes";
import { gridOffsetOf } from "./partyPlace";

/**
 * Reading the book's hex number off a token's position.
 *
 * A Foundry scene's grid numbers its own cells from its own top-left corner:
 * `getOffset` answers "row 9, column 14", and that has nothing to do with
 * "0608" — it depends entirely on where each table's copy of the map was
 * cropped and how its grid was lined up. So the module cannot know the book's
 * hex from a position, and until now it did not try: the move hook said "you
 * have moved, check the bar" and the Referee typed the number.
 *
 * **One measurement fixes that for good.** Stand the party's token in a hex
 * whose number you know, type that number on the bar, and press the crosshairs:
 * the difference between the grid's own coordinates and the book's is a
 * constant for that map, and every later position can be read straight off.
 * Leander's idea, 2026-08-29.
 *
 * **Stored per scene id**, because it is a property of a *map*: the world map
 * has the book's numbering, a battle map has none at all, and one calibration
 * used on both would put the party in a hex on the strength of where they stood
 * in somebody's kitchen.
 */

/**
 * What one scene's calibration remembers: **two** known hexes.
 *
 * **One is not enough, and the first cut of this shipped believing it was.**
 * Leander calibrated on 1508 and every hex in a neighbouring column came out
 * one row too far south: 1408 read as 1409, 1407 as 1408, 1607 as 1608. The
 * column was right every time.
 *
 * The reason is the stagger. A hex map's columns are offset from each other by
 * half a hex, so "the row above" means something different depending on which
 * column you are in — and Foundry's own numbering and the Campaign Book's
 * resolve that half-step in opposite directions on his map. Which way round it
 * goes is one bit of information, it is a property of how the map was drawn and
 * gridded, and **no single measurement can contain it**: one point fixes the
 * constant, and the constant is right for every hex in its own column and every
 * other column, and wrong by one for the columns in between.
 *
 * So the second point is measured too, in a **neighbouring column**, and the
 * half-step is read off the difference rather than assumed.
 */
export interface HexCalibration {
  /** The grid's own row and column for the hex below. */
  i: number;
  j: number;
  /** The book's hex the token was standing in, as four digits. */
  hex: string;
  /** The second measurement, from a column an odd number of steps away. */
  i2?: number;
  j2?: number;
  hex2?: string;
  /** The scene's name when it was measured, so a stale entry can be recognised. */
  scene?: string;
}

/**
 * The map's own bounds, taken from the data rather than written down twice.
 *
 * A calibrated grid answers for every cell of a Foundry scene, including the
 * margins outside the book's map, and a party parked on the edge would
 * otherwise get "2004" — a number the book has never heard of. Off the map is
 * an honest "no answer".
 */
const BOUNDS = HEXES.reduce(
  (b, h) => ({
    maxColumn: Math.max(b.maxColumn, Number(h.hex.slice(0, 2))),
    maxRow: Math.max(b.maxRow, Number(h.hex.slice(2))),
  }),
  { maxColumn: 0, maxRow: 0 }
);

function allCalibrations(): Record<string, HexCalibration> {
  const stored = (game as Game).settings?.get(MODULE_ID, SETTINGS.HEX_CALIBRATION) as
    | Record<string, HexCalibration>
    | undefined;
  return stored && typeof stored === "object" ? stored : {};
}

/** What this scene has been calibrated to, if anything. */
export function calibrationFor(sceneId: string | undefined): HexCalibration | undefined {
  if (!sceneId) return undefined;
  const found = allCalibrations()[sceneId];
  return found && typeof found.i === "number" && typeof found.j === "number" && found.hex
    ? found
    : undefined;
}

/** Is the module allowed to take the hex off the token at all? */
export function followsToken(): boolean {
  return !!(game as Game).settings?.get(MODULE_ID, SETTINGS.HEX_FROM_TOKEN);
}

const columnOf = (hex: string) => Number(hex.slice(0, 2));
const rowOf = (hex: string) => Number(hex.slice(2));

/**
 * The half-step between neighbouring columns, measured rather than assumed.
 *
 * Zero when the two numberings agree about which way a column's stagger leans,
 * ±1 when they do not — which is the case on Leander's map. Undefined until the
 * second point has been taken, and that is deliberate: a calibration that
 * cannot say is one that must not answer.
 */
export function parityShiftOf(cal: HexCalibration | undefined): number | undefined {
  if (!cal || cal.i2 === undefined || cal.j2 === undefined || !cal.hex2) return undefined;
  const dj = cal.j2 - cal.j;
  // Columns do not stagger — they are the unambiguous axis — so the book and
  // the grid must agree about how many columns apart the two points are. If
  // they do not, one of the two was measured wrong and no shift is derivable.
  if (columnOf(cal.hex2) - columnOf(cal.hex) !== dj) return undefined;
  if (Math.abs(dj % 2) !== 1) return undefined;
  const shift = rowOf(cal.hex2) - rowOf(cal.hex) - (cal.i2 - cal.i);
  return Math.abs(shift) <= 1 ? shift : undefined;
}

/** Has this scene been measured twice, so that it can actually answer? */
export function isComplete(cal: HexCalibration | undefined): boolean {
  return parityShiftOf(cal) !== undefined;
}

/**
 * The book's hex for a grid offset on a calibrated scene.
 *
 * The column is a plain difference: columns do not stagger. The row is the same
 * difference plus the half-step, applied when the target sits an **odd** number
 * of columns away — that is exactly when the two numberings disagree about
 * where the row boundary falls.
 */
export function hexFromOffset(
  cal: HexCalibration | undefined,
  offset: { i: number; j: number } | undefined
): string | undefined {
  const shift = parityShiftOf(cal);
  if (!cal || !offset || shift === undefined) return undefined;
  const dj = offset.j - cal.j;
  const column = columnOf(cal.hex) + dj;
  const row = rowOf(cal.hex) + (offset.i - cal.i) + (Math.abs(dj % 2) === 1 ? shift : 0);
  if (!Number.isFinite(column) || !Number.isFinite(row)) return undefined;
  if (column < 1 || row < 1 || column > BOUNDS.maxColumn || row > BOUNDS.maxRow) return undefined;
  return `${String(column).padStart(2, "0")}${String(row).padStart(2, "0")}`;
}

/** The book's hex a point falls in, on a scene that has been calibrated. */
export function bookHexAt(
  scene: { id?: string; grid?: unknown } | undefined,
  point: { x?: number; y?: number } | undefined
): string | undefined {
  return hexFromOffset(calibrationFor(scene?.id), gridOffsetOf(scene, point));
}

/**
 * Every hex the party actually **entered**, in order, for one move.
 *
 * Not origin-and-destination: a drag across four hexes crosses four, and the
 * book charges for each one entered. `getDirectPath` is core's own line-drawing
 * over the grid (`HexagonalGrid#getDirectPath`, the redblobgames algorithm), so
 * the module is not deciding for itself which cells a straight line passes
 * through — and a dog-legged path with waypoints is walked leg by leg.
 *
 * The first cell is dropped: the party was already standing in it and has long
 * since paid for it.
 */
export function pathHexes(
  scene: { id?: string; grid?: unknown } | undefined,
  waypoints: { x?: number; y?: number }[]
): string[] {
  const grid = scene?.grid as
    | { getDirectPath?: (w: { x: number; y: number }[]) => { i: number; j: number }[] }
    | undefined;
  const points = waypoints.filter(
    (p): p is { x: number; y: number } => typeof p?.x === "number" && typeof p?.y === "number"
  );
  if (!grid?.getDirectPath || points.length < 2) return [];

  const cal = calibrationFor(scene?.id);
  if (!isComplete(cal)) return [];

  let path: { i: number; j: number }[];
  try {
    path = grid.getDirectPath(points);
  } catch {
    return [];
  }

  const out: string[] = [];
  let last: string | undefined;
  for (const [n, offset] of path.entries()) {
    const hex = hexFromOffset(cal, offset);
    // A path that leaves the book's map contributes nothing rather than a
    // guess; the cells beyond it are simply not hexes anybody can be charged
    // for. Consecutive duplicates are dropped for the same reason as the first
    // cell: standing still costs nothing.
    if (n === 0) {
      last = hex;
      continue;
    }
    if (hex && hex !== last) out.push(hex);
    last = hex;
  }
  return out;
}

/** What entering one hex costs, by the book's two rules. */
export function hexEntryCost(hex: string, way: string, fallback: number): number {
  // "6 miles costs 2 Travel Points, unaffected by the type of terrain or the
  // number of hexes passed through" — Player's Book p156, for roads and tracks.
  // A hex is 6 miles across, so entering one along a road is 2, whatever the
  // ground either side of it looks like.
  if (way !== "wild") return 2;
  // "The Terrain Types table lists the cost to enter an adjacent hex, based on
  // its terrain type" (p157) — the hex being *entered*, not the one being left.
  return hexInfo(hex)?.cost ?? fallback;
}

/** What a whole move costs, hex by hex, for the card to print. */
export function travelCostOf(
  hexes: string[],
  way: string,
  fallback: number
): { parts: { hex: string; cost: number; known: boolean }[]; total: number } {
  const parts = hexes.map((hex) => ({
    hex,
    cost: hexEntryCost(hex, way, fallback),
    known: !!hexInfo(hex),
  }));
  return { parts, total: parts.reduce((sum, p) => sum + p.cost, 0) };
}

/** Which measurement the next press of the crosshairs will take. */
export function calibrationStep(sceneId: string | undefined): 1 | 2 {
  const cal = calibrationFor(sceneId);
  return cal && !isComplete(cal) ? 2 : 1;
}

/**
 * Measure this scene against a hex the Referee knows the token is standing in.
 *
 * **Two presses, in two different columns.** The first stores the anchor and
 * clears whatever was there; the second, taken from a column an odd number of
 * steps away, gives the half-step between the two numberings. A press on a
 * finished calibration starts over, because "measure it again" is what someone
 * pressing a crosshairs on a map that already works must mean.
 *
 * Every refusal is a sentence saying what to do instead. The one that matters
 * is the mismatched column: if the book says three columns and the grid says
 * two, one of the two hexes was typed wrong, and taking the measurement anyway
 * would bake that error into every reading afterwards.
 */
export async function calibrate(
  scene: { id?: string; name?: string; grid?: unknown } | undefined,
  point: { x?: number; y?: number } | undefined,
  hex: string
): Promise<
  { ok: true; step: 1 | 2; cal: HexCalibration; shift?: number } | { ok: false; why: string }
> {
  const g = game as Game;
  if (!g.user?.isGM) return { ok: false, why: "Only the Referee can calibrate a map." };

  const here = hexInfo(hex);
  if (!here) {
    return {
      ok: false,
      why: "Type the hex the token is standing in first — and one the Campaign Book details, so the measurement can be checked.",
    };
  }
  if (!scene?.id) return { ok: false, why: "No scene to calibrate." };

  const offset = gridOffsetOf(scene, point);
  if (!offset) {
    return {
      ok: false,
      why: "This scene has no hex grid, or there is no token to measure from. Select the party's token on the world map and try again.",
    };
  }

  const existing = calibrationFor(scene.id);
  const taking = existing && !isComplete(existing) ? 2 : 1;
  const save = async (cal: HexCalibration) => {
    await g.settings.set(MODULE_ID, SETTINGS.HEX_CALIBRATION, {
      ...allCalibrations(),
      [scene.id as string]: cal,
    });
  };

  if (taking === 1) {
    const cal: HexCalibration = {
      ...offset,
      hex: here.hex,
      ...(scene.name ? { scene: scene.name } : {}),
    };
    await save(cal);
    return { ok: true, step: 1, cal };
  }

  const first = existing as HexCalibration;
  const dj = offset.j - first.j;
  const dColumn = columnOf(here.hex) - columnOf(first.hex);
  if (dj === 0 || dColumn === 0) {
    return {
      ok: false,
      why: `The second hex has to be in a different column from ${first.hex} — one step left or right. That is the whole point of it: the columns are staggered, and the second measurement is what says which way.`,
    };
  }
  if (dColumn !== dj) {
    return {
      ok: false,
      why: `That does not add up: the book has ${here.hex} ${Math.abs(dColumn)} column(s) from ${first.hex}, and the grid has it ${Math.abs(dj)}. One of the two hexes is typed wrong. Check the number and press again.`,
    };
  }
  if (Math.abs(dj % 2) !== 1) {
    return {
      ok: false,
      why: `${here.hex} is an even number of columns from ${first.hex}, which measures nothing — the stagger repeats every second column. Use a hex directly to the left or right.`,
    };
  }

  const cal: HexCalibration = { ...first, i2: offset.i, j2: offset.j, hex2: here.hex };
  const shift = parityShiftOf(cal);
  if (shift === undefined) {
    return {
      ok: false,
      why: `Those two are more than a hex apart vertically once the columns are accounted for, so one of them is wrong. Take ${first.hex} again and use a hex right beside it.`,
    };
  }
  await save(cal);
  return { ok: true, step: 2, cal, shift };
}
