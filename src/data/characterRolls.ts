import {
  ABILITIES,
  ABILITY_CHECK_TARGET,
  SAVES,
  getExtras,
  getSystemFields,
  type AbilityKey,
  type BlockRoll,
  type CharacterBlock,
} from "./characterSheet";
import { exhaustionPenalty, hungerEffect, getCharacterDay } from "./characterDay";

/**
 * What a block's formula may refer to, and how it is rolled.
 *
 * **Every reference goes into one object and Foundry's own `Roll` resolves it.**
 * That is the whole trick: `@wis` and `@b.keen-nose` are not a language this
 * module invents and has to parse — they are Foundry's `@` substitution, so a
 * block's formula gets the whole of Foundry's dice syntax for free, exploding
 * dice and all, and the module only has to decide what goes in the bag.
 *
 * The bag holds:
 *
 * - `@str` … `@cha` — the score, and `@strMod` … `@chaMod` its modifier
 * - `@level`, `@hp`, `@hpMax`, `@ac`, `@attack`
 * - `@doom`, `@ray`, `@hold`, `@blast`, `@spell` — the five save targets
 * - `@listen`, `@search`, `@survival` — the three skill targets
 * - `@b.<slug>` — any block's own value, so blocks may lean on each other
 * - `@attackPenalty`, `@damagePenalty`, `@exhaustion`, `@hunger` — what the
 *   module already knows about the state the character is in, all negative
 *
 * Those last four are the reason for the whole arrangement. The module knows
 * the character has slept badly for three nights, so a block written as
 * `1d6 + @b.blade + @damagePenalty` applies it without anybody at the table
 * remembering to. **Attack rolls take `@attackPenalty` by themselves** — the
 * book gives no discretion there — while a damage formula asks for it, because
 * only the block knows whether it is damage.
 */
export function buildRollData(actor: Actor): Record<string, unknown> {
  const sys = getSystemFields(actor);
  const extras = getExtras(actor);

  const data: Record<string, unknown> = {
    level: sys.level,
    hp: sys.hp.value,
    hpMax: sys.hp.max,
    ac: sys.ac,
    attack: sys.attack,
    listen: extras.skills.listen,
    search: extras.skills.search,
    survival: extras.skills.survival,
    ...(() => {
      const p = characterPenalties(actor);
      return {
        attackPenalty: p.attack,
        damagePenalty: p.damage,
        exhaustion: p.exhaustion,
        hunger: p.hunger,
      };
    })(),
  };

  for (const { key } of ABILITIES) {
    data[key] = sys.scores[key].value;
    data[`${key}Mod`] = sys.scores[key].bonus;
  }
  for (const { key } of SAVES) data[key] = sys.saves[key];

  // Blocks are addressed under their own namespace so a block called "level"
  // cannot shadow the character's level.
  const blocks: Record<string, number> = {};
  for (const b of extras.blocks) blocks[b.slug] = b.value ?? 0;
  data.b = blocks;

  // The table's own skill targets, under a namespace of their own for the same
  // reason. The three printed ones keep their bare names, since those are what
  // the book calls them and what a formula would reach for first.
  const more: Record<string, number> = {};
  for (const s of extras.moreSkills) more[s.slug] = s.target;
  data.s = more;

  return data;
}

/**
 * What hunger and exhaustion actually cost, kept apart because the books keep
 * them apart.
 *
 * **They do not reach the same rolls, and lumping them was a mistake** — caught
 * by Leander asking what hunger even affects (2026-08-25):
 *
 * - **Exhaustion** is "a -1 penalty to Attack **and Damage** Rolls until they
 *   rest", cumulative to -4 (Player's Book p151).
 * - **Hunger** is -1 to -5 **Attack** and a Speed loss (p153, Effects of
 *   Hunger). It never touches damage.
 * - **Neither reaches an Ability Check, a Skill Check or a Saving Throw.** A
 *   starving character is no worse at listening at doors.
 *
 * The day bar's Penalty column shows the attack figure, which is why a starving
 * exhausted character can read -8 there.
 *
 * Both come back **negative**, ready to be added to a formula.
 */
export interface CharacterPenalties {
  /** Exhaustion and hunger together — Attack Rolls only. */
  attack: number;
  /** Exhaustion alone — Damage Rolls. Hunger does not reach them. */
  damage: number;
  /** The raw figures, for a block that wants to say something of its own. */
  exhaustion: number;
  hunger: number;
}

