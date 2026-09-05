import { escapeHTML } from "../helpers/handlebars";
import { t } from "../helpers/i18n";
import { stepper, wireSteppers } from "../helpers/steppers";
import { FlagManager } from "../data/FlagManager";
import { getConvoyActors, getPartyActors } from "../data/sharedStore";
import { getDayContext, seasonInfo } from "../data/dayContext";
import { getDayState } from "../data/dayDuties";
import {
  getCampState,
  rollCampActivity,
  rollFire,
  rollFirewood,
  partyFirewood,
  type WoodRow,
  rollSleep,
  rollWatches,
  serveMeal,
  type Gatherer,
  type MealChoice,
  type SleeperChoice,
  type WatchKeeperChoice,
} from "../data/campRolls";
import { ABILITIES, getSystemFields } from "../data/characterSheet";
import { isEdible } from "../data/characterDay";
import { definitionFor } from "../data/itemDefs";
import { displayQuantity } from "../data/consumables";
import { firewoodPenalty, hasEffect } from "../data/weather";
import { FIRE_MINIMUM_HOURS } from "../data/camping";
import { allocate, partyStock, stockLine } from "../data/partySupply";
import { isGM } from "../data/rollCard";

/** What the fire dialog answers with: how hard it is, and what goes on it. */
export interface FireChoice {
  chance: number;
  fuel: { holderId: string; itemId: string; hours: number }[];
}
import {
  BEDDING,
  BEDROLL_ID,
  CAMP_ACTIVITIES,
  FIREWOOD_CONDITIONS,
  FIRE_AUTOMATIC,
  FIRE_CHANCES,
  MIN_SLEEP_HOURS,
  NIGHT_HOURS,
  SLEEP_DIFFICULTIES,
  TENT_ID,
  beddingFrom,
  fallAsleepFaces,
  hoursLabel,
  restModifier,
  watchShares,
  sleepDifficulty,
  type Bedding,
  type CampActivity,
} from "../data/camping";

/**
 * What the camp asks before it rolls.
 *
 * **The rule the whole file is built on is Dolmenmaster's:** *"Wenn ein Würfelwurf
 * einen Spielerstat braucht, dann mach am besten beim Würfeln eine Abfrage, um
 * welchen Spieler es sich für die Aktion handelt (in Klammern oder so dann auch
 * seinen entsprechenden Stat angeben)."* So no camp roll ever guesses whose
 * check it is, and every name in these dialogs carries the number the roll is
 * about to use — the Wisdom that cooks, the Charisma that entertains, the
 * Constitution that sleeps. A Referee should be able to pick the right
 * character without opening a single sheet.
 *
 * The stats are read through `characterSheet.ts`, which is the one file in the
 * module that knows a game system exists. A character it can read nothing from
 * shows a dash rather than a zero: a missing score and a score of 0 are not the
 * same thing, and printing "+0" for "no idea" is how a table ends up trusting a
 * number nobody entered.
 *
 * All of these are AppV1 `Dialog`s, which still default to `jQuery: true` in
 * v14 — so `html.find()` is correct here and not an oversight.
 */

// ─── Who is at the camp, and what they are worth ──────────────────────────────

interface Member {
  actorId: string;
  name: string;
  /**
   * Is this character the reader's to answer for?
   *
   * True for every actor on the Referee's screen. On a player's it marks the
   * rows they may fill in, and the rest are drawn greyed rather than dropped —
   * a camp is a thing the whole party does, and *"man sollte auch sehen können,
   * was die anderen ausgewählt haben"* (Dolmenmaster, 2026-09-03).
   */
  mine: boolean;
  /** Undefined where this actor carries no scores this module can read. */
  scores?: { con: number; conMod: number; wis: number; wisMod: number; cha: number; chaMod: number };
  /** The Save Versus Doom target off the sheet; 0 where there is none to read. */
  doom: number;
  bedding: Bedding;
}

/**
 * The party, with the three abilities the camp cares about and what they are
 * sleeping on.
 *
 * **Bedding is read from the packs and then left to the Referee.** A bedroll in
 * the inventory is good evidence and not proof — it may be lost, wet, or lent
 * to somebody else — so it fills the select in and the select stays editable.
 * Only catalogue ids count: an item somebody typed the word "bedroll" into is
 * not a thing the module can be sure about.
 */
/**
 * **Whose names a dialog may offer, and it is not always the whole party.**
 *
 * Dolmenmaster's job 3, 2026-09-03: *"a player may only enter their own character"*.
 * The split follows the rights model rather than the dialog:
 *
 * - **"mine"** where the answer is *which of my characters did this* — who went
 *   for wood, who is bedding down, who is preparing spells, who cooks, who
 *   forages. A player is offered their own; the Referee is offered everyone.
 * - **"party"** where the answer is about the whole camp and would be nonsense
 *   scoped — the watch rota divides the night among *everybody*, supper is
 *   eaten by everybody, and the fire burns wood out of the party's packs. A
 *   player rolling one of these is rolling *for* the party, which is exactly
 *   what `GROUP_DUTIES` says they are doing.
 *
 * The Referee is never narrowed by this: `isOwner` is true for them on every
 * actor, so "mine" and "party" are the same list on their screen.
 */
type Whose = "mine" | "party";

function partyMembers(whose: Whose = "party"): Member[] {
  const actors =
    whose === "mine"
      ? getPartyActors().filter((a) => (a as { isOwner?: boolean }).isOwner)
      : getPartyActors();
  return actors.map((actor) => {
    const sys = getSystemFields(actor);
    const items = FlagManager.getInventory(actor).items ?? [];
    const has = (id: string) => items.some((i) => i.definitionId === id && i.quantity > 0);
    const readable = !!(actor as { system?: { scores?: unknown } }).system?.scores;
    return {
      actorId: actor.id ?? "",
      name: actor.name ?? "Someone",
      mine: !!(actor as { isOwner?: boolean }).isOwner,
      ...(readable
        ? {
            scores: {
              con: sys.scores.con.value,
              conMod: sys.scores.con.bonus,
              wis: sys.scores.wis.value,
              wisMod: sys.scores.wis.bonus,
              cha: sys.scores.cha.value,
              chaMod: sys.scores.cha.bonus,
            },
          }
        : {}),
      doom: sys.saves.doom,
      bedding: beddingFrom(has(BEDROLL_ID), has(TENT_ID)),
    };
  });
}

