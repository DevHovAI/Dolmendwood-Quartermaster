import { escapeHTML } from "../helpers/handlebars";
import {
  getDayContext,
  regionInfo,
  seasonInfo,
  settlementLabel,
  terrainInfo,
  wayInfo,
} from "./dayContext";
import {
  SETTLEMENT_ENCOUNTERS,
  settlementInfo,
  type Settlement,
} from "./settlementEncounters";
import {
  ACTIVITIES,
  ENCOUNTER_TYPES,
  MARK_NOTES,
  MARK_SECTIONS,
  UNSEASON_ENCOUNTERS,
  activityNeedsOther,
  encounterChance,
  lairChance,
  monsterInfo,
  reactionFor,
  subTable,
  typeColumn,
  type EncounterEntry,
  type EncounterMark,
  type EncounterResult,
} from "./encounters";
import { creatureEntry, type BestiaryEntry } from "./bestiary";
import { BOOKS, bookRef, mayOpenBook, type BookId } from "./books";
import { creatureArt } from "./creatureArt";
import { hexInfo } from "./hexes";
import { BookApp } from "../apps/BookApp";
import { givenColumns, nameTable, surnameColumn } from "./nameTables";
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

    // Fifty of the book's hexes grow something the tables do not know about.
    const hexExtra = await hexForageLine(ctx.hex);
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
      <p class="dw-day-roll-sub">${bookRef("campaign", kind === "fungi" ? 118 : 119, "Campaign Book p" + (kind === "fungi" ? 118 : 119))}</p>
      ${hexExtra.html}`;
    dice.push(...hexExtra.dice);
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

    // One of the twenty catches fights back, and that one has a page like any
    // other creature. The other nineteen are fish the Campaign Book invented for
    // this table alone, and the Monster Book has never heard of them.
    const fishBlock = monsterInfo(entry.name)
      ? `${creatureBookLine(entry.name)}${creatureStatLine(entry.name)}${creatureFlavour(entry.name)}`
      : "";

    body = `<p class="dw-day-roll-headline">${escapeHTML(entry.name)}</p>
      <p class="dw-day-roll-sub">1d20 = ${which} &middot; ${bookRef("campaign", 116, "Campaign Book p116")}</p>
      ${noteLine(entry.note)}
      ${yieldLine}
      ${fishBlock}`;
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

    // A successful hunt ends in a combat encounter, so it is given the same
    // treatment as one: the distance actually rolled rather than described, the
    // creature's page and stat lines, and the buttons that read the bestiary's
    // own tables. What is missing is deliberate — nothing here needs a reaction
    // roll or a lair check, and the party's surprise is not in doubt.
    const distanceDie = await rollDice("1d4");
    dice.push(distanceDie);
    const feet = total(distanceDie) * 30;
    const uuid = await findCreatureUuid(name);
    const extras = Object.values(creatureButtons(name, uuid, total(countDie))).filter(Boolean).join("");

    body = `<p class="dw-day-roll-headline">${escapeHTML(name)} &times;${total(countDie)}</p>
      <p class="dw-day-roll-sub">${escapeHTML(t.label)}, 1d20 = ${which}; number ${numberDice} = ${total(countDie)}</p>
      <p class="dw-day-roll-consequence">The party has crept up on them. The kill is a normal combat encounter: the party has surprise and begins <strong>${feet} feet</strong> away (1d4 &times; 30 = ${total(distanceDie)} &times; 30).</p>
      <p class="dw-day-roll-yield"><strong>Rations by Hit Points of what falls</strong> — 1 per HP for small game, 2 for medium, 4 for large (Player's Book p152).</p>
      ${creatureBookLine(name)}
      ${creatureStatLine(name)}
      ${creatureFlavour(name)}
      ${extras ? `<div class="dw-encounter-buttons">${extras}</div>` : ""}`;
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

// ─── Encounters ────────────────────────────────────────────────────────────────

/**
 * A wandering monster, start to finish.
 *
 * The Campaign Book's procedure (p114) is eight questions deep, and answering
 * them by hand means four page-turns while the table waits. This rolls the lot:
 * whether anything turns up, which column of the Encounter Type table today
 * reads, which of the sixteen d20 tables that sends the Referee to, what is on
 * it, how many, what it is doing, who is surprised, how far off, and how it
 * feels about the party. The card prints every die that produced it, so a
 * Referee who disagrees with one can overrule that one rather than the whole
 * thing.
 *
 * Three things are deliberately *not* rolled, and are buttons on the card
 * instead: the lair check (the Referee usually knows), the reaction re-roll
 * (Charisma applies when parleying, and that is a conversation, not a die), and
 * the second creature an activity ending in "?" implies.
 */
export async function rollEncounter(period: "day" | "night"): Promise<EncounterResult | undefined> {
  if (!isGM()) return undefined;

  const ctx = getDayContext();
  const state = getDayState();
  const dutyId: RollableDuty = period === "day" ? "encounter-day" : "encounter-night";
  const chance = encounterChance(state.mode, period, ctx.terrain);

  const checkDie = await rollDice("1d6");
  const roll = total(checkDie);
  const happened = roll <= chance.inSix;
  const dice = [checkDie];

  if (!happened) {
    const result: EncounterResult = { period, roll, chance: chance.inSix, happened: false };
    await setDutyResult(dutyId, resultPatch(period, result));
    await whisperToGMs(
      `<div class="dw-day-roll">
        <h3><i class="fas ${period === "day" ? "fa-sun" : "fa-moon"}"></i> Encounter check &mdash; ${period === "day" ? "daytime" : "night"}</h3>
        <p class="dw-day-roll-headline">Nothing found the party.</p>
        <p class="dw-day-roll-sub">1d6 = ${roll}, against ${chance.inSix}-in-6</p>
        <p class="dw-day-roll-note">${escapeHTML(chance.reason)}</p>
      </div>`,
      dice
    );
    return result;
  }

  const result: EncounterResult = { period, roll, chance: chance.inSix, happened: true };

  // In town none of what follows applies. The settlement's own d6 table gives a
  // scene rather than a creature, so the wilderness procedure is not entered at
  // all — an earlier cut of this sent a party in Prigwort to the Road/Track
  // column and produced ogres in the market square.
  if (state.mode === "settlement") {
    return rollSettlementScene(period, result, dice);
  }

  let entries: EncounterEntry[];
  let entryDie: string;

  // Chame and Vague overrule everything: a 2-in-6 chance that what comes is
  // serpents or the risen dead, off a d10 of their own, with no type roll at all.
  const override = ctx.season === "chame" || ctx.season === "vague" ? ctx.season : undefined;
  const overrideDie = override ? await rollDice("1d6") : undefined;
  if (overrideDie) dice.push(overrideDie);

  if (override && overrideDie && total(overrideDie) <= 2) {
    result.unseason = override;
    entries = UNSEASON_ENCOUNTERS[override];
    entryDie = "1d10";
  } else if (ctx.region === "aquatic") {
    // "For encounters on rivers or lakes, roll directly on the Aquatic regional
    // encounter table" (CB p114) — so there is no type roll to make.
    result.table = "regional";
    result.tableLabel = regionInfo(ctx.region).label;
    entries = subTable("regional", ctx.region).entries;
    entryDie = "1d20";
  } else {
    const column = typeColumn(period, ctx.way, state.done["fire"] === true);
    const typeDie = await rollDice("1d8");
    dice.push(typeDie);
    const table = ENCOUNTER_TYPES[column].rolls[total(typeDie) - 1];
    const sub = subTable(table, ctx.region);
    result.column = column;
    result.typeRoll = total(typeDie);
    result.table = table;
    result.tableLabel = sub.label;
    entries = sub.entries;
    entryDie = "1d20";
  }

  const whichDie = await rollDice(entryDie);
  dice.push(whichDie);
  const which = total(whichDie);
  const [name, count, mark] = entries[which - 1];
  result.entryRoll = which;
  result.name = name;
  if (mark) result.mark = mark;

  if (/^(\d+d\d+|\d+)$/.test(count)) {
    const countDie = await rollDice(count);
    dice.push(countDie);
    result.numberFormula = count;
    result.number = total(countDie);
  } else if (count) {
    // "see p355" and its three siblings: named beings, not a group with a size.
    result.reference = count;
  }

  // Activity and reaction are **not** rolled here, though the procedure lists
  // both. The book calls the activity table optional and reaches for a reaction
  // only "if the creatures' potential reaction to PCs is unclear" — and most of
  // the time it is not: the Referee already knows what the thing wants. Rolling
  // them unasked put two answers on the card that were as likely to be argued
  // with as used, and threw four more dice across the screen for them. Both are
  // buttons now, and cost a click when they are actually wanted.
  const partyDie = await rollDice("1d6");
  const creatureDie = await rollDice("1d6");
  dice.push(partyDie, creatureDie);
  result.surprise = { party: total(partyDie), creature: total(creatureDie) };
  const bothSurprised = total(partyDie) <= 2 && total(creatureDie) <= 2;

  const distanceFormula = bothSurprised ? "1d4" : "2d6";
  const distanceDie = await rollDice(distanceFormula);
  dice.push(distanceDie);
  result.distance = { formula: `${distanceFormula} × 30`, feet: total(distanceDie) * 30 };

  // "If a nighttime encounter is rolled, the Referee may randomly determine when
  // during the night it occurs (e.g. during which character's watch)" — Player's
  // Book p158. Four two-hour watches across the party's eight hours of rest is
  // what that page describes, and what the bar's own Watches duty says.
  if (period === "night") {
    const watchDie = await rollDice("1d4");
    dice.push(watchDie);
    result.watch = total(watchDie);
  }

  const uuid = await findCreatureUuid(name);
  if (uuid) result.uuid = uuid;

  await setDutyResult(dutyId, resultPatch(period, result));
  await whisperToGMs(encounterCard(result), dice);
  return result;
}

/** Which field of the day this period's result is written to. */
function resultPatch(period: "day" | "night", result: EncounterResult | undefined) {
  return period === "day" ? { encounterDay: result } : { encounterNight: result };
}

function storedEncounter(period: "day" | "night"): EncounterResult | undefined {
  const state = getDayState();
  return period === "day" ? state.encounterDay : state.encounterNight;
}

/**
 * The Actor behind a name, if this world has one.
 *
 * Looked up once, while the card is built, so the button on it needs only
 * `fromUuid` at click time rather than a walk through every compendium. Most
 * worlds have no Dolmenwood bestiary installed — this one runs on OSE — so
 * finding nothing is the normal case and simply leaves the button off.
 *
 * Names are compared loosely because the book writes "Snake—Adder" where a
 * compendium is likely to write "Snake, Adder" or "Adder": punctuation is
 * dropped and case ignored, but nothing cleverer is attempted. A wrong actor
 * opened is worse than no button.
 */
async function findCreatureUuid(name: string): Promise<string | undefined> {
  const g = game as Game;
  const wanted = looseName(name);

  const local = g.actors?.find?.((a: { name?: string }) => looseName(a.name ?? "") === wanted) as
    | { uuid?: string }
    | undefined;
  if (local?.uuid) return local.uuid;

  const packs = (g.packs ?? []) as unknown as {
    documentName?: string;
    getIndex: () => Promise<{ name?: string; uuid?: string }[]>;
  }[];
  for (const pack of packs) {
    if (pack.documentName !== "Actor") continue;
    try {
      const index = await pack.getIndex();
      const hit = [...index].find((e) => looseName(e.name ?? "") === wanted);
      if (hit?.uuid) return hit.uuid;
    } catch {
      // A pack that will not index is a pack without a match.
    }
  }
  return undefined;
}

function looseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[—–,'’]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Marsh Lantern ×7", or the name alone where the book gives no number. */
function encounterHeadline(r: EncounterResult): string {
  const number = r.number !== undefined ? ` &times;${r.number}` : "";
  return `${escapeHTML(r.name ?? "")}${number}`;
}

const ORDINALS = ["first", "second", "third", "fourth"];

function surpriseLine(r: EncounterResult): string {
  const s = r.surprise;
  if (!s) return "";
  const party = s.party <= 2;
  const creature = s.creature <= 2;
  const verdict = party && creature
    ? "Both surprised &mdash; a moment's confusion, and neither side gains anything."
    : party
      ? "<strong>The party is surprised.</strong> The creature has a free Round."
      : creature
        ? "<strong>The creature is surprised.</strong> The party has a free Round."
        : "Neither side surprised.";
  return `<li><strong>Surprise</strong> party ${s.party}, creature ${s.creature} &mdash; ${verdict}</li>`;
}

// ─── What the Monster Book knows, for any creature on any card ─────────────────

/**
 * The page, the lair chance, the stat-block lines, and the buttons that read the
 * bestiary's own tables — for a name, wherever that name came from.
 *
 * Written once and shared, because a hunt turns up a creature exactly as an
 * encounter does: the party has crept up on 2d6 headhogs, and the Referee wants
 * the same page number, the same trait to tell one from another, and the same
 * sheet to open. Everything encounter-specific — reaction, activity, the lair
 * check, the other creature — stays on the encounter card, since none of it
 * applies to game standing in a clearing.
 *
 * The buttons carry the creature's **name**, not the period, so the same button
 * works on a card that has no stored encounter behind it at all.
 */
function creatureBookLine(name: string | undefined, mark?: EncounterMark): string {
  const info = monsterInfo(name);
  if (!info) {
    return mark
      ? `<p class="dw-day-roll-note">${escapeHTML(MARK_NOTES[mark])}</p>`
      : `<p class="dw-day-roll-note">Not in the Monster Book &mdash; see the Campaign Book.</p>`;
  }
  // Said only where the book says something. "No lair chance printed" is a fact
  // about the page rather than about the creature, and on a hunt's card — where
  // no lair check is offered anyway — it is pure noise.
  const lairWord =
    info.lair === "none" ? "keeps no lair" : typeof info.lair === "number" ? `${info.lair}% in lair` : "";
  return `<p class="dw-encounter-book"><i class="fas fa-book-skull"></i>
      ${bookRef("monsters", info.page, `Monster Book <strong>p${info.page}</strong>`)}${info.pageNote ? ` (${escapeHTML(info.pageNote)})` : ""}${
        mark ? ` &middot; ${escapeHTML(MARK_SECTIONS[mark])}` : ""
      }${lairWord ? ` &middot; ${lairWord}` : ""}</p>`;
}

/**
 * Morale, hoard and temperament off the stat block.
 *
 * All three are asked in the first minute and all three are a page-turn away
 * otherwise. Only the bestiary's seventy-seven entries carry them; the animals
 * and everyday mortals have compact blocks with none of it, and get nothing.
 */
/**
 * What this particular hex gives a forager, on top of the usual.
 *
 * Fifty of the Campaign Book's hexes grant something the foraging tables know
 * nothing about — a stand of Wolfsbane, a patch of Sage Toe — and the note is
 * always written the same way: so many portions of a named thing, with the book
 * it is described in. The die is rolled here rather than left to the Referee,
 * and the name carries a link to the page that says what it does.
 *
 * "DPB" is the Player's Book's Common Fungi and Herbs table on p130; a bare
 * page number is the Campaign Book's own treasure chapter.
 */
async function hexForageLine(hex: string | undefined): Promise<{ html: string; dice: Roll[] }> {
  const here = hexInfo(hex);
  if (!here?.forage) {
    return {
      html: '<p class="dw-day-roll-note">Some hexes list their own plants or fungi, instead of or as well as this. Type the hex on the bar and it is rolled here.</p>',
      dice: [],
    };
  }
  const dice: Roll[] = [];
  const parts: string[] = [];
  // "1d3 portions of Hogscap (DPB) or Prancing Mandrake (p430)" — the second
  // choice inherits the first one's count rather than restating it, so it is
  // written back in before anything is matched.
  const spelled = here.forage.replace(
    /(([0-9]+d[0-9]+|[0-9]+)[ ]+(?:portions? of[ ]+)?)[A-Za-z'’ -]+?[ ]*[(](?:DPB|p[0-9]{1,3})[)][ ]+(?:or|and)[ ]+(?![0-9])/g,
    (whole, lead) => whole + lead
  );
  const pattern = /([0-9]+d[0-9]+|[0-9]+)[ ]+(?:portions? of[ ]+)?([A-Za-z'’ -]+?)[ ]*[(](DPB|p[0-9]{1,3})[)]/g;
  for (let hit = pattern.exec(spelled); hit; hit = pattern.exec(spelled)) {
    const [, formula, name, source] = hit;
    let howMany = Number(formula);
    if (/d/.test(formula)) {
      const die = await rollDice(formula);
      dice.push(die);
      howMany = total(die);
    }
    const where =
      source === "DPB" ? bookRef("players", 130, escapeHTML(name.trim())) : bookRef("campaign", Number(source.slice(1)), escapeHTML(name.trim()));
    parts.push(`<strong>${howMany}</strong> &times; ${where}${/d/.test(formula) ? ` (${formula})` : ""}`);
  }
  if (!parts.length) {
    return {
      html: `<p class="dw-day-roll-note">${escapeHTML(here.hex)} also grants: ${escapeHTML(here.forage)}</p>`,
      dice: [],
    };
  }
  const joiner = / or /.test(here.forage) ? " <em>or</em> " : " and ";
  return {
    html: `<p class="dw-day-roll-yield"><i class="fas fa-seedling"></i>
        This hex as well: ${parts.join(joiner)} &middot; ${escapeHTML(here.hex)} ${escapeHTML(here.name)},
        ${bookRef("campaign", here.page, "Campaign Book p" + here.page)}</p>`,
    dice,
  };
}

/**
 * What the thing is, in three plain lines.
 *
 * Printed on the card rather than hidden behind a button, because it is the
 * one thing a Referee needs in the first second of an encounter and the one
 * thing the stat line does not say. Written for this module — the books' own
 * descriptions stay in the books, and the page reference beside it opens them.
 */
function creatureFlavour(name: string | undefined): string {
  const book = creatureEntry(name, monsterInfo(name)?.page);
  if (!book?.flavour?.length) return "";
  return `<ul class="dw-encounter-flavour">${book.flavour
    .map((line) => `<li>${escapeHTML(line)}</li>`)
    .join("")}</ul>`;
}

function creatureStatLine(name: string | undefined): string {
  const book = creatureEntry(name, monsterInfo(name)?.page);
  const bits = [
    book?.level !== undefined ? `Level <strong>${book.level}</strong>` : "",
    book?.ac !== undefined ? `AC <strong>${book.ac}</strong>` : "",
    hpBit(book),
    book?.kind ? escapeHTML(book.kind) : "",
    book?.morale !== undefined ? `Morale <strong>${book.morale}</strong>` : "",
    book?.hoard ? `Hoard ${escapeHTML(book.hoard)}` : "",
    book?.behaviour ? escapeHTML(book.behaviour) : "",
  ].filter(Boolean);
  const line = bits.length ? `<p class="dw-encounter-stats">${bits.join(" &middot; ")}</p>` : "";
  // Twenty-one entries send the Referee to another book for names rather than
  // printing any. Saying where beats a button that is not there and no reason.
  // Printed only where the button cannot follow it — the wight, whose entry
  // says "Names: Not used." Everywhere else the button does the following.
  const note =
    book?.namesNote && !book.nameTable
      ? `<p class="dw-day-roll-note">Names: ${escapeHTML(book.namesNote)}</p>`
      : "";
  return line + note;
}

/**
 * The book's Hit Points as a formula, where it prints dice.
 *
 * One entry does not: the talking animal's block says "By species", which the
 * stat line prints as it stands and no button offers to roll.
 */
function rollableHP(hp: string | undefined): string | undefined {
  return hp && /^[0-9]+d[0-9]+([+-][0-9]+)?$/.test(hp) ? hp : undefined;
}

/** "HP 18 (4d8)" — the book's average, with the dice behind it. */
function hpBit(book: BestiaryEntry | undefined): string {
  if (!book?.hp) return "";
  return book.hpAverage === undefined
    ? `HP <strong>${escapeHTML(book.hp)}</strong>`
    : `HP <strong>${book.hpAverage}</strong> (${escapeHTML(book.hp)})`;
}

/**
 * Situation, Trait, Name, HP and the sheet — drawn only where there is
 * something behind them.
 *
 * Handed back **by name** rather than as a list. They were read by index, and
 * the Name button landing at index 2 meant the encounter card drew Name where
 * it meant to draw the sheet — it never showed an Open button at all. A caller
 * that wants four of the five now says which four.
 */
function creatureButtons(
  name: string | undefined,
  uuid?: string,
  count?: number
): Record<"situation" | "trait" | "name" | "hp" | "map", string> {
  const book = creatureEntry(name, monsterInfo(name)?.page);
  const held = escapeHTML(name ?? "");
  return {
    situation: book?.encounters?.length
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="situation" data-name="${held}"
           title="The Monster Book's own suggestion for what this creature is in the middle of — a whole situation rather than a bare sighting.">
          <i class="fas fa-masks-theater"></i> Situation
         </button>`
      : "",
    trait: book?.traits?.length
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="trait" data-name="${held}"
           title="One detail that tells this individual apart from the rest of its kind.">
          <i class="fas fa-fingerprint"></i> Trait
         </button>`
      : "",
    name: book?.names?.length || book?.nameTable
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="name" data-name="${held}"
           title="One of the book's example names for this kind of creature. A named thing is harder to kill and easier to remember.">
          <i class="fas fa-signature"></i> Name
         </button>`
      : "",
    hp: rollableHP(book?.hp)
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="hp" data-name="${held}" data-count="${Math.max(count ?? 1, 1)}"
           title="Hit Points for each of them, on the book's own dice. The stat line carries the book's average, which is what most encounters ever need.">
          <i class="fas fa-heart-pulse"></i> HP
         </button>`
      : "",
    map: `<button type="button" class="dw-encounter-btn" data-encounter-action="map" data-name="${held}" data-count="${Math.max(count ?? 1, 1)}"
           title="Put them on the battle map: one token each, at the middle of the view. An actor of this name is used where the world has one; otherwise a bare one is made, carrying nothing but the name.">
          <i class="fas fa-chess-pawn"></i> To the map
         </button>`,
  };
}

/**
 * The card.
 *
 * Built as one string rather than a template because it is also rebuilt by the
 * follow-up buttons, and a Handlebars round trip for a card that already knows
 * everything it needs would only add a file to keep in step.
 */
function encounterCard(r: EncounterResult): string {
  const reaction = r.reaction ? reactionFor(r.reaction.roll) : undefined;
  const period = r.period === "day" ? "daytime" : "night";

  const where = r.unseason
    ? `<p class="dw-day-roll-sub">${escapeHTML(r.unseason === "chame" ? "Chame" : "Vague")} has taken over the tables (2-in-6, Campaign Book p111); 1d10 = ${r.entryRoll}</p>`
    : `<p class="dw-day-roll-sub">${escapeHTML(r.tableLabel ?? "")}${
        r.typeRoll !== undefined
          ? ` &mdash; 1d8 = ${r.typeRoll} on the ${escapeHTML(ENCOUNTER_TYPES[r.column ?? "road"].label)} column`
          : " &mdash; rolled directly, as the book directs for rivers and lakes"
      }; 1d20 = ${r.entryRoll}${
        r.numberFormula ? `; number ${escapeHTML(r.numberFormula)} = ${r.number}` : ""
      }</p>`;

  const reference = r.reference
    ? `<p class="dw-day-roll-consequence">A named being rather than a group: ${escapeHTML(r.reference)} of the Campaign Book.</p>`
    : "";
  const noNumber =
    !r.reference && r.number === undefined
      ? `<p class="dw-day-roll-consequence">The book gives no number for this one &mdash; it is the Referee's to decide.</p>`
      : "";

  // Activity and reaction appear only once they have been asked for. Both are
  // optional in the book and both are buttons here, so a fresh card carries
  // just what the procedure always produces: who saw whom, and how far off.
  const facts = `<ul class="dw-encounter-facts">
      ${
        r.activity
          ? `<li><strong>Activity</strong> ${escapeHTML(r.activity)} <span class="dw-encounter-die">(1d20 = ${r.activityRoll})</span></li>`
          : ""
      }
      ${surpriseLine(r)}
      ${
        r.watch
          ? `<li><strong>Watch</strong> the ${ORDINALS[r.watch - 1]} of four <span class="dw-encounter-die">(1d4 = ${r.watch}; hours ${r.watch * 2 - 1}–${r.watch * 2} of the rest)</span> &mdash; whoever is on it is awake, and everyone asleep is automatically surprised.</li>`
          : ""
      }
      <li><strong>Distance</strong> ${escapeHTML(r.distance?.formula ?? "")} = ${r.distance?.feet} feet</li>
      ${
        r.reaction
          ? `<li><strong>Reaction</strong> ${escapeHTML(r.reaction.label)} <span class="dw-encounter-die">(2d6 = ${r.reaction.roll})</span> &mdash; ${escapeHTML(reaction?.hint ?? "")}</li>`
          : ""
      }
    </ul>`;

  const lair = lairChance(r.name, r.period);
  const bookLine = creatureBookLine(r.name, r.mark);
  const statLine = creatureStatLine(r.name) + creatureFlavour(r.name);

  const creature = creatureButtons(r.name, r.uuid, r.number);
  const buttons = [
    `<button type="button" class="dw-encounter-btn" data-encounter-action="reaction" data-period="${r.period}"
       title="How it takes the party, on 2d6 — for when that is not already obvious. The speaking character's Charisma Modifier applies when parleying (Player's Book p165).">
      <i class="fas fa-comments"></i> Reaction
     </button>`,
    creature.situation,
    creature.trait,
    `<button type="button" class="dw-encounter-btn" data-encounter-action="activity" data-period="${r.period}"
       title="What it is doing when found, on the Creature Activity d20. A prompt rather than a ruling — take another if the first says nothing to you.">
      <i class="fas fa-person-walking"></i> Activity
     </button>`,
    r.number !== undefined && lair && r.mark !== "adventurer" && r.mark !== "everyday"
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="lair" data-period="${r.period}"
           title="Wandering, or at home? ${escapeHTML(lair.source)}. In its lair there may be up to five times as many.">
          <i class="fas fa-house-crack"></i> In its lair? (${lair.percent}%)
         </button>`
      : "",
    r.activity && activityNeedsOther(r.activity)
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="other" data-period="${r.period}"
           title="This activity involves somebody else. Roll another encounter to find out who.">
          <i class="fas fa-question"></i> The other creature
         </button>`
      : "",
    creature.name,
    creature.hp,
    creature.map,
  ]
    .filter(Boolean)
    .join("");

  return `<div class="dw-day-roll dw-encounter">
      <h3><i class="fas ${r.period === "day" ? "fa-sun" : "fa-moon"}"></i> Encounter &mdash; ${period}</h3>
      <p class="dw-day-roll-headline">${encounterHeadline(r)}</p>
      ${where}
      ${reference}
      ${noNumber}
      ${facts}
      ${bookLine}
      ${statLine}
      <div class="dw-encounter-buttons">${buttons}</div>
    </div>`;
}

