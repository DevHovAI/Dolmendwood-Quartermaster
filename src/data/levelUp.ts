/**
 * Levelling up, the Dolmendudes way.
 *
 * **The house rules, not the book's.** `docs/Hausregeln.pdf`, "Levelaufstieg
 * und Werte verbessern", prints one small table with four ways up:
 *
 * |        | Trainer          | no Trainer            | no Trainer, 50% extra XP | Cap erreicht        |
 * |--------|------------------|-----------------------|--------------------------|---------------------|
 * | Dauer  | bis Tagesende    | 5 Wochen              | 2 Wochen                 | sofort              |
 * | Kosten | 100 Gold / Level | 10 Gold / Woche / Level | 10 Gold / Woche / Level | 50 % der extra XP |
 *
 * The table says everything except three things, and Dolmenmaster settled all three
 * on 2026-09-02:
 *
 * 1. **"/ Level" is the Level the character still has**, not the one being
 *    bought — the book's own wording for training costs ("per Level of the
 *    trainee"). A Level 2 friar training to 3 pays 200 gold with a trainer.
 * 2. **"50% extra XP" is a requirement, not a payment.** The fast route without
 *    a trainer needs half the distance from the next threshold to the cap *on
 *    top of* the threshold — for that friar, 3,500 + 1,750 = **5,250 XP**.
 *    Nothing is deducted; the extra experience is what replaces the teacher.
 * 3. **The cap route is a payment**, and it is the one that costs XP: half the
 *    gap between the next threshold and the cap.
 *
 * **The cap itself is the house rule underneath all of it.** A character may go
 * on earning past the threshold for their next Level, but only as far as the
 * threshold for the one after that — that ceiling is the cap. Reaching it opens
 * the fourth route.
 *
 * **What the cap route buys is time, not a second Level** (Dolmenmaster's
 * correction, 2026-09-02: *"lvl2 spieler erreicht cap (lvl4) und steigt für 50%
 * der XP zwischen lvl3 und lvl4 auf lvl 3 auf"*). All four routes gain exactly
 * one Level. The difference is what each one costs to get there: a trainer and
 * 100 gold a Level, five weeks, two weeks and a head start of experience, or —
 * at the cap — nothing but the wait, paid for in XP on the spot.
 *
 * Everything here is pure. `check-levelup.js` in the scratchpad walks it
 * against Dolmenmaster's own worked example and the nine advancement tables.
 */

import { ADVANCEMENT } from "./advancement";
import type { ClassKey } from "./xpAward";

export type RouteId = "trainer" | "alone" | "aloneFast" | "cap";

/** Total XP needed to stand at this Level, or undefined past the table's end. */
export function thresholdFor(cls: ClassKey, level: number): number | undefined {
  return ADVANCEMENT[cls]?.find((r) => r.level === level)?.xp;
}

export function maxLevel(cls: ClassKey): number {
  const rows = ADVANCEMENT[cls] ?? [];
  return rows.length ? rows[rows.length - 1].level : 1;
}

/**
 * The ceiling on a character's XP total while they stay at this Level.
 *
 * Two Levels up, not one: the whole point of the cap is that a character may
 * bank the next Level's worth of experience without taking it. Undefined at the
 * top of the table, where there is nothing left to bank towards.
 */
export function xpCapFor(cls: ClassKey, level: number): number | undefined {
  return thresholdFor(cls, level + 2);
}

/**
 * The cap as a ceiling on an award, not just as a doorway to the fourth route.
 *
 * A character may earn up to the threshold two Levels above them and no
 * further, so experience handed out beyond that does not land. **What is lost
 * is returned rather than swallowed** — the XP window prints it on the row, and
 * a Referee who would rather rule otherwise can see exactly what they are
 * ruling on.
 */
export function applyCap(
  newTotal: number,
  cap: number | undefined
): { total: number; lost: number } {
  if (cap === undefined || newTotal <= cap) return { total: newTotal, lost: 0 };
  return { total: cap, lost: newTotal - cap };
}

export interface RouteOffer {
  id: RouteId;
  label: string;
  /** How long the training takes — the Referee's note, not a timer. */
  duration: string;
  /**
   * The Level left behind and the Level reached.
   *
   * **Always one apart, on all four routes.** The cap route buys *time*, not a
   * second Level: a Level 2 character standing at the cap goes to Level 3 like
   * everybody else — immediately, and for XP instead of weeks (Dolmenmaster's
   * correction, 2026-09-02).
   */
  fromLevel: number;
  toLevel: number;
  /** XP the character must already hold. */
  needXp: number;
  /** Coins, in gold pieces. */
  costGp: number;
  /** XP spent on the way up. Only the cap route charges any. */
  costXp: number;
  /** How the gold breaks down, for the line under the button. */
  costNote: string;
  available: boolean;
  /** Why not, when not — always said rather than left to be guessed. */
  blocked?: string;
}

/** Half a gap, rounded to a whole XP. Both house rules that need one use this. */
const halfGap = (from: number, to: number): number => Math.round((to - from) / 2);

/**
 * The four routes, in the table's own order, always all four.
 *
 * A route the character cannot take is returned blocked rather than dropped:
 * "you are 1,750 XP short of the cap" is the answer to the question they are
 * actually asking, and a missing button answers nothing.
 */
