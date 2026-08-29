import { moveAccount, type MovedToken } from "../data/hexTravel";

/**
 * The price of the next hex, before anybody commits to it.
 *
 * Foundry already draws a ruler while a token is being dragged, and already
 * puts a cost on it — in feet, which on the Dolmenwood map is the one unit
 * nobody at the table is counting. This replaces that number with the thing
 * they are counting: the Travel Points the hexes under the ruler would cost,
 * out of the same `moveAccount` the refusal and the charge use, so the label
 * cannot promise one price and the move take another.
 *
 * It also says what is left, and marks the label when the two do not fit —
 * which is the whole question being asked while the token is in the air.
 *
 * **A label, and nothing else.** The obvious alternative was to give core a
 * movement cost function of our own (`CONFIG.Token.movement.TerrainData`), and
 * it was the wrong tool: that number is what core budgets movement against for
 * every token in every scene, and this is a caption on a drag.
 */

type RulerWaypoint = {
  center?: { x?: number; y?: number };
  previous?: RulerWaypoint | null;
};

type LabelContext = {
  cost?: { total: string; units: string; delta?: string };
  cssClass?: string;
};

/** The centres of every waypoint up to and including this one, in order. */
function pathTo(waypoint: RulerWaypoint): { x?: number; y?: number }[] {
  const chain: RulerWaypoint[] = [];
  for (let w: RulerWaypoint | null | undefined = waypoint; w; w = w.previous) chain.unshift(w);
  return chain.map((w) => w.center ?? {}).filter((p) => typeof p.x === "number");
}

/**
 * Swap the ruler's cost for ours, on the class Foundry is already using.
 *
 * Subclassed at `ready` from whatever `CONFIG.Token.rulerClass` then holds, so
 * a system or another module that has put its own ruler there keeps every part
 * of it that is not this one label. Where the move is none of our business —
 * off a calibrated map, not the party's token, the charge switched off —
 * `moveAccount` says so and core's own label is left exactly as it was.
 */
export function installTravelRuler(): void {
  const config = (CONFIG as unknown as { Token?: { rulerClass?: unknown } })?.Token;
  const Base = config?.rulerClass as
    | (new (...args: unknown[]) => {
        token?: { document?: MovedToken };
        _getWaypointLabelContext?: (w: unknown, s: unknown) => LabelContext | void;
      })
    | undefined;
  if (!Base) return;

  class TravelPointRuler extends (Base as new (...args: unknown[]) => {
    token?: { document?: MovedToken };
    _getWaypointLabelContext(w: unknown, s: unknown): LabelContext | void;
  }) {
    override _getWaypointLabelContext(waypoint: unknown, state: unknown): LabelContext | void {
      const context = super._getWaypointLabelContext(waypoint, state);
      // Core returns nothing for a waypoint it does not label at all — the
      // first one, or a step too small to be worth a caption. Nothing to
      // rewrite, and nothing to add.
      if (!context) return context;

      const doc = this.token?.document;
      if (!doc) return context;

      const account = moveAccount(doc, pathTo(waypoint as RulerWaypoint), { centred: true });
      if (!account) return context;

      // Core's template draws this as "{total} {units} ({delta})", so the
      // label reads "3 TP (2 left)" — the price, and whether it can be paid,
      // which is the whole question while the token is still in the air.
      const short = account.total > account.left;
      context.cost = {
        total: `${account.total}`,
        units: "TP",
        delta: `${account.left} left`,
      };
      context.cssClass = `${context.cssClass ?? ""}${short ? " dw-tp-short" : ""}`.trim();
      return context;
    }
  }

  (config as { rulerClass?: unknown }).rulerClass = TravelPointRuler;
}