// ─── In town ───────────────────────────────────────────────────────────────────

/**
 * A scene off the settlement's own table.
 *
 * The Campaign Book gives each of its twelve settlements a d6 for day and
 * another for night, and what they produce is a scene rather than a creature:
 * a named local doing something, a building coming down, wagons arriving. So
 * there is no number appearing, no surprise, no encounter distance and no
 * reaction — the party has walked into a moment, not a fight, and what happens
 * next is a conversation.
 *
 * Somewhere the book does not detail, the card says so plainly instead of
 * borrowing another town's table. The duty is still ticked: "checked, and this
 * place has no table" is a finished job.
 */
async function rollSettlementScene(
  period: "day" | "night",
  result: EncounterResult,
  dice: Roll[]
): Promise<EncounterResult> {
  const ctx = getDayContext();
  const dutyId: RollableDuty = period === "day" ? "encounter-day" : "encounter-night";
  const info = ctx.settlement === "elsewhere" ? undefined : settlementInfo(ctx.settlement);

  if (!info) {
    result.settlement = { id: "elsewhere", label: settlementLabel("elsewhere"), page: 0, roll: 0, text: "" };
    await setDutyResult(dutyId, resultPatch(period, result));
    await whisperToGMs(
      `<div class="dw-day-roll">
        <h3><i class="fas fa-house-chimney"></i> Encounter &mdash; ${period === "day" ? "daytime" : "night"} in town</h3>
        <p class="dw-day-roll-headline">Something happens &mdash; but there is no table for it.</p>
        <p class="dw-day-roll-sub">1d6 = ${result.roll}, against ${result.chance}-in-6</p>
        <p class="dw-day-roll-note">The Campaign Book prints encounter tables for twelve settlements only. Name one in the bar's context row to roll on it, or invent this one &mdash; the roll says only that something happened.</p>
      </div>`,
      dice
    );
    return result;
  }

  const die = await rollDice("1d6");
  dice.push(die);
  const which = total(die);
  result.settlement = {
    id: info.id,
    label: info.label,
    page: info.page,
    roll: which,
    text: SETTLEMENT_ENCOUNTERS[info.id][period][which - 1],
  };

  await setDutyResult(dutyId, resultPatch(period, result));
  await whisperToGMs(settlementCard(result), dice);
  return result;
}

