import { escapeHTML } from "../helpers/handlebars";
import { t, tn } from "../helpers/i18n";
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

const nameOf = (actor: Actor): string =>
  actor.name ?? t("DOLMENWOOD.Party.Unsorted.Someone");

/** The page reference these two cards share, in the reader's own language. */
const playersBook = (page: number): string =>
  bookRef("players", page, t("DOLMENWOOD.Book.Players", { page }));

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
    // **The reason is stored as a key, not as a sentence.** The result goes
    // into the day's own record, and a finished sentence would freeze the
    // language the morning happened to be rolled in.
    if (day.healed) {
      result.passed.push({ name, why: "DOLMENWOOD.Morning.Passed.Already" });
      continue;
    }
    if (!sleptWellForMorning(actor)) {
      result.passed.push({ name, why: "DOLMENWOOD.Morning.Passed.NoRest" });
      continue;
    }
    const { hp } = getSystemFields(actor);
    const gain = healingFor(hp.value, hp.max);
    if (gain <= 0) {
      result.passed.push({
        name,
        why:
          hp.max <= 0
            ? "DOLMENWOOD.Morning.Passed.NoHp"
            : "DOLMENWOOD.Morning.Passed.Full",
      });
      continue;
    }
    await setSystemField(actor, "hp", hp.value + gain);
    await setHealed(actor, true);
    result.healed.push({ name, from: hp.value, to: hp.value + gain });
  }

  await setMorningResult("healing", { healing: result });

  const lines = [
    ...result.healed.map((h) =>
      t("DOLMENWOOD.Morning.Healing.Row", {
        name: escapeHTML(h.name),
        from: h.from,
        to: h.to,
      })
    ),
    // A day rolled before the reasons became keys still holds a finished
    // sentence; it is printed as it stands rather than as a missing key.
    ...result.passed.map((p) =>
      t("DOLMENWOOD.Morning.Healing.Passed", {
        name: escapeHTML(p.name),
        why: p.why.startsWith("DOLMENWOOD.") ? t(p.why) : escapeHTML(p.why),
      })
    ),
  ];

  await announce(
    card(
      "fa-heart-pulse",
      t("DOLMENWOOD.Morning.Healing.Title"),
      `<p class="dw-day-roll-headline${result.healed.length ? "" : " is-bad"}">${
        result.healed.length
          ? tn("DOLMENWOOD.Morning.Healing.Headline", result.healed.length, {
              hp: OVERNIGHT_HEALING,
            })
          : t("DOLMENWOOD.Morning.Healing.None")
      }</p>
       <p class="dw-day-roll-sub">${t("DOLMENWOOD.Morning.Healing.Sub", {
         book: playersBook(159),
       })}</p>
       ${rows(lines)}
       <p class="dw-day-roll-sub">${t("DOLMENWOOD.Morning.Healing.Foot")}</p>`
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

  const lines = results.map((r) =>
    tn("DOLMENWOOD.Morning.Spells.Row", r.spells, {
      name: escapeHTML(r.name),
      rolls: r.rolls.join(", ") || t("DOLMENWOOD.Morning.Spells.Row.Nothing"),
      outcome: r.lost
        ? t("DOLMENWOOD.Morning.Spells.Row.Lost", { n: r.lost })
        : t("DOLMENWOOD.Morning.Spells.Row.AllPrepared"),
    })
  );

  await announce(
    card(
      "fa-wand-sparkles",
      t("DOLMENWOOD.Morning.Spells.Title"),
      `<p class="dw-day-roll-headline${lost ? " is-bad" : ""}">${
        lost
          ? tn("DOLMENWOOD.Morning.Spells.Lost", lost)
          : t("DOLMENWOOD.Morning.Spells.AllPrepared")
      }</p>
       <p class="dw-day-roll-sub">${t("DOLMENWOOD.Morning.Spells.CardSub", {
         chance: SPELL_LOSS_IN_6,
         book: playersBook(159),
       })}</p>
       ${rows(lines)}
       ${
         lost
           ? `<p class="dw-day-roll-consequence">${t(
               "DOLMENWOOD.Morning.Spells.Consequence"
             )}</p>`
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
      ? t("DOLMENWOOD.Morning.Line.Healed", {
          healed: h.healed.length,
          passed: h.passed.length,
        })
      : t("DOLMENWOOD.Morning.Line.NobodyHealed");
  }

  const s = morning.spells;
  if (!s) return undefined;
  const spells = s.casters.reduce((sum, c) => sum + c.spells, 0);
  return s.lost
    ? t("DOLMENWOOD.Morning.Line.SpellsLost", { lost: s.lost, spells })
    : tn("DOLMENWOOD.Morning.Line.SpellsNoneLost", spells);
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
        ? t("DOLMENWOOD.Morning.Warn.AllFull")
        : t("DOLMENWOOD.Morning.Warn.NobodyRested");
    }
    return tn("DOLMENWOOD.Morning.Warn.WillHeal", owed.length, {
      names: owed.map((a) => nameOf(a)).join(", "),
      hp: OVERNIGHT_HEALING,
    });
  }

  if (dutyId !== "prepare-spells") return undefined;
  if (morning.spells) return undefined;
  const badly = sleptBadly();
  if (!badly.length) return t("DOLMENWOOD.Morning.Warn.NoRollNeeded");
  const names = badly.map((a) => nameOf(a)).join(", ");
  return tn("DOLMENWOOD.Morning.Warn.SleptBadly", badly.length, {
    names,
    chance: SPELL_LOSS_IN_6,
  });
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
      t("DOLMENWOOD.Morning.Spells.Title"),
      `<p class="dw-day-roll-headline">${t("DOLMENWOOD.Morning.Spells.AllPrepared")}</p>
       <p class="dw-day-roll-sub">${t("DOLMENWOOD.Morning.Spells.FreeSub", {
         book: playersBook(159),
       })}</p>`
    )
  );
}
