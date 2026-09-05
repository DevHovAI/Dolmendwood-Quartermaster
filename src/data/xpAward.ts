/**
 * Awarding experience: the book's arithmetic, with no window attached.
 *
 * Everything here is pure — it takes numbers and gives numbers back — so the
 * rules can be checked against the Player's Book by a script rather than by
 * clicking through Foundry. The window in `XpAwardApp.ts` only collects the
 * figures and shows what these functions say.
 *
 * **Two pages of the Player's Book, and both are quoted rather than
 * remembered:**
 *
 * - p25, *Dividing Party XP*: "All XP awarded to the party is totalled and
 *   divided evenly between all party members who survived the adventure.
 *   Awarded XP is always divided evenly, irrespective of how the party decides
 *   to divide treasure." Adventurer retainers are counted as party members for
 *   the division but "all XP they earn is halved"; townsfolk retainers gain no
 *   XP at all and are not counted in the division.
 * - p22, *Prime Abilities*: a character's score in their Prime Ability sets a
 *   modifier applied to all XP earned, and "for Classes with multiple Prime
 *   Abilities, the lowest score determines a character's XP modifier".
 */

import type { AbilityKey } from "./characterSheet";
import { getExtras, getSystemFields, hasSystemFields } from "./characterSheet";

// ─── The Prime Abilities of each Class (Player's Book p19) ────────────────────

export type ClassKey =
  | "bard"
  | "cleric"
  | "enchanter"
  | "fighter"
  | "friar"
  | "hunter"
  | "knight"
  | "magician"
  | "thief";

/**
 * The Summary of Classes table, Prime Abilities column only.
 *
 * Read out of the book with `pdftotext -table` (printed p19 = PDF p21) — the
 * `-layout` mode interleaves this table's columns and pairs the wrong Hit Dice
 * with the wrong Class, which is exactly the trap the module's own note about
 * `-table` warns of. Only the Prime Abilities are taken: Hit Points and Combat
 * Aptitude are the system's business, not this module's.
 *
 * **The aliases are a kindness, not a rule.** OSE keeps the Class as free text
 * and Dolmenmaster's table plays in German, so a field reading "Kämpfer" should not
 * silently fall back to "no modifier known". They are matched as whole words
 * and longest-first, because `zauberer` sits inside `verzauberer` and would
 * otherwise turn every enchanter into a magician.
 */
/**
 * Which Classes prepare spells after a night's rest.
 *
 * **Three, and the book is specific about which.** Clerics and friars *pray*
 * for their spells (pp… the Class entries say "praying for spells" outright)
 * and magicians *memorise* theirs from a spell book. Those are the three the
 * morning's duty is about, and the 1-in-6 loss after a bad night applies to
 * "memorising or praying" (p159).
 *
 * **The enchanter is deliberately not here**, though it is plainly a magical
 * Class: glamours are used a number of times per day rather than prepared after
 * a rest, so a morning that asked an enchanter how many spells they were
 * preparing would be asking a question their sheet has no answer to. The bard
 * is not here either — countercharm and enchantment are Class abilities, not
 * prepared spells.
 */
export const PREPARES_SPELLS = new Set<ClassKey>(["cleric", "friar", "magician"]);

export const CLASSES: {
  key: ClassKey;
  label: string;
  prime: AbilityKey[];
  aliases: string[];
}[] = [
  { key: "bard", label: "Bard", prime: ["cha", "dex"], aliases: ["barde", "bardin"] },
  { key: "cleric", label: "Cleric", prime: ["wis"], aliases: ["kleriker", "klerikerin", "priester"] },
  { key: "enchanter", label: "Enchanter", prime: ["cha", "int"], aliases: ["verzauberer", "verzauberin"] },
  {
    key: "fighter",
    label: "Fighter",
    prime: ["str"],
    aliases: ["kaempfer", "kampfer", "krieger", "kriegerin"],
  },
  {
    key: "friar",
    label: "Friar",
    prime: ["int", "wis"],
    aliases: ["moench", "monch", "ordensbruder", "bruder"],
  },
  { key: "hunter", label: "Hunter", prime: ["con", "dex"], aliases: ["jaeger", "jager", "jagerin"] },
  { key: "knight", label: "Knight", prime: ["cha", "str"], aliases: ["ritter", "ritterin"] },
  {
    key: "magician",
    label: "Magician",
    prime: ["int"],
    aliases: ["magier", "magierin", "zauberer", "zauberin"],
  },
  { key: "thief", label: "Thief", prime: ["dex"], aliases: ["dieb", "diebin", "schurke", "schurkin"] },
];