export function characterPenalties(actor: Actor): CharacterPenalties {
  const day = getCharacterDay(actor);
  // The -4 ceiling belongs to exhaustion alone (p151) and is applied inside
  // exhaustionPenalty, never to a sum.
  const exhaustion = exhaustionPenalty(
    day.daysWithoutSleep,
    day.travelDaysSinceRest,
    day.forcedMarchesSinceRest
  );
  // A character who has eaten has no entry in the table at all, which is not
  // the same as an entry of zero.
  const hunger = hungerEffect(day.daysWithoutFood)?.attack ?? 0;
  return {
    attack: -Math.abs(exhaustion + hunger),
    damage: -Math.abs(exhaustion),
    exhaustion: -Math.abs(exhaustion),
    hunger: -Math.abs(hunger),
  };
}

// ─── Turning a block into a formula ───────────────────────────────────────────

export interface RollPlan {
  /** The formula, with references still in it for Foundry to resolve. */
  formula: string;
  /** What the total must reach, where the roll is a success-or-failure one. */
  target?: number;
  /** Whether the target is a floor (`>=`) or a ceiling (`<=`, as X-in-6 is). */
  atOrUnder?: boolean;
  /** The die that decides a natural 1 or a natural best, where the book says so. */
  faces?: 6 | 20;
  /** What the chat card calls it. */
  label: string;
}

/**
 * How the book says to roll each kind (Player's Book p144-145).
 *
 * - **Ability Check**: 1d6 + the ability's modifier, at or above 4.
 * - **Skill Check**: 1d6, at or above the skill's target. Six is the default and
 *   Kindred or Class only ever lowers it.
 * - **Saving Throw**: 1d20, at or above the save target. Against magic, add the
 *   Wisdom modifier — the sheet knows which effects are magical because the
 *   block says so.
 * - **Attack Roll**: 1d20 + Attack, plus Strength for melee or Dexterity for
 *   missile. No target: the defender's AC is not ours to know.
 * - **X-in-6**: a chance the Referee judged, so at or *under* the target.
 */
export function planRoll(block: CharacterBlock, roll: BlockRoll): RollPlan {
  const bonus = "bonus" in roll && roll.bonus ? ` + (${roll.bonus})` : "";

  switch (roll.kind) {
    case "ability": {
      const ability = ABILITIES.find((a) => a.key === roll.ability);
      return {
        formula: `1d6 + @${roll.ability}Mod${bonus}`,
        target: ABILITY_CHECK_TARGET,
        faces: 6,
        label: `${block.name} — ${ability?.label ?? roll.ability} Check`,
      };
    }
    case "skill":
      return {
        formula: `1d6${bonus}`,
        target: roll.target,
        faces: 6,
        label: `${block.name} — Skill Check`,
      };
    case "save": {
      const save = SAVES.find((s) => s.key === roll.save);
      // Magical effects add Wisdom, which is what Dolmenwood's Magic Resistance
      // actually is on the printed sheet.
      const wis = roll.magical ? " + @wisMod" : "";
      return {
        formula: `1d20${wis}${bonus}`,
        target: undefined,
        faces: 20,
        label: `${block.name} — Save versus ${save?.label ?? roll.save}`,
      };
    }
    case "attack": {
      const ability: AbilityKey = roll.missile ? "dex" : "str";
      return {
        formula: `1d20 + @attack + @${ability}Mod${bonus} + @attackPenalty`,
        faces: 20,
        label: `${block.name} — ${roll.missile ? "Missile" : "Melee"} Attack`,
      };
    }
    case "xin6":
      return {
        formula: "1d6",
        target: roll.target,
        atOrUnder: true,
        faces: 6,
        label: `${block.name} — ${roll.target}-in-6`,
      };
    case "formula":
      return { formula: roll.formula, label: block.name };
  }
}

/**
 * Whether a plan's result succeeded, with the book's two absolutes applied.
 *
 * **A natural 1 always fails and a natural best always succeeds, whatever the
 * modifiers** — the book says so for d6 and d20 rolls alike, and it is the rule
 * most easily lost when a computer does the adding. `natural` is the raw die,
 * before anything was added to it.
 */
export function judge(
  plan: RollPlan,
  total: number,
  natural: number | undefined
): { success: boolean; decidedByDie: boolean } | undefined {
  if (plan.target === undefined) return undefined;

  if (plan.faces && natural !== undefined) {
    if (natural === 1) return { success: false, decidedByDie: true };
    if (natural === plan.faces) return { success: true, decidedByDie: true };
  }

  const success = plan.atOrUnder ? total <= plan.target : total >= plan.target;
  return { success, decidedByDie: false };
}
