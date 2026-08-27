import { escapeHTML } from "../helpers/handlebars";
import { announce, isGM, rollDice, total, whisperToGMs } from "./rollCard";
import { abilityCheck } from "./checks";
import { bookRef } from "./books";
import { getDayContext, seasonInfo } from "./dayContext";
import { getDayState, setCampResult } from "./dayDuties";
import { consumeFood, setAte, setSleptWell } from "./characterDay";
import { ABILITIES, getSystemFields } from "./characterSheet";
import {
  CAMP_ACTIVITIES,
  FIRE_AUTOMATIC,
  MIN_SLEEP_HOURS,
  hoursLabel,
  watchShares,
  NIGHT_HOURS,
  SLEEP_DIFFICULTIES,
  fallAsleepFaces,
  fellAsleepOnWatch,
  fireLit,
  firewoodHours,
  planSleep,
  restModifier,
  sleepDifficulty,
  type Bedding,
  type CampActivity,
  type CampActivityResult,
  type CampState,
  type FirewoodGatherer,
  type MealResult,
  type SleeperResult,
  type WatchKeeper,
} from "./camping";

/**
 * The camp's rolls: firewood, the fire, supper, songs, the watch, and the night
 * itself (Player's Book p158-159).
 *
 * **The rolls are the Referee's; the results are the table's.** Camping is
 * resolved by one person with the book open, but what comes of it is something
 * the characters live through — how much wood came back, whether the fire took,
 * how supper turned out, who slept — so those cards are **announced to
 * everyone** (Leander's ruling, 2026-08-27).
 *
 * **The watch is the exception and stays whispered.** Falling asleep on watch is
 * the one camp result the characters would not know: a watcher who nodded off
 * did not notice doing it, and the table finding out from a chat card would rob
 * the Referee of the only interesting thing about the rule.
 *
 * **Who rolled it is asked, never guessed.** Leander's instruction, and it is
 * the right one: a Wisdom Check has to be *somebody's* Wisdom Check, so the
 * dialog names the character and prints the score it is about to use. The
 * module will not pick a cook for the party.
 *
 * The arithmetic is all in `camping.ts` and checked offline. What lives here is
 * dice, chat, and the two writes that reach out of the day: `setSleptWell`,
 * which is what makes a bad night cost exhaustion tomorrow, and nothing else.
 */

// ─── Small shared pieces ──────────────────────────────────────────────────────

const nameOf = (actor: Actor): string => actor.name ?? "Someone";

function actorById(id: string): Actor | undefined {
  return (game as Game).actors?.get(id) ?? undefined;
}

/** A signed number the way a card should print it: "+1", "−2", or nothing at all. */
function signed(n: number): string {
  if (n === 0) return "";
  return n > 0 ? ` + ${n}` : ` − ${Math.abs(n)}`;
}

function card(icon: string, title: string, body: string): string {
  return `<div class="dw-day-roll">
      <h3><i class="fas ${icon}"></i> ${escapeHTML(title)}</h3>
      ${body}
    </div>`;
}