function settlementCard(r: EncounterResult): string {
  const s = r.settlement;
  if (!s) return "";
  return `<div class="dw-day-roll dw-encounter">
      <h3><i class="fas fa-house-chimney"></i> ${escapeHTML(s.label)} &mdash; ${r.period === "day" ? "daytime" : "night"}</h3>
      <p class="dw-encounter-scene">${escapeHTML(s.text)}</p>
      <p class="dw-day-roll-sub">1d6 = ${s.roll} &middot; Campaign Book p${s.page}</p>
      <div class="dw-encounter-buttons">
        <button type="button" class="dw-encounter-btn" data-encounter-action="settlement" data-period="${r.period}"
          title="Another scene from the same table.">
          <i class="fas fa-arrows-rotate"></i> Another
        </button>
      </div>
    </div>`;
}

/** Another scene from the same table, standing in place of the first. */
async function rerollSettlement(period: "day" | "night"): Promise<void> {
  if (!isGM()) return;
  const stored = storedEncounter(period);
  if (!stored?.settlement || !stored.settlement.page) return;

  const id = stored.settlement.id as Settlement;
  const table = SETTLEMENT_ENCOUNTERS[id];
  if (!table) return;

  const die = await rollDice("1d6");
  const which = total(die);
  const next: EncounterResult = {
    ...stored,
    settlement: { ...stored.settlement, roll: which, text: table[period][which - 1] },
  };
  await setDutyResult(period === "day" ? "encounter-day" : "encounter-night", resultPatch(period, next));
  await whisperToGMs(settlementCard(next), [die]);
}
// ─── The card's own buttons ────────────────────────────────────────────────────

