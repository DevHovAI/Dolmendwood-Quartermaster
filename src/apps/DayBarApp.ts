import { MODULE_ID, SETTINGS, TEMPLATES, TRAVEL_DAYS_PER_REST } from "../constants";
import { getConvoyActors } from "../data/sharedStore";
import { getEncumbranceMode } from "../data/zoneGrants";
import { getInnDay } from "../data/innMenu";
import { partyDayRows, setAte, setSleptWell, setRested } from "../data/characterDay";
import { buildPartyConvoy } from "./PartyOverviewApp";
import {
  DUTY_GROUPS,
  DUTY_MODES,
  dutiesForMode,
  getDayState,
  reconcileDay,
  resetDuties,
  setDutyDone,
  setDutyMode,
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
      togglePanel: DayBarApp._onTogglePanel,
      toggleAte: DayBarApp._onToggleAte,
      toggleSlept: DayBarApp._onToggleSlept,
      restChar: DayBarApp._onRestChar,
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

    const state = getDayState();
    const collapsed = !!(game as Game).settings.get(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED);
    const duties = dutiesForMode(state.mode);
    const isDone = (d: Duty) => state.done[d.id] === true;

    const party = partyDayRows().map((row) => ({
      ...row,
      hungry: row.daysWithoutFood > 0,
      // Exhaustion from lost sleep bites on the very first day, unlike the rest
      // debt, which only comes due after a week of travel.
      tired: row.daysWithoutSleep > 0,
      overdue: row.travelDaysSinceRest >= TRAVEL_DAYS_PER_REST,
    }));

    const budget = travelPointBudget();

    return {
      collapsed,
      modes: DUTY_MODES.map((m) => ({ ...m, active: m.id === state.mode })),
      blocks: buildBlocks(duties, isDone),
      remaining: duties.filter((d) => !isDone(d)).length,
      allDone: duties.length > 0 && duties.every(isDone),

      travelPoints:
        state.mode !== "travel" ? undefined :
        budget === undefined
          ? undefined
          : {
              total: budget,
              used: state.travelPointsUsed,
              left: Math.max(0, budget - state.travelPointsUsed),
              spent: state.travelPointsUsed > 0,
            },
      // The bottom row exists only when it has something to carry.
      showFoot: (state.mode === "travel" && budget !== undefined) || party.length > 0,

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
    const budget = travelPointBudget();
    if (!delta || budget === undefined) return;
    await spendTravelPoints(delta, budget);
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
  groupLabel?: string;
  duties: { id: string; label: string; icon: string; hint: string; done: boolean }[];
}

/**
 * Lay the duties out in runs, so a group is drawn as one banded stretch.
 *
 * Consecutive duties sharing a group become one block; everything else falls
 * into an unlabelled block. Order is the catalogue's, so moving a duty in the
 * table moves it on screen.
 */
function buildBlocks(duties: Duty[], isDone: (d: Duty) => boolean): DutyBlock[] {
  const blocks: DutyBlock[] = [];
  for (const duty of duties) {
    const label = duty.group ? DUTY_GROUPS[duty.group]?.label : undefined;
    const last = blocks[blocks.length - 1];
    const entry = {
      id: duty.id,
      label: duty.label,
      icon: duty.icon,
      hint: duty.hint,
      done: isDone(duty),
    };
    if (last && last.groupLabel === label) last.duties.push(entry);
    else blocks.push({ groupLabel: label, duties: [entry] });
  }
  return blocks;
}

/** The day's Travel Point budget: the party's Speed divided by 5 (PB p156). */
function travelPointBudget(): number | undefined {
  const convoy = buildPartyConvoy(getConvoyActors(), getEncumbranceMode());
  if (!convoy) return undefined;
  return Math.floor(convoy.speed / 5);
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

/** Re-render the bar if it is on screen — after any write it reads from. */
export function refreshDayBar(): void {
  barInstance()?.render();
}
