import { MODULE_ID, SETTINGS, TEMPLATES, TRAVEL_DAYS_PER_REST } from "../constants";
import { getConvoyActors } from "../data/sharedStore";
import { getEncumbranceMode } from "../data/zoneGrants";
import { getInnDay } from "../data/innMenu";
import { partyDayRows, setAte, setSleptWell, setRested, hungerEffect, exhaustionPenalty } from "../data/characterDay";
import { buildPartyConvoy } from "./PartyOverviewApp";
import {
  DUTIES,
  DUTY_GROUPS,
  DUTY_MODES,
  dutiesForMode,
  getDayState,
  reconcileDay,
  resetDuties,
  setDutiesDone,
  setDutyDone,
  setDutyMode,
  setForcedMarch,
  setTravelPointBudget,
  spendTravelPoints,
  startNewDay,
  type Duty,
  type DutyMode,
} from "../data/dayDuties";

/**
 * The day bar: the Referee's per-day checklist, docked at the top of the screen.
 *
 * **GM only.** Weather, getting lost, and the wandering-monster checks are the
 * Referee's business, and once these start rolling themselves a visible result
 * would tell the players a monster is coming before their characters know it.
 *
 * Frameless and unpositioned (`frame: false`, `positioned: false`), inserted
 * into Foundry's own `#ui-top` region — the top half of `#ui-middle`, a centred
 * flex column — so the bar sits under the scene navigation without coordinate
 * maths of its own and follows the interface when the UI scale changes.
 */
