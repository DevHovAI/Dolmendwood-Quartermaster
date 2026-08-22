import { escapeHTML } from "../helpers/handlebars";
import { getDayContext, seasonInfo, terrainInfo, wayInfo } from "./dayContext";
import { getDayState, setDutyResult } from "./dayDuties";
import { lostChance, lostConsequence, type LostResult } from "./gettingLost";
import { skillCheck } from "./checks";
import {
  FISH,
  FULL_DAY_BONUS,
  FUNGI,
  GAME_ANIMALS,
  PLANTS,
  foodMethodInfo,
  foragingYield,
  type FoodMethod,
  type FoodResult,
} from "./findingFood";
import {
  WEATHER_EFFECTS,
  hasEffect,
  weatherEntry,
  weatherSummary,
  weatherTableFor,
  type WeatherResult,
} from "./weather";

/**
 * Rolling the day's tables.
 *
 * Everything here goes through Foundry's own `Roll`, never `Math.random`, and
 * **the Roll objects travel with the chat message**. That second part is not
 * decoration: Dice So Nice animates what it finds in `message.rolls`, so a card
 * whose dice were rolled separately and merely described in its HTML gets no
 * animation at all. Passing them also puts the real dice in the log, where a
 * Referee can inspect one or argue with it.
 *
 * Each roll writes its result onto the day and posts a card. The card is
 * whispered to the GMs rather than shown at the table, because half of what
 * these tables produce is meant to be found out the hard way — the whole point
 * of the Campaign Book's "secret" handling of getting lost is that the players'
 * map goes quietly wrong.
 *
 * **No card names the day.** The module's counter and the campaign's calendar
 * do not agree and are not meant to, so printing "day 14" on a result was
 * saying something untrue about the fiction.
 */

async function rollDice(formula: string): Promise<Roll> {
  return new Roll(formula).evaluate();
}

const total = (roll: Roll): number => roll.total ?? 0;

/** GM-only, and only ever seen by GMs. */
async function whisperToGMs(content: string, rolls: Roll[] = []): Promise<void> {
  const g = game as Game;
  const gmIds = (g.users?.filter?.((u: { isGM?: boolean; id?: string }) => !!u.isGM) ?? [])
    .map((u: { id?: string }) => u.id)
    .filter((id): id is string => !!id);
  await ChatMessage.create({
    content,
    rolls,
    // Without this the card lands silently: Foundry plays the dice sound only
    // for messages it can tell are rolls.
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
    whisper: gmIds,
  } as Parameters<typeof ChatMessage.create>[0]);
}

function isGM(): boolean {
  return !!(game as Game).user?.isGM;
}

function noteLine(note: string | undefined): string {
  return note ? `<p class="dw-day-roll-consequence">${escapeHTML(note)}</p>` : "";
}

// ─── Weather ───────────────────────────────────────────────────────────────────

function effectChips(effects: WeatherResult["effects"]): string {
  if (!effects.length) return `<p class="dw-day-roll-none">No adverse effects.</p>`;
  return `<ul class="dw-day-roll-effects">${effects
    .map(
      (e) =>
        `<li><i class="fas ${WEATHER_EFFECTS[e].icon}"></i> <strong>${escapeHTML(
          WEATHER_EFFECTS[e].label
        )}.</strong> ${escapeHTML(WEATHER_EFFECTS[e].hint)}</li>`
    )
    .join("")}</ul>`;
}

