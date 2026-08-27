/**
 * The attribute sheet: the character's numbers, and the blocks a table invents
 * on top of them.
 *
 * **Not a full character sheet, on Leander's instruction (2026-08-25):** *"Im
 * Prinzip keinen vollständigen Character Sheet sondern eher einen
 * Attributsbogen (denn ein Inventar haben wir ja schon mega ausgearbeitet)."*
 * The inventory stays where it is and is not folded in here.
 *
 * **This file is the one place in the module that knows a game system exists.**
 * Everything else reads and writes only the module's own flags, which is why it
 * runs on OSE without depending on OSE. A sheet is the deliberate exception: it
 * is a view of a system's character, so it may know whose character it is. The
 * rule is that the knowledge lives here and nowhere else — if a Dolmenwood
 * system is ever published, this file grows a second mapping and nothing above
 * it changes.
 *
 * **One home per value.** Anything the system already models is read and
 * written in place, so the system's own automation — token health bars above
 * all — keeps working. Only what Dolmenwood has and the system does not lives
 * in the module's flag. Nothing is kept twice.
 */

import { MODULE_ID } from "../constants";

// ─── The six ──────────────────────────────────────────────────────────────────

export type AbilityKey = "str" | "int" | "wis" | "dex" | "con" | "cha";

/**
 * In the order the printed sheet prints them, with what the book says each
 * modifier is for. The caption is on the sheet itself and is half of why the
 * printed one is easy to read.
 */
export const ABILITIES: { key: AbilityKey; label: string; short: string; governs: string }[] = [
  { key: "str", label: "Strength", short: "STR", governs: "Melee attacks and damage" },
  { key: "int", label: "Intelligence", short: "INT", governs: "Extra languages" },
  { key: "wis", label: "Wisdom", short: "WIS", governs: "Magic Resistance" },
  { key: "dex", label: "Dexterity", short: "DEX", governs: "AC and missile attacks" },
  { key: "con", label: "Constitution", short: "CON", governs: "Hit Points per Level" },
  { key: "cha", label: "Charisma", short: "CHA", governs: "Reaction Rolls" },
];

// ─── The five saves ───────────────────────────────────────────────────────────

export type SaveKey = "doom" | "ray" | "hold" | "blast" | "spell";

/**
 * Dolmenwood's five saving throws, and where OSE keeps each one.
 *
 * The names are the point: the book says Doom, Ray, Hold, Blast and Spell, and
 * OSE's own sheet says death, wand, paralysis, breath and spell. Same five, same
 * order — a relabelling, not a conversion.
 */
export const SAVES: { key: SaveKey; label: string; ose: string }[] = [
  { key: "doom", label: "Doom", ose: "death" },
  { key: "ray", label: "Ray", ose: "wand" },
  { key: "hold", label: "Hold", ose: "paralysis" },
  { key: "blast", label: "Blast", ose: "breath" },
  { key: "spell", label: "Spell", ose: "spell" },
];

// ─── The rules the blocks roll by (Player's Book p144-145) ────────────────────

/** An Ability Check succeeds on 1d6 + the ability's modifier at or above this. */
export const ABILITY_CHECK_TARGET = 4;

/**
 * The modifier an Ability Score carries (Player's Book p22).
 *
 * Printed as a table of ranges rather than a formula, and kept as one here: the
 * bands are not symmetric — 9-12 is four scores wide and 16-17 only two — so a
 * `Math.floor((score - 10) / 3)` would be wrong at both ends and right in the
 * middle, which is the worst way for it to be wrong.
 */
const ABILITY_MODIFIER_TABLE: { upTo: number; mod: number }[] = [
  { upTo: 3, mod: -3 },
  { upTo: 5, mod: -2 },
  { upTo: 8, mod: -1 },
  { upTo: 12, mod: 0 },
  { upTo: 15, mod: 1 },
  { upTo: 17, mod: 2 },
  { upTo: Infinity, mod: 3 },
];

/**
 * What the book says a score is worth.
 *
 * **The sheet fills the modifier in when a score is typed** — Leander's ask,
 * and the arithmetic is the book's, not a house rule. The field stays editable
 * afterwards, because a ring or a curse can move a modifier without moving the
 * score, and the sheet says so when the two have come apart.
 */
export function abilityModifier(score: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return ABILITY_MODIFIER_TABLE.find((band) => score <= band.upTo)?.mod ?? 0;
}

/** A skill with nothing said about it. Kindred and Class only ever lower it. */
export const DEFAULT_SKILL_TARGET = 6;