/**
 * Wire the follow-up buttons on an encounter card.
 *
 * Each posts its own small card with its own dice rather than editing the one
 * it was clicked on: Dice So Nice animates what arrives with a *new* message,
 * and the original card is the record of what was first rolled. Where the
 * answer changes the day — a re-rolled reaction — the stored result is updated
 * too, so the strip and the card do not drift apart.
 */
/**
 * Every way the three books are cited, on a card or in a sentence.
 *
 * Both apostrophes, because the module writes one and the books the other, and
 * both the long names and the short forms the books themselves cross-reference
 * with.
 */
const BOOK_REFERENCE = /(Player['’]s Book|Campaign Book|Monster Book|DPB|DCB|DMB) +p[.]? ?([0-9]{1,3})/g;

const BOOK_BY_NAME: Record<string, BookId> = {
  "player's book": "players",
  "player’s book": "players",
  dpb: "players",
  "campaign book": "campaign",
  dcb: "campaign",
  "monster book": "monsters",
  dmb: "monsters",
};

/**
 * Turn every page reference in a card into a click.
 *
 * Done on the rendered card rather than in the strings that build it, so that
 * one pass covers every citation the module has ever written — the ones on the
 * encounter cards, the ones in a hunt's yield line, the ones a future card has
 * not been written yet to print. Text nodes only: a reference inside a tooltip
 * is an attribute, and rewriting attributes as markup is how cards break.
 */
function linkBookReferences(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest("a")) continue;
    BOOK_REFERENCE.lastIndex = 0;
    if (BOOK_REFERENCE.test(node.data)) found.push(node);
  }

  for (const node of found) {
    const pieces: Node[] = [];
    let at = 0;
    BOOK_REFERENCE.lastIndex = 0;
    for (let hit = BOOK_REFERENCE.exec(node.data); hit; hit = BOOK_REFERENCE.exec(node.data)) {
      const id = BOOK_BY_NAME[hit[1].toLowerCase()];
      const page = Number(hit[2]);
      if (!id || !page) continue;
      if (hit.index > at) pieces.push(document.createTextNode(node.data.slice(at, hit.index)));
      const link = document.createElement("a");
      link.className = "dw-book-link";
      link.dataset.book = id;
      link.dataset.bookPage = String(page);
      link.title = `Open ${BOOKS[id].label} at page ${page}.`;
      link.textContent = hit[0];
      pieces.push(link);
      at = hit.index + hit[0].length;
    }
    if (at < node.data.length) pieces.push(document.createTextNode(node.data.slice(at)));
    node.replaceWith(...pieces);
  }
}