/** One row per character — the shape every camp card but the fire's uses. */
function rows(lines: string[]): string {
  return `<ul class="dw-camp-rows">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
}

/** Today's camp record, or an empty one. Never undefined, so callers may read through. */
export function getCampState(): CampState {
  return getDayState().camp ?? {};
}

// ─── Fetching firewood ────────────────────────────────────────────────────────

export interface Gatherer {
  actorId: string;
  name: string;
}

/**
 * Each character who went for wood brings back 1d6 hours of fire, less whatever
 * the weather costs.
 *
 * One roll per gatherer rather than one roll times a headcount: the book says
 * "each character who goes fetching wood can collect enough to keep a campfire
 * burning for 1d6 hours", and a party of four in the rain wants to see which of
 * them came back empty-handed.
 */
export async function rollFirewood(
  gatherers: Gatherer[],
  modifier: number
): Promise<void> {
  if (!isGM() || !gatherers.length) return;

  const dice: Roll[] = [];
  const results: FirewoodGatherer[] = [];
  for (const g of gatherers) {
    const die = await rollDice("1d6");
    dice.push(die);
    const roll = total(die);
    results.push({ name: g.name, roll, hours: firewoodHours(roll, modifier) });
  }

  const hours = results.reduce((sum, r) => sum + r.hours, 0);
  await setCampResult("firewood", { firewood: { modifier, hours, gatherers: results } });

  const lines = results.map(
    (r) =>
      `<strong>${escapeHTML(r.name)}</strong> — 1d6 = ${r.roll}${signed(modifier)} → ${
        r.hours === 0 ? "nothing usable" : `${r.hours} hour${r.hours === 1 ? "" : "s"}`
      }`
  );

  // What the number is actually for: whether the fire is still burning when the
  // party beds down, which is the one row of the Sleep Difficulty table that
  // moves.
  const shortfall =
    hours === 0
      ? `<p class="dw-day-roll-headline is-bad">No firewood at all.</p>`
      : hours < NIGHT_HOURS
        ? `<p class="dw-day-roll-consequence">Enough for ${hours} of the night's ${NIGHT_HOURS} hours — the fire will not see them to morning unless it is fed from the packs.</p>`
        : `<p class="dw-day-roll-consequence">Enough to burn through the night.</p>`;

  await announce(
    card(
      "fa-fire-burner",
      "Fetching firewood",
      `<p class="dw-day-roll-headline">${hours} hour${hours === 1 ? "" : "s"} of campfire</p>
       <p class="dw-day-roll-sub">${gatherers.length} gathering${
         modifier ? `, ${modifier} for the conditions` : ""
       } &middot; ${bookRef("players", 158, "Player's Book p158")}</p>
       ${rows(lines)}
       ${shortfall}`
    ),
    dice
  );
}

// ─── Building a fire ──────────────────────────────────────────────────────────

/**
 * A chance, not a check: at or under the Referee's number lights it, and a 6
 * means they judged no roll was needed at all.
 *
 * The woodpile is reported but never enforced. A party may be carrying wood in
 * their packs, and a module that refused to light a fire because nobody rolled
 * the firewood duty would be wrong more often than right.
 */
export async function rollFire(chance: number): Promise<void> {
  if (!isGM()) return;

  const wood = getCampState().firewood;
  const dice: Roll[] = [];
  let roll: number | undefined;
  let lit = true;

  if (chance < FIRE_AUTOMATIC) {
    const die = await rollDice("1d6");
    dice.push(die);
    roll = total(die);
    lit = fireLit(roll, chance);
  }

  await setCampResult("fire", { fire: { lit, chance, ...(roll === undefined ? {} : { roll }) } });

  const how =
    roll === undefined
      ? "Normal conditions — a tinder box and a stash of wood is all it takes."
      : `1d6 = ${roll} against a ${chance}-in-6 chance.`;

  const woodLine =
    wood === undefined
      ? ""
      : wood.hours === 0
        ? `<p class="dw-day-roll-consequence">Nobody brought back usable wood — whatever burns here came out of the packs.</p>`
        : `<p class="dw-day-roll-sub">${wood.hours} hour${wood.hours === 1 ? "" : "s"} of wood gathered.</p>`;

  await announce(
    card(
      "fa-fire",
      "Building a fire",
      `<p class="dw-day-roll-headline${lit ? "" : " is-bad"}">${
        lit ? "The fire catches" : "No fire tonight"
      }</p>
       <p class="dw-day-roll-sub">${escapeHTML(how)}</p>
       ${woodLine}
       <p class="dw-day-roll-consequence">${
         lit
           ? "A campfire moves the Sleep Difficulty table in the party's favour — for everyone who has bedding."
           : "Sleep is rolled from the no-fire rows of the Sleep Difficulty table."
       }</p>`
    ),
    dice
  );
}

// ─── Cooking and camaraderie ──────────────────────────────────────────────────

/**
 * An Ability Check made by one named character, and a Save Versus Doom if the
 * die comes up 1.
 *
 * Both evening activities are this function; only the ability and the words
 * change. The save is rolled here rather than left to the Referee because a
 * natural 1 is exactly the moment a table forgets there is a save at all — but
 * a character sheet with no save target on it is not guessed at: the card says
 * so and leaves the ruling where it belongs.
 */
export interface MealChoice {
  /** Rows to empty into the pot, each with how many portions to take from it. */
  ingredients: { holderId: string; holderName: string; itemId: string; itemName: string; portions: number }[];
}

/**
 * @param doomTarget What to save against on a natural 1, where the sheet has no
 * Doom target of its own. Asked for on the form rather than invented here: a
 * world whose characters carry no saves would otherwise never see this branch,
 * which is exactly the complaint that produced it.
 */