export class DayBarApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /**
   * Is the per-character panel unfolded? Per-instance rather than a setting: it
   * is a glance, not a preference, and should not follow the GM across sessions.
   */
  private panelOpen = false;

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-day-bar",
    // No window chrome and no JS positioning: this is a HUD strip, not a window.
    window: { frame: false, positioned: false },
    classes: ["dolmenwood-party-inventory", "day-bar"],
    actions: {
      setMode: DayBarApp._onSetMode,
      toggleDuty: DayBarApp._onToggleDuty,
      newDay: DayBarApp._onNewDay,
      resetDay: DayBarApp._onResetDay,
      hideBar: DayBarApp._onHideBar,
      toggleCollapsed: DayBarApp._onToggleCollapsed,
      spendTP: DayBarApp._onSpendTP,
      toggleForcedMarch: DayBarApp._onToggleForcedMarch,
      refreshBudget: DayBarApp._onRefreshBudget,
      togglePanel: DayBarApp._onTogglePanel,
      toggleAte: DayBarApp._onToggleAte,
      toggleSlept: DayBarApp._onToggleSlept,
      restChar: DayBarApp._onRestChar,
      openGroup: DayBarApp._onOpenGroup,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.DAY_BAR },
  };

  /**
   * Dock into Foundry's top UI region rather than the body.
   *
   * `#ui-middle` carries `pointer-events: none`, which is why the strip re-enables
   * them in CSS. Replacing an element of the same id first mirrors what the base
   * implementation does; without it a re-insert would leave two bars behind. The
   * body fallback keeps the bar reachable if that region ever goes away, and the
   * stylesheet pins it there.
   */
  protected override _insertElement(element: HTMLElement): void {
    const existing = document.getElementById(element.id);
    if (existing) {
      existing.replaceWith(element);
      return;
    }
    (document.getElementById("ui-top") ?? document.body).append(element);
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    // The inn window can move the day on too, so catch up before drawing.
    await reconcileDay();

    let state = getDayState();
    const collapsed = !!(game as Game).settings.get(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED);
    const duties = dutiesForMode(state.mode);
    const isDone = (d: Duty) => state.done[d.id] === true;
    const blocks = buildBlocks(duties, isDone);

    const party = partyDayRows().map((row) => {
      const overdue = row.travelDaysSinceRest >= TRAVEL_DAYS_PER_REST;
      const hunger = hungerEffect(row.daysWithoutFood);
      const exhaustion = exhaustionPenalty(
        row.daysWithoutSleep,
        row.travelDaysSinceRest,
        row.forcedMarchesSinceRest
      );

      // Hunger and exhaustion both bite the Attack Roll, so the column adds them
      // and the tooltip takes them apart again. The -4 ceiling belongs to
      // exhaustion alone (p151) and is applied before this, never to the sum.
      const attack = (hunger?.attack ?? 0) + exhaustion;
      const speed = hunger?.speed ?? 0;
      const constitution = hunger?.constitutionPerDay ?? 0;
      const parts: string[] = [];
      if (attack > 0 && attack === exhaustion) parts.push(`-${attack} Atk & Dmg`);
      else {
        if (attack > 0) parts.push(`-${attack} Atk`);
        if (exhaustion > 0) parts.push(`-${exhaustion} Dmg`);
      }
      if (speed > 0) parts.push(`-${speed} Spd`);
      if (constitution > 0) parts.push(`-${constitution} Con/day`);

      const sources: string[] = [];
      if (hunger) {
        sources.push(
          `${row.daysWithoutFood} day${row.daysWithoutFood === 1 ? "" : "s"} without food: -${hunger.attack} Attack` +
            (hunger.speed ? `, -${hunger.speed} Speed (never below 10)` : "") +
            (hunger.constitutionPerDay ? `, -${hunger.constitutionPerDay} Constitution a day, death at 0` : "") +
            " (Effects of Hunger, Player's Book p153)"
        );
      }
      if (exhaustion > 0) {
        const made = [
          row.daysWithoutSleep > 0
            ? `${row.daysWithoutSleep} night${row.daysWithoutSleep === 1 ? "" : "s"} without a good rest (-${row.daysWithoutSleep}, p159)`
            : "",
          overdue ? "a rest day overdue (-1, p157)" : "",
          row.forcedMarchesSinceRest > 0
            ? `${row.forcedMarchesSinceRest} forced march${row.forcedMarchesSinceRest === 1 ? "" : "es"} without a rest day since (-${row.forcedMarchesSinceRest}, p156)`
            : "",
        ].filter(Boolean);
        sources.push(
          `Exhaustion, ${made.join(" + ")}${exhaustion === 4 ? ", capped at -4" : ""}: -${exhaustion} to Attack and Damage Rolls until rested (p151). Lost sleep also gives each prepared spell a 1-in-6 chance of failing.`
        );
      }

      return {
        ...row,
        hungry: row.daysWithoutFood > 0,
        // Exhaustion from lost sleep bites on the very first day, unlike the rest
        // debt, which only comes due after a week of travel.
        tired: row.daysWithoutSleep > 0,
        overdue,
        penalty: parts.join(", "),
        penaltyTitle: sources.join("  •  "),
        noPenalty: parts.length === 0,
      };
    });

    // The day's allowance is frozen, not recomputed on every render. "Travel
    // Points Per Day" is a per-day figure read off the party's Speed (Player's
    // Book p156) and the day's procedure spends it down — it must not move under
    // the party mid-march because somebody ate a ration, took up a hoard, or
    // left a mule behind. Frozen here rather than at the roll-over because this
    // is the first moment the convoy can be measured; reconcileDay lives in a
    // module that deliberately cannot reach the encumbrance calculator.
    const derived = convoyTravelPoints();
    if (state.travelPointBudget === undefined && derived !== undefined && (game as Game).user?.isGM) {
      await setTravelPointBudget(derived);
      state = getDayState();
    }
    const normalBudget = state.travelPointBudget ?? derived;
    const budget = forcedBudget(normalBudget, state.forcedMarch);
    // The party is not what it was when the day began. Said, not acted on: only
    // the GM decides whether that is a new day's march or the same one.
    const stale =
      derived !== undefined && normalBudget !== undefined && derived !== normalBudget;

    return {
      collapsed,
      modes: DUTY_MODES.map((m) => ({ ...m, active: m.id === state.mode })),
      blocks,
      // Counted off the blocks, not the raw duties, so the figure matches the
      // ticks on screen: a group is one outstanding thing until its last step
      // is done, not seven.
      remaining: blocks.filter((b) => (b.groupId ? !b.allDone : !b.duties[0].done)).length,
      allDone: duties.length > 0 && duties.every(isDone),

      // Always on the top line, in every mode: how far the party can still get
      // today is the one number the GM looks up mid-sentence, and it was buried
      // in a row that only appeared in travel mode.
      travelPoints: {
        hasBudget: budget !== undefined,
        total: budget,
        normal: normalBudget,
        used: state.travelPointsUsed,
        left: budget === undefined ? 0 : Math.max(0, budget - state.travelPointsUsed),
        spent: state.travelPointsUsed > 0,
        // Calling off a forced march does not unwalk the miles: what was spent
        // stays spent, and the readout says so rather than quietly rounding it
        // down to the smaller budget.
        over: budget !== undefined && state.travelPointsUsed > budget,
        stale,
        derived,
        budgetTitle:
          budget === undefined
            ? "No party convoy to read a Speed from, so there is no allowance to count against."
            : `${state.travelPointsUsed} of the day's ${budget} Travel Points spent. The allowance is fixed when the day starts — the party's Speed divided by 5, and half as many again on a forced march (Player's Book p156) — so it does not shift under the march when a load or a ration changes. Unspent points are lost at nightfall.${state.travelPointsUsed > budget ? " More has been spent than the allowance now allows: the extra points were walked under a forced march that has since been called off." : ""}`,
        refreshTitle: stale
          ? `The party would be worth ${derived} Travel Points as they stand now, against the ${normalBudget} this day was started with. Click to adopt ${derived} — the points already spent stay spent.`
          : "Re-read the day's allowance from the party as they stand now. It is fixed at the start of the day on purpose, so this is only for when their circumstances really have changed.",        forced: state.forcedMarch,
        forcedTitle: state.forcedMarch
          ? `Forced march: ${normalBudget ?? "?"} Travel Points become ${budget ?? "?"}, at the price of a 16 hour day. Every character who marches owes a full rest day afterwards or is exhausted, -1 to Attack and Damage; marching again before that rest adds another -1 (Player's Book p156). Click to call it off.`
          : "Normal travel. Click to declare a forced march: half as many Travel Points again, a 16 hour day, and a rest day owed afterwards (Player's Book p156).",
      },
      // The bottom row exists only when it has something to carry.
      showFoot: party.length > 0,

      party,
      hasParty: party.length > 0,
      panelOpen: this.panelOpen,
      ateCount: party.filter((p) => p.ate).length,
      sleptCount: party.filter((p) => p.sleptWell).length,
      allAte: party.length > 0 && party.every((p) => p.ate),
      allSlept: party.length > 0 && party.every((p) => p.sleptWell),
      partySize: party.length,
      // One number for "somebody is taking a penalty right now", so the GM has a
      // reason to unfold the panel without unfolding it to find out.
      warnings: party.filter((p) => p.hungry || p.tired || p.overdue).length,
      restLimit: TRAVEL_DAYS_PER_REST,
    };
  }

  // ─── Duties ─────────────────────────────────────────────────────────────────

  private static async _onSetMode(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const mode = target.dataset.mode as DutyMode | undefined;
    if (!mode) return;
    await setDutyMode(mode);
    this.render();
  }

  private static async _onToggleDuty(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.dutyId;
    if (!id) return;
    await setDutyDone(id, target.dataset.done !== "true");
    this.render();
  }

  /**
   * Open a group's steps. The chip is a button rather than a tick: with seven
   * steps behind it, "done" is something to read, not something to set.
   */
  private static _onOpenGroup(this: DayBarApp, _event: Event, target: HTMLElement): void {
    const groupId = target.dataset.groupId;
    if (!groupId) return;
    openDutyGroup(groupId);
  }

  private static async _onNewDay(this: DayBarApp): Promise<void> {
    const confirmed = await Dialog.confirm({
      title: "New Day",
      content:
        `<p>Move on to day <strong>${getInnDay() + 1}</strong>?</p>` +
        '<p class="qm-hint">Every inn re-rolls its menu, the duty list starts fresh, and each character\'s hunger and rest clocks move on — anyone who did not eat today gains a day of hunger.</p>',
    });
    if (!confirmed) return;
    await startNewDay();
    this.render();
  }

  private static async _onResetDay(this: DayBarApp): Promise<void> {
    await resetDuties();
    this.render();
  }

  /**
   * Fold the bar down to its handle, keeping the day and what is still open in
   * view. Unlike the close button this leaves the bar on screen, so it is stored
   * as a preference rather than per instance — a GM who folded it away wants it
   * folded away next session too.
   */
  private static async _onToggleCollapsed(this: DayBarApp): Promise<void> {
    const g = game as Game;
    const now = !!g.settings.get(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED);
    await g.settings.set(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED, !now);
    this.render();
  }

  private static async _onHideBar(this: DayBarApp): Promise<void> {
    await (game as Game).settings.set(MODULE_ID, SETTINGS.SHOW_DAY_BAR, false);
    await this.close();
  }

  // ─── Travel Points ──────────────────────────────────────────────────────────

  private static async _onSpendTP(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const delta = Number(target.dataset.delta ?? 0);
    const budget = forcedBudget(convoyTravelPoints(), getDayState().forcedMarch);
    if (!delta || budget === undefined) return;
    await spendTravelPoints(delta, budget);
    this.render();
  }

  /**
   * Declare the day a forced march, or take it back.
   *
   * Spending points already over the normal budget is left alone when it is
   * called off: clamping them down would silently undo a decision the GM may
   * have meant, and spendTravelPoints clamps the next click anyway.
   */
  private static async _onToggleForcedMarch(this: DayBarApp): Promise<void> {
    await setForcedMarch(!getDayState().forcedMarch);
    this.render();
  }

  /**
   * Re-read the day's allowance from the party as they stand now.
   *
   * Deliberately manual. The whole point of freezing it is that a ration eaten
   * at noon does not lengthen the afternoon; only the GM can say that losing the
   * pack horse is a different day's march.
   */
  private static async _onRefreshBudget(this: DayBarApp): Promise<void> {
    const derived = convoyTravelPoints();
    if (derived === undefined) return;
    await setTravelPointBudget(derived);
    this.render();
  }

  // ─── The per-character panel ────────────────────────────────────────────────

  private static _onTogglePanel(this: DayBarApp): void {
    this.panelOpen = !this.panelOpen;
    this.render();
  }

  private static async _onToggleAte(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    if (!actor) return;
    await setAte(actor, target.dataset.value !== "true");
    this.render();
  }

  private static async _onToggleSlept(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    if (!actor) return;
    // A good night on a day the party did not move is the rest day it owes
    // itself, so the rest clock is settled here as well as at the roll-over.
    const travelled = getDayState().travelPointsUsed > 0;
    await setSleptWell(actor, target.dataset.value !== "true", travelled);
    this.render();
  }

  private static async _onRestChar(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    if (!actor) return;
    await setRested(actor);
    this.render();
  }
}