/** "CON 13, +1" — or a dash where there is nothing to read. */
function statLabel(member: Member, ability: "con" | "wis" | "cha"): string {
  const short = ABILITIES.find((a) => a.key === ability)?.short ?? ability.toUpperCase();
  if (!member.scores) return `${short} —`;
  const value = member.scores[ability];
  const mod = member.scores[`${ability}Mod` as "conMod" | "wisMod" | "chaMod"];
  return `${short} ${value}, ${mod >= 0 ? "+" : "−"}${Math.abs(mod)}`;
}

/**
 * " · Doom 12+", where the sheet has one.
 *
 * Shown beside the ability because the Save Versus Doom is **already decided by
 * the character being picked** — Dolmenmaster's observation. It is only rolled on a
 * natural 1, but a Referee choosing between two cooks can see what each of them
 * would face, rather than finding out afterwards.
 */
function doomLabel(member: Member): string {
  return member.doom > 0 ? ` · Doom ${member.doom}+` : " · no Doom target";
}

function noParty(): void {
  ui.notifications?.warn(
    "No party characters found. A character counts as party when a player owns it."
  );
}

/** The one shape every dialog here resolves through. */
function ask<T>(
  title: string,
  content: string,
  read: (html: JQuery) => T | null,
  options: { label?: string; width?: number; render?: (html: JQuery) => void } = {}
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const done = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    new Dialog(
      {
        title,
        content,
        buttons: {
          ok: {
            label: options.label ?? "Roll",
            icon: '<i class="fas fa-dice-d20"></i>',
            callback: (html: JQuery) => done(read(html)),
          },
          cancel: { label: "Cancel", callback: () => done(null) },
        },
        default: "ok",
        render: (html: JQuery) => options.render?.(html),
        close: () => done(null),
      },
      options.width ? { width: options.width } : undefined
    ).render(true);
  });
}

/** Every ticked box's value, in the order the party is listed. */
function checked(html: JQuery, name: string): string[] {
  return html
    .find(`input[name="${name}"]:checked`)
    .toArray()
    .map((el) => (el as HTMLInputElement).value);
}

// ─── Fetching firewood ────────────────────────────────────────────────────────

export interface FirewoodChoice {
  gatherers: Gatherer[];
  modifier: number;
}

/**
 * Who went for wood, and what the weather did to them.
 *
 * No stat is involved — it is 1d6 a head — so this asks for names only, and
 * **the conditions are read off the morning's weather roll** rather than asked
 * for: the day's weather already knows whether it is snowing, and `firewoodPenalty`
 * turns that into the book's -1, -2 or -4. Dolmenmaster's point, and the right one —
 * the answer was on a card an hour ago.
 *
 * Still a select, still overridable: "damp" against "heavy rain" is a judgement
 * a d12 of weather text cannot always settle.
 */
export async function promptFirewood(): Promise<FirewoodChoice | null> {
  const members = partyMembers("mine");
  if (!members.length) return noParty(), null;

  const weather = getDayState().weather;
  const suggested = firewoodPenalty(weather);
  // **A player who opened this is going for wood.** Anything else would be a
  // form that asks them to tick themselves before they may do the thing they
  // just pressed (Dolmenmaster, 2026-09-04). The Referee's list is the whole party
  // and stays empty: who goes is the question they are being asked.
  const mineByDefault = !isGM();
  const rows = members
    .map(
      (m) => `
      <label class="dw-camp-member">
        <input type="checkbox" name="dw-wood-who" value="${escapeHTML(m.actorId)}"${
          mineByDefault && m.mine ? " checked" : ""
        }>
        <span class="dw-camp-member-name">${escapeHTML(m.name)}</span>
      </label>`
    )
    .join("");

  const conditions = FIREWOOD_CONDITIONS.map(
    (c) =>
      `<option value="${c.modifier}" ${c.modifier === suggested ? "selected" : ""}>${escapeHTML(
        c.label
      )}${c.modifier ? ` (${c.modifier})` : ""}</option>`
  ).join("");

  return ask<FirewoodChoice>(
    "Fetching firewood",
    `<form class="dw-camp-form">
      <p class="hint">Each character who goes brings back enough wood for <strong>1d6 hours</strong>
        of campfire, less whatever the weather costs. A night is eight hours.</p>
      <div class="dw-camp-members">${rows}</div>
      <div class="form-group">
        <label for="dw-wood-conditions">Conditions</label>
        <select id="dw-wood-conditions">${conditions}</select>
      </div>
      <p class="hint">${
        weather
          ? `Read off this morning's weather — <strong>${escapeHTML(
              weather.text
            )}</strong> — which the module scores as ${
              suggested ? `${suggested} to the roll` : "no penalty"
            }. Change it if the Referee sees it differently.`
          : "The weather has not been rolled today, so nothing is assumed."
      }</p>
    </form>`,
    (html) => {
      const ids = checked(html, "dw-wood-who");
      if (!ids.length) {
        ui.notifications?.warn("Nobody was sent for wood.");
        return null;
      }
      const byId = new Map(members.map((m) => [m.actorId, m]));
      return {
        gatherers: ids.map((id) => ({ actorId: id, name: byId.get(id)?.name ?? "Someone" })),
        modifier: Number(html.find("#dw-wood-conditions").val()) || 0,
      };
    }
  );
}

// ─── Building a fire ──────────────────────────────────────────────────────────

/**
 * How hard the fire is to get going — the Referee's judgement, which is exactly
 * what the book asks for ("the Referee may rule that there is only a 4-in-6 or
 * worse chance"). Wet weather pre-picks the book's own example.
 */
