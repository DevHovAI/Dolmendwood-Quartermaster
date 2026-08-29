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

/** Marks a class as already carrying this behaviour, so it is wrapped once. */
const WRAPPED = "dwTravelRuler";

type RulerWaypoint = {
  center?: { x?: number; y?: number };
  previous?: RulerWaypoint | null;
};

type LabelContext = {
  cost?: { total: string; units: string; delta?: string };
  cssClass?: string;
};

type RulerBase = {
  token?: { document?: MovedToken };
  _getWaypointLabelContext(w: unknown, s: unknown): LabelContext | void;
};

/** The centres of every waypoint up to and including this one, in order. */
function pathTo(waypoint: RulerWaypoint): { x?: number; y?: number }[] {
  const chain: RulerWaypoint[] = [];
  for (let w: RulerWaypoint | null | undefined = waypoint; w; w = w.previous) chain.unshift(w);
  return chain.map((w) => w.center ?? {}).filter((p) => typeof p.x === "number");
}

/**
 * Swap the ruler's cost for ours, on the class Foundry is currently using.
 *
 * **Called at `init` and again at every `canvasInit`, and that is not belt and
 * braces.** A Token builds its ruler the first time it is drawn — `if
 * (this.ruler === undefined) this.ruler = this._initializeRuler()` — so a class
 * put into CONFIG after the tokens are on screen reaches none of them. The
 * first cut of this installed at `ready`, by which time the initial scene is
 * drawn, and it did nothing at all. `canvasInit` fires before the token layer
 * draws, which is the moment that matters, and it also catches a system or
 * module that put its own ruler in after us.
 *
 * Idempotent by a marker on the class, so repeated calls do not stack one
 * subclass on another; a module that subclasses *ours* inherits the marker and
 * is left alone, because our behaviour is still in its chain.
 */
export function installTravelRuler(): void {
  const config = (CONFIG as unknown as { Token?: { rulerClass?: unknown } })?.Token;
  const Base = config?.rulerClass as (new (...args: unknown[]) => RulerBase) | undefined;
  if (!Base) return;
  if ((Base as unknown as Record<string, unknown>)[WRAPPED]) return;
  // Another ruler entirely, with no label to rewrite: leave it be rather than
  // subclass it into a call that throws the first time somebody drags a token.
  if (typeof (Base.prototype as RulerBase)?._getWaypointLabelContext !== "function") return;

  class TravelPointRuler extends (Base as new (...args: unknown[]) => RulerBase) {
    static [WRAPPED] = true;

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