// ─── Context helpers ───────────────────────────────────────────────────────────

interface DutyBlock {
  /** Set when this block is a group: its id, label, and tally for the one tick. */
  groupId?: string;
  groupLabel?: string;
  groupIcon?: string;
  doneCount?: number;
  total?: number;
  allDone?: boolean;
  duties: { id: string; label: string; icon: string; hint: string; done: boolean }[];
}

/**
 * Lay the duties out in runs, so a group collapses to a single tick.
 *
 * Consecutive duties sharing a group become one block; everything else falls
 * into an unlabelled block whose duties are drawn one by one. Order is the
 * catalogue's, so moving a duty in the table moves it on screen.
 */
function buildBlocks(duties: Duty[], isDone: (d: Duty) => boolean): DutyBlock[] {
  const blocks: DutyBlock[] = [];
  for (const duty of duties) {
    const group = duty.group ? DUTY_GROUPS[duty.group] : undefined;
    const last = blocks[blocks.length - 1];
    const entry = {
      id: duty.id,
      label: duty.label,
      icon: duty.icon,
      hint: duty.hint,
      done: isDone(duty),
    };
    if (last && last.groupId === duty.group) last.duties.push(entry);
    else
      blocks.push({
        groupId: duty.group,
        groupLabel: group?.label,
        groupIcon: group?.icon,
        duties: [entry],
      });
  }
  for (const block of blocks) {
    if (!block.groupId) continue;
    block.doneCount = block.duties.filter((d) => d.done).length;
    block.total = block.duties.length;
    block.allDone = block.doneCount === block.total;
  }
  return blocks;
}

