import { announce } from "./rollCard";
import { t } from "../helpers/i18n";
import { escapeHTML } from "../helpers/handlebars";
import { buildRollData, judge, type RollPlan } from "./characterRolls";

/**
 * Rolling a character's own dice, and saying what they said.
 *
 * The arithmetic all happened before this: `planRoll` in `characterRolls.ts`
 * turns a block into a formula and a target, `buildRollData` fills the bag of
 * `@` references, and `judge` applies the book's two absolutes. What is left
 * here is the two things that touch Foundry — evaluating the `Roll` and posting
 * the card — which is why they live apart from the rules and can be checked
 * without a browser.
 *
 * **These cards are public.** A character's own roll is something the character
 * makes and the table watches; the whispered half of this module is for what
 * the party is not meant to know, and their own Saving Throw is not that.
 */

/**
 * The raw face of the die that decided it, before anything was added.
 *
 * **Needed because a natural 1 always fails and a natural best always
 * succeeds** (Player's Book p144), and a total of 7 says nothing about which
 * face came up. Read off the first die term, which is the check's own die in
 * every plan the module builds — `1d6 + @strMod`, `1d20 + @attack`. A formula
 * with no die at all (a block whose value is a flat number) has no natural, and
 * `judge` treats that as "nothing to say".
 */
function naturalDie(roll: Roll): number | undefined {
  const dice = (roll as unknown as { dice?: { results?: { result?: number }[] }[] }).dice ?? [];
  const first = dice[0]?.results?.[0]?.result;
  return typeof first === "number" ? first : undefined;
}

/** "1d6 + 2" — the formula with its references already filled in. */
function spelledOut(roll: Roll): string {
  const f = (roll as unknown as { formula?: string }).formula;
  return typeof f === "string" ? f : "";
}

export interface RollFlavour {
  /** A line under the headline: the weapon's ranges, the block's own text. */
  note?: string;
  /** Shown as-is beside the total, for a damage roll that judges nothing. */
  icon?: string;
}

/**
 * Roll a plan and post the card.
 *
 * The `Roll` object travels with the message so Dice So Nice animates it and
 * the log holds the real dice — the same rule the day's tables follow.
 */
export async function performRoll(
  actor: Actor,
  plan: RollPlan,
  flavour: RollFlavour = {}
): Promise<Roll> {
  // Cast because Foundry's own `Roll` is generic over its data and the shims
  // default it to an empty object; every other caller in the module rolls
  // without data, so the narrower type is right for them and not for this.
  const roll = new Roll(plan.formula, buildRollData(actor)) as unknown as Roll;
  await roll.evaluate();

  const total = roll.total ?? 0;
  const natural = naturalDie(roll);
  const verdict = judge(plan, total, natural);

  await announce(rollCardHTML(actor, plan, roll, total, verdict, flavour), [roll]);
  return roll;
}

/**
 * What the card says.
 *
 * Three lines at most, and the middle one is the answer: the total, big, with
 * the word for it beside it. Below that the arithmetic, because a Referee who
 * disagrees with a modifier should be able to see the modifier rather than take
 * the module's word for the sum.
 */
function rollCardHTML(
  actor: Actor,
  plan: RollPlan,
  roll: Roll,
  total: number,
  verdict: { success: boolean; decidedByDie: boolean } | undefined,
  flavour: RollFlavour
): string {
  const who = escapeHTML(actor.name ?? t("DOLMENWOOD.Sheet.Card.Someone"));
  const headline = verdict
    ? `<p class="dw-day-roll-headline${verdict.success ? "" : " is-bad"}">
         <strong class="dw-sheet-total">${total}</strong>
         ${t(verdict.success ? "DOLMENWOOD.Sheet.Card.Success" : "DOLMENWOOD.Sheet.Card.Failure")}
       </p>`
    : `<p class="dw-day-roll-headline"><strong class="dw-sheet-total">${total}</strong></p>`;

  // The target is worth printing even on a success: "12 against 11" is the
  // sentence a table repeats, and "12, success" is not.
  const against =
    plan.target === undefined
      ? ""
      : ` &mdash; ${t(
          plan.atOrUnder ? "DOLMENWOOD.Sheet.Card.AtOrUnder" : "DOLMENWOOD.Sheet.Card.AtOrOver",
          { target: plan.target }
        )}`;

  // Said plainly, because it is the rule a computer is most likely to be
  // suspected of getting wrong.
  const byTheDie = verdict?.decidedByDie
    ? `<p class="dw-day-roll-note">${t("DOLMENWOOD.Sheet.Card.Natural", {
        n: verdict.success ? (plan.faces ?? 20) : 1,
      })}</p>`
    : "";

  return `<div class="dw-day-roll dw-sheet-roll">
      <h3><i class="fas ${flavour.icon ?? "fa-dice-d20"}"></i> ${who}</h3>
      <p class="dw-day-roll-sub">${escapeHTML(plan.label)}${against}</p>
      ${headline}
      <p class="dw-day-roll-sub dw-sheet-maths">${escapeHTML(spelledOut(roll))}</p>
      ${flavour.note ? `<p class="dw-day-roll-note">${escapeHTML(flavour.note)}</p>` : ""}
      ${byTheDie}
    </div>`;
}