export async function rollWeather(): Promise<WeatherResult | undefined> {
  if (!isGM()) return undefined;

  const { season } = getDayContext();
  const table = weatherTableFor(season);
  const die = await rollDice("2d6");
  const roll = total(die);
  const entry = weatherEntry(table, roll);
  if (!entry) return undefined;

  const result: WeatherResult = { season, table, roll, text: entry.text, effects: entry.effects };
  await setDutyResult("weather", { weather: result });

  const info = seasonInfo(season);
  // Said plainly when it applies: it is the one result that quietly changes a
  // number elsewhere on the bar.
  const borrowed =
    table !== season
      ? `<p class="dw-day-roll-note">${escapeHTML(info.label)} has no weather table of its own — rolled on ${escapeHTML(table)}.</p>`
      : "";

  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas fa-cloud-sun-rain"></i> Weather</h3>
      <p class="dw-day-roll-headline">${escapeHTML(entry.text)}</p>
      <p class="dw-day-roll-sub">${escapeHTML(info.label)}, 2d6 = ${roll}</p>
      ${borrowed}
      ${effectChips(entry.effects)}
    </div>`,
    [die]
  );

  return result;
}

// ─── Getting lost ──────────────────────────────────────────────────────────────

export async function rollGettingLost(): Promise<LostResult | undefined> {
  if (!isGM()) return undefined;

  const ctx = getDayContext();
  const state = getDayState();
  const chance = lostChance(ctx.way, ctx.terrain, hasEffect(state.weather, "V"));

  // A road carries no chance at all, so there is nothing to roll. Recorded as a
  // result all the same: "checked, no risk" is a different thing from "not yet
  // checked", and the tick should say the duty was dealt with.
  if (chance.inSix <= 0) {
    const result: LostResult = { roll: 0, chance: 0, lost: false };
    await setDutyResult("lost", { lost: result });
    await whisperToGMs(
      `<div class="dw-day-roll">
        <h3><i class="fas fa-map-location-dot"></i> Getting lost</h3>
        <p class="dw-day-roll-headline">No roll: the party is on a road.</p>
        <p class="dw-day-roll-sub">${escapeHTML(chance.reason)}</p>
      </div>`
    );
    return result;
  }

  const die = await rollDice("1d6");
  const roll = total(die);
  const lost = roll <= chance.inSix;
  const result: LostResult = { roll, chance: chance.inSix, lost };
  const dice = [die];

  if (lost) {
    const cDie = await rollDice("3d6");
    dice.push(cDie);
    const cRoll = total(cDie);
    const consequence = lostConsequence(cRoll);
    result.consequence = {
      roll: cRoll,
      text: consequence?.text ?? "—",
      secret: !!consequence?.secret,
    };
    result.hunterHint = true;
  }

  await setDutyResult("lost", { lost: result });

  const t = terrainInfo(ctx.terrain);
  const where =
    ctx.way === "wild"
      ? `travelling wild in ${t.label.toLowerCase()}`
      : `following a ${wayInfo(ctx.way).label.toLowerCase()}`;

  const body = lost
    ? `<p class="dw-day-roll-headline is-bad">Lost.</p>
      <p class="dw-day-roll-sub">1d6 = ${roll}, against ${chance.inSix}-in-6 &mdash; ${escapeHTML(where)}</p>
      <p class="dw-day-roll-consequence"><strong>3d6 = ${result.consequence?.roll}.</strong>
        ${escapeHTML(result.consequence?.text ?? "")}</p>
      ${
        result.consequence?.secret
          ? `<p class="dw-day-roll-note">Off-course: the Campaign Book lets you keep this to yourself and let their map go wrong, or tell them the direction they are really walking. Either way they cannot correct it today.</p>`
          : ""
      }
      <p class="dw-day-roll-note">A hunter in the party can find the path again on a 3-in-6 chance.</p>`
    : `<p class="dw-day-roll-headline">On course.</p>
      <p class="dw-day-roll-sub">1d6 = ${roll}, against ${chance.inSix}-in-6 &mdash; ${escapeHTML(where)}</p>`;

  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas fa-map-location-dot"></i> Getting lost</h3>
      ${body}
    </div>`,
    dice
  );

  return result;
}

// ─── Finding food ──────────────────────────────────────────────────────────────

/**
 * Fish, forage, or hunt.
 *
 * The Survival Skill Target comes from the caller rather than the character
 * sheet: this world runs on OSE, which records no Dolmenwood skills, so there
 * is nothing to read. The Referee states the party's best target and the module
 * rolls against it — honest about what it does and does not know.
 *
 * It is a **target to reach, not a chance to roll under**: 1d6 plus modifiers,
 * meeting or exceeding it (PB p144). A natural 1 always fails and a natural 6
 * always succeeds, which `skillCheck` enforces — the first cut of this had the
 * comparison inverted and no natural rule at all.
 */