/**
 * What the party could do today if the allowance were read off them right now:
 * their Speed divided by 5 (Player's Book p156).
 *
 * This is not necessarily the day's allowance — that one is frozen in the day
 * state. It is what the allowance would be, which is what the refresh button
 * offers and what tells the bar the frozen figure has gone stale.
 */
function convoyTravelPoints(): number | undefined {
  const convoy = buildPartyConvoy(getConvoyActors(), getEncumbranceMode());
  if (!convoy) return undefined;
  return Math.floor(convoy.speed / 5);
}

/**
 * The day's Travel Point budget, forced march included.
 *
 * A forced march is worth "a 50% increase in Travel Points" (Player's Book
 * p156). Party speeds are multiples of 10 and the normal budget is speed / 5,
 * so the half is whole in every row of the book's table; the floor is only
 * there for a convoy whose speed some other module has bent.
 */
function forcedBudget(normal: number | undefined, forcedMarch: boolean): number | undefined {
  if (normal === undefined) return undefined;
  return forcedMarch ? Math.floor(normal * 1.5) : normal;
}

// ─── Opening and closing ───────────────────────────────────────────────────────

function barInstance(): DayBarApp | undefined {
  return foundry.applications?.instances?.get("dolmenwood-day-bar") as DayBarApp | undefined;
}