/**
 * One handler for every page reference, however it got there.
 *
 * Exported because the day bar prints references of its own — the hex's page —
 * and a link that works in chat and not on the bar is worse than no link.
 */
export function activateBookLinks(html: HTMLElement): void {
  html.querySelectorAll<HTMLElement>(".dw-book-link").forEach((link) => {
    if (link.dataset.dwWired === "1") return;
    link.dataset.dwWired = "1";
    // A reference a player may not follow stays on the card, but stops looking
    // like a door. The page number is not a secret; the page is.
    const book = link.dataset.book as BookId | undefined;
    if (!book || !mayOpenBook(book)) {
      link.classList.remove("dw-book-link");
      link.removeAttribute("title");
      return;
    }
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const id = link.dataset.book as BookId | undefined;
      const page = Number(link.dataset.bookPage ?? "0");
      if (id && BOOKS[id] && page > 0) void BookApp.open(id, page);
    });
  });
}

export function activateEncounterChatButtons(html: HTMLElement): void {
  linkBookReferences(html);
  activateBookLinks(html);
  html.querySelectorAll<HTMLElement>(".dw-encounter-btn").forEach((button) => {
    // Never wire the same button twice: a render hook that fires more than once
    // would otherwise make one click do its work twice over.
    if (button.dataset.dwWired === "1") return;
    button.dataset.dwWired = "1";
    button.addEventListener("click", () => {
      const period = button.dataset.period === "night" ? "night" : "day";
      // Trait, situation and the sheet travel with the creature's name, so they
      // work on a hunt's card as well as an encounter's.
      const name = button.dataset.name ?? "";
      switch (button.dataset.encounterAction) {
        case "reaction":
          void rerollReaction(period);
          break;
        case "trait":
          void rollBestiaryTable(name, "traits", "Trait", "fa-fingerprint", "trait");
          break;
        case "name":
          void rollBestiaryTable(name, "names", "Name", "fa-signature", "name");
          break;
        case "situation":
          void rollBestiaryTable(name, "encounters", "Situation", "fa-masks-theater", "situation");
          break;
        case "hp":
          void rollCreatureHP(name, Number(button.dataset.count ?? "1"));
          break;
        case "map":
          void placeCreatureTokens(name, Number(button.dataset.count ?? "1"));
          break;
        case "settlement":
          void rerollSettlement(period);
          break;
        case "activity":
          void rerollActivity(period);
          break;
        case "lair":
          void rollLairCheck(period);
          break;
        case "other":
          void rollOtherCreature(period);
          break;
      }
    });
  });
}

