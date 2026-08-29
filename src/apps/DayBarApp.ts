import { MODULE_ID, SETTINGS, TEMPLATES, TRAVEL_DAYS_PER_REST } from "../constants";
import { getConvoyActors } from "../data/sharedStore";
import { getEncumbranceMode } from "../data/zoneGrants";
import { SETTLEMENTS } from "../data/settlementEncounters";
import { hexInfo } from "../data/hexes";
import { activateBookLinks } from "../data/dayRolls";
import { partyDayRows, setAte, setSleptWell, setRested, hungerEffect, exhaustionPenalty } from "../data/characterDay";
import { PartyOverviewApp, buildPartyConvoy } from "./PartyOverviewApp";
import { PlayerInventoryApp } from "./PlayerInventoryApp";
import { ShopApp } from "./ShopApp";
import { InnApp } from "./InnApp";
import { openLootBrowser } from "./LootApp";
import { openTrash } from "./TrashApp";
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
  travelPointSeconds,
  describeDuration,
  startNewDay,
  type Duty,
  type DutyMode,
} from "../data/dayDuties";
import {
  REGIONS,
  SEASONS,
  WAYS,
  confirmDayContext,
  getDayContext,
  setDayContext,
  regionInfo,
  seasonInfo,
  settlementLabel,
  terrainGroups,
  terrainInfo,
  wayInfo,
  type DayContext,
} from "../data/dayContext";
import {
  clearDayRoll,
  dutyResultLine,
  dutyHoverNote,
  rollEncounter,
  rollFindingFood,
  rollGettingLost,
  rollWeather,
  ROLLABLE_DUTIES,
  type RollableDuty,
} from "../data/dayRolls";
import { promptFindFood } from "./FindFoodDialog";
import { CharacterSheetApp } from "./CharacterSheetApp";
import { runCampDuty } from "./CampDuties";
import { runMorningDuty } from "./MorningDuties";
import { CAMP_ROLL_DUTIES } from "../data/campRolls";
import { MORNING_ROLL_DUTIES } from "../data/morningRolls";
import { travelPointPenalty, hasEffect, weatherSummary, weatherIcon } from "../data/weather";
import { lostChance } from "../data/gettingLost";
import { partyTokensOn, tokenPoint } from "../data/partyPlace";
import { calibrate, calibrationFor, followsToken } from "../data/hexGrid";

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

  /**
   * Is the "where are we?" row unfolded? Per-instance like the party panel: it
   * is set once at the start of a leg and then left alone, so it should not
   * take up a line of the strip for the rest of the session.
   */
  private contextOpen = false;

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
      rollDuty: DayBarApp._onRollDuty,
      clearDuty: DayBarApp._onClearDuty,
      toggleContext: DayBarApp._onToggleContext,
      confirmContext: DayBarApp._onConfirmContext,
      calibrateHex: DayBarApp._onCalibrateHex,
      expandToContext: DayBarApp._onExpandToContext,
      expandToPanel: DayBarApp._onExpandToPanel,
      openShortcut: DayBarApp._onOpenShortcut,
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

  /**
   * Wire the "where are we?" dropdowns.
   *
   * ApplicationV2 actions fire on click, which a <select> does not usefully
   * emit — so these three are listened to by hand. Re-attached on every render
   * because the element is replaced each time.
   */
  override async _onRender(
    _context: DeepPartial<ApplicationV2RenderContext>,
    _options: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<void> {
    // Typing a hex answers three of the other four fields at once: the book
    // prints the terrain, its cost and the region above every hex it details.
    // A hex it does not detail is still written down — the number is the thing
    // the Referee actually has — and the other fields stay as they were.
    // The hex line carries a page reference, and it should open the book like
    // every other one the module prints.
    activateBookLinks(this.element);

    const hexBox = this.element.querySelector<HTMLInputElement>('[data-context-field="hex"]');
    hexBox?.addEventListener("change", async () => {
      const typed = hexBox.value.trim();
      const found = hexInfo(typed);
      await setDayContext(
        found
          ? { hex: found.hex, terrain: found.terrain, region: found.region }
          : { hex: typed }
      );
      this.render();
    });

    for (const field of ["season", "terrain", "way", "region", "settlement"] as (keyof DayContext)[]) {
      this.element
        .querySelector<HTMLSelectElement>(`[data-context-field="${field}"]`)
        ?.addEventListener("change", async (event) => {
          const value = (event.target as HTMLSelectElement).value;
          await setDayContext({ [field]: value } as Partial<DayContext>);
          this.render();
        });
    }
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    // The inn window can move the day on too, so catch up before drawing.
    await reconcileDay();

    let state = getDayState();
    // Everything on the context row that the book already knows, given the hex.
    const here = hexInfo(getDayContext().hex);
    // The map the Referee is looking at, not the one the token last moved on:
    // calibration is a property of a scene, and this row is about this one.
    const calibration = calibrationFor(
      (game as Game).scenes?.current?.id as string | undefined
    );
    const collapsed = !!(game as Game).settings.get(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED);
    const duties = dutiesForMode(state.mode);
    const isDone = (d: Duty) => state.done[d.id] === true;
    const blocks = buildBlocks(duties, isDone);

    const isGM = (game as Game).user?.isGM ?? false;
    // A player's bar carries their own characters and nobody else's. The party
    // tallies above it stay whole — how many of the party have eaten is not a
    // secret, and it is what makes somebody go and fix it.
    const allRows = partyDayRows();
    const ownRows = allRows.filter(
      (row) =>
        isGM ||
        ((game as Game).actors?.get?.(row.actorId) as { isOwner?: boolean } | undefined)?.isOwner === true
    );
    const party = ownRows.map((row) => {
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
    // The weather is applied on top rather than written into the stored budget,
    // so it stays reversible: re-rolling the weather, or clearing it, simply
    // changes the sum again. Order follows the book — a forced march buys 50%
    // more of the day's allowance, and the weather then takes 2 off what the
    // party can actually manage in it.
    const marched = forcedBudget(normalBudget, state.forcedMarch);
    const weatherCost = travelPointPenalty(state.weather);
    const budget =
      marched === undefined ? undefined : Math.max(0, marched - weatherCost);
    // "If this reduces the party's Travel Points to 0 or below, they can only
    // progress by forced marching" (CB p112) — worth saying out loud, since a
    // 0 TP day otherwise just looks broken.
    const weatherStopped = weatherCost > 0 && budget === 0 && !state.forcedMarch;
    // What one point costs the clock, off the *speed's* allowance rather than
    // the weather-reduced one: bad weather means the party gets less far in the
    // day, not that each league takes longer.
    const perPointLabel = describeDuration(travelPointSeconds(marched, state.forcedMarch));
    // The party is not what it was when the day began. Said, not acted on: only
    // the GM decides whether that is a new day's march or the same one.
    const stale =
      derived !== undefined && normalBudget !== undefined && derived !== normalBudget;

    // ── Where the party is ──
    const ctx = getDayContext();
    const season = seasonInfo(ctx.season);
    const terrain = terrainInfo(ctx.terrain);
    const way = wayInfo(ctx.way);
    const region = regionInfo(ctx.region);
    const settlement = settlementLabel(ctx.settlement);
    const chance = lostChance(ctx.way, ctx.terrain, hasEffect(state.weather, "V"));

    return {
      collapsed,
      modes: DUTY_MODES.map((m) => ({ ...m, active: m.id === state.mode })),

      // The sticky context. Folded away by default: it is set once at the start
      // of a leg, and the summary line is enough to see it has not gone stale.
      context: {
        open: this.contextOpen,
        summary:
          state.mode === "settlement" && ctx.settlement !== "elsewhere"
            ? `${season.label} · ${settlement} · ${region.label}`
            : `${season.label} · ${way.label} · ${terrain.label} · ${region.label}`,
        // Set by the token-move hook. It never guesses the new terrain — nothing
        // on a Foundry scene says whether a hex is bog or meadow — it only says
        // the answer below may have gone stale.
        moved: ctx.moved
          ? {
              label: "Party moved",
              // The warning exists because the module cannot tell which hex the
              // party walked into. Where it *could* — the reading is on, this
              // map simply has not been measured — say so, since that is one
              // press away and ends the warning for good.
              title:
                `A token has crossed a hex boundary on ${ctx.moved.sceneName} since this was last set. ` +
                (followsToken() && !calibration
                  ? "Reading the hex off the token is switched on, but this map has not been calibrated: stand the token in a hex you know, type it in the box and press the crosshairs. Until then, check the terrain and the way by hand."
                  : "Check the terrain and the way — the module cannot read them off the map.") +
                " Change one of them, or click to say it is still right.",
            }
          : undefined,
        summaryTitle:
          `What the day's tables are rolled against. ${season.label}: ${season.hint} ` +
          `${way.label}: ${way.hint} ${terrain.label} (${terrain.bandLabel.toLowerCase()} terrain): ${terrain.blurb}. ` +
          "Click to change. It stays as it is until you do — it is not part of the day, and a new day does not clear it.",
        seasons: SEASONS.map((x) => ({ ...x, selected: x.id === ctx.season })),
        // Grouped by band, so the dropdown reads like the book's own table and
        // the cost and risk of each group are visible while choosing.
        terrainGroups: terrainGroups().map((g) => ({
          ...g,
          terrains: g.terrains.map((x) => ({ ...x, selected: x.id === ctx.terrain })),
        })),
        ways: WAYS.map((x) => ({ ...x, selected: x.id === ctx.way })),
        regions: REGIONS.map((x) => ({ ...x, selected: x.id === ctx.region })),
        settlements: [
          { id: "elsewhere", label: "— not in one —", selected: ctx.settlement === "elsewhere" },
          ...SETTLEMENTS.map((x) => ({ ...x, selected: x.id === ctx.settlement })),
        ],
        seasonHint: `${season.label} — ${season.months}. ${season.hint}`,
        terrainHint: `${terrain.label} (${terrain.bandLabel.toLowerCase()}): ${terrain.blurb}. ${terrain.chanceIn6}-in-6 to lose the way or to meet something; ${terrain.cost} Travel Points to enter or search a hex. ${terrain.travel}`,
        wayHint: `${way.label}: ${way.hint}`,
        settlementHint:
          ctx.settlement === "elsewhere"
            ? "Which of the twelve settlements the Campaign Book details the party is in. Only the Settlement tab's encounter rolls use it — everywhere else it is ignored, and a hamlet the book does not cover has no table."
            : `${settlement}. Its own d6 encounter tables, day and night, are what the Settlement tab rolls on. It does not replace the region: the party is still in ${region.label} the moment they leave.`,
        regionHint:
          region.id === "aquatic"
            ? "Aquatic is the column for a day spent on a river or a lake, not a place on the map. Chosen, an encounter is rolled straight off it, as the Campaign Book directs (p114)."
            : `${region.label} — which regional encounter table this hex reads (Campaign Book p115). A region is a dozen hexes across, so this changes far less often than the terrain does.`,
        // Said here rather than only in the duty's own tooltip, because this is
        // the row where the numbers that produce it are being set.
        lostLine:
          chance.inSix > 0
            ? `${chance.inSix}-in-6 to lose the way`
            : "No chance of losing the way",
        lostTitle: chance.reason,
        hex: ctx.hex ?? "",
        hexName: here?.name ?? "",
        hexPage: here?.page ?? 0,
        hexForage: here?.forage ?? "",
        hexNote: here?.note ?? "",
        hexAlso: here?.alsoRegion ?? "",
        hexHint: here
          ? `${here.hex}, ${here.name}. ${terrain.label}, ${region.label}, ${here.lost} to lose the way. Described in the Campaign Book on p${here.page}.`
          : "The hex the party is standing in. Type it and the terrain, the region and the lost chance follow from the Campaign Book — including anything that grows here which the foraging tables do not know about. A hex the book does not detail is still kept; set the terrain by hand.",
        // The crosshairs: one measurement per map, and after it the hex reads
        // itself off the token. Offered to the Referee only, and only where
        // there is a hex in the box to measure against.
        mayCalibrate: isGM,
        calibrated: !!calibration,
        calibrateLabel: calibration ? "Re-calibrate" : "Calibrate",
        calibrateTitle: calibration
          ? `This map is calibrated on hex ${calibration.hex}. ${
              followsToken()
                ? "Moving a token sets the hex by itself."
                : "Switch on “Read the hex off the party's token” in the module settings to use it."
            } Press again with the token somewhere else, and the hex in the box, to measure it afresh.`
          : "Calibrate this map: stand the party's token in a hex you know, select it, type that hex in the box, and press this. From then on the module can read the hex off any position on this map.",
      },
      isGM,
      // The bar's shortcuts are the toolbar's buttons in another place, so they
      // answer to the same settings. A player who may not open the Loot from
      // the toolbar may not open it from here either.
      mayOpenLoot: isGM || !!(game as Game).settings.get(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_LOOT),
      mayOpenTrash: isGM || !!(game as Game).settings.get(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_TRASH),
      mayOpenInn: isGM || !!(game as Game).settings.get(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_INN),
      mayOpenShop: isGM || !!(game as Game).settings.get(MODULE_ID, SETTINGS.PLAYER_GENERIC_SHOP),
      day: state.day,
      // Told to the players only once it has been rolled: they are standing in
      // it, so there is nothing left to give away.
      // Both only on a player's bar: the Referee rolled the weather and has the
      // card, and the panel below carries every character in full.
      //
      // The slot is held whether or not the day has been rolled for, so the two
      // units after it do not slide along the row when it appears.
      weatherSlot: !isGM,
      showOwn: !isGM && ownRows.length > 0,
      weather: !isGM && state.weather ? weatherSummary(state.weather) : "",
      weatherIcon: state.weather ? weatherIcon(state.weather) : "fa-cloud-question",
      weatherTitle: state.weather
        ? `${weatherSummary(state.weather)} — the day's weather.`
        : "The day's weather has not been rolled yet.",
      blocks,

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
        weatherCost,
        weatherStopped,
        // What one point costs the clock. Read off the *speed's* allowance
        // rather than the weather-reduced one: bad weather means the party gets
        // less far in the day, not that each league takes longer.
        perPoint: perPointLabel,
        budgetTitle:
          budget === undefined
            ? "No party convoy to read a Speed from, so there is no allowance to count against."
            : `${state.travelPointsUsed} of the day's ${budget} Travel Points spent. The allowance is fixed when the day starts — the party's Speed divided by 5, and half as many again on a forced march (Player's Book p156) — so it does not shift under the march when a load or a ration changes. Unspent points are lost at nightfall.${
                perPointLabel
                  ? ` ${state.forcedMarch ? "Sixteen" : "Twelve"} hours on the road split ${marched} ways: each point spent is ${perPointLabel}, and the world clock moves with it.`
                  : ""
              }${weatherCost ? ` The weather takes ${weatherCost} off: ${state.weather?.text}.` : ""}${weatherStopped ? " That leaves nothing at all — the party can only progress by forced marching today." : ""}${state.travelPointsUsed > budget ? " More has been spent than the allowance now allows: the extra points were walked under a forced march that has since been called off." : ""}`,
        refreshTitle: stale
          ? `The party would be worth ${derived} Travel Points as they stand now, against the ${normalBudget} this day was started with. Click to adopt ${derived} — the points already spent stay spent.`
          : "Re-read the day's allowance from the party as they stand now. It is fixed at the start of the day on purpose, so this is only for when their circumstances really have changed.",        forced: state.forcedMarch,
        forcedTitle: state.forcedMarch
          ? `Forced march: ${normalBudget ?? "?"} Travel Points become ${budget ?? "?"}, at the price of a 16 hour day. Every character who marches owes a full rest day afterwards or is exhausted, -1 to Attack and Damage; marching again before that rest adds another -1 (Player's Book p156). Click to call it off.`
          : "Normal travel. Click to declare a forced march: half as many Travel Points again, a 16 hour day, and a rest day owed afterwards (Player's Book p156).",
      },

      party,
      hasParty: allRows.length > 0,
      panelOpen: this.panelOpen,
      // Counted across the whole party, listed only for one's own characters:
      // "two of us have not eaten" is not a secret, and it is the thing that
      // makes somebody go and do something about it.
      ateCount: allRows.filter((p) => p.ate).length,
      sleptCount: allRows.filter((p) => p.sleptWell).length,
      allAte: allRows.length > 0 && allRows.every((p) => p.ate),
      allSlept: allRows.length > 0 && allRows.every((p) => p.sleptWell),
      partySize: allRows.length,
      // One number for "somebody is taking a penalty right now", so the GM has a
      // reason to unfold the panel without unfolding it to find out.
      warnings: party.filter((p) => p.hungry || p.tired || p.overdue).length,
      // Named, not merely counted: folded down to the handle this chip is the
      // only thing standing between the Referee and a forgotten -2.
      warningsTitle: party
        .filter((c) => c.hungry || c.tired || c.overdue)
        .map((c) => `${c.name}: ${c.noPenalty ? "a clock running, no penalty yet" : c.penalty}`)
        .join("  •  "),
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
   * Roll a duty's table.
   *
   * The result is written onto the day and whispered to the GMs; the tick goes
   * with it, because a rolled duty is a done duty and leaving it to be ticked
   * by hand afterwards was exactly the sort of half-step that made the bar feel
   * unfinished.
   */
  private static async _onRollDuty(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.dutyId;
    if (id === "weather") await rollWeather();
    else if (id === "lost") await rollGettingLost();
    else if (id === "encounter-day") await rollEncounter("day");
    else if (id === "encounter-night") await rollEncounter("night");
    // The camp's six ask their own questions first — who fetched the wood, whose
    // Wisdom is cooking, who is sleeping on what.
    else if (id && CAMP_ROLL_DUTIES.has(id)) await runCampDuty(id);
    // Waking up: the healing that a good night earns, and the spells a bad one
    // threatens.
    else if (id && MORNING_ROLL_DUTIES.has(id)) await runMorningDuty(id);
    else if (id === "forage") {
      // Three procedures share this duty and need different things, so it asks
      // before it rolls. Cancelling leaves the duty exactly as it was.
      const choice = await promptFindFood();
      if (!choice) return;
      await rollFindingFood(
        choice.method,
        choice.target,
        choice.fullDay,
        choice.situational,
        choice.forager,
        choice.storeToId
      );
    }
    this.render();
  }

  /** Take a roll back so it can be made again. */
  private static async _onClearDuty(
    this: DayBarApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.dutyId;
    if (!id || !ROLLABLE_DUTIES.has(id)) return;
    await clearDayRoll(id as RollableDuty);
    this.render();
  }

  /**
   * The three windows the bar does not own, opened from it anyway.
   *
   * They are on the toolbar as well, and that is the point: the toolbar means
   * leaving the strip, hunting the control bar, and coming back. Everything a
   * Referee touches during a day now sits on one line.
   *
   * Kept out of the folding, so they are reachable from the handle too.
   */
  private static _onOpenShortcut(this: DayBarApp, _event: Event, target: HTMLElement): void {
    switch (target.dataset.shortcut) {
      case "loot":
        openLootBrowser();
        break;
      case "trash":
        openTrash();
        break;
      case "character": {
        // Their own character, or whatever token they have selected. A player
        // usually has one assigned and never thinks about this; the fallback is
        // for the table where nobody has.
        const g = game as Game;
        const actor =
          g.user?.character ?? (canvas?.tokens?.controlled?.[0]?.actor as Actor | undefined);
        if (actor) CharacterSheetApp.open(actor);
        else ui.notifications?.warn("No character assigned to you, and no token selected.");
        break;
      }
      case "inn": {
        const inn = foundry.applications?.instances?.get("dolmenwood-inn") as
          | { render: (options?: unknown) => void }
          | undefined;
        if (inn) inn.render({ force: true });
        else new InnApp().render(true);
        break;
      }
      case "shop": {
        // The place-less shop. Reaching it from the bar keeps it available when
        // BAR_ONLY_ACCESS has taken the toolbar buttons away.
        const shop = foundry.applications?.instances?.get("dolmenwood-shop") as
          | { render: (options?: unknown) => void }
          | undefined;
        if (shop) shop.render({ force: true });
        else new ShopApp().render(true);
        break;
      }
      case "inventory": {
        // The GM gets the party, a player their own sheet — the same split the
        // scene toolbar makes, and the one this button's tooltip has been
        // promising all along. Opening PartyOverviewApp unconditionally also
        // walked past the GM-only guard that openPartyOverview() applies, so a
        // player reached the whole party's inventory from here. The party
        // stores are not lost by the change: they are zones inside the
        // character's own sheet.
        const isGM = (game as Game).user?.isGM ?? false;
        const existing = foundry.applications?.instances?.get(
          isGM ? "dolmenwood-party-overview" : "dolmenwood-player-inventory"
        ) as { render: (options?: unknown) => void } | undefined;
        if (existing) {
          existing.render({ force: true });
          break;
        }
        if (isGM) {
          new PartyOverviewApp().render(true);
          break;
        }
        const own = (game as Game).user?.character ?? undefined;
        if (!own) {
          ui.notifications?.warn("No actor found. Assign a character to your user first.");
          break;
        }
        new PlayerInventoryApp(own).render(true);
        break;
      }
    }
  }

  private static _onToggleContext(this: DayBarApp): void {
    this.contextOpen = !this.contextOpen;
    this.render();
  }

  /**
   * "It is still right." Drops the moved-since warning without changing
   * anything — the party crossed a hex boundary but stayed in the same kind of
   * country, which on a forest map is most of the time.
   */
  private static async _onConfirmContext(this: DayBarApp): Promise<void> {
    await confirmDayContext();
    this.render();
  }

  /**
   * Measure this map against the hex in the box, once and for all.
   *
   * The token measured is the one the Referee has selected, and failing that
   * the party's marker: a Referee about to say "the party is here" has almost
   * always just clicked the token they mean, and asking them to select it is a
   * clearer instruction than a setting naming an actor.
   *
   * The hex comes from the box rather than from a prompt, because it is already
   * on screen and already the thing the Referee keeps up to date.
   */
  private static async _onCalibrateHex(this: DayBarApp): Promise<void> {
    const g = game as Game;
    const scene = g.scenes?.current as unknown as
      | { id?: string; name?: string; grid?: unknown }
      | undefined;
    const controlled = (
      canvas as unknown as { tokens?: { controlled?: { document?: unknown }[] } }
    )?.tokens?.controlled;
    const token = controlled?.[0]?.document ?? partyTokensOn(scene as never)[0];
    const result = await calibrate(scene, tokenPoint(scene as never, token as never), getDayContext().hex ?? "");
    if (!result.ok) {
      ui.notifications?.warn(result.why);
      return;
    }
    ui.notifications?.info(
      `${scene?.name ?? "This map"} is calibrated on hex ${result.cal.hex}. ` +
        (followsToken()
          ? "Moving a token now sets the hex on the bar by itself."
          : "Switch on “Read the hex off the party's token” in the module settings to use it.")
    );
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
        "<p>Move on to the next day?</p>" +
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

  /**
   * Unfold the bar and open the row the chip was about.
   *
   * The folded handle carries warnings but none of what answers them, so a chip
   * there has to lead somewhere rather than being a dead badge.
   */
  private static async _expand(this: DayBarApp, open: "context" | "panel"): Promise<void> {
    const g = game as Game;
    if (open === "context") this.contextOpen = true;
    else this.panelOpen = true;
    await g.settings.set(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED, false);
    this.render();
  }

  private static async _onExpandToContext(this: DayBarApp): Promise<void> {
    await DayBarApp._expand.call(this, "context");
  }

  private static async _onExpandToPanel(this: DayBarApp): Promise<void> {
    await DayBarApp._expand.call(this, "panel");
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
    const state = getDayState();
    // **The frozen figure, the same one the readout counts against.** Reading
    // the convoy live here meant a mule sold at noon could change the clamp —
    // and now the length of the afternoon — under a march already half walked.
    // The live figure is only the fallback for a day that never froze one.
    const budget = forcedBudget(state.travelPointBudget ?? convoyTravelPoints(), state.forcedMarch);
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
  duties: {
    id: string;
    label: string;
    icon: string;
    hint: string;
    done: boolean;
    /** Does this duty roll on a table, rather than only being ticked off? */
    rollable?: boolean;
    /** What the table produced today, shown under the label once it has. */
    result?: string;
    /** The face of the button that performs it — not every duty throws dice. */
    rollIcon?: string;
  }[];
}

/**
 * What the button that performs a duty should look like.
 *
 * Waking up heals; it does not roll. A d20 on that button would be a small lie,
 * and the one thing a Referee reads before clicking is the icon.
 */
function rollIconFor(dutyId: string): string {
  return dutyId === "healing" ? "fa-hand-holding-heart" : "fa-dice-d20";
}

/** The duty's own explanation, with today's answer added where there is one. */
function withNote(hint: string, note: string | undefined): string {
  return note ? `${note}. ${hint}` : hint;
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
    const rollable = ROLLABLE_DUTIES.has(duty.id);
    const entry = {
      id: duty.id,
      label: duty.label,
      icon: duty.icon,
      // What the day already knows goes on the hover, not into the strip: the
      // strip is a checklist, and a line naming three characters unbalances it.
      hint: withNote(duty.hint, dutyHoverNote(duty.id)),
      done: isDone(duty),
      rollable,
      // Only meaningful once rolled; the strip prints it under the label so the
      // Referee reads today's weather without opening anything.
      result: rollable ? dutyResultLine(duty.id) : undefined,
      rollIcon: rollIconFor(duty.id),
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
/**
 * May this user have a bar at all?
 *
 * The GM always; a player when the table has switched their half on. What they
 * then get is a different strip, not a censored one — see the template.
 */
export function mayUseDayBar(): boolean {
  const g = game as Game;
  if (g.user?.isGM) return true;
  return !!g.settings?.get(MODULE_ID, SETTINGS.PLAYER_DAY_BAR);
}

export function syncDayBar(): void {
  const g = game as Game;
  const wanted = mayUseDayBar() && !!g.settings.get(MODULE_ID, SETTINGS.SHOW_DAY_BAR);
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
  if (!mayUseDayBar()) return;
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
      rollDuty: DutyGroupApp._onRollDuty,
      clearDuty: DutyGroupApp._onClearDuty,
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
    const duties = this.steps().map((d) => {
      const rollable = ROLLABLE_DUTIES.has(d.id);
      return {
        id: d.id,
        label: d.label,
        icon: d.icon,
        hint: withNote(d.hint, dutyHoverNote(d.id)),
        done: state.done[d.id] === true,
        rollable,
        // The result takes the hint's place once there is one: the hint is what
        // the step is for, and after the dice the Referee wants what it said.
        result: rollable ? dutyResultLine(d.id) : undefined,
        rollIcon: rollIconFor(d.id),
      };
    });
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

  /**
   * Roll one of the camp's steps from the window it lives in.
   *
   * The strip's own die does the same thing through the same `runCampDuty`, so
   * a Referee who rolls the firewood from the Camp tab and the cooking from
   * this window gets the same dialogs and the same cards.
   */
  private static async _onRollDuty(
    this: DutyGroupApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.dutyId;
    if (!id || !CAMP_ROLL_DUTIES.has(id)) return;
    await runCampDuty(id);
    this.render();
    refreshDayBar();
  }

  private static async _onClearDuty(
    this: DutyGroupApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.dutyId;
    if (!id || !ROLLABLE_DUTIES.has(id)) return;
    await clearDayRoll(id as RollableDuty);
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