export async function promptFire(): Promise<FireChoice | null> {
  const wet = hasEffect(getDayState().weather, "W");
  const preferred = wet ? 4 : FIRE_AUTOMATIC;
  // **The wood comes out of the packs, exactly the way the pot's ingredients
  // do** — and that now means the whole shape of the form, not just where the
  // wood comes from (Dolmenmaster, 2026-09-03: *"mach feuer machen am besten wie das
  // kochen"*). Every stepper starts at **0** rather than full, which reverses
  // the 2026-08-28 ruling: what goes on the fire is a decision to be made
  // rather than one to be taken back, and starting full meant an evening's
  // whole woodpile burned by pressing nothing at all.
  const stack = partyFirewood();
  const carried = stack.reduce((sum, r) => sum + r.hours, 0);

  const options = FIRE_CHANCES.map(
    (c) =>
      `<option value="${c.chance}" ${c.chance === preferred ? "selected" : ""}>${escapeHTML(
        c.label
      )}</option>`
  ).join("");

  return ask<FireChoice>(
    "Building a fire",
    `<form class="dw-camp-form">
      <p class="hint">Given a tinder box and a stash of wood, fire building succeeds by itself.
        In troublesome circumstances the Referee may put a chance on it.</p>
      <div class="form-group">
        <label for="dw-fire-chance">Chance</label>
        <select id="dw-fire-chance">${options}</select>
      </div>
      ${woodSection(stack, carried)}
      ${wet ? `<p class="hint">Today's weather was wet, so the book's 4-in-6 is pre-picked.</p>` : ""}
    </form>`,
    (html) => ({
      chance: Number(html.find("#dw-fire-chance").val()) || FIRE_AUTOMATIC,
      fuel: readFuel(html, stack),
    }),
    {
      render: (html) => {
        wireSteppers(html);
        const paint = (): void => paintFireHours(html);
        html.on("input change click", ".dw-wood-take, .dw-stepper button", () =>
          window.setTimeout(paint, 0)
        );
        paint();
      },
    }
  );
}

/**
 * What goes on the fire, counted in hours of burning.
 *
 * The same shape as the pot's ingredients, and for the same reason: the wood is
 * somebody's, it is spent when the match is struck, and a number typed into a
 * box is a number nobody checks against the pack it came out of.
 *
 * **Each row says what that character still has, and says it while the stepper
 * moves.** The pot prints what is in the pack and leaves it standing; wood is
 * the thing a party runs out of halfway through a bad week, so the number that
 * matters is what is left after tonight rather than what there was before it.
 */
function woodSection(stack: WoodRow[], carried: number): string {
  if (!stack.length) {
    return `<hr><p class="hint dw-meal-empty">Nobody is carrying firewood. Light it anyway if the wood
      came from somewhere the module cannot see — nothing will leave the packs, and the Sleep
      Difficulty table will be rolled from its no-fire rows.</p>`;
  }
  const rows = stack
    .map(
      (row) => `
      <div class="dw-wood-row" data-item-id="${escapeHTML(row.itemId)}" data-holder-id="${escapeHTML(
        row.holderId
      )}" data-carried="${row.hours}">
        <span class="dw-camp-member-name">${escapeHTML(row.holderName)}</span>
        <span class="dw-camp-member-stat">${row.hours}h carried · <span class="dw-wood-left">${
          row.hours
        }h left</span></span>
        ${stepper(`class="dw-wood-take" min="0" max="${row.hours}" value="0"`)}
      </div>`
    )
    .join("");
  return `<hr>
    <p class="hint"><strong>Wood on the fire.</strong> ${carried} hour${carried === 1 ? "" : "s"} in
      the packs, and a rest period is ${NIGHT_HOURS}. What is put on is burned whether the fire
      catches or not.</p>
    <div class="dw-meal-rows">${rows}</div>
    <p class="dw-wood-count"></p>`;
}

/**
 * The live "six hours — two short of the night" line, and what each pack has
 * left while the wood is being picked.
 */
function paintFireHours(html: JQuery): void {
  let hours = 0;
  for (const el of html.find(".dw-wood-row").toArray()) {
    const row = el as HTMLElement;
    const take = Number((row.querySelector(".dw-wood-take") as HTMLInputElement)?.value) || 0;
    const carried = Number(row.dataset.carried) || 0;
    hours += take;
    const left = row.querySelector(".dw-wood-left");
    if (!left) continue;
    const rest = Math.max(0, carried - take);
    left.textContent = rest === 0 ? "nothing left" : `${rest}h left`;
    left.classList.toggle("is-short", rest === 0 && carried > 0);
  }

  const out = html.find(".dw-wood-count");
  if (!out.length) return;
  const short = NIGHT_HOURS - hours;
  out.text(
    hours === 0
      ? "Nothing on the fire — the night is rolled cold."
      : hours < FIRE_MINIMUM_HOURS
        ? `${hours} hour${hours === 1 ? "" : "s"} — under ${FIRE_MINIMUM_HOURS}, so not a night's fire at all.`
        : short > 0
          ? `${hours} hour${hours === 1 ? "" : "s"} — ${short} short of the night, so −1 on the sleep check.`
          : `${hours} hour${hours === 1 ? "" : "s"} — enough for the whole night.`
  );
  out.toggleClass("is-short", hours < NIGHT_HOURS);
}