/**
 * Fold a free-text Class field down to something matchable: lower case, with
 * the umlauts and the ß flattened the way a German keyboard's fallback spells
 * them, so "Kämpfer", "Kaempfer" and "KAMPFER" all arrive as one word.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Which Class a free-text field names, or null.
 *
 * Whole words only, so "Fighter 3" and "Magician (Woldish)" both land while a
 * character named after a class does not drag its name in. Longest match wins,
 * so "Verzauberer" is an enchanter rather than a magician.
 */
export function classFromText(text: string): ClassKey | null {
  const hay = normalise(text);
  if (hay === "") return null;

  const words = new Set(hay.split(" "));
  let best: { key: ClassKey; length: number } | null = null;

  for (const cls of CLASSES) {
    for (const word of [cls.key, ...cls.aliases]) {
      if (words.has(word) && (!best || word.length > best.length)) {
        best = { key: cls.key, length: word.length };
      }
    }
  }
  return best?.key ?? null;
}

// ─── The Prime Ability XP modifier (Player's Book p22) ────────────────────────

/**
 * The Prime Ability XP Modifiers table.
 *
 * **The book prints four rows, not five.** 3–5 is −20%, 6–8 is −10%, 13–15 is
 * +5% and 16–18 is +10%; there is no row for 9–12, and that absence is the rule
 * — an average Prime Ability changes nothing. The middle band is written out
 * here anyway so the table reads as a ladder rather than as four rows with a
 * hole in them.
 *
 * Scores outside 3–18 cannot happen by the book's own character creation, so
 * the ends are clamped rather than given rows of their own.
 */
export const XP_MODIFIER_BANDS: { min: number; max: number; percent: number }[] = [
  { min: 3, max: 5, percent: -20 },
  { min: 6, max: 8, percent: -10 },
  { min: 9, max: 12, percent: 0 },
  { min: 13, max: 15, percent: 5 },
  { min: 16, max: 18, percent: 10 },
];

export function xpModifierForScore(score: number): number {
  if (score <= 5) return -20;
  if (score >= 16) return 10;
  const band = XP_MODIFIER_BANDS.find((b) => score >= b.min && score <= b.max);
  return band?.percent ?? 0;
}

// ─── Where a character's modifier comes from ──────────────────────────────────

/**
 * Two sources, and the window always says which one it used.
 *
 * `class` — the Class field named a Class this module knows, so the modifier is
 * worked out from the character's own Prime Ability scores. This is the one
 * that keeps up: raise a score and the percentage follows.
 * `field`  — no Class recognised, so OSE's own `system.details.xp.bonus` is
 * taken at its word. It is what the attribute sheet has always edited.
 * `none`   — neither, which means 0% and a note in the row rather than a silent
 * assumption.
 */
export type ModifierSource = "class" | "field" | "none";

export interface PrimeReading {
  classKey: ClassKey;
  classLabel: string;
  /** The Prime Abilities of that Class, and the score each one holds. */
  scores: { key: AbilityKey; score: number }[];
  /** The one that decides it — the lowest, by the book. */
  lowest: number;
}

export interface MemberModifier {
  percent: number;
  source: ModifierSource;
  prime: PrimeReading | null;
}

/**
 * Does this character prepare spells of a morning?
 *
 * **The Class answers it, and the sheet may overrule.** A recognised Class that
 * prepares is a yes; anything else falls back to the number the player typed
 * into "spells prepared" on the attribute sheet, so a Class this module does
 * not know, a ruling at the table or an item that grants casting all still
 * work. Nought and no casting Class means the morning does not ask about them
 * at all (Dolmenmaster, 2026-09-03: *"nur die angezeigt werden, die eine class mit
 * spells spielen"*).
 */
