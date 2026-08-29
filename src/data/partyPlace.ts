import { MODULE_ID, SETTINGS } from "../constants";
import { getPartyActors } from "./sharedStore";

/**
 * Where the party is, and therefore what it can walk into.
 *
 * A shop is a place. Until now a player could reach every shop in Dolmenwood
 * from the Shop button in their own inventory, wherever the party actually
 * stood — which made the map notes decorative and the settlement notes' careful
 * geography beside the point. This is the rule that puts the shops back on the
 * map: a player opens a shop note only where the party is standing.
 *
 * The Referee is never restricted. Half of running a shop is opening it to look
 * at it, and a GM who has to move a token first would just turn this off.
 */

/**
 * The scene grid's own coordinates for a point: row `i`, column `j`.
 *
 * Foundry's own numbering, which starts wherever the map's top-left corner
 * happens to be and has nothing to do with the book's hex numbers. `hexOf`
 * makes a key out of it; `hexGrid.ts` turns it into "1310" once a scene has
 * been calibrated.
 */
export function gridOffsetOf(
  scene: { grid?: unknown } | undefined,
  point: { x?: number; y?: number } | undefined
): { i: number; j: number } | undefined {
  const key = hexOf(scene, point);
  if (!key) return undefined;
  const [i, j] = key.split(",").map(Number);
  return Number.isFinite(i) && Number.isFinite(j) ? { i, j } : undefined;
}

/** Which hex a point falls in, by the scene's own grid. Undefined off a hex map. */
export function hexOf(
  scene: { grid?: unknown } | undefined,
  point: { x?: number; y?: number } | undefined
): string | undefined {
  const grid = scene?.grid as
    | {
        isHexagonal?: boolean;
        type?: number;
        getOffset?: (p: { x: number; y: number }) => { i: number; j: number };
      }
    | undefined;
  if (!grid?.getOffset) return undefined;

  // `isHexagonal` is the v12+ getter; the type range is the older way of asking
  // and costs nothing to keep.
  const hex =
    grid.isHexagonal ?? (typeof grid.type === "number" && grid.type >= 2 && grid.type <= 5);
  if (!hex) return undefined;

  if (typeof point?.x !== "number" || typeof point?.y !== "number") return undefined;
  const { i, j } = grid.getOffset({ x: point.x, y: point.y });
  return `${i},${j}`;
}

type TokenLike = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  actorId?: string;
  actor?: { id?: string } | null;
  getCenterPoint?: (data?: { x?: number; y?: number }) => { x?: number; y?: number };
};
type SceneLike = { name?: string; grid?: unknown; tokens?: Iterable<TokenLike> };
type NoteLike = { x?: number; y?: number; parent?: SceneLike };

/**
 * Where a token actually stands.
 *
 * **`TokenDocument#x/y` is the top-left corner of the token's base, not its
 * centre** — and on a hex grid that corner belongs to a *different hex* than
 * the token does, because a hexagon's bounding box pokes into its neighbours.
 * Asking the grid which hex that corner falls in therefore answers with the
 * wrong hex most of the time, which is exactly what refused Leander entry to a
 * shop he was standing on.
 *
 * `getCenterPoint()` is the right question and knows about hexagonal token
 * shapes and multi-hex bases. The arithmetic fallback is for the plain objects
 * the offline checks pass in, and for anything that is not a real document.
 *
 * A Note needs none of this: its x/y *is* its anchor point.
 */
export function tokenPoint(
  scene: SceneLike | undefined,
  token: TokenLike | undefined
): { x?: number; y?: number } | undefined {
  if (!token) return undefined;

  const centre = token.getCenterPoint?.();
  if (typeof centre?.x === "number" && typeof centre?.y === "number") return centre;

  const grid = scene?.grid as { sizeX?: number; sizeY?: number; size?: number } | undefined;
  const sizeX = grid?.sizeX ?? grid?.size;
  const sizeY = grid?.sizeY ?? grid?.size;
  if (
    typeof token.x !== "number" ||
    typeof token.y !== "number" ||
    typeof sizeX !== "number" ||
    typeof sizeY !== "number"
  ) {
    return token;
  }
  return {
    x: token.x + ((token.width ?? 1) * sizeX) / 2,
    y: token.y + ((token.height ?? 1) * sizeY) / 2,
  };
}