function readFuel(html: JQuery, stack: WoodRow[]): FireChoice["fuel"] {
  const byId = new Map(stack.map((r) => [r.itemId, r]));
  return html
    .find(".dw-wood-row")
    .toArray()
    .map((el) => {
      const row = el as HTMLElement;
      const take = Number((row.querySelector(".dw-wood-take") as HTMLInputElement)?.value) || 0;
      const source = byId.get(row.dataset.itemId ?? "");
      if (!source || take <= 0) return undefined;
      return { holderId: source.holderId, itemId: source.itemId, hours: Math.min(take, source.hours) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

// ─── Cooking and camaraderie ──────────────────────────────────────────────────

/**
 * Whose check it is — the dialog Dolmenmaster asked for — and, for the cook, what
 * goes in the pot.
 *
 * One radio per character with the governing score printed beside the name, and
 * **the Doom target beside that**: the save is only ever needed on a natural 1,
 * but it is the chosen character's own number, so it is knowable before the die
 * is thrown and belongs on the form rather than as a surprise on the card. The
 * best candidate is pre-selected and can be overruled — the party's best cook is
 * usually the one with the Wisdom, but not always.
 *
 * **Cooking also asks for ingredients**, out of the party's own packs, and says
 * how many mouths they fill as they are picked. A meal is one portion a head
 * (the ration is literally "1 Day"), so the readout is arithmetic rather than a
 * ruling. The ingredients are spent when the roll is made — see `rollCampActivity`
 * for what happens to them when the meal is ruined.
 */
export async function promptCampActivity(
  activity: CampActivity
): Promise<{ actorId: string; meal?: MealChoice; doomTarget?: number } | null> {
  const spec = CAMP_ACTIVITIES[activity];
  const members = partyMembers("mine");
  if (!members.length) return noParty(), null;

  const ability = spec.ability;
  const best = members.reduce((a, b) =>
    (b.scores?.[`${ability}Mod` as "wisMod" | "chaMod"] ?? -99) >
    (a.scores?.[`${ability}Mod` as "wisMod" | "chaMod"] ?? -99)
      ? b
      : a
  );

  const rows = members
    .map(
      (m) => `
      <label class="dw-camp-member">
        <input type="radio" name="dw-activity-who" value="${escapeHTML(m.actorId)}"
               data-doom="${m.doom}" ${m.actorId === best.actorId ? "checked" : ""}>
        <span class="dw-camp-member-name">${escapeHTML(m.name)}</span>
        <span class="dw-camp-member-stat">(${escapeHTML(statLabel(m, ability))}${escapeHTML(
          doomLabel(m)
        )})</span>
      </label>`
    )
    .join("");

  const cooking = activity === "cooking";
  const larder = cooking ? partyFood() : [];
  const mealSection = cooking ? foodSection(larder) : "";

  return ask<{ actorId: string; meal?: MealChoice; doomTarget?: number }>(
    spec.label,
    `<form class="dw-camp-form">
      <p class="hint">1d6 plus the modifier, meeting or exceeding <strong>4</strong>.
        ${escapeHTML(spec.success)}</p>
      <div class="dw-camp-members">${rows}</div>
      <div class="form-group">
        <label for="dw-activity-doom">Save Versus Doom target</label>
        <input type="number" id="dw-activity-doom" min="0" max="20" value="${best.doom || ""}"
               placeholder="none on the sheet">
      </div>
      <p class="hint">Only ever rolled on a natural 1: ${escapeHTML(spec.doom)}
        The number follows the character where their sheet carries one — type one here for a
        character whose saves have not been filled in.</p>
      ${mealSection}
    </form>`,
    (html) => {
      const actorId = String(html.find('input[name="dw-activity-who"]:checked').val() ?? "");
      if (!actorId) return null;
      const doomTarget = Number(html.find("#dw-activity-doom").val()) || undefined;
      if (!cooking) return { actorId, ...(doomTarget ? { doomTarget } : {}) };
      return {
        actorId,
        ...(doomTarget ? { doomTarget } : {}),
        meal: { ingredients: readIngredients(html, larder) },
      };
    },
    {
      width: cooking ? 520 : 420,
      render: (html) => {
        // The Doom target follows the character, because it is theirs — and
        // stays typeable, which is the only way to see the branch at all in a
        // world whose sheets carry no saves.
        html.on("change", 'input[name="dw-activity-who"]', (event) => {
          const doom = (event.currentTarget as HTMLElement).dataset.doom ?? "";
          html.find("#dw-activity-doom").val(doom === "0" ? "" : doom);
        });
        if (!cooking) return;
        wireSteppers(html);
        const paint = () => paintPortions(html, members.length);
        html.on("change input click", paint);
        paint();
      },
    }
  );
}

/**
 * Who sits down to what was cooked — asked after the dice, never before.
 *
 * By this point the pot's size is a fact rather than a plan, so the form can
 * say plainly how many it feeds and warn when more are ticked than there is
 * food for. They are fed in the order listed.
 */
export async function promptEaters(portions: number): Promise<{ eaterIds: string[] } | null> {
  const members = partyMembers();
  if (!members.length) return noParty(), null;

  const rows = members
    .map(
      (m, i) => `
      <label class="dw-camp-member">
        <input type="checkbox" class="dw-meal-eater" value="${escapeHTML(m.actorId)}" ${
          i < portions ? "checked" : ""
        }>
        <span class="dw-camp-member-name">${escapeHTML(m.name)}</span>
      </label>`
    )
    .join("");

  return ask<{ eaterIds: string[] }>(
    "Who eats?",
    `<form class="dw-camp-form">
      <p class="hint">The pot holds <strong>${portions} portion${
        portions === 1 ? "" : "s"
      }</strong> — one a head. Eating settles today's hunger.</p>
      <div class="dw-camp-members">${rows}</div>
      <p class="dw-meal-count"></p>
    </form>`,
    (html) => {
      const eaterIds = html
        .find(".dw-meal-eater:checked")
        .toArray()
        .map((el) => (el as HTMLInputElement).value);
      return eaterIds.length ? { eaterIds } : null;
    },
    {
      label: "Serve",
      render: (html) => {
        const paint = () => {
          const ticked = html.find(".dw-meal-eater:checked").length;
          const out = html.find(".dw-meal-count");
          out.text(
            ticked > portions
              ? `${ticked} named for ${portions} portions — the last ${ticked - portions} go hungry.`
              : `${ticked} eating, ${portions - ticked} portion${
                  portions - ticked === 1 ? "" : "s"
                } left over.`
          );
          out.toggleClass("is-short", ticked > portions);
        };
        html.on("change", paint);
        paint();
      },
    }
  );
}

// ─── The larder ───────────────────────────────────────────────────────────────

interface FoodRow {
  holderId: string;
  holderName: string;
  itemId: string;
  itemName: string;
  available: number;
}

/**
 * Every edible row the party is carrying, the shared store included.
 *
 * `isEdible` reads the effective definition, so the two ration entries and
 * anything a GM marked edible when inventing it both turn up — a hunted deer
 * written in by hand is as much an ingredient as a preserved ration. Counted
 * through `displayQuantity` rather than `quantity`, because a bundle's row
 * quantity is 1 however many portions are loose in it.
 */
function partyFood(): FoodRow[] {
  const rows: FoodRow[] = [];
  for (const holder of getConvoyActors()) {
    for (const item of FlagManager.getInventory(holder).items ?? []) {
      if (!isEdible(item)) continue;
      const available = displayQuantity(item, definitionFor(item));
      if (available <= 0) continue;
      rows.push({
        holderId: holder.id ?? "",
        holderName: holder.name ?? "Someone",
        itemId: item.id,
        itemName: item.name,
        available,
      });
    }
  }
  return rows;
}

/**
 * What is going in the pot.
 *
 * **Counted with + and −, not typed.** A number box asks the Referee to select,
 * clear and retype for a change of one, and the ordinary change *is* one. The
 * box is still there under the buttons — it is what the reader reads, and it
 * keeps the row honest about its maximum.
 *
 * **And each row says what that pack still has, while the stepper moves**
 * (Dolmenmaster, 2026-09-03, pulling the pot level with the fire). Standing text
 * saying "3 left" beside a stepper that has taken all three is the one thing on
 * either form that can be read as a fact and be wrong.
 */
function foodSection(larder: FoodRow[]): string {
  if (!larder.length) {
    return `<hr><p class="hint dw-meal-empty">The party is carrying nothing edible. Cook anyway if the
      ingredients came from somewhere the module cannot see — nothing will be taken from the packs.</p>`;
  }

  const ingredients = larder
    .map(
      (row) => `
      <div class="dw-meal-row" data-item-id="${escapeHTML(row.itemId)}" data-holder-id="${escapeHTML(
        row.holderId
      )}" data-available="${row.available}">
        <span class="dw-camp-member-name">${escapeHTML(row.itemName)}</span>
        <span class="dw-camp-member-stat">${escapeHTML(row.holderName)} · <span
          class="dw-meal-left">${row.available} left</span></span>
        ${stepper(`class="dw-meal-take" min="0" max="${row.available}" value="0"`)}
      </div>`
    )
    .join("");

  return `<hr>
    <p class="hint"><strong>Ingredients.</strong> One portion feeds one character. What is taken
      leaves the packs when the roll is made, whether the dish turns out well or not — who eats it
      is asked afterwards.</p>
    <div class="dw-meal-rows">${ingredients}</div>
    <p class="dw-meal-count"></p>`;
}

/**
 * The live "four portions — feeds four of five" line, and what each pack has
 * left while the ingredients are being picked.
 *
 * The twin of `paintFireHours`, down to the wording: both forms take somebody
 * else's supplies out of somebody else's pack, and in both the number worth
 * seeing is the one that will be there tomorrow.
 */
function paintPortions(html: JQuery, partySize: number): void {
  let portions = 0;
  for (const el of html.find(".dw-meal-row").toArray()) {
    const row = el as HTMLElement;
    const take = Number((row.querySelector(".dw-meal-take") as HTMLInputElement)?.value) || 0;
    const available = Number(row.dataset.available) || 0;
    portions += take;
    const left = row.querySelector(".dw-meal-left");
    if (!left) continue;
    const rest = Math.max(0, available - take);
    left.textContent = rest === 0 ? "none left" : `${rest} left`;
    left.classList.toggle("is-short", rest === 0 && available > 0);
  }

  const out = html.find(".dw-meal-count");
  if (!out.length) return;

  if (portions === 0) {
    out.text("Nothing in the pot yet.");
    out.removeClass("is-short");
    return;
  }
  out.text(
    `${portions} portion${portions === 1 ? "" : "s"} — enough for ${Math.min(
      portions,
      partySize
    )} of the ${partySize} in the party.`
  );
  out.toggleClass("is-short", portions < partySize);
}

function readIngredients(html: JQuery, larder: FoodRow[]): MealChoice["ingredients"] {
  const byId = new Map(larder.map((r) => [r.itemId, r]));
  return html
    .find(".dw-meal-row")
    .toArray()
    .map((el) => {
      const row = el as HTMLElement;
      const take = Number((row.querySelector(".dw-meal-take") as HTMLInputElement)?.value) || 0;
      const source = byId.get(row.dataset.itemId ?? "");
      if (!source || take <= 0) return undefined;
      return {
        holderId: source.holderId,
        holderName: source.holderName,
        itemId: source.itemId,
        itemName: source.itemName,
        portions: Math.min(take, source.available),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

// ─── Watches ──────────────────────────────────────────────────────────────────

export interface WatchChoice {
  keepers: WatchKeeperChoice[];
  nightHours: number;
}

/**
 * Who stands watch, **in what order**, and how long the night is.
 *
 * The order was Dolmenmaster's question and the book does not answer it: it is the
 * table's, so it is asked for. Each ticked character gets a number, defaulting
 * to the order the party is listed in, and the roll sorts by it. Constitution
 * decides the falling-asleep die, so Constitution is printed.
 *
 * The line under the list is the reason the order matters less than the count:
 * the night divides evenly among the watchers, and fewer than four leaves
 * everyone short of the six hours a good night's rest takes. It updates as boxes
 * are ticked, so the shortfall is visible before the dice rather than after.
 */
/**
 * Who stands watch, **in what order**, and how long the night is.
 *
 * The order is the table's — the book does not decide it — so the list is
 * **dragged into shape** rather than numbered by hand: pick the row up by its
 * grip and drop it where it belongs, and the watch numbers renumber themselves.
 * Typing 1..4 into four boxes was the first cut and Dolmenmaster was right that it
 * is the wrong verb for the job.
 *
 * A dragged row has to be a real element, which is why this list is flexbox
 * with fixed columns rather than the `display: contents` grid the other lists
 * use: an element with no box of its own cannot be picked up.
 *
 * The line under the list is why the count matters more than the order: the
 * night divides evenly, and fewer than four watchers leaves everyone short of
 * the six hours a good night's rest takes. It updates as boxes are ticked.
 */
export async function promptWatches(): Promise<WatchChoice | null> {
  const members = partyMembers();
  if (!members.length) return noParty(), null;

  const rows = members
    .map((m) => {
      const con = m.scores?.con ?? 0;
      const faces = fallAsleepFaces(con);
      return `
      <div class="dw-watch-row" draggable="true" data-actor-id="${escapeHTML(m.actorId)}">
        <i class="fas fa-grip-vertical dw-watch-grip" title="Drag to reorder the watches"></i>
        <span class="dw-watch-number"></span>
        <input type="checkbox" name="dw-watch-who" value="${escapeHTML(m.actorId)}">
        <span class="dw-camp-member-name">${escapeHTML(m.name)}</span>
        <span class="dw-camp-member-stat">(${escapeHTML(statLabel(m, "con"))} — 1-in-${faces})</span>
      </div>`;
    })
    .join("");

  return ask<WatchChoice>(
    "Watches through the night",
    `<form class="dw-camp-form">
      <p class="hint">Tick who stands watch and <strong>drag the rows</strong> into the order they
        take them. The optional rule: a 1-in-10 chance of nodding off, 1-in-20 at Constitution 15 or
        higher, 1-in-6 at 6 or lower.</p>
      <div class="dw-watch-rows">${rows}</div>
      <div class="form-group">
        <label for="dw-watch-hours">The night is</label>
        <input type="number" id="dw-watch-hours" min="1" max="16" step="1" value="${NIGHT_HOURS}">
      </div>
      <p class="dw-watch-count"></p>
    </form>`,
    (html) => {
      // The order is the order on screen, so it is read off the DOM rather than
      // out of any field — after a drag those are the same thing.
      const keepers = html
        .find(".dw-watch-row")
        .toArray()
        .map((el) => el as HTMLElement)
        .filter(
          (row) =>
            !!(row.querySelector('input[name="dw-watch-who"]') as HTMLInputElement)?.checked
        )
        .map((row, index) => {
          const actorId = row.dataset.actorId ?? "";
          const member = members.find((m) => m.actorId === actorId);
          return {
            actorId,
            name: member?.name ?? "Someone",
            constitution: member?.scores?.con ?? 0,
            order: index + 1,
          };
        });

      if (!keepers.length) {
        ui.notifications?.warn("Nobody was put on watch.");
        return null;
      }
      return {
        keepers,
        nightHours: Number(html.find("#dw-watch-hours").val()) || NIGHT_HOURS,
      };
    },
    {
      width: 460,
      render: (html) => {
        const list = html.find(".dw-watch-rows")[0] as HTMLElement | undefined;

        const paint = () => {
          // Only the ticked rows are watches, so only they are numbered.
          let n = 0;
          html
            .find(".dw-watch-row")
            .toArray()
            .forEach((el) => {
              const row = el as HTMLElement;
              const on = !!(row.querySelector('input[name="dw-watch-who"]') as HTMLInputElement)
                ?.checked;
              row.classList.toggle("is-on", on);
              const label = row.querySelector(".dw-watch-number") as HTMLElement | null;
              if (label) label.textContent = on ? `${++n}.` : "—";
            });

          const hours = Number(html.find("#dw-watch-hours").val()) || NIGHT_HOURS;
          const out = html.find(".dw-watch-count");
          if (!n) {
            out.text("Nobody on watch — everyone sleeps the night through.");
            out.removeClass("is-short");
            return;
          }
          const share = watchShares(n, hours);
          out.text(
            `${n} watch${n === 1 ? "" : "es"} of ${hoursLabel(
              share.hoursOnWatch
            )} — each watcher sleeps ${hoursLabel(share.hoursAsleep)}` +
              (share.shortNight
                ? `, under the ${MIN_SLEEP_HOURS} hours a good night's rest takes.`
                : ".")
          );
          out.toggleClass("is-short", share.shortNight);
        };

        // Plain HTML5 drag and drop: no library, and the drop simply moves the
        // element, so the DOM stays the single answer to "what order is it in".
        let dragged: HTMLElement | undefined;
        html.on("dragstart", ".dw-watch-row", (event) => {
          dragged = event.currentTarget as HTMLElement;
          dragged.classList.add("is-dragging");
          (event.originalEvent as DragEvent).dataTransfer?.setData("text/plain", "");
        });
        html.on("dragend", ".dw-watch-row", () => {
          dragged?.classList.remove("is-dragging");
          dragged = undefined;
          html.find(".dw-watch-row").removeClass("is-over");
          paint();
        });
        html.on("dragover", ".dw-watch-row", (event) => {
          event.preventDefault();
          const over = event.currentTarget as HTMLElement;
          if (!dragged || over === dragged || !list) return;
          html.find(".dw-watch-row").removeClass("is-over");
          over.classList.add("is-over");
          // Above the midpoint means "before this row", below it "after" — the
          // behaviour every list in every application has.
          const box = over.getBoundingClientRect();
          const after = (event.originalEvent as DragEvent).clientY > box.top + box.height / 2;
          list.insertBefore(dragged, after ? over.nextSibling : over);
        });
        html.on("drop", ".dw-watch-row", (event) => event.preventDefault());

        html.on("change input", paint);
        paint();
      },
    }
  );
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export interface SleepChoice {
  sleepers: SleeperChoice[];
  campfire: boolean;
}

/**
 * The night, character by character.
 *
 * Everything that decides a Constitution Check is on this one form and says so
 * as it changes: the fire, each character's bedding, the season, and whatever
 * supper and songs were worth. **The difficulty is recomputed live** beside
 * each name — the Sleep Difficulty table is the part of camping a table looks
 * up wrongly, and a row that says "Moderate" the moment the fire is unticked is
 * the whole reason to have it on a screen rather than on paper.
 *
 * The evening's bonus is read from what was already rolled rather than asked
 * for again. Nothing here can be set to disagree with the cards that produced
 * it.
 */
export async function promptSleep(): Promise<SleepChoice | null> {
  // **The whole camp is listed; only your own rows are yours to fill in.**
  // Dolmenmaster, 2026-09-03. The night is one thing the party does together, and a
  // player who sees only their own row cannot tell whether anybody else has
  // bedded down yet — so the others are drawn greyed, showing whatever they
  // have already rolled tonight.
  const members = partyMembers("party");
  if (!members.length) return noParty(), null;
  if (!members.some((m) => m.mine)) {
    ui.notifications?.warn("None of these characters are yours to bed down.");
    return null;
  }

  const camp = getCampState();
  const season = seasonInfo(getDayContext().season);
  const host = season.host;
  const bonus = restModifier(
    camp.cooking ? { succeeded: camp.cooking.success, doomed: camp.cooking.doom?.saved === false } : undefined,
    camp.camaraderie
      ? { succeeded: camp.camaraderie.success, doomed: camp.camaraderie.doom?.saved === false }
      : undefined
  );
  // The fire duty answers this where it was rolled; where it was not, a camp
  // with a fire is the ordinary case.
  // The tick says whether there is a campfire at all. Whether it lasted the
  // night is a separate question, and the sleep roll asks it for itself — a
  // short fire costs a point rather than the whole row.
  const campfire = camp.fire?.lit ?? true;

  // The watch roll already worked out who slept short: with three watchers over
  // eight hours nobody gets six. Pre-ticked from it rather than left for the
  // Referee to notice, and still a tick they can clear.
  const shortFromWatch = new Set(
    camp.watches?.shortNight ? (camp.watches.keepers ?? []).map((k) => k.actorId) : []
  );

  // **What the party actually owns, counted across every pack and the store.**
  // Before this the bedding was read out of each character's own bag alone, so
  // a tent Alice carried sheltered Alice and one in the shared store sheltered
  // nobody — and nothing stopped the dropdown offering bedding to a party that
  // owned none (Dolmenmaster, 2026-09-03).
  const bedrolls = partyStock(BEDROLL_ID);
  const tents = partyStock(TENT_ID);
  const everyone = members.map((m) => m.actorId);
  const carriersOf = (stock: { carriers: { actorId: string }[] }) =>
    stock.carriers.map((c) => c.actorId);

  // Pre-ticked, carriers first. A tent holds two, so one tent in the party
  // covers its owner and one more.
  //
  // **Two ticks rather than one dropdown.** The book's bedding ladder is
  // "neither / one of them / both", which is exactly what two independent ticks
  // say — and unlike a three-way select, each one can be stopped on its own the
  // moment the party runs out of that particular thing.
  const withBedroll = new Set(allocate(bedrolls.spaces, carriersOf(bedrolls), everyone));
  const withTent = new Set(allocate(tents.spaces, carriersOf(tents), everyone));

  // Whoever has already bedded down tonight, and on what. Their row shows it
  // rather than the module's guess at it — the roll has happened, so the guess
  // is no longer the interesting thing.
  const rolled = new Map((camp.sleep?.sleepers ?? []).map((s) => [s.actorId, s]));

  const rows = members
    .map((m) => {
      const done = rolled.get(m.actorId);
      // A row that is not the reader's is read-only, and so is one already
      // rolled: both are facts to be seen rather than questions to answer.
      const locked = !m.mine || !!done;
      const off = locked ? " disabled" : "";
      // **What was recorded is "none", "some" or "both", not which of the two.**
      // So both ticks are only shown set where the record says both, and the
      // row's own note names the bedding in the book's words — inventing a
      // bedroll for a "some" would be a guess printed as a fact.
      const bedroll = done ? done.bedding === "both" : withBedroll.has(m.actorId);
      const tent = done ? done.bedding === "both" : withTent.has(m.actorId);
      const short = done ? done.shortNight : shortFromWatch.has(m.actorId);
      const bedding = BEDDING.find((b) => b.id === done?.bedding)?.label ?? "";
      const note = done
        ? ` — already bedded down · ${bedding.toLowerCase()}`
        : m.mine
          ? ""
          : " — somebody else's to roll";
      return `
      <div class="dw-sleep-row${locked ? " is-locked" : ""}" data-actor-id="${escapeHTML(m.actorId)}"
           data-mine="${m.mine && !done}">
        <input type="checkbox" class="dw-sleep-in" checked${off}
               title="Sleeping in this camp tonight. Unticked, nothing is written to this character at all.">
        <span class="dw-camp-member-name">${escapeHTML(m.name)}</span>
        <span class="dw-camp-member-stat">(${escapeHTML(statLabel(m, "con"))})${escapeHTML(note)}</span>
        <label class="dw-sleep-gear" title="A bedroll of their own.">
          <input type="checkbox" class="dw-sleep-bedroll" ${bedroll ? "checked" : ""}${off}>
          bedroll
        </label>
        <label class="dw-sleep-gear" title="A place under a tent. One tent holds two.">
          <input type="checkbox" class="dw-sleep-tent" ${tent ? "checked" : ""}${off}>
          tent
        </label>
        <label class="dw-sleep-short" title="Under ${MIN_SLEEP_HOURS} hours asleep is not a good night's rest, whatever the conditions.">
          <input type="checkbox" class="dw-sleep-short-box" ${short ? "checked" : ""}${off}> short night
        </label>
        <span class="dw-sleep-difficulty"></span>
      </div>`;
    })
    .join("");

  const fireHours = camp.firewood?.hours;
  const woodWarning =
    fireHours !== undefined && fireHours > 0 && fireHours < 8
      ? `<p class="hint">Only ${fireHours} hour${fireHours === 1 ? "" : "s"} of wood were gathered — enough for part of the night. Whether the fire is still burning at bedtime is the Referee's call.</p>`
      : "";

  return ask<SleepChoice>(
    "Sleep",
    `<form class="dw-camp-form dw-sleep-form">
      <label class="dw-sleep-fire">
        <input type="checkbox" id="dw-sleep-fire" ${campfire ? "checked" : ""}${
          isGM() ? "" : " disabled"
        }>
        A campfire is burning${
          isGM()
            ? ""
            : ` — ${campfire ? "the camp has one" : "there is none"}, as the fire step left it`
        }
      </label>
      <p class="hint">${escapeHTML(t(season.labelKey))}${
        host === (season.id as string) ? "" : ` (an unseason falling in ${host})`
      }${
        bonus ? `, ${bonus > 0 ? "+" : ""}${bonus} from the evening's cooking and company` : ""
      }. Easy sleeps without a roll, impossible fails without one; the rest is a Constitution Check against 4.</p>
      <p class="dw-sleep-stock hint">
        <i class="fas fa-box-open"></i>
        <span data-stock="bedroll"></span> &middot; <span data-stock="tent"></span>
      </p>
      <div class="dw-sleep-rows">${rows}</div>
      ${
        shortFromWatch.size
          ? `<p class="hint">The watch left ${shortFromWatch.size} of them under ${MIN_SLEEP_HOURS} hours' sleep, so their nights are already ticked short.</p>`
          : ""
      }
      ${woodWarning}
    </form>`,
    (html) => {
      const fire = !!html.find("#dw-sleep-fire").prop("checked");
      const sleepers: SleeperChoice[] = html
        // **Only the rows this reader owns and has not already rolled.** The
        // others are on the form to be seen, not to be answered for; the
        // Referee's client checks the same thing again when the request
        // arrives, because a disabled input is a courtesy and not a lock.
        .find('.dw-sleep-row[data-mine="true"]')
        .toArray()
        // A character who is not in this camp is skipped entirely rather than
        // rolled and ignored: sleep is the one camp roll that writes to the
        // actor, and a night nobody spent here must not reach their clocks.
        .filter((el) => !!((el as HTMLElement).querySelector(".dw-sleep-in") as HTMLInputElement)?.checked)
        .map((el) => {
          const row = el as HTMLElement;
          return {
            actorId: row.dataset.actorId ?? "",
            bedding: beddingFrom(
              !!(row.querySelector(".dw-sleep-bedroll") as HTMLInputElement)?.checked,
              !!(row.querySelector(".dw-sleep-tent") as HTMLInputElement)?.checked
            ),
            shortNight: !!(row.querySelector(".dw-sleep-short-box") as HTMLInputElement)?.checked,
          };
        })
        .filter((s) => s.actorId);
      if (!sleepers.length) {
        ui.notifications?.warn("Nobody is sleeping in this camp.");
        return null;
      }
      return { sleepers, campfire: fire };
    },
    {
      width: 720,
      // Live, because the table is the thing worth seeing. Bound once on the
      // form rather than per control, so it survives whatever the rows contain.
      render: (html) => {
        const rowEls = () => html.find(".dw-sleep-row").toArray() as HTMLElement[];
        const box = (row: HTMLElement, cls: string) =>
          row.querySelector(cls) as HTMLInputElement | null;
        const isHere = (row: HTMLElement) => !!box(row, ".dw-sleep-in")?.checked;

        /**
         * Stop a tick the party cannot pay for.
         *
         * Only what is *claimed by somebody sleeping here* counts against the
         * stock: a character who is not in this camp is holding nothing. The
         * already-ticked are never disabled, or a full list would freeze itself
         * and the Referee could not free a place by moving one.
         */
        const limit = (cls: string, stock: { spaces: number }, noun: string) => {
          const rows = rowEls();
          const claimed = rows.filter((r) => isHere(r) && box(r, cls)?.checked).length;
          const left = Math.max(0, stock.spaces - claimed);
          for (const row of rows) {
            const input = box(row, cls);
            if (!input) continue;
            // A locked row's ticks are facts, not offers: never hand them back
            // just because the party has a place left over.
            const locked = row.classList.contains("is-locked");
            const blocked = !input.checked && (left === 0 || !isHere(row));
            input.disabled = blocked || locked;
            const label = input.closest("label") as HTMLElement | null;
            if (label) {
              label.classList.toggle("is-spent", blocked && left === 0);
              if (blocked && left === 0) {
                label.title = `The party has ${stock.spaces} ${noun} place${
                  stock.spaces === 1 ? "" : "s"
                } and they are all taken. Untick somebody to free one.`;
              }
            }
          }
          return { claimed, left };
        };

        const paint = () => {
          const fire = !!html.find("#dw-sleep-fire").prop("checked");

          const bed = limit(".dw-sleep-bedroll", bedrolls, "bedroll");
          const tent = limit(".dw-sleep-tent", tents, "tent");
          const stockOut = (key: string, text: string) => {
            const el = html.find(`[data-stock="${key}"]`)[0] as HTMLElement | undefined;
            if (el) el.textContent = text;
          };
          stockOut("bedroll", stockLine(bedrolls, "bedrolls", bed.claimed));
          stockOut("tent", stockLine(tents, "tents", tent.claimed));

          rowEls().forEach((row) => {
              const here = isHere(row);
              row.classList.toggle("is-away", !here);
              const bedding = beddingFrom(
                !!box(row, ".dw-sleep-bedroll")?.checked,
                !!box(row, ".dw-sleep-tent")?.checked
              );
              const short = !!(row.querySelector(".dw-sleep-short-box") as HTMLInputElement)
                ?.checked;
              const difficulty = sleepDifficulty(fire, bedding, host);
              const info = SLEEP_DIFFICULTIES[difficulty];
              const out = row.querySelector(".dw-sleep-difficulty") as HTMLElement | null;
              if (!out) return;
              if (!here) {
                out.textContent = "not here";
                out.title = "Nothing is rolled or written for this character tonight.";
                out.className = "dw-sleep-difficulty is-away";
                return;
              }
              out.textContent = short ? `${info.label} — but a short night` : info.label;
              out.title = short
                ? `Under ${MIN_SLEEP_HOURS} hours asleep: no good night's rest, whatever the table says.`
                : info.hint;
              out.className = `dw-sleep-difficulty is-${short ? "impossible" : difficulty}`;
            });
        };
        html.on("change", paint);
        paint();
      },
    }
  );
}

// ─── Asking, then rolling ─────────────────────────────────────────────────────

/**
 * One camp duty, from the button to the card.
 *
 * Both places a camp duty can be rolled from — the strip and the "Making camp"
 * window — call this and nothing else, so the two cannot drift into asking
 * different questions for the same duty. Cancelling any prompt leaves the duty
 * exactly as it was.
 */
export async function runCampDuty(dutyId: string): Promise<void> {
  // The camp is the Referee's, on Dolmenmaster's instruction, and the guard is here
  // as well as inside every roll: without it a player who reached one of these
  // buttons would be walked through a dialog that then quietly did nothing.
  // The duty strip is already GM-only, so this is the second door, not the only
  // one — the same shape as the party-presence rule.
  if (!(game as Game).user?.isGM) return;

  if (dutyId === "firewood") {
    const choice = await promptFirewood();
    if (choice) await rollFirewood(choice.gatherers, choice.modifier);
    return;
  }
  if (dutyId === "fire") {
    const choice = await promptFire();
    if (choice) await rollFire(choice.chance, choice.fuel);
    return;
  }
  if (dutyId === "cooking" || dutyId === "entertainment") {
    const activity: CampActivity = dutyId === "cooking" ? "cooking" : "camaraderie";
    const choice = await promptCampActivity(activity);
    if (!choice) return;
    await rollCampActivity(activity, choice.actorId, choice.meal, choice.doomTarget);
    // The pot is a fact now, so the second question can be asked properly.
    const meal = getCampState().cooking?.meal;
    if (activity === "cooking" && meal && !meal.ruined && meal.portions > 0) {
      const diners = await promptEaters(meal.portions);
      if (diners) await serveMeal(diners.eaterIds);
    }
    return;
    return;
  }
  if (dutyId === "watches") {
    const choice = await promptWatches();
    if (choice) await rollWatches(choice.keepers, choice.nightHours);
    return;
  }
  if (dutyId === "sleep") {
    const choice = await promptSleep();
    if (choice) await rollSleep(choice.sleepers, choice.campfire);
  }
}