// ─── The module's own half ────────────────────────────────────────────────────

/**
 * What Dolmenwood's sheet has and the system does not.
 *
 * Deliberately small: every field here is one OSE offers no home for, so keeping
 * it in the module's flag creates no second copy of anything.
 */
export interface CharacterExtras {
  kindred: string;
  background: string;
  affiliation: string;
  moonSign: string;
  /** Dolmenwood's own defence against magic; the sheet derives it from Wisdom. */
  magicResistance: string;
  /** The three every adventurer has, printed on the paper sheet. */
  skills: { listen: number; search: number; survival: number };
  /**
   * Skill targets the table added — Leander's ask, 2026-08-27.
   *
   * The printed sheet has three lines and a Class hands out more than three, so
   * the list has to grow. Kept beside the three rather than folded into
   * `blocks` because a skill target is one number rolled one way, and asking a
   * player to write a block for "Climb: 4" is asking too much for too little.
   * Each is addressable as `@s.<slug>`, the same way a block is `@b.<slug>`.
   */
  moreSkills: { id: string; name: string; slug: string; target: number }[];
  /** Feet per turn while exploring — printed beside Speed on the paper sheet. */
  exploring: string;
  /**
   * How many spells this character sets about preparing of a morning. **Zero
   * means "not a spell-caster"**, which is why one number carries both answers.
   *
   * It lives on the character because that is what it is a fact about — not
   * every adventurer casts, and the morning's dialog should not ask the Referee
   * to remember which ones do, every day, for the rest of the campaign. Written
   * by that dialog, so the answer given once is the answer offered next time.
   */
  prepares: number;
  blocks: CharacterBlock[];
}

/**
 * A trait, a class ability, a spell, a skill of its own — one model for all.
 *
 * Leander's call, and the right one: *"Für alles detaillierte (Zauber, Traits,
 * usw.) würde ich wirklich am liebsten mit Bausteinen und viel Flexibilität
 * beim Anlegen arbeiten. Es sollte ansteuerbar sein für Bezüge und sich alles
 * würfeln lassen, je nachdem, wie es definiert ist."*
 *
 * So the module ships **no** class list, no kindred list and no spell list. It
 * ships a block that can be any of them, and the table writes what it plays.
 * Less data work, never out of date, and it holds a homebrew kindred as happily
 * as a printed one.
 *
 * Two things make a block more than a note:
 *
 * - **It can be rolled**, in whichever of the book's four ways fits it.
 * - **It can be referred to.** Every block has a `slug`, and its `value` is in
 *   the roll data as `@b.<slug>` — so one block's formula may lean on another,
 *   and on the character's scores, and on the module's own exhaustion and
 *   hunger penalties. That last one is why a bad night's sleep can reach a die
 *   roll without anybody remembering to apply it.
 */
export interface CharacterBlock {
  id: string;
  /** Free text: "Kindred", "Class", "Spells, 1st" — whatever the table calls it. */
  group: string;
  name: string;
  /** How other blocks and formulas address this one: `@b.<slug>`. */
  slug: string;
  text: string;
  /** The number this block contributes when referred to, if it stands for one. */
  value?: number;
  roll?: BlockRoll;
  /** For a per-day ability or a memorised spell. Absent means neither. */
  uses?: { value: number; max: number };
  /**
   * Is this block a spell, and of which kind — Leander's ask, 2026-08-27.
   *
   * **Absent means it is not a spell at all**, which is the common case: a
   * trait, a class ability, a knack. Only a spell gets the prepared/bestowed
   * tick, because ticking a Kindred trait as "prepared for today" is a control
   * with nothing behind it.
   *
   * **Arcane and holy are kept apart because the books keep them apart**, and
   * the difference that reaches this module is a real one: an arcane caster
   * memorises from **spell books that must be to hand** (Player's Book p78),
   * while a holy caster prays and needs nothing but the hour — and may choose
   * *any* spell of their Rank rather than only what they have written down
   * (p100). Everything else that differs — one hand free, being bound, Rank 6
   * against Rank 5, blessings at shrines — is a ruling at the table rather than
   * a number this sheet holds. The morning's 1-in-6 loss after a bad night
   * applies to both alike: the book says "memorising or praying" (p159).
   */
  spell?: "arcane" | "holy";
  prepared?: boolean;
}