export async function rollCampActivity(
  activity: CampActivity,
  actorId: string,
  meal?: MealChoice,
  doomTarget?: number
): Promise<void> {
  if (!isGM()) return;
  const actor = actorById(actorId);
  if (!actor) return;

  const spec = CAMP_ACTIVITIES[activity];
  const sys = getSystemFields(actor);
  const modifier = sys.scores[spec.ability].bonus;
  const abilityLabel = ABILITIES.find((a) => a.key === spec.ability)?.label ?? spec.ability;

  const die = await rollDice("1d6");
  const dice = [die];
  const roll = total(die);
  const outcome = abilityCheck(roll, modifier);

  const result: CampActivityResult = {
    activity,
    actorId,
    name: nameOf(actor),
    roll,
    modifier,
    success: outcome.success,
    ...(outcome.natural ? { natural: outcome.natural } : {}),
  };

  // Only a natural 1 calls for the save — a check that merely fails produces a
  // dull supper, not a disaster.
  let doomLine = "";
  if (outcome.natural === "fail") {
    // The sheet's own number wins; the form's is the fallback for a world whose
    // characters carry no saves yet.
    const target = sys.saves.doom > 0 ? sys.saves.doom : (doomTarget ?? 0);
    if (target > 0) {
      const saveDie = await rollDice("1d20");
      dice.push(saveDie);
      const saveRoll = total(saveDie);
      // The d20 absolutes, the same ones the attribute sheet's saves use.
      const saved = saveRoll === 20 ? true : saveRoll === 1 ? false : saveRoll >= target;
      result.doom = { roll: saveRoll, target, saved };
      doomLine = `<p class="dw-day-roll-consequence"><strong>Save Versus Doom:</strong> 1d20 = ${saveRoll} against ${target}+ — ${
        saved ? "saved." : escapeHTML(spec.doom)
      }</p>`;
    } else {
      doomLine = `<p class="dw-day-roll-consequence"><strong>Save Versus Doom</strong> is called for, and this sheet carries no Doom target — the Referee rules it. On a failure: ${escapeHTML(
        spec.doom
      )}</p>`;
    }
  }

  // ── The pot ───────────────────────────────────────────────────────────────
  //
  // The ingredients are spent whatever the dice said: a dull supper is still a
  // supper, and the book only *wastes* them on a natural 1 whose Save Versus
  // Doom then fails.
  //
  // **Nobody eats here.** Who sits down to the meal is asked *after* the dice,
  // on Leander's instruction and for a good reason: until the die is thrown
  // there may be nothing to eat, and asking who wants a share of a ruined
  // supper is a question with no answer. `serveMeal` is the second half.
  let mealLine = "";
  if (meal && meal.ingredients.length) {
    const ruined = result.doom?.saved === false;
    const spent: MealResult["ingredients"] = [];
    let portions = 0;

    for (const ing of meal.ingredients) {
      const holder = actorById(ing.holderId);
      if (!holder) continue;
      const taken = await consumeFood(holder, ing.itemId, ing.portions);
      if (taken <= 0) continue;
      spent.push({ name: ing.itemName, holder: ing.holderName, portions: taken });
      portions += taken;
    }

    result.meal = { ingredients: spent, portions, eaters: [], ruined };

    const spentLine = spent
      .map((s) => `${s.portions} × ${escapeHTML(s.name)} (${escapeHTML(s.holder)})`)
      .join(", ");
    mealLine = `<p class="dw-day-roll-yield"><strong>Into the pot:</strong> ${
      spentLine || "nothing"
    } — ${portions} portion${portions === 1 ? "" : "s"}.</p>
      ${
        ruined
          ? `<p class="dw-day-roll-headline is-bad">Wasted. Nobody eats tonight.</p>`
          : ""
      }`;
  }

  await setCampResult(spec.dutyId, { [activity]: result } as Partial<CampState>);

  await announce(
    card(
      spec.icon,
      spec.label,
      `<p class="dw-day-roll-headline${outcome.success ? "" : " is-bad"}">${escapeHTML(
        nameOf(actor)
      )} — ${outcome.success ? "success" : "failure"}</p>
       <p class="dw-day-roll-sub">${escapeHTML(abilityLabel)} Check. ${escapeHTML(
         outcome.explain
       )}</p>
       <p class="dw-day-roll-consequence">${escapeHTML(
         outcome.success ? spec.success : spec.failure
       )}</p>
       ${doomLine}
       ${mealLine}
       <p class="dw-day-roll-sub">${bookRef("players", 158, "Player's Book p158")}</p>`
    ),
    dice
  );
}