/** Show the bar if this user is the GM and has not hidden it. */
export function syncDayBar(): void {
  const g = game as Game;
  const wanted = (g.user?.isGM ?? false) && !!g.settings.get(MODULE_ID, SETTINGS.SHOW_DAY_BAR);
  const existing = barInstance();

  if (!wanted) {
    if (existing) void existing.close();
    return;
  }
  if (!existing) {
    void new DayBarApp().render(true);
    return;
  }
  // A registered instance whose element is no longer in the document cannot be
  // brought back by rendering it — the toolbar button would look dead. Close it
  // and build a fresh one instead.
  if (!existing.element?.isConnected) {
    void existing.close().then(() => void new DayBarApp().render(true));
    return;
  }
  existing.render();
}

/** Flip the bar on or off — the toolbar button. */
export async function toggleDayBar(): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const on = !!g.settings.get(MODULE_ID, SETTINGS.SHOW_DAY_BAR);
  await g.settings.set(MODULE_ID, SETTINGS.SHOW_DAY_BAR, !on);
  syncDayBar();
}

/** Re-render the bar and any open group window — after any write they read from. */
export function refreshDayBar(): void {
  barInstance()?.render();
  groupInstance()?.render();
}

/**
 * The steps behind one grouped tick, in a window of their own.
 *
 * Seven camp steps side by side made the Camp tab twice the width of every
 * other one, which is the whole reason this exists — the strip keeps one tick
 * and a tally, and the detail lives here.
 *
 * There is one instance at a time, keyed by nothing: opening a different group
 * re-points the same window rather than stacking a second one.
 */
export class DutyGroupApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private groupId: string;

  constructor(groupId: string, options: Record<string, unknown> = {}) {
    super(options);
    this.groupId = groupId;
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-duty-group",
    classes: ["dolmenwood-party-inventory", "duty-group"],
    position: { width: 340, height: "auto" as unknown as number },
    window: { title: "Duties", icon: "fas fa-campground", resizable: false },
    actions: {
      toggleDuty: DutyGroupApp._onToggleDuty,
      tickAll: DutyGroupApp._onTickAll,
      clearAll: DutyGroupApp._onClearAll,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.DAY_BAR_GROUP },
  };

  override get title(): string {
    return DUTY_GROUPS[this.groupId]?.label ?? "Duties";
  }

  /** Point an already open window at another group instead of opening a second. */
  show(groupId: string): void {
    this.groupId = groupId;
    this.render({ force: true } as never);
  }

  /**
   * The group's duties in catalogue order.
   *
   * Filtered by group rather than by the day's mode: a group belongs to the mode
   * its duties do, and reading the mode again here would only let the two drift.
   */
  private steps(): Duty[] {
    return DUTIES.filter((d) => d.group === this.groupId);
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    let state = getDayState();
    const duties = this.steps().map((d) => ({
      id: d.id,
      label: d.label,
      icon: d.icon,
      hint: d.hint,
      done: state.done[d.id] === true,
    }));
    const doneCount = duties.filter((d) => d.done).length;
    return {
      duties,
      doneCount,
      total: duties.length,
      allDone: duties.length > 0 && doneCount === duties.length,
    };
  }

  private static async _onToggleDuty(
    this: DutyGroupApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.dutyId;
    if (!id) return;
    await setDutyDone(id, target.dataset.done !== "true");
    this.render();
    refreshDayBar();
  }

  private static async _onTickAll(this: DutyGroupApp): Promise<void> {
    await this.setAll(true);
  }

  private static async _onClearAll(this: DutyGroupApp): Promise<void> {
    await this.setAll(false);
  }

  /**
   * Written in one pass rather than a loop of setDutyDone calls: each of those
   * writes a world setting, and seven writes in a row is seven round trips and
   * seven re-renders for one click.
   */
  private async setAll(done: boolean): Promise<void> {
    await setDutiesDone(this.steps().map((d) => d.id), done);
    this.render();
    refreshDayBar();
  }
}

function groupInstance(): DutyGroupApp | undefined {
  return foundry.applications?.instances?.get("dolmenwood-duty-group") as DutyGroupApp | undefined;
}

/** Open the group's steps, or re-point the window if one is already up. */
export function openDutyGroup(groupId: string): void {
  const existing = groupInstance();
  if (existing) existing.show(groupId);
  else new DutyGroupApp(groupId).render({ force: true } as never);
}