/**
 * How a block is rolled.
 *
 * The four the book defines, plus two the Referee reaches for constantly: a
 * bare formula (damage, a duration, 1d6 hours of firewood) and an X-in-6 chance
 * roll. Every one carries an optional `bonus` formula, which is where a
 * reference like `@b.keen-nose` earns its keep.
 *
 * **There is deliberately no "apply the penalty" tick.** Hunger and exhaustion
 * reach Attack Rolls and — exhaustion alone — Damage Rolls, and nothing else:
 * an Ability Check is not harder on an empty stomach. So an attack applies
 * `@attackPenalty` by itself, and anything else that should carry one says so
 * in its own formula. A tick would have invited the wrong answer.
 */
export type BlockRoll =
  /** 1d6 + the ability's modifier, at or above 4. Natural 1 fails, 6 succeeds. */
  | { kind: "ability"; ability: AbilityKey; bonus?: string }
  /** 1d6 at or above the target. Natural 1 fails, 6 succeeds. */
  | { kind: "skill"; target: number; bonus?: string }
  /** 1d20 at or above the save target; magical effects add the Wisdom modifier. */
  | { kind: "save"; save: SaveKey; magical?: boolean; bonus?: string }
  /** 1d20 + Attack + Strength (melee) or Dexterity (missile), against an AC. */
  | { kind: "attack"; missile?: boolean; bonus?: string }
  /** A chance the Referee judged: 1d6 at or under the target. */
  | { kind: "xin6"; target: number }
  /** Straight dice, no success or failure to report. */
  | { kind: "formula"; formula: string };

export function defaultExtras(): CharacterExtras {
  return {
    kindred: "",
    background: "",
    affiliation: "",
    moonSign: "",
    magicResistance: "",
    skills: {
      listen: DEFAULT_SKILL_TARGET,
      search: DEFAULT_SKILL_TARGET,
      survival: DEFAULT_SKILL_TARGET,
    },
    moreSkills: [],
    exploring: "",
    // Nobody is assumed to cast: a party of fighters should never be asked to
    // untick four boxes on its first morning.
    prepares: 0,
    blocks: [],
  };
}

/**
 * A block's address, from its name.
 *
 * Kept on the block rather than derived on the fly, so renaming a block does
 * not silently break every formula that pointed at it.
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "block"
  );
}

/** A slug not already taken by another block. */
export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(name);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

const FLAG = "sheet";

export function getExtras(actor: Actor): CharacterExtras {
  const stored = actor.getFlag(MODULE_ID, FLAG) as Partial<CharacterExtras> | undefined;
  const base = defaultExtras();
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    skills: { ...base.skills, ...(stored.skills ?? {}) },
    moreSkills: (stored.moreSkills ?? []).map((s) => ({ ...s, slug: s.slug || slugify(s.name) })),
    blocks: (stored.blocks ?? []).map((b) => ({ ...b, slug: b.slug || slugify(b.name) })),
  };
}

export async function setExtras(actor: Actor, extras: CharacterExtras): Promise<void> {
  await actor.setFlag(MODULE_ID, FLAG, extras);
}

export async function updateExtras(
  actor: Actor,
  updater: (extras: CharacterExtras) => CharacterExtras
): Promise<void> {
  await setExtras(actor, updater(foundry.utils.deepClone(getExtras(actor))));
}

// ─── The system's own half ────────────────────────────────────────────────────

/**
 * The shape of an OSE character, as far as this module cares.
 *
 * Written out rather than imported: the module does not depend on OSE's types
 * and must not start now. Every read is optional-chained, so a character of
 * another system comes back empty instead of throwing — which is what makes the
 * sheet safe to open on anything at all.
 */
type SystemActor = Actor & {
  system?: {
    usesAscendingAC?: boolean;
    scores?: Record<string, { value?: number; bonus?: number }>;
    hp?: { value?: number; max?: number };
    ac?: { value?: number; mod?: number };
    aac?: { value?: number; mod?: number };
    thac0?: { value?: number; bba?: number };
    saves?: Record<string, { value?: number }>;
    movement?: { base?: number };
    languages?: { value?: string[] };
    details?: {
      class?: string;
      alignment?: string;
      level?: number;
      xp?: { value?: number; next?: number; bonus?: number };
    };
  };
  update?: (data: Record<string, unknown>) => Promise<unknown>;
};

export interface SystemFields {
  scores: Record<AbilityKey, { value: number; bonus: number }>;
  saves: Record<SaveKey, number>;
  hp: { value: number; max: number };
  ac: number;
  attack: number;
  speed: number;
  languages: string;
  class: string;
  alignment: string;
  level: number;
  xp: { value: number; next: number; bonus: number };
}

