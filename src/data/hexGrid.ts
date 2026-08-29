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

/** What one scene's calibration remembers: a known hex, and where it was. */
export interface HexCalibration {
  /** The grid's own row and column for the hex below. */
  i: number;
  j: number;
  /** The book's hex the token was standing in, as four digits. */
  hex: string;
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

/**
 * The book's hex for a grid offset on a calibrated scene.
 *
 * The whole arithmetic: the book numbers a hex column-then-row, Foundry numbers
 * it row-then-column, and the difference between the two is one pair of
 * constants per map.
 */
export function hexFromOffset(
  cal: HexCalibration | undefined,
  offset: { i: number; j: number } | undefined
): string | undefined {
  if (!cal || !offset) return undefined;
  const column = Number(cal.hex.slice(0, 2)) + (offset.j - cal.j);
  const row = Number(cal.hex.slice(2)) + (offset.i - cal.i);
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
 * Measure this scene against a hex the Referee knows the token is standing in.
 *
 * Refuses a hex the book does not detail, because a calibration built on a
 * number nobody can check is worse than none: every later reading would be
 * wrong by the same amount and nothing would ever say so.
 */
export async function calibrate(
  scene: { id?: string; name?: string; grid?: unknown } | undefined,
  point: { x?: number; y?: number } | undefined,
  hex: string
): Promise<{ ok: true; cal: HexCalibration } | { ok: false; why: string }> {
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

  const cal: HexCalibration = { ...offset, hex: here.hex, ...(scene.name ? { scene: scene.name } : {}) };
  await g.settings.set(MODULE_ID, SETTINGS.HEX_CALIBRATION, { ...allCalibrations(), [scene.id]: cal });
  return { ok: true, cal };
}
