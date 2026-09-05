import { escapeHTML } from "../helpers/handlebars";
import { announce, isGM, rollDice, total } from "./rollCard";
import { bookRef } from "./books";
import { getCharacterDay, setHealed } from "./characterDay";
import { getPartyActors } from "./sharedStore";
import { getExtras, getSystemFields, setSystemField, updateExtras } from "./characterSheet";
import { creditsFrom } from "./spellCharges";
import { preparesSpells } from "./xpAward";
import { setMorningResult, getDayState } from "./dayDuties";
import {
  OVERNIGHT_HEALING,
  SPELL_LOSS_IN_6,
  healingFor,
  spellLost,
  type HealingResult,
  type MorningState,
  type SpellCasterResult,
} from "./camping";

/**
 * Waking up: the two things the morning owes the party (Player's Book p158-159,
 * step 6 of the Camping procedure).
 *
 * Both turn on **last night**, which is why `CharacterDay` carries
 * `sleptWellLastNight` past the day's roll-over: the sleep roll is made on the
 * evening of one day and paid for on the morning of the next, by which time the
 * flag that knew has been cleared.
 *
 * Healing is the only thing in this module that writes a character's **Hit
 * Points**, and it is written in place, through `setSystemField`, because
 * Foundry's token health bars read the system's own data. One home per value.
 */

const nameOf = (actor: Actor): string => actor.name ?? "Someone";

function card(icon: string, title: string, body: string): string {
  return `<div class="dw-day-roll">
      <h3><i class="fas ${icon}"></i> ${escapeHTML(title)}</h3>
      ${body}
    </div>`;
}

function rows(lines: string[]): string {
  return `<ul class="dw-camp-rows">${lines.map((l) => `<li>${l}</li>`).join("")}</ul>`;
}

/**
 * Did this character sleep well *for the purposes of this morning*?
 *
 * Either flag will do, and that is deliberate: a table that rolls sleep and
 * then wakes up before pressing ▶ reads today's `sleptWell`, and one that
 * advances the day first reads the record the roll-over carried over. The
 * `healed` guard is what stops the two readings paying twice.
 */
export function sleptWellForMorning(actor: Actor): boolean {
  const day = getCharacterDay(actor);
  return day.sleptWell || day.sleptWellLastNight === true;
}

/** Party members whose night was bad — the people the spell warning is about. */
export function sleptBadly(): Actor[] {
  return getPartyActors().filter((actor) => !sleptWellForMorning(actor));
}

// ─── Healing ──────────────────────────────────────────────────────────────────

/**
 * "Characters who slept well heal 1 HP."
 *
 * Three ways to be passed over, and the card says which: a bad night, a full
 * Hit Point track, or having already been paid this morning. **Never past the
 * maximum** — Dolmenmaster's instruction and the obvious rule; a sheet with no
 * maximum on it gets nothing at all, because "full" and "unknown" must not look
 * the same.
 *
 * No dice. It is on the strip beside the rolls because it is a duty, not
 * because it is a roll — hence the heart on its button rather than a d20.
 */
export async function grantMorningHealing(): Promise<void> {
  if (!isGM()) return;

  const result: HealingResult = { healed: [], passed: [] };

  for (const actor of getPartyActors()) {
    const name = nameOf(actor);
    const day = getCharacterDay(actor);
    if (day.healed) {
      result.passed.push({ name, why: "already healed this morning" });
      continue;
    }
    if (!sleptWellForMorning(actor)) {
      result.passed.push({ name, why: "no good night's rest" });
      continue;
    }
    const { hp } = getSystemFields(actor);
    const gain = healingFor(hp.value, hp.max);
    if (gain <= 0) {
      result.passed.push({
        name,
        why: hp.max <= 0 ? "no Hit Points on this sheet" : "already at full Hit Points",
      });
      continue;
    }
    await setSystemField(actor, "hp", hp.value + gain);
    await setHealed(actor, true);
    result.healed.push({ name, from: hp.value, to: hp.value + gain });
  }

  await setMorningResult("healing", { healing: result });

  const lines = [
    ...result.healed.map(
      (h) => `<strong>${escapeHTML(h.name)}</strong> — ${h.from} → ${h.to} HP`
    ),
    ...result.passed.map(
      (p) => `<strong>${escapeHTML(p.name)}</strong> — ${escapeHTML(p.why)}`
    ),
  ];

  await announce(
    card(
      "fa-heart-pulse",
      "Waking up",
      `<p class="dw-day-roll-headline${result.healed.length ? "" : " is-bad"}">${
        result.healed.length
          ? `${result.healed.length} heal ${OVERNIGHT_HEALING} Hit Point`
          : "Nobody heals this morning"
      }</p>
       <p class="dw-day-roll-sub">A good night's rest in the wild or a night in a settlement &middot; ${bookRef(
         "players",
         159,
         "Player's Book p159"
       )}</p>
       ${rows(lines)}
       <p class="dw-day-roll-sub">A full day of rest heals 1d3 instead, and is not this button's
         business — it precludes anything more strenuous than an inn chair.</p>`
    )
  );
}