/** Roll the reaction again, and let the new one stand as today's. */
async function rerollReaction(period: "day" | "night"): Promise<void> {
  if (!isGM()) return;
  const stored = storedEncounter(period);
  if (!stored?.happened) return;

  const die = await rollDice("2d6");
  const roll = total(die);
  const reaction = reactionFor(roll);
  await setDutyResult(
    period === "day" ? "encounter-day" : "encounter-night",
    resultPatch(period, { ...stored, reaction: { roll, label: reaction.label } })
  );
  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas fa-comments"></i> Reaction &mdash; ${escapeHTML(stored.name ?? "")}</h3>
      <p class="dw-day-roll-headline">${escapeHTML(reaction.label)}</p>
      <p class="dw-day-roll-sub">2d6 = ${roll}</p>
      <p class="dw-day-roll-consequence">${escapeHTML(reaction.hint)}</p>
      <p class="dw-day-roll-note">Add the speaking character's Charisma Modifier by hand when this was a parley (Player's Book p165).</p>
    </div>`,
    [die]
  );
}

/**
 * Spin the activity again.
 *
 * The Campaign Book calls this table optional and describes it as a spark for
 * "a quick idea about what the creature is doing" — so a result that sparks
 * nothing is worth nothing, and taking another costs the fiction less than a
 * Referee sitting with one they cannot use. The new one stands as today's, and
 * its card carries the buttons the new activity earns.
 */
async function rerollActivity(period: "day" | "night"): Promise<void> {
  if (!isGM()) return;
  const stored = storedEncounter(period);
  if (!stored?.happened) return;

  const die = await rollDice("1d20");
  const roll = total(die);
  const activity = ACTIVITIES[roll - 1];
  await setDutyResult(
    period === "day" ? "encounter-day" : "encounter-night",
    resultPatch(period, { ...stored, activity, activityRoll: roll })
  );

  const buttons =
    `<button type="button" class="dw-encounter-btn" data-encounter-action="activity" data-period="${period}"
        title="Once more."><i class="fas fa-arrows-rotate"></i> Again</button>` +
    (activityNeedsOther(activity)
      ? `<button type="button" class="dw-encounter-btn" data-encounter-action="other" data-period="${period}"
           title="This activity involves somebody else. Roll another encounter to find out who.">
          <i class="fas fa-question"></i> The other creature
         </button>`
      : "");

  await whisperToGMs(
    `<div class="dw-day-roll dw-encounter">
      <h3><i class="fas fa-person-walking"></i> Activity &mdash; ${escapeHTML(stored.name ?? "")}</h3>
      <p class="dw-day-roll-headline">${escapeHTML(activity)}</p>
      <p class="dw-day-roll-sub">1d20 = ${roll}</p>
      <div class="dw-encounter-buttons">${buttons}</div>
    </div>`,
    [die]
  );
}

/**
 * The bestiary's own two tables for a creature: a trait and a situation.
 *
 * Both answer the question a rolled name leaves behind — *and what is it
 * actually doing, and what does this one look like?* — and both are a d4 or d6
 * the Referee would otherwise turn a page for. They are buttons rather than
 * part of the first card because neither is always wanted: a creature glimpsed
 * across a valley needs no fingerprint.
 */
async function rollBestiaryTable(
  name: string,
  key: "traits" | "encounters" | "names",
  label: string,
  icon: string,
  action: string
): Promise<void> {
  if (!isGM()) return;
  const info = monsterInfo(name);
  const entry = creatureEntry(name, info?.page);
  // Where the bestiary prints no names of its own but points at a naming table
  // in one of the other books, that table is rolled on instead of the pointer
  // being read out.
  if (key === "names" && !entry?.names?.length && entry?.nameTable) {
    await rollNameFromTable(name, entry.nameTable, info?.page);
    return;
  }
  const rows = entry?.[key];
  if (!rows?.length) return;

  const die = await rollDice(`1d${rows.length}`);
  const which = total(die);

  await whisperToGMs(
    `<div class="dw-day-roll dw-encounter">
      <h3><i class="fas ${icon}"></i> ${escapeHTML(label)} &mdash; ${escapeHTML(name)}</h3>
      <p class="dw-encounter-scene">${escapeHTML(rows[which - 1])}</p>
      <p class="dw-day-roll-sub">1d${rows.length} = ${which} &middot; Monster Book p${info?.page}</p>
      <div class="dw-encounter-buttons">
        <button type="button" class="dw-encounter-btn" data-encounter-action="${action}" data-name="${escapeHTML(name)}"
          title="Another."><i class="fas fa-arrows-rotate"></i> Again</button>
      </div>
    </div>`,
    [die]
  );
}

/**
 * The little of a Scene and an Actor that placing a token actually touches.
 *
 * Written out here rather than reached for through the system's own types,
 * which differ between systems and between Foundry versions; these five members
 * are core and have not moved.
 */
interface SceneLike {
  grid?: { size?: number };
  createEmbeddedDocuments: (name: string, data: Record<string, unknown>[]) => Promise<unknown>;
}

interface ActorLike {
  id?: string;
  getTokenDocument: (data: Record<string, unknown>) => Promise<{ toObject: () => Record<string, unknown> }>;
}

/**
 * Put what was met on the battle map.
 *
 * The Referee has already rolled the creature and the number; carrying both
 * across to the canvas by hand is the one part of an encounter that is pure
 * clerical work. One token per creature, laid out around the middle of the
 * current view.
 *
 * **The name is enough.** Where the world or a compendium already holds an
 * actor of that name it is used, statistics and artwork and all. Where it does
 * not — most of the Monster Book, in most worlds — a bare actor is made
 * carrying nothing but the name, which is what a Referee running out of the
 * book needs anyway: the numbers are on the card and in the book, and what the
 * map is for is knowing who is standing where.
 */
async function placeCreatureTokens(name: string, count: number): Promise<void> {
  if (!isGM()) return;
  const scene = (canvas as unknown as { scene?: SceneLike }).scene;
  if (!scene) {
    ui.notifications?.warn("There is no scene in view to put them on.");
    return;
  }

  const actor = await findOrMakeCreatureActor(name);
  if (!actor) return;

  const wanted = Math.max(Number.isFinite(count) ? count : 1, 1);
  const howMany = Math.min(wanted, 30);
  const grid = scene.grid?.size ?? 100;
  const stage = (canvas as unknown as { stage?: { pivot?: { x: number; y: number } } }).stage;
  const middle = { x: stage?.pivot?.x ?? 0, y: stage?.pivot?.y ?? 0 };
  const perRow = Math.max(1, Math.ceil(Math.sqrt(howMany)));

  const tokens: Record<string, unknown>[] = [];
  for (let i = 0; i < howMany; i++) {
    const column = i % perRow;
    const row = Math.floor(i / perRow);
    const x = middle.x + (column - (perRow - 1) / 2) * grid;
    const y = middle.y + (row - (Math.ceil(howMany / perRow) - 1) / 2) * grid;
    const doc = await actor.getTokenDocument({
      x: Math.round(x / grid) * grid,
      y: Math.round(y / grid) * grid,
      hidden: true,
    });
    tokens.push(doc.toObject());
  }
  await scene.createEmbeddedDocuments("Token", tokens);

  ui.notifications?.info(
    `${howMany} × ${name} placed, hidden — reveal them when the party sees them.${
      wanted > howMany ? ` (${wanted} were rolled; thirty is as many as this places at once.)` : ""
    }`
  );
}

/**
 * The actor a token needs, found or made.
 *
 * A compendium entry is imported first: a token cannot point at a document
 * inside a pack, and importing is what the sidebar's own drag-and-drop does.
 */
async function findOrMakeCreatureActor(name: string): Promise<ActorLike | undefined> {
  const g = game as Game;
  const uuid = await findCreatureUuid(name);
  if (uuid) {
    const found = (await fromUuid(uuid)) as (ActorLike & { pack?: string | null }) | null;
    if (found && !found.pack) return found;
    if (found) {
      const imported = (await (
        g.actors as unknown as { importFromCompendium: (pack: unknown, id: string) => Promise<ActorLike> }
      ).importFromCompendium(g.packs?.get?.(found.pack ?? ""), found.id ?? "")) as ActorLike | undefined;
      if (imported) return imported;
    }
  }

  // Actor.create needs a type the active system actually defines — the same
  // dance the loot boxes do, and for the same reason.
  const g2 = g as unknown as {
    documentTypes?: Record<string, string[]>;
    model?: { Actor?: Record<string, unknown> };
  };
  const declared = g2.documentTypes?.Actor?.length
    ? g2.documentTypes.Actor
    : Object.keys(g2.model?.Actor ?? {});
  const types = declared.filter((t) => t !== CONST.BASE_DOCUMENT_TYPE);
  const type = types.find((t) => /monster|npc|creature/i.test(t)) ?? types[0];
  if (!type) {
    ui.notifications?.error("Cannot place a token: the game system defines no actor types.");
    return undefined;
  }

  // A picture, so that three species in the same clearing are three different
  // things on the map rather than three identical rings. Foundry's own icons —
  // the same one for the same creature every time, in every world.
  const img = creatureArt(name, creatureEntry(name, monsterInfo(name)?.page)?.kind);
  const created = await Actor.create({
    name,
    type,
    img,
    folder: await encounterFolderId(),
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    prototypeToken: {
      name,
      texture: { src: img },
      // Hostile by default: these are made by an encounter roll, and the ones
      // that turn out to be friendly are a click away from saying so.
      disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
    },
  } as Parameters<typeof Actor.create>[0]);
  return (created as ActorLike | undefined) ?? undefined;
}

/** One folder for the actors the encounter cards make, so they do not litter the tab. */
async function encounterFolderId(): Promise<string | undefined> {
  const g = game as unknown as {
    folders?: { find: (fn: (f: { name?: string; type?: string; id?: string }) => boolean) => { id?: string } | undefined };
  };
  const existing = g.folders?.find((f) => f.type === "Actor" && f.name === ENCOUNTER_FOLDER);
  if (existing?.id) return existing.id;
  const made = (await Folder.create({ name: ENCOUNTER_FOLDER, type: "Actor" } as Parameters<
    typeof Folder.create
  >[0])) as { id?: string } | undefined;
  return made?.id;
}

/**
 * Where the actors made for a map token are kept.
 *
 * Exported because the Actors sidebar has to know the same name: the folder is
 * hidden from players there, and a folder hidden under one name while actors
 * are filed under another is the kind of drift that survives for months.
 */
export const ENCOUNTER_FOLDER = "Dolmenwood Encounters";

/**
 * Hit Points for what was met, one roll per creature.
 *
 * The stat line already prints the book's average, which is what most
 * encounters ever need — this is for the ones that turn into a fight, where
 * five wolves are five different animals and one of them is the one that dies
 * first. The number encountered comes with the button, so a hunt's card rolls
 * for what it brought down and a card with no count behind it rolls one.
 *
 * Capped at twenty rolls. Past that the list stops being readable and the
 * Referee is better served by the average, which is on the card already.
 */
async function rollCreatureHP(name: string, count: number): Promise<void> {
  if (!isGM()) return;
  const info = monsterInfo(name);
  const entry = creatureEntry(name, info?.page);
  const formula = rollableHP(entry?.hp);
  if (!formula) return;

  const wanted = Math.max(Number.isFinite(count) ? count : 1, 1);
  const howMany = Math.min(wanted, 20);
  const rolls: Roll[] = [];
  for (let i = 0; i < howMany; i++) rolls.push(await rollDice(formula));
  const each = rolls.map((roll) => total(roll));
  const sum = each.reduce((a, b) => a + b, 0);

  await whisperToGMs(
    `<div class="dw-day-roll dw-encounter">
      <h3><i class="fas fa-heart-pulse"></i> Hit Points &mdash; ${escapeHTML(name)}</h3>
      <p class="dw-encounter-scene">${each.join(" &middot; ")}</p>
      <p class="dw-day-roll-sub">${howMany} &times; ${escapeHTML(formula)}${
        howMany > 1 ? ` &middot; ${sum} in all` : ""
      }${entry?.hpAverage !== undefined ? ` &middot; the book's average is ${entry.hpAverage}` : ""}${
        wanted > howMany ? ` &middot; the first ${howMany} of ${wanted}` : ""
      }</p>
      <div class="dw-encounter-buttons">
        <button type="button" class="dw-encounter-btn" data-encounter-action="hp" data-name="${escapeHTML(name)}" data-count="${wanted}"
          title="Again."><i class="fas fa-arrows-rotate"></i> Again</button>
      </div>
    </div>`,
    rolls
  );
}

/**
 * A name off one of the other books' naming tables.
 *
 * Three dice where the table has both given names and surnames: one to choose
 * which column of given names to read — a creature has *a* name, not a male one
 * and a female one — one for the row, and one for the surname. The elves' two
 * columns are rustic and courtly rather than gendered, and the saints have one
 * column and no surname at all, so the same three steps collapse where they do
 * not apply.
 */
async function rollNameFromTable(creature: string, tableId: string, page?: number): Promise<void> {
  const table = nameTable(tableId);
  if (!table) return;

  const given = givenColumns(table);
  const dice: Roll[] = [];

  let column = given[0];
  let columnLine = "";
  if (given.length > 1) {
    const columnDie = await rollDice(`1d${given.length}`);
    dice.push(columnDie);
    column = given[total(columnDie) - 1];
    columnLine = `${escapeHTML(table.columns[column])} (1d${given.length} = ${total(columnDie)})`;
  } else {
    columnLine = escapeHTML(table.columns[column]);
  }

  const rowDie = await rollDice(`1d${table.rows.length}`);
  dice.push(rowDie);
  const parts = [table.rows[total(rowDie) - 1][column]];
  let surnameLine = "";

  const surnameAt = surnameColumn(table);
  if (surnameAt >= 0) {
    const surnameDie = await rollDice(`1d${table.rows.length}`);
    dice.push(surnameDie);
    parts.push(table.rows[total(surnameDie) - 1][surnameAt]);
    surnameLine = `; surname 1d${table.rows.length} = ${total(surnameDie)}`;
  }

  await whisperToGMs(
    `<div class="dw-day-roll dw-encounter">
      <h3><i class="fas fa-signature"></i> Name &mdash; ${escapeHTML(creature)}</h3>
      <p class="dw-day-roll-headline">${escapeHTML(parts.join(" "))}</p>
      <p class="dw-day-roll-sub">${escapeHTML(table.label)} names &mdash; ${columnLine}, 1d${table.rows.length} = ${total(rowDie)}${surnameLine}</p>
      <p class="dw-day-roll-note">The Monster Book gives this creature no names of its own (p${page}) and sends you here.</p>
      <div class="dw-encounter-buttons">
        <button type="button" class="dw-encounter-btn" data-encounter-action="name" data-name="${escapeHTML(creature)}"
          title="Another."><i class="fas fa-arrows-rotate"></i> Again</button>
      </div>
    </div>`,
    dice
  );
}

/**
 * Wandering, or at home?
 *
 * The bestiary gives a lair chance per creature; where it does not, the book
 * offers a flat 30% (CB p114). This rolls that, and where it lands says what
 * the lair is worth: "up to 5 times as many individuals", which is a ceiling
 * rather than a multiplier, so both figures are printed.
 */
async function rollLairCheck(period: "day" | "night"): Promise<void> {
  if (!isGM()) return;
  const stored = storedEncounter(period);
  if (!stored?.happened || stored.number === undefined) return;
  // Nothing to roll for a creature the book says keeps no lair; the card has
  // already said so, and the button is not drawn.
  const lair = lairChance(stored.name, period);
  if (!lair) return;

  const die = await rollDice("1d100");
  const roll = total(die);
  const inLair = roll <= lair.percent;
  const dice = [die];

  // How many are actually at home.
  //
  // The book gives a ceiling and no die: "up to 5 times as many individuals may
  // be encountered in the creatures' lair". A ceiling is not something a
  // Referee can use mid-sentence, so **the multiplier is rolled on a d5** —
  // between the number that would have been wandering and five times it, which
  // is exactly the range the sentence describes. The card says the die is this
  // module's and not the book's, so a Referee who wants the maximum can take it.
  const wandering = stored.wanderingNumber ?? stored.number;
  let lairNumber = wandering;
  let numberLine = `<p class="dw-day-roll-consequence">The ${wandering === 1 ? "creature is" : "creatures are"} out on the move; the number rolled stands.</p>`;
  if (inLair) {
    const multiplierDie = await rollDice("1d5");
    dice.push(multiplierDie);
    const multiplier = total(multiplierDie);
    lairNumber = wandering * multiplier;
    numberLine = `<p class="dw-day-roll-consequence">
      <strong>${lairNumber}</strong> at home &mdash; ${wandering} &times; ${multiplier}
      <span class="dw-encounter-die">(1d5; the book gives only "up to five times as many", so the multiplier is this module's die)</span>.
      Treasure is kept in lairs, not carried.</p>`;
  }

  // The bestiary describes four lairs for most creatures that keep one, and
  // this is the moment they are worth reading: the party has just arrived at it.
  const lairs = creatureEntry(stored.name, monsterInfo(stored.name)?.page)?.lairs;
  let lairLine = "";
  if (inLair && lairs?.length) {
    const lairDie = await rollDice(`1d${lairs.length}`);
    dice.push(lairDie);
    lairLine = `<p class="dw-encounter-scene">${escapeHTML(lairs[total(lairDie) - 1])}</p>
      <p class="dw-day-roll-sub">1d${lairs.length} = ${total(lairDie)} on the Monster Book's lairs for this creature</p>`;
  }

  // The strip reads off the stored result, so the lair's number has to land
  // there too — otherwise the bar goes on saying seven while the card says
  // twenty-eight.
  const dutyId: RollableDuty = period === "day" ? "encounter-day" : "encounter-night";
  if (inLair) {
    await setDutyResult(
      dutyId,
      resultPatch(period, { ...stored, number: lairNumber, wanderingNumber: wandering, inLair: true })
    );
  } else if (stored.inLair) {
    // A second press that comes up wandering has to take the lair number back
    // off the strip, or the bar keeps reporting a lair the creatures have left.
    await setDutyResult(
      dutyId,
      resultPatch(period, { ...stored, number: wandering, wanderingNumber: undefined, inLair: undefined })
    );
  }

  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas fa-house-crack"></i> ${escapeHTML(stored.name ?? "")} &mdash; lair</h3>
      <p class="dw-day-roll-headline">${inLair ? "In its lair." : "Wandering abroad."}</p>
      <p class="dw-day-roll-sub">1d100 = ${roll}, against ${lair.percent}% &mdash; ${escapeHTML(lair.source)}.</p>
      ${numberLine}
      ${lairLine}
    </div>`,
    dice
  );
}

/**
 * The other creature in an activity that ends in "?".
 *
 * A full second encounter as the book means it (CB p114) — type roll and all —
 * but without a chance check, surprise, distance or reaction: this creature is
 * already busy with the first one, not with the party.
 */
async function rollOtherCreature(period: "day" | "night"): Promise<void> {
  if (!isGM()) return;
  const stored = storedEncounter(period);
  if (!stored?.happened) return;

  const ctx = getDayContext();
  const state = getDayState();
  const dice: Roll[] = [];

  let entries: EncounterEntry[];
  let label: string;
  let typeLine = "";
  if (ctx.region === "aquatic") {
    entries = subTable("regional", ctx.region).entries;
    label = regionInfo(ctx.region).label;
  } else {
    const column = typeColumn(period, ctx.way, state.done["fire"] === true);
    const typeDie = await rollDice("1d8");
    dice.push(typeDie);
    const table = ENCOUNTER_TYPES[column].rolls[total(typeDie) - 1];
    const sub = subTable(table, ctx.region);
    entries = sub.entries;
    label = sub.label;
    typeLine = `1d8 = ${total(typeDie)} on the ${ENCOUNTER_TYPES[column].label} column; `;
  }

  const whichDie = await rollDice("1d20");
  dice.push(whichDie);
  const [name, count, mark] = entries[total(whichDie) - 1];
  let number = "";
  if (/^(\d+d\d+|\d+)$/.test(count)) {
    const countDie = await rollDice(count);
    dice.push(countDie);
    number = ` &times;${total(countDie)}`;
  }

  // The second creature deserves the same page reference as the first.
  const otherInfo = monsterInfo(name);
  const otherBook = otherInfo
    ? `<p class="dw-encounter-book"><i class="fas fa-book-skull"></i>
        Monster Book <strong>p${otherInfo.page}</strong>${
          mark ? ` &middot; ${escapeHTML(MARK_SECTIONS[mark])}` : ""
        }</p>`
    : mark
      ? `<p class="dw-day-roll-note">${escapeHTML(MARK_NOTES[mark])}</p>`
      : "";

  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas fa-question"></i> The other creature</h3>
      <p class="dw-day-roll-headline">${escapeHTML(name)}${number}</p>
      <p class="dw-day-roll-sub">${escapeHTML(label)} &mdash; ${typeLine}1d20 = ${total(whichDie)}</p>
      <p class="dw-day-roll-consequence">${escapeHTML(stored.name ?? "The creature")} is ${escapeHTML((stored.activity ?? "").replace("?", "this one").toLowerCase())}.</p>
      ${otherBook}
    </div>`,
    dice
  );
}