/**
 * The tokens that stand for the party on one scene.
 *
 * A named marker wins where the world has one — Leander's table travels as a
 * single "Dolmendudes" token, which belongs to no player and so is invisible to
 * `getPartyActors()` (that helper requires a *non-GM* owner, by design). The
 * setting takes a name or an id, since a name is what a Referee knows.
 *
 * With no marker named, every party character's token counts instead, so the
 * rule still does something sensible in a world that has never touched the
 * setting.
 */
export function partyTokensOn(scene: SceneLike | undefined): TokenLike[] {
  if (!scene?.tokens) return [];
  const g = game as Game;
  const named = ((g.settings.get(MODULE_ID, SETTINGS.PARTY_MARKER_ACTOR) ?? "") as string).trim();

  let wanted: Set<string>;
  if (named) {
    const marker = g.actors?.getName(named) ?? g.actors?.get(named);
    if (!marker?.id) return [];
    wanted = new Set([marker.id]);
  } else {
    wanted = new Set(getPartyActors().map((a) => a.id ?? "").filter(Boolean));
  }
  if (wanted.size === 0) return [];

  return [...scene.tokens].filter((t) => {
    const id = t.actorId ?? t.actor?.id;
    return !!id && wanted.has(id);
  });
}

export interface Reachability {
  ok: boolean;
  /** Why not, in words a player can act on. Empty when ok. */
  reason: string;
}

/**
 * Whether the party may walk into the place this note marks.
 *
 * On a **hex map** the test is the hex itself: the marker must stand in the
 * same hex as the note. That is the unit the Campaign Book measures travel in,
 * and it is already the unit the day bar's movement hint watches.
 *
 * On a **scene with no hex grid** — a village map, a dungeon — being there is
 * the whole test. Once you are in the village you are in the village, and
 * making players walk a token to each stall would be busywork. (Leander's call,
 * 2026-08-25.) Note the consequence: a village scene with no party token on it
 * at all counts as "the party is not there", so its shops stay shut.
 */
export function partyCanReachNote(note: NoteLike | undefined): Reachability {
  const g = game as Game;
  if (g.user?.isGM) return { ok: true, reason: "" };
  if (!g.settings.get(MODULE_ID, SETTINGS.SHOPS_NEED_PARTY_PRESENT)) {
    return { ok: true, reason: "" };
  }

  const scene = note?.parent;
  const here = partyTokensOn(scene);
  const where = scene?.name ?? "this map";
  if (here.length === 0) {
    return { ok: false, reason: `The party is not on ${where}.` };
  }

  const noteHex = hexOf(scene, note);
  // Not a hex map: standing on the scene is the whole test.
  if (!noteHex) return { ok: true, reason: "" };

  const inHex = here.some((t) => hexOf(scene, tokenPoint(scene, t)) === noteHex);
  return inHex
    ? { ok: true, reason: "" }
    : { ok: false, reason: "The party is not in that hex — travel there first." };
}

type GridLike = {
  isHexagonal?: boolean;
  type?: number;
  getOffset?: (p: { x: number; y: number }) => { i: number; j: number };
  getAdjacentOffsets?: (o: { i: number; j: number }) => { i: number; j: number }[];
};

/**
 * Which cell of *any* grid a point falls in — square as well as hexagonal.
 *
 * Beside `hexOf`, which answers only for hex grids because the shop rule is
 * written that way on purpose: a village map has no hexes and standing in the
 * village is the whole test there. **Loot needs the other answer**, and finding
 * that out cost a live test: Olfmar opened a body from clear across the battle
 * map, because a battle map is a *square* grid, `hexOf` returned nothing, and
 * the rule fell open (Leander, 2026-08-28).
 *
 * Gridless scenes still answer `undefined`. Every point on one is its own cell,
 * so "next to" has no meaning and being on the scene is all that can be asked.
 */
export function cellOf(
  scene: SceneLike | undefined,
  point: { x?: number; y?: number } | undefined
): string | undefined {
  const grid = scene?.grid as GridLike | undefined;
  // 0 is gridless; 1 is square; 2–5 are the four hex layouts.
  const real = grid?.isHexagonal || (typeof grid?.type === "number" && grid.type >= 1);
  if (!grid?.getOffset || !real) return undefined;
  if (typeof point?.x !== "number" || typeof point?.y !== "number") return undefined;
  const { i, j } = grid.getOffset({ x: point.x, y: point.y });
  return `${i},${j}`;
}