/**
 * Serve what the cook produced — the second half of the meal.
 *
 * Kept apart from the roll because the two questions belong at different
 * moments: the ingredients are chosen before anybody knows how it turns out,
 * and the diners after. Feeds one portion a head, in the order given, until the
 * pot is empty — a meal that feeds four does not feed five by being shared.
 */
export async function serveMeal(eaterIds: string[]): Promise<void> {
  if (!isGM()) return;
  const cooking = getCampState().cooking;
  const meal = cooking?.meal;
  if (!cooking || !meal || meal.ruined) return;

  const fed: string[] = [];
  for (const eaterId of eaterIds) {
    if (fed.length >= meal.portions) break;
    const eater = actorById(eaterId);
    if (!eater) continue;
    await setAte(eater, true);
    fed.push(nameOf(eater));
  }
  if (!fed.length) return;

  const left = meal.portions - fed.length;
  await setCampResult(CAMP_ACTIVITIES.cooking.dutyId, {
    cooking: { ...cooking, meal: { ...meal, eaters: fed } },
  });

  await announce(
    card(
      "fa-drumstick-bite",
      "Supper",
      `<p class="dw-day-roll-headline">${fed.map((n) => escapeHTML(n)).join(", ")}</p>
       <p class="dw-day-roll-sub">${fed.length} of ${meal.portions} portion${
         meal.portions === 1 ? "" : "s"
       } eaten${left ? `, ${left} left over` : ""}.</p>
       <p class="dw-day-roll-consequence">Their hunger is settled for today.</p>`
    )
  );
}

// ─── Watches through the night ────────────────────────────────────────────────

export interface WatchKeeperChoice {
  actorId: string;
  name: string;
  constitution: number;
  /** Which watch they stand, first to last. The Referee sets it in the dialog. */
  order: number;
}

/**
 * The watch order, the hours it costs, and the optional falling-asleep rule.
 *
 * **The order is the Referee's**, set in the dialog and carried here as a
 * number — the book leaves it to the table, and it matters for narration rather
 * than arithmetic. What *is* arithmetic is the division: the night splits evenly
 * among however many stand watch, and **three watchers over eight hours leave
 * each other five hours and twenty minutes of sleep**, which is under the six
 * the book requires. That is the answer this roll hands to the sleep roll, so
 * nobody has to notice it by hand.
 *
 * The falling-asleep chance is flagged in the book as slapstick and is treated
 * that way: rolled because it is stat-driven and fiddly to look up, and then
 * read by nothing. A broken watch order is a Referee's narration, not a penalty
 * a module can compute.
 */
