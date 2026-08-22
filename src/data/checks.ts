/**
 * The core d6 checks (Player's Book p144).
 *
 * Two things about them are easy to get backwards, and this module got both
 * wrong the first time:
 *
 * 1. **You roll high and meet or exceed a target.** A Skill Target is not an
 *    "X-in-6 chance" — it is a number to reach, and a *lower* target is a
 *    *better* character. Skills default to 6, and only Kindred or Class bring
 *    it down.
 * 2. **A natural 1 always fails and a natural 6 always succeeds**, whatever the
 *    modifiers say. So a hopeless target is never quite hopeless, and no stack
 *    of bonuses makes a check automatic.
 *
 * **Chance Rolls are not checks.** Where the Referee judges a bare likelihood
 * out of 6 — getting lost, a wandering monster, a hunter finding the path —
 * the book gives no natural-1-or-6 rule, and none is applied. Those stay a
 * plain "roll at or under the chance" and live with the tables that use them.
 */

export interface CheckOutcome {
  /** The face that came up. */
  roll: number;
  /** Everything added to it. */
  modifier: number;
  /** What the total had to reach. */
  target: number;
  success: boolean;
  /** Set when the natural die decided it, whatever the total was. */
  natural?: "fail" | "success";
  /** One line saying how it was resolved, for the chat card. */
  explain: string;
}

function resolve(roll: number, modifier: number, target: number, kind: string): CheckOutcome {
  const totalled = roll + modifier;
  const mod = modifier === 0 ? "" : modifier > 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`;

  if (roll === 1) {
    return {
      roll,
      modifier,
      target,
      success: false,
      natural: "fail",
      explain: `Natural 1 — always fails, whatever the modifiers (1d6 = 1${mod}, target ${target}).`,
    };
  }
  if (roll === 6) {
    return {
      roll,
      modifier,
      target,
      success: true,
      natural: "success",
      explain: `Natural 6 — always succeeds, whatever the modifiers (1d6 = 6${mod}, target ${target}).`,
    };
  }
  return {
    roll,
    modifier,
    target,
    success: totalled >= target,
    explain: `${kind}: 1d6 = ${roll}${mod} = ${totalled}, against a target of ${target}.`,
  };
}

/**
 * A Skill Check — Listen, Search, Survival, or a Class's own.
 *
 * `target` is the character's Skill Target, 6 by default and lower for those
 * trained in it. Where several characters could make the attempt, the group
 * uses the **best** target among them, which is the lowest number.
 */
export function skillCheck(roll: number, modifier: number, target: number): CheckOutcome {
  return resolve(roll, modifier, target, "Skill Check");
}

/** An Ability Check: 1d6 plus the Ability Modifier, against a fixed target of 4. */
export const ABILITY_CHECK_TARGET = 4;

export function abilityCheck(roll: number, modifier: number): CheckOutcome {
  return resolve(roll, modifier, ABILITY_CHECK_TARGET, "Ability Check");
}

/** Skill Targets a character can actually have. Lower is better. */
export const SKILL_TARGETS = [2, 3, 4, 5, 6] as const;

/** The band the book suggests for a situational modifier on a d6 check. */
export const SITUATIONAL_MODIFIERS = [-2, -1, 0, 1, 2] as const;