// ─── Preparing spells ─────────────────────────────────────────────────────────

/**
 * Set a character's spell credits for the day, and wipe yesterday's charges.
 *
 * **Set, never added to.** Credits are a morning's worth of preparation, not a
 * currency that accrues: a caster who left three unassigned yesterday does not
 * wake with six. And the charges left on their list go with them — a spell held
 * overnight is not a spell still memorised (Player's Book p78: an arcane spell
 * is gone from the mind "until it is memorised again").
 */
async function issueCredits(actorId: string, credits: number): Promise<void> {
  const actor = (game as Game).actors?.get(actorId);
  if (!actor) return;
  await updateExtras(actor, (x) => {
    x.spellCredits = credits;
    for (const block of x.blocks) if (block.spell) block.prepared = 0;
    return x;
  });
}

/**
 * Hand every casting character who is not in `rolled` their whole list.
 *
 * A rested caster loses nothing, so their credits are simply the number of
 * spells they prepare. Characters who were rolled are skipped: theirs were
 * issued with their result, dice and all.
 */
async function issueRestedCredits(rolled: Set<string>): Promise<void> {
  for (const actor of getPartyActors()) {
    const id = actor.id ?? "";
    if (rolled.has(id) || !preparesSpells(actor)) continue;
    await issueCredits(id, getExtras(actor).prepares ?? 0);
  }
}

export interface CasterChoice {
  actorId: string;
  name: string;
  /** How many spells this caster sets about memorising or praying for. */
  spells: number;
}

/**
 * "For each spell the character attempts to memorise or pray for, there is a
 * 1-in-6 chance of failure. If the roll fails, the spell slot remains empty and
 * unusable this day."
 *
 * **Only characters who slept badly roll at all**, so the dialog offers only
 * them; a rested caster prepares their whole list without a die. The module
 * ships no spell lists and never will, so it asks how many spells rather than
 * which — the table knows, and a wrong guess here would be a rule the module
 * invented.
 *
 * A chance, not a check: no natural-1-always-fails rule, one die per spell.
 */
export async function rollSpellPreparation(casters: CasterChoice[]): Promise<void> {
  if (!isGM()) return;

  const dice: Roll[] = [];
  const results: SpellCasterResult[] = [];

  for (const caster of casters) {
    const rolls: number[] = [];
    let lost = 0;
    for (let i = 0; i < caster.spells; i++) {
      const die = await rollDice("1d6");
      dice.push(die);
      const roll = total(die);
      rolls.push(roll);
      if (spellLost(roll)) lost++;
    }
    results.push({ name: caster.name, spells: caster.spells, rolls, lost });
    await issueCredits(caster.actorId, creditsFrom(caster.spells, lost));
  }

  // **Everyone else who casts got their whole list**, and has to be given it.
  // Only the badly-slept are rolled, so without this the rested casters would
  // wake up with no credits at all on exactly the mornings when nothing went
  // wrong for them.
  await issueRestedCredits(new Set(casters.map((c) => c.actorId)));

  const lost = results.reduce((sum, r) => sum + r.lost, 0);
  await setMorningResult("prepare-spells", { spells: { casters: results, lost } });

  const lines = results.map(
    (r) =>
      `<strong>${escapeHTML(r.name)}</strong> — ${r.spells} spell${
        r.spells === 1 ? "" : "s"
      }, rolled ${r.rolls.join(", ") || "nothing"} → ${
        r.lost ? `<em>${r.lost} lost</em>` : "all prepared"
      }`
  );

  await announce(
    card(
      "fa-wand-sparkles",
      "Preparing spells",
      `<p class="dw-day-roll-headline${lost ? " is-bad" : ""}">${
        lost ? `${lost} spell${lost === 1 ? "" : "s"} lost` : "Every spell prepared"
      }</p>
       <p class="dw-day-roll-sub">${SPELL_LOSS_IN_6}-in-6 per spell, for a caster who failed to get
         a good night's rest &middot; ${bookRef("players", 159, "Player's Book p159")}</p>
       ${rows(lines)}
       ${
         lost
           ? `<p class="dw-day-roll-consequence">Those slots stay empty and unusable today.</p>`
           : ""
       }`,
    ),
    dice
  );
}