export async function rollWatches(
  keepers: WatchKeeperChoice[],
  nightHours = NIGHT_HOURS
): Promise<void> {
  if (!isGM() || !keepers.length) return;

  const share = watchShares(keepers.length, nightHours);
  const inOrder = [...keepers].sort((a, b) => a.order - b.order);

  const dice: Roll[] = [];
  const results: WatchKeeper[] = [];
  for (const [index, k] of inOrder.entries()) {
    const faces = fallAsleepFaces(k.constitution);
    const die = await rollDice(`1d${faces}`);
    dice.push(die);
    const roll = total(die);
    results.push({
      actorId: k.actorId,
      name: k.name,
      // Renumbered 1..n after sorting, so two rows given the same number by a
      // hurried Referee still come out as distinct watches.
      order: index + 1,
      hoursOnWatch: share.hoursOnWatch,
      hoursAsleep: share.hoursAsleep,
      faces,
      roll,
      asleep: fellAsleepOnWatch(roll),
    });
  }

  await setCampResult("watches", {
    watches: { nightHours, shortNight: share.shortNight, keepers: results },
  });

  const asleep = results.filter((r) => r.asleep);
  const lines = results.map(
    (r) =>
      `<strong>${r.order}. ${escapeHTML(r.name)}</strong> — ${hoursLabel(
        r.hoursOnWatch
      )} on watch, 1-in-${r.faces}, rolled ${r.roll} → ${
        r.asleep ? "<em>nods off</em>" : "stays awake"
      }`
  );

  await whisperToGMs(
    card(
      "fa-tower-observation",
      "Watches through the night",
      `<p class="dw-day-roll-headline${asleep.length ? " is-bad" : ""}">${
        asleep.length
          ? `${asleep.map((r) => escapeHTML(r.name)).join(", ")} asleep on watch`
          : "The watch holds"
      }</p>
       <p class="dw-day-roll-sub">${keepers.length} watches across ${hoursLabel(
         nightHours
       )} &middot; Optional rule &middot; ${bookRef("players", 159, "Player's Book p159")}</p>
       ${rows(lines)}
       <p class="dw-day-roll-${share.shortNight ? "consequence" : "sub"}">Each of them sleeps ${hoursLabel(
         share.hoursAsleep
       )}${
         share.shortNight
           ? ` — under the ${MIN_SLEEP_HOURS} hours a good night's rest takes, so every watcher fails it. A fourth pair of eyes would fix that.`
           : ", which is a full night's rest."
       }</p>
       ${
         asleep.length
           ? `<p class="dw-day-roll-consequence">A sleeping watcher never wakes the next in line, so the rest of the night's order goes with them.</p>`
           : ""
       }`
    ),
    dice
  );
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export interface SleeperChoice {
  actorId: string;
  bedding: Bedding;
  /** Under six hours, so the night fails whatever the table says. */
  shortNight: boolean;
}

/**
 * The night itself — the roll the whole camp has been leading up to.
 *
 * This is the only camp roll that writes anything outside the day's record: a
 * character who fails here is exhausted until they get a good night's rest, and
 * `setSleptWell` is what carries that into tomorrow's attack rolls. The rest
 * day is only settled on a day nobody spent a Travel Point, which is why the
 * day state is read for it.
 */
export async function rollSleep(sleepers: SleeperChoice[], campfire: boolean): Promise<void> {
  if (!isGM() || !sleepers.length) return;

  const state = getDayState();
  const camp = state.camp ?? {};
  const season = seasonInfo(getDayContext().season).host;
  const bonus = restModifier(
    camp.cooking ? { succeeded: camp.cooking.success, doomed: camp.cooking.doom?.saved === false } : undefined,
    camp.camaraderie
      ? { succeeded: camp.camaraderie.success, doomed: camp.camaraderie.doom?.saved === false }
      : undefined
  );
  const travelledToday = state.travelPointsUsed > 0;

  const dice: Roll[] = [];
  const results: SleeperResult[] = [];

  for (const s of sleepers) {
    const actor = actorById(s.actorId);
    if (!actor) continue;
    const difficulty = sleepDifficulty(campfire, s.bedding, season);
    const plan = planSleep(difficulty, bonus, s.shortNight);
    const conMod = getSystemFields(actor).scores.con.bonus;

    const base: SleeperResult = {
      actorId: s.actorId,
      name: nameOf(actor),
      bedding: s.bedding,
      difficulty,
      shortNight: s.shortNight,
      modifier: plan.modifier + conMod,
      sleptWell: false,
    };

    if (!plan.roll) {
      results.push({ ...base, sleptWell: plan.decided!.sleptWell, why: plan.decided!.why });
    } else {
      const die = await rollDice("1d6");
      dice.push(die);
      const roll = total(die);
      const outcome = abilityCheck(roll, plan.modifier + conMod);
      results.push({
        ...base,
        roll,
        sleptWell: outcome.success,
        ...(outcome.natural ? { natural: outcome.natural } : {}),
        why: outcome.explain,
      });
    }
  }

  // Written per character, because the clocks are per character. A good night
  // ends exhaustion at once; a bad one adds to it at the day's roll-over.
  for (const r of results) {
    const actor = actorById(r.actorId);
    if (actor) await setSleptWell(actor, r.sleptWell, travelledToday);
  }

  await setCampResult("sleep", { sleep: { campfire, season, bonus, sleepers: results } });

  const lines = results.map((r) => {
    const d = SLEEP_DIFFICULTIES[r.difficulty];
    const how =
      r.roll === undefined
        ? escapeHTML(r.why ?? "")
        : `1d6 = ${r.roll}${signed(r.modifier)} against 4${
            r.natural === "fail"
              ? " — natural 1, always fails"
              : r.natural === "success"
                ? " — natural 6, always succeeds"
                : ""
          }`;
    return `<strong>${escapeHTML(r.name)}</strong> — ${escapeHTML(d.label)}${
      r.shortNight ? ", short night" : ""
    }: ${how} → ${r.sleptWell ? "<em>rests well</em>" : "<em>no rest</em>"}`;
  });

  const rested = results.filter((r) => r.sleptWell);
  const badly = results.filter((r) => !r.sleptWell);

  await announce(
    card(
      "fa-bed",
      "Sleep",
      `<p class="dw-day-roll-headline${badly.length ? " is-bad" : ""}">${rested.length} of ${
        results.length
      } get a good night's rest</p>
       <p class="dw-day-roll-sub">${campfire ? "Campfire" : "No fire"}, ${escapeHTML(
         season
       )}${bonus ? `, ${bonus > 0 ? "+" : ""}${bonus} from the evening` : ""} &middot; ${bookRef(
         "players",
         159,
         "Player's Book p159"
       )}</p>
       ${rows(lines)}
       ${
         rested.length
           ? `<p class="dw-day-roll-yield"><strong>${rested
               .map((r) => escapeHTML(r.name))
               .join(", ")}</strong> heal 1 Hit Point on waking.</p>`
           : ""
       }
       ${
         badly.length
           ? `<p class="dw-day-roll-consequence">${badly
               .map((r) => escapeHTML(r.name))
               .join(
                 ", "
               )} are exhausted until they do get one, and each spell they try to prepare has a 1-in-6 chance of failing.</p>`
           : ""
       }`
    ),
    dice
  );
}

// ─── The strip's side of it ───────────────────────────────────────────────────

export type CampRollDuty =
  | "firewood"
  | "fire"
  | "cooking"
  | "entertainment"
  | "watches"
  | "sleep";

/** Which camp duties roll, and which field of the camp record each one owns. */
const CAMP_FIELDS: Record<CampRollDuty, keyof CampState> = {
  firewood: "firewood",
  fire: "fire",
  cooking: "cooking",
  entertainment: "camaraderie",
  watches: "watches",
  sleep: "sleep",
};

export const CAMP_ROLL_DUTIES = new Set<string>(Object.keys(CAMP_FIELDS));

export function isCampRollDuty(id: string): id is CampRollDuty {
  return CAMP_ROLL_DUTIES.has(id);
}

/** Take a camp roll back so it can be made again. Unticks the duty with it. */
export async function clearCampRoll(dutyId: CampRollDuty): Promise<void> {
  if (!isGM()) return;
  await setCampResult(dutyId, { [CAMP_FIELDS[dutyId]]: undefined } as Partial<CampState>);
}

/** The line under a camp duty in the strip, once it has been rolled. */
export function campResultLine(dutyId: string): string | undefined {
  if (!isCampRollDuty(dutyId)) return undefined;
  const camp = getCampState();

  if (dutyId === "firewood") {
    const f = camp.firewood;
    if (!f) return undefined;
    return `${f.hours} hour${f.hours === 1 ? "" : "s"} of fire, ${f.gatherers.length} gathering`;
  }

  if (dutyId === "fire") {
    const f = camp.fire;
    if (!f) return undefined;
    if (f.roll === undefined) return f.lit ? "Lit — no roll needed" : "No fire";
    return f.lit ? `Lit (${f.roll} vs ${f.chance}-in-6)` : `Would not catch (${f.roll} vs ${f.chance}-in-6)`;
  }

  if (dutyId === "cooking" || dutyId === "entertainment") {
    const a = dutyId === "cooking" ? camp.cooking : camp.camaraderie;
    if (!a) return undefined;
    const doom = a.doom && !a.doom.saved ? ", and doomed" : "";
    return `${a.name} — ${a.success ? "+1 to rest" : "no bonus"}${doom}`;
  }

  if (dutyId === "watches") {
    const w = camp.watches;
    if (!w) return undefined;
    const asleep = w.keepers.filter((k) => k.asleep);
    return asleep.length
      ? `${asleep.map((k) => k.name).join(", ")} asleep on watch`
      : `${w.keepers.length} on watch, all awake`;
  }

  const s = camp.sleep;
  if (!s) return undefined;
  const rested = s.sleepers.filter((r) => r.sleptWell).length;
  return `${rested}/${s.sleepers.length} rested well`;
}

