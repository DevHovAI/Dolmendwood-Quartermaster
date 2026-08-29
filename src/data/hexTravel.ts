import { MODULE_ID, SETTINGS } from "../constants";
import { travelBudgetNow } from "../apps/DayBarApp";
import { getDayContext, terrainInfo } from "./dayContext";
import { getDayState } from "./dayDuties";
import { followsToken, pathHexes, travelCostOf } from "./hexGrid";
import { isPartyToken, tokenPoint } from "./partyPlace";

/**
 * What a move over the hex map costs, and what the party has to spend on it.
 *
 * One sum, asked by three things that must never disagree: the hook that
 * refuses a move it cannot pay for, the hook that charges for the one that
 * happens, and the ruler that shows the price while the Referee is still
 * deciding. Two of those disagreeing would be the worst of both — refused and
 * charged, or walked and free.
 */

/** A token document, as much of one as any of the three needs. */
export type MovedToken = {
  parent?: { id?: string; name?: string; grid?: unknown };
  actorId?: string;
  actor?: { id?: string } | null;
  getCenterPoint?: (data?: { x?: number; y?: number }) => { x?: number; y?: number };
  width?: number;
  height?: number;
};

/**
 * Where a waypoint actually is.
 *
 * A movement waypoint is a token *position* — the top-left corner of the base,
 * which on a hex grid sits in a neighbouring hex — so every one of them has to
 * be recentred or the crossing is counted at the wrong moment. Shared with the
 * party-presence rule through `tokenPoint`.
 */
export function centreOf(doc: MovedToken, p: { x?: number; y?: number } | undefined) {
  if (!p) return undefined;
  return (
    doc.getCenterPoint?.(p) ?? tokenPoint(doc.parent, { ...p, width: doc.width, height: doc.height })
  );
}

export interface MoveAccount {
  parts: { hex: string; cost: number; known: boolean }[];
  total: number;
  /** Travel Points still unspent today. */
  left: number;
  budget: number;
}

/**
 * The cost of one move, hex by hex, against the day's remaining allowance.
 *
 * Undefined where none of this applies: the charge switched off, the hex not
 * being read off the token, the token not one the world can call the party's,
 * the map not calibrated, or no budget known yet. Undefined is not zero — a
 * caller must treat it as "this is none of the module's business", not as "it
 * is free".
 *
 * **`centred`** says the points have already been moved to the middle of the
 * token. The movement hooks hand over raw waypoints and need the correction;
 * the ruler hands over `waypoint.center`, which has had it already, and
 * applying it twice would shift every reading by half a token.
 */
export function moveAccount(
  doc: MovedToken,
  waypoints: ({ x?: number; y?: number } | undefined)[],
  { centred = false }: { centred?: boolean } = {}
): MoveAccount | undefined {
  const g = game as Game;
  if (!g.settings?.get(MODULE_ID, SETTINGS.TP_FROM_MOVEMENT)) return undefined;
  if (!followsToken()) return undefined;
  if (isPartyToken(doc.parent as never, doc) === false) return undefined;

  const scene = doc.parent as { id?: string; grid?: unknown } | undefined;
  const points = waypoints.filter((p): p is { x?: number; y?: number } => !!p);
  const hexes = pathHexes(scene, centred ? points : points.map((p) => centreOf(doc, p) ?? p));
  if (!hexes.length) return undefined;

  const budget = travelBudgetNow();
  if (budget === undefined) return undefined;

  const ctx = getDayContext();
  const { parts, total } = travelCostOf(hexes, ctx.way, terrainInfo(ctx.terrain).cost);
  return { parts, total, left: Math.max(0, budget - getDayState().travelPointsUsed), budget };
}