export async function rollFindingFood(
  method: FoodMethod,
  target: number,
  fullDay: boolean,
  situational = 0
): Promise<FoodResult | undefined> {
  if (!isGM()) return undefined;

  const ctx = getDayContext();
  const info = foodMethodInfo(method);
  // The full day is a modifier on the roll, not a lower target — so it cannot
  // rescue a natural 1, and the target stays the character's own number.
  const modifier = (fullDay ? FULL_DAY_BONUS : 0) + situational;

  const checkDie = await rollDice("1d6");
  const roll = total(checkDie);
  const check = skillCheck(roll, modifier, target);
  const success = check.success;
  const dice = [checkDie];

  const result: FoodResult = {
    method,
    roll,
    modifier,
    target,
    fullDay,
    success,
    ...(check.natural ? { natural: check.natural } : {}),
  };

  let body = "";
  if (!success) {
    body = `<p class="dw-day-roll-headline is-bad">Nothing found.</p>`;
  } else if (method === "forage") {
    // 1d6 decides the kind before 1d20 decides which of it.
    const kindDie = await rollDice("1d6");
    dice.push(kindDie);
    const kind = total(kindDie) <= 3 ? "fungi" : "plants";
    const whichDie = await rollDice("1d20");
    dice.push(whichDie);
    const which = total(whichDie);
    const entry = (kind === "fungi" ? FUNGI : PLANTS)[which - 1];

    const y = foragingYield(ctx.season);
    const yieldDie = await rollDice(y.formula);
    dice.push(yieldDie);

    result.find = { name: entry.name, note: entry.note, roll: which, kind };
    result.rations = { formula: y.formula, total: total(yieldDie), why: y.why };

    // Colliggwyld doubles fungi specifically, not the whole harvest.
    const doubled = ctx.season === "colliggwyld" && kind === "fungi";
    body = `<p class="dw-day-roll-headline">${escapeHTML(entry.name)}</p>
      <p class="dw-day-roll-sub">${kind === "fungi" ? "Fungi" : "Plants"} (1d6 = ${total(kindDie)}), 1d20 = ${which}</p>
      ${noteLine(entry.note)}
      <p class="dw-day-roll-yield"><strong>${result.rations.total}${doubled ? ` × 2 = ${result.rations.total * 2}` : ""} fresh rations</strong>
        (${y.formula}, ${escapeHTML(y.why)})${doubled ? " — Colliggwyld doubles foraged fungi." : ""}</p>
      <p class="dw-day-roll-note">Some hexes list their own special plants or fungi, instead of or as well as this.</p>`;
  } else if (method === "fish") {
    const whichDie = await rollDice("1d20");
    dice.push(whichDie);
    const which = total(whichDie);
    const entry = FISH[which - 1];
    result.find = { name: entry.name, note: entry.note, roll: which };

    // Three entries override the standard 2d6 and one replaces the catch with a
    // monster, so the yield is only rolled where the book actually grants one.
    const formula =
      entry.name === "Hameth sprat" ? "2d4" : entry.name === "Giant catfish" ? "" : "2d6";
    let yieldLine = `<p class="dw-day-roll-yield"><strong>—</strong> the catch is a combat encounter, not a meal. Killed, it gives 4 rations per Hit Point.</p>`;
    if (formula) {
      const yieldDie = await rollDice(formula);
      dice.push(yieldDie);
      result.rations = { formula, total: total(yieldDie), why: "fishing" };
      yieldLine = `<p class="dw-day-roll-yield"><strong>${result.rations.total} fresh rations</strong> (${formula})</p>`;
    }

    body = `<p class="dw-day-roll-headline">${escapeHTML(entry.name)}</p>
      <p class="dw-day-roll-sub">1d20 = ${which}</p>
      ${noteLine(entry.note)}
      ${yieldLine}`;
  } else {
    const t = terrainInfo(ctx.terrain);
    const whichDie = await rollDice("1d20");
    dice.push(whichDie);
    const which = total(whichDie);
    const [name, numberDice] = GAME_ANIMALS[ctx.terrain][which - 1];
    const countDie = await rollDice(numberDice);
    dice.push(countDie);

    result.find = { name, roll: which };
    result.number = `${total(countDie)}`;

    body = `<p class="dw-day-roll-headline">${escapeHTML(name)} &times;${total(countDie)}</p>
      <p class="dw-day-roll-sub">${escapeHTML(t.label)}, 1d20 = ${which}; number ${numberDice} = ${total(countDie)}</p>
      <p class="dw-day-roll-consequence">The party has crept up on them. The kill is a normal combat encounter: the party has surprise and begins 1d4 × 30 feet away.</p>
      <p class="dw-day-roll-yield"><strong>Rations by Hit Points of what falls</strong> — 1 per HP for small game, 2 for medium, 4 for large.</p>`;
  }

  await setDutyResult("forage", { food: result });

  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas ${info.icon}"></i> ${escapeHTML(info.label)}</h3>
      <p class="dw-day-roll-sub">Survival ${escapeHTML(check.explain)}${
        fullDay ? " Includes +2 for a whole day given to it." : ""
      }</p>
      ${body}
    </div>`,
    dice
  );

  return result;
}

// ─── Clearing ──────────────────────────────────────────────────────────────────

/** Take a roll back, so it can be made again. Unticks the duty with it. */
export async function clearDayRoll(dutyId: RollableDuty): Promise<void> {
  if (!isGM()) return;
  if (dutyId === "weather") await setDutyResult("weather", { weather: undefined });
  else if (dutyId === "lost") await setDutyResult("lost", { lost: undefined });
  else await setDutyResult("forage", { food: undefined });
}

export type RollableDuty = "weather" | "lost" | "forage";

/** Which duties roll on a table rather than merely being ticked off. */
export const ROLLABLE_DUTIES = new Set<string>(["weather", "lost", "forage"]);

/** The line the strip shows under a rolled duty, or nothing if it has not been rolled. */
export function dutyResultLine(dutyId: string): string | undefined {
  const state = getDayState();

  if (dutyId === "weather" && state.weather) return weatherSummary(state.weather);

  if (dutyId === "lost" && state.lost) {
    if (state.lost.chance === 0) return "On a road — no roll";
    return state.lost.lost
      ? `Lost — ${state.lost.consequence?.text ?? ""}`
      : `On course (${state.lost.roll} vs ${state.lost.chance}-in-6)`;
  }

  if (dutyId === "forage" && state.food) {
    const f = state.food;
    const label = foodMethodInfo(f.method).label;
    if (!f.success) return `${label} — nothing found`;
    const count = f.number ? ` ×${f.number}` : "";
    const rations = f.rations ? `, ${f.rations.total} rations` : "";
    return `${f.find?.name ?? label}${count}${rations}`;
  }

  return undefined;
}