/**
 * Which armour class this world counts.
 *
 * **OSE has a setting for it** and keeps both numbers side by side. Guessing
 * "ascending, because Dolmenwood counts upwards" would be wrong in a world that
 * left OSE in descending mode — a mistake found by reading how the Dolmenwood
 * Character Sheet module does it, before it could cost a test round.
 */
function acRoot(actor: Actor): "aac" | "ac" {
  return (actor as SystemActor).system?.usesAscendingAC === false ? "ac" : "aac";
}

export function getSystemFields(actor: Actor): SystemFields {
  const sys = (actor as SystemActor).system;
  const num = (v: unknown, fallback = 0) => (typeof v === "number" ? v : fallback);

  const scores = {} as SystemFields["scores"];
  for (const { key } of ABILITIES) {
    const s = sys?.scores?.[key];
    scores[key] = { value: num(s?.value), bonus: num(s?.bonus) };
  }

  const saves = {} as SystemFields["saves"];
  for (const { key, ose } of SAVES) saves[key] = num(sys?.saves?.[ose]?.value);

  return {
    scores,
    saves,
    hp: { value: num(sys?.hp?.value), max: num(sys?.hp?.max) },
    ac: num(sys?.[acRoot(actor)]?.value),
    // Dolmenwood prints an Attack value where OSE keeps a base attack bonus.
    attack: num(sys?.thac0?.bba),
    speed: num(sys?.movement?.base),
    languages: (sys?.languages?.value ?? []).join(", "),
    class: sys?.details?.class ?? "",
    alignment: sys?.details?.alignment ?? "",
    level: num(sys?.details?.level, 1),
    xp: {
      value: num(sys?.details?.xp?.value),
      next: num(sys?.details?.xp?.next),
      bonus: num(sys?.details?.xp?.bonus),
    },
  };
}

/** Whether this actor carries scores this module can read at all. */
export function hasSystemFields(actor: Actor): boolean {
  return !!(actor as SystemActor).system?.scores;
}

/**
 * Write one field back, by the key the sheet used.
 *
 * **Armour class is the awkward one and needs saying.** OSE *derives* AC from
 * the armour worn, so writing the total straight into `.value` does not stick —
 * the next recalculation overwrites it. The editable part is `.mod`, so an edit
 * is turned into the difference it asked for. Learned by reading the Dolmenwood
 * Character Sheet module, which solves it the same way.
 */
export async function setSystemField(actor: Actor, field: string, value: unknown): Promise<void> {
  const sys = actor as SystemActor;

  if (field === "ac") {
    const root = acRoot(actor);
    const current = typeof sys.system?.[root]?.value === "number" ? sys.system[root]!.value! : 0;
    const mod = typeof sys.system?.[root]?.mod === "number" ? sys.system[root]!.mod! : 0;
    const wanted = typeof value === "number" ? value : Number(value) || 0;
    // The derived part is whatever the total is now, less the modifier on it.
    await sys.update?.({ [`system.${root}.mod`]: mod + (wanted - current) });
    return;
  }

  // OSE keeps languages as an **array**, and the sheet asks for them as one
  // line — because that is how a player writes a list. Split on commas, blanks
  // dropped, so "Woldish, Sylvan," is two languages and not three.
  if (field === "languages") {
    const list = String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await sys.update?.({ "system.languages.value": list });
    return;
  }

  const path = SYSTEM_PATHS[field];
  if (!path) return;
  await sys.update?.({ [path]: value });
}

/**
 * The path each editable field writes to.
 *
 * Data rather than a switch, so the template can carry the key on the input and
 * one handler serves every box — the trick the zone coin inputs already use.
 * `ac` and `languages` are deliberately absent: one is derived from the armour
 * worn and the other is an array written from one line of commas, so both go
 * through their own cases above.
 */
export const SYSTEM_PATHS: Record<string, string> = {
  hp: "system.hp.value",
  hpMax: "system.hp.max",
  attack: "system.thac0.bba",
  speed: "system.movement.base",
  class: "system.details.class",
  alignment: "system.details.alignment",
  level: "system.details.level",
  xp: "system.details.xp.value",
  xpNext: "system.details.xp.next",
  xpBonus: "system.details.xp.bonus",
  ...Object.fromEntries(
    ABILITIES.flatMap(({ key }) => [
      [`score-${key}`, `system.scores.${key}.value`],
      [`mod-${key}`, `system.scores.${key}.bonus`],
    ])
  ),
  ...Object.fromEntries(SAVES.map(({ key, ose }) => [`save-${key}`, `system.saves.${ose}.value`])),
};