// ─── The strip's side of it ───────────────────────────────────────────────────

export type MorningRollDuty = "healing" | "prepare-spells";

const MORNING_FIELDS: Record<MorningRollDuty, keyof MorningState> = {
  healing: "healing",
  "prepare-spells": "spells",
};

export const MORNING_ROLL_DUTIES = new Set<string>(Object.keys(MORNING_FIELDS));

export function isMorningRollDuty(id: string): id is MorningRollDuty {
  return MORNING_ROLL_DUTIES.has(id);
}

export function getMorningState(): MorningState {
  return getDayState().morning ?? {};
}

export async function clearMorningRoll(dutyId: MorningRollDuty): Promise<void> {
  if (!isGM()) return;
  // Taking the healing back does not take the Hit Point back: the point is in
  // the character's own record now, and un-healing somebody who has since been
  // hit would be worse than the mistake it was undoing. The per-character
  // `healed` flag stays set for the same reason, so re-running it pays nobody
  // twice.
  await setMorningResult(dutyId, { [MORNING_FIELDS[dutyId]]: undefined } as Partial<MorningState>);
}

export function morningResultLine(dutyId: string): string | undefined {
  if (!isMorningRollDuty(dutyId)) return undefined;
  const morning = getMorningState();

  if (dutyId === "healing") {
    const h = morning.healing;
    if (!h) return undefined;
    return h.healed.length
      ? `${h.healed.length} healed, ${h.passed.length} passed over`
      : "Nobody healed";
  }

  const s = morning.spells;
  if (!s) return undefined;
  const spells = s.casters.reduce((sum, c) => sum + c.spells, 0);
  return s.lost ? `${s.lost} of ${spells} spells lost` : `${spells} spells, none lost`;
}

/**
 * The line a duty shows *before* it is rolled, when the day already knows
 * something worth saying.
 *
 * Dolmenmaster's ask, and the one place in the strip where a warning earns its
 * space: a caster who slept badly is the only reason the spell duty needs dice
 * at all, and nobody would think to check.
 */
export function morningWarningLine(dutyId: string): string | undefined {
  const morning = getMorningState();

  // Healing: who it would pay, before it pays them. Dolmenmaster asked for this
  // outright — the duty used to say nothing until it was pressed, which is a
  // poor way to find out that nobody in the party had slept.
  if (dutyId === "healing") {
    if (morning.healing) return undefined;
    const owed = getPartyActors().filter((actor) => {
      const day = getCharacterDay(actor);
      if (day.healed || !sleptWellForMorning(actor)) return false;
      const { hp } = getSystemFields(actor);
      return healingFor(hp.value, hp.max) > 0;
    });
    if (!owed.length) {
      // Two different nothings, and the difference is worth a word: a party
      // that slept badly is a problem, a party at full Hit Points is not.
      return getPartyActors().some((a) => sleptWellForMorning(a))
        ? "Everyone rested is at full Hit Points"
        : "Nobody rested — no healing this morning";
    }
    return `${owed.map((a) => nameOf(a)).join(", ")} heal ${OVERNIGHT_HEALING} HP`;
  }

  if (dutyId !== "prepare-spells") return undefined;
  if (morning.spells) return undefined;
  const badly = sleptBadly();
  if (!badly.length) return "Everyone slept well — no roll needed";
  const names = badly.map((a) => nameOf(a)).join(", ");
  return `${names} slept badly — ${SPELL_LOSS_IN_6}-in-6 per spell`;
}

/**
 * The card for a morning nobody has to roll for.
 *
 * Pressing the die and getting only a toast was the complaint — an action that
 * produces nothing visible reads as an action that did not work. A rested party
 * now gets a card saying so, and the duty ticks.
 */
export async function noteSpellsPreparedFreely(): Promise<void> {
  if (!isGM()) return;
  await setMorningResult("prepare-spells", { spells: { casters: [], lost: 0 } });
  // Nobody rolled, so every caster in the party gets their whole list.
  await issueRestedCredits(new Set());
  await announce(
    card(
      "fa-wand-sparkles",
      "Preparing spells",
      `<p class="dw-day-roll-headline">Every spell prepared</p>
       <p class="dw-day-roll-sub">Everyone got a good night's rest, so no spell is at risk &middot; ${bookRef(
         "players",
         159,
         "Player's Book p159"
       )}</p>`
    )
  );
}