// ─── Clearing ──────────────────────────────────────────────────────────────────

/** Take a roll back, so it can be made again. Unticks the duty with it. */
export async function clearDayRoll(dutyId: RollableDuty): Promise<void> {
  if (!isGM()) return;
  if (dutyId === "weather") await setDutyResult("weather", { weather: undefined });
  else if (dutyId === "lost") await setDutyResult("lost", { lost: undefined });
  else if (dutyId === "forage") await setDutyResult("forage", { food: undefined });
  else if (dutyId === "encounter-day") await setDutyResult(dutyId, { encounterDay: undefined });
  else await setDutyResult(dutyId, { encounterNight: undefined });
}

export type RollableDuty = "weather" | "lost" | "forage" | "encounter-day" | "encounter-night";

/** Which duties roll on a table rather than merely being ticked off. */
export const ROLLABLE_DUTIES = new Set<string>([
  "weather",
  "lost",
  "forage",
  "encounter-day",
  "encounter-night",
]);

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

  if (dutyId === "encounter-day" || dutyId === "encounter-night") {
    const e = dutyId === "encounter-day" ? state.encounterDay : state.encounterNight;
    if (!e) return undefined;
    if (!e.happened) return `Nothing (${e.roll} vs ${e.chance}-in-6)`;
    if (e.settlement) {
      if (!e.settlement.text) return "Something — no table for this place";
      // The scenes are whole sentences; the strip has room for the opening of one.
      const text = e.settlement.text;
      return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
    }
    const number = e.number !== undefined ? ` ×${e.number}` : "";
    const lair = e.inLair ? " in lair" : "";
    return `${e.name}${number}${lair}${e.reaction ? ` — ${e.reaction.label.toLowerCase()}` : ""}`;
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