/**
 * That cell and the ring around it.
 *
 * Foundry's own `getAdjacentOffsets` is asked rather than the neighbours being
 * worked out here: a square has eight of them and a hex six, and which hexes
 * touch which depends on whether the grid is pointy or flat topped and on which
 * rows are offset. A module that reimplemented that would be wrong on
 * somebody's map and right on the test's.
 */
export function cellsWithinOne(
  scene: SceneLike | undefined,
  point: { x?: number; y?: number } | undefined
): Set<string> | undefined {
  const grid = scene?.grid as GridLike | undefined;
  const here = cellOf(scene, point);
  if (!here || !grid?.getOffset) return undefined;
  const offset = grid.getOffset({ x: point!.x!, y: point!.y! });
  const keys = new Set([here]);
  for (const o of grid.getAdjacentOffsets?.(offset) ?? []) keys.add(`${o.i},${o.j}`);
  return keys;
}

/** Every token on this scene the current user owns. */
export function ownedTokensOn(scene: SceneLike | undefined): TokenLike[] {
  if (!scene?.tokens) return [];
  const g = game as Game;
  const mine = new Set(
    (g.actors?.contents ?? [])
      .filter((a) => a.isOwner)
      .map((a) => a.id ?? "")
      .filter(Boolean)
  );
  return [...scene.tokens].filter((t) => {
    const id = t.actorId ?? t.actor?.id;
    return !!id && mine.has(id);
  });
}

/**
 * Whether a player may open the body or hoard this note marks.
 *
 * **Two scenarios, two distances** — Leander, 2026-08-28: *"nur wenn party
 * token drauf (Kartenszenario) oder player token adjacent (Battlemap
 * szenario)."* Which one applies is decided by *whose* token answers, not by
 * guessing what kind of scene this is:
 *
 *  - **The party marker must be standing on it.** On the world map a hex is a
 *    day's travel, and looting a body from the hex next door is looting it from
 *    a mile away. Same rule as a shop's.
 *  - **A character's own token may be next to it.** On a battle map a hex is a
 *    few feet, and nobody stands *inside* a corpse — the ring of neighbours is
 *    where you kneel down. This is the one time the party is not one piece on
 *    the board, which is why the marker is not the only answer.
 *
 * On a scene with no hex grid the test is the scene, exactly as for a shop.
 */
export function canReachLoot(note: NoteLike | undefined): Reachability {
  const g = game as Game;
  if (g.user?.isGM) return { ok: true, reason: "" };
  if (!g.settings.get(MODULE_ID, SETTINGS.SHOPS_NEED_PARTY_PRESENT)) {
    return { ok: true, reason: "" };
  }

  const scene = note?.parent;
  const where = scene?.name ?? "this map";
  const marker = partyTokensOn(scene);
  const own = ownedTokensOn(scene);
  if (marker.length === 0 && own.length === 0) {
    return { ok: false, reason: `You have nobody on ${where}.` };
  }

  // **Any grid, not only a hex one.** A battle map is usually squares, and
  // asking `hexOf` there answered "no grid" and let everybody in from anywhere.
  const noteHex = cellOf(scene, note);
  if (!noteHex) return { ok: true, reason: "" };

  const markerOnIt = marker.some((t) => cellOf(scene, tokenPoint(scene, t)) === noteHex);
  const ownBeside = own.some((t) => cellsWithinOne(scene, tokenPoint(scene, t))?.has(noteHex));
  return markerOnIt || ownBeside
    ? { ok: true, reason: "" }
    : {
        ok: false,
        reason: "Travel to that hex with the party, or step a token beside it.",
      };
}

/** The same question, answered with a notification when the answer is no. */
export function refusePlaceIfAway(note: NoteLike | undefined, what: string): boolean {
  const verdict = partyCanReachNote(note);
  if (verdict.ok) return false;
  ui.notifications?.warn(`${what} is out of reach. ${verdict.reason}`);
  return true;
}