export function preparesSpells(actor: Actor): boolean {
  const key = classFromText(getSystemFields(actor).class ?? "");
  if (key) return PREPARES_SPELLS.has(key) || (getExtras(actor).prepares ?? 0) > 0;
  return (getExtras(actor).prepares ?? 0) > 0;
}

export function readModifier(actor: Actor): MemberModifier {
  if (!hasSystemFields(actor)) return { percent: 0, source: "none", prime: null };

  const sys = getSystemFields(actor);
  const classKey = classFromText(sys.class ?? "");

  const manual = getExtras(actor).xpBonusManual;

  if (classKey) {
    const cls = CLASSES.find((c) => c.key === classKey)!;
    const scores = cls.prime.map((key) => ({ key, score: sys.scores[key]?.value ?? 0 }));
    const lowest = Math.min(...scores.map((s) => s.score));
    // The Class is still reported even when its number is not used: it is what
    // names the Prime Abilities in the row, and what the XP cap is read from.
    const prime = { classKey, classLabel: cls.label, scores, lowest };

    // **A hand-typed modifier outranks the Class.** The sheet lets a Referee
    // overrule the derived percentage, and a window that quietly went on using
    // the Class's own figure would make that box a lie.
    //
    // A score of 0 counts as the same thing by a different route: it means the
    // sheet was never filled in, not a terrible character, and reading it as
    // −20% would quietly rob somebody.
    if (manual || scores.some((s) => s.score <= 0)) {
      return { percent: sys.xp.bonus, source: manual || sys.xp.bonus !== 0 ? "field" : "none", prime };
    }
    return { percent: xpModifierForScore(lowest), source: "class", prime };
  }

  return { percent: sys.xp.bonus, source: sys.xp.bonus === 0 ? "none" : "field", prime: null };
}

// ─── The arithmetic ───────────────────────────────────────────────────────────

/**
 * The even split, and what it cannot divide.
 *
 * **Floored, with the remainder left over and shown.** The book says the total
 * is divided evenly; it does not say who gets the odd point, and inventing a
 * rule that hands it to whoever sorts first would be the module deciding
 * something that is the Referee's to decide. So five characters splitting 1,002
 * XP get 200 each and the window says two are left over — a sentence a Referee
 * can act on.
 */
export function splitEvenly(total: number, count: number): { each: number; remainder: number } {
  if (count <= 0) return { each: 0, remainder: total };
  const each = Math.floor(total / count);
  return { each, remainder: total - each * count };
}

export interface AwardLine {
  /** The even share, before this character's own circumstances. */
  base: number;
  /** After OSE's share percentage — the retainer's half, where it is set. */
  shared: number;
  /** The Prime Ability modifier, as a percentage. */
  percent: number;
  /** What that percentage is worth in XP, positive or negative. */
  bonus: number;
  /** What is actually credited. */
  award: number;
  newTotal: number;
  levelUp: boolean;
}

/**
 * One character's line, from their share to their new total.
 *
 * **Rounded to the nearest whole XP at each of the two steps.** Unlike the even
 * split above, halving a share and applying a percentage only ever touch the
 * character they belong to, so rounding here takes nothing from anybody else
 * and the ordinary rounding is the honest one.
 *
 * The order is the book's: divide first (p25), then halve a retainer's earnings
 * (p25), then apply the Prime Ability modifier to what they earned (p22).
 */
export function awardFor(
  base: number,
  sharePct: number,
  percent: number,
  current: number,
  next: number
): AwardLine {
  const shared = Math.round((base * sharePct) / 100);
  const bonus = Math.round((shared * percent) / 100);
  const award = shared + bonus;
  const newTotal = current + award;
  return {
    base,
    shared,
    percent,
    bonus,
    award,
    newTotal,
    // `next` is a figure the Referee types on the attribute sheet, so a zero
    // means "not filled in" rather than "levels up at nothing".
    levelUp: next > 0 && current < next && newTotal >= next,
  };
}