export function routesFor(cls: ClassKey, level: number, xp: number): RouteOffer[] {
  const next = thresholdFor(cls, level + 1);
  const cap = xpCapFor(cls, level);
  const top = maxLevel(cls);

  const atTop = next === undefined;
  const short = (need: number): string =>
    `${(need - xp).toLocaleString()} XP short — needs ${need.toLocaleString()}.`;

  const offers: RouteOffer[] = [];

  const single = (id: RouteId, label: string, duration: string, gp: number, note: string) => {
    const needXp = next ?? Infinity;
    offers.push({
      id,
      label,
      duration,
      fromLevel: level,
      toLevel: level + 1,
      needXp: next ?? 0,
      costGp: gp,
      costXp: 0,
      costNote: note,
      available: !atTop && xp >= needXp,
      blocked: atTop ? `Level ${top} is the top of the table.` : xp >= needXp ? undefined : short(needXp),
    });
  };

  single("trainer", "With a trainer", "Until the end of the day", 100 * level, `100 gp × Level ${level}`);
  single("alone", "Without a trainer", "5 weeks", 50 * level, `5 weeks × 10 gp × Level ${level}`);

  // The fast route needs the cap to measure its requirement against, so at the
  // last two Levels of the table it simply is not on offer.
  const fastNeed = next !== undefined && cap !== undefined ? next + halfGap(next, cap) : undefined;
  offers.push({
    id: "aloneFast",
    label: "Without a trainer, on extra XP",
    duration: "2 weeks",
    fromLevel: level,
    toLevel: level + 1,
    needXp: fastNeed ?? 0,
    costGp: 20 * level,
    costXp: 0,
    costNote: `2 weeks × 10 gp × Level ${level}`,
    available: fastNeed !== undefined && xp >= fastNeed,
    blocked:
      fastNeed === undefined
        ? atTop
          ? `Level ${top} is the top of the table.`
          : "No cap above this Level to measure the extra experience against."
        : xp >= fastNeed
          ? undefined
          : short(fastNeed),
  });

  // **The cap route, and the only one that spends experience.** It is the same
  // one Level as the other three — what the XP buys is the waiting: no trainer,
  // no weeks, the Level is taken on the spot. The price is half the gap the
  // character has just banked, which is the experience they earned beyond the
  // Level they are taking and now give up.
  const capCost = next !== undefined && cap !== undefined ? halfGap(next, cap) : 0;
  offers.push({
    id: "cap",
    label: "At the cap, without waiting",
    duration: "At once",
    fromLevel: level,
    toLevel: level + 1,
    needXp: cap ?? 0,
    costGp: 0,
    costXp: capCost,
    costNote: `${capCost.toLocaleString()} XP — half of ${(cap ?? 0).toLocaleString()} − ${(next ?? 0).toLocaleString()}`,
    available: cap !== undefined && xp >= cap,
    blocked:
      cap === undefined
        ? `No Level ${level + 2} on the table, so there is no cap to reach.`
        : xp >= cap
          ? undefined
          : short(cap),
  });

  return offers;
}

// ─── What a Level actually changes ────────────────────────────────────────────

export interface HpGain {
  level: number;
  /** What the book prints for that Level: "+1d6", or a flat "+1". */
  printed: string;
  rolled: number;
  conMod: number;
  /** After the book's floor of one Hit Point per Level. */
  gained: number;
}

/**
 * The Hit Points for one Level, given a roll.
 *
 * **Two rules from p22, and both are easy to get wrong.** The Constitution
 * Modifier is added "at Level 1 and every time a level is gained thereafter up
 * to Level 10" — so a Level 11 gain gets none, which is also why the book stops
 * printing dice there. And "a character always gains at least 1 Hit Point per
 * Level, regardless of Constitution Modifier", so a bad roll and a −3 never add
 * up to nothing.
 *
 * The roll is passed in rather than made here, so this stays testable.
 */
export function hpGainFor(printed: string, level: number, roll: number, conMod: number): HpGain {
  const flat = /^\+(\d+)$/.exec(printed);
  if (flat) {
    return { level, printed, rolled: Number(flat[1]), conMod: 0, gained: Number(flat[1]) };
  }
  const mod = level <= 10 ? conMod : 0;
  return { level, printed, rolled: roll, conMod: mod, gained: Math.max(1, roll + mod) };
}

/** The die a Level's Hit Points are rolled on, or null where the book prints a flat number. */
export function hpDieFor(cls: ClassKey, level: number): string | null {
  const printed = ADVANCEMENT[cls]?.find((r) => r.level === level)?.hp ?? "";
  const die = /(\d*d\d+)/.exec(printed);
  return die ? die[1] : null;
}

export interface LevelChange {
  fromLevel: number;
  toLevel: number;
  /** The Attack value the new Level prints, and the one it replaces. */
  attack: { from: number; to: number };
  /** Doom, Ray, Hold, Blast, Spell — before and after. */
  saves: { from: number[]; to: number[] };
  /** The XP total the new Level asks for next. 0 past the end of the table. */
  nextXp: number;
}

/**
 * What the advancement table says about the move, Hit Points aside.
 *
 * Hit Points are rolled and so live in `hpGainFor`; everything here is read
 * straight off the printed row.
 */
export function levelChange(cls: ClassKey, fromLevel: number, toLevel: number): LevelChange | null {
  const rows = ADVANCEMENT[cls];
  const before = rows?.find((r) => r.level === fromLevel);
  const after = rows?.find((r) => r.level === toLevel);
  if (!before || !after) return null;
  return {
    fromLevel,
    toLevel,
    attack: { from: before.attack, to: after.attack },
    saves: { from: [...before.saves], to: [...after.saves] },
    nextXp: thresholdFor(cls, toLevel + 1) ?? 0,
  };
}
