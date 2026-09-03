/**
 * The nine Class advancement tables (Player's Book pp57–79).
 *
 * **Generated, not typed** — by `extract-advancement.js` in the session
 * scratchpad, which reads each table twice out of the PDF (`pdftotext -table`
 * and `-raw`, two different parsers) and refuses to emit anything unless both
 * readings agree cell for cell and the ladder has the shape a ladder should:
 * Level 1 at 0 XP, no gaps, XP always climbing, Attack never falling, Save
 * Targets never rising. Re-run it rather than editing this file by hand.
 *
 * Four columns are taken and the rest deliberately left in the book: the XP
 * threshold, the Hit Points gained, the Attack value, and the five Save
 * Targets in the module's own order (Doom, Ray, Hold, Blast, Spell). Spell
 * slots, Skill Targets and the friar's AC Bonus are not here — they are per
 * Class in shape as well as in number, and the sheet does not model them.
 *
 * **Hit Points are the book's own strings**, not dice expressions this module
 * invented: "1d4" at Level 1, "+1d4" for each level after, and a flat "+1" or
 * "+2" from Level 11, where the book stops giving dice.
 */

import type { ClassKey } from "./xpAward";

export interface AdvancementRow {
  level: number;
  /** Total XP needed to reach this Level. */
  xp: number;
  /** What the book prints in the Hit Points column for this Level. */
  hp: string;
  attack: number;
  /** Doom, Ray, Hold, Blast, Spell — the module's order, the book's numbers. */
  saves: [number, number, number, number, number];
}

export const ADVANCEMENT: Record<ClassKey, AdvancementRow[]> = {
  bard: [
    { level: 1, xp: 0, hp: "1d6", attack: 0, saves: [13, 14, 13, 15, 15] },
    { level: 2, xp: 1750, hp: "+1d6", attack: 0, saves: [13, 14, 13, 15, 15] },
    { level: 3, xp: 3500, hp: "+1d6", attack: 1, saves: [12, 13, 12, 14, 14] },
    { level: 4, xp: 7000, hp: "+1d6", attack: 1, saves: [12, 13, 12, 14, 14] },
    { level: 5, xp: 14000, hp: "+1d6", attack: 2, saves: [11, 12, 11, 13, 13] },
    { level: 6, xp: 28000, hp: "+1d6", attack: 2, saves: [11, 12, 11, 13, 13] },
    { level: 7, xp: 56000, hp: "+1d6", attack: 3, saves: [10, 11, 10, 12, 12] },
    { level: 8, xp: 112000, hp: "+1d6", attack: 3, saves: [10, 11, 10, 12, 12] },
    { level: 9, xp: 220000, hp: "+1d6", attack: 4, saves: [9, 10, 9, 11, 11] },
    { level: 10, xp: 340000, hp: "+1d6", attack: 4, saves: [9, 10, 9, 11, 11] },
    { level: 11, xp: 460000, hp: "+1", attack: 5, saves: [8, 9, 8, 10, 10] },
    { level: 12, xp: 580000, hp: "+1", attack: 5, saves: [8, 9, 8, 10, 10] },
    { level: 13, xp: 700000, hp: "+1", attack: 6, saves: [7, 8, 7, 9, 9] },
    { level: 14, xp: 820000, hp: "+1", attack: 6, saves: [7, 8, 7, 9, 9] },
    { level: 15, xp: 940000, hp: "+1", attack: 7, saves: [6, 7, 6, 8, 8] },
  ],
  cleric: [
    { level: 1, xp: 0, hp: "1d6", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 2, xp: 1500, hp: "+1d6", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 3, xp: 3000, hp: "+1d6", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 4, xp: 6000, hp: "+1d6", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 5, xp: 12000, hp: "+1d6", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 6, xp: 24000, hp: "+1d6", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 7, xp: 48000, hp: "+1d6", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 8, xp: 96000, hp: "+1d6", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 9, xp: 190000, hp: "+1d6", attack: 4, saves: [7, 8, 9, 12, 10] },
    { level: 10, xp: 290000, hp: "+1d6", attack: 4, saves: [7, 8, 9, 12, 10] },
    { level: 11, xp: 390000, hp: "+1", attack: 5, saves: [6, 7, 8, 11, 9] },
    { level: 12, xp: 490000, hp: "+1", attack: 5, saves: [6, 7, 8, 11, 9] },
    { level: 13, xp: 590000, hp: "+1", attack: 6, saves: [5, 6, 7, 10, 8] },
    { level: 14, xp: 690000, hp: "+1", attack: 6, saves: [5, 6, 7, 10, 8] },
    { level: 15, xp: 790000, hp: "+1", attack: 7, saves: [4, 5, 6, 9, 7] },
  ],
  enchanter: [
    { level: 1, xp: 0, hp: "1d6", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 2, xp: 1750, hp: "+1d6", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 3, xp: 3500, hp: "+1d6", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 4, xp: 7000, hp: "+1d6", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 5, xp: 14000, hp: "+1d6", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 6, xp: 28000, hp: "+1d6", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 7, xp: 56000, hp: "+1d6", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 8, xp: 112000, hp: "+1d6", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 9, xp: 220000, hp: "+1d6", attack: 4, saves: [7, 8, 9, 12, 10] },
    { level: 10, xp: 340000, hp: "+1d6", attack: 4, saves: [7, 8, 9, 12, 10] },
    { level: 11, xp: 460000, hp: "+1", attack: 5, saves: [6, 7, 8, 11, 9] },
    { level: 12, xp: 580000, hp: "+1", attack: 5, saves: [6, 7, 8, 11, 9] },
    { level: 13, xp: 700000, hp: "+1", attack: 6, saves: [5, 6, 7, 10, 8] },
    { level: 14, xp: 820000, hp: "+1", attack: 6, saves: [5, 6, 7, 10, 8] },
    { level: 15, xp: 940000, hp: "+1", attack: 7, saves: [4, 5, 6, 9, 7] },
  ],
  fighter: [
    { level: 1, xp: 0, hp: "1d8", attack: 1, saves: [12, 13, 14, 15, 16] },
    { level: 2, xp: 2000, hp: "+1d8", attack: 1, saves: [12, 13, 14, 15, 16] },
    { level: 3, xp: 4000, hp: "+1d8", attack: 2, saves: [11, 12, 13, 14, 15] },
    { level: 4, xp: 8000, hp: "+1d8", attack: 3, saves: [10, 11, 12, 13, 14] },
    { level: 5, xp: 16000, hp: "+1d8", attack: 3, saves: [10, 11, 12, 13, 14] },
    { level: 6, xp: 32000, hp: "+1d8", attack: 4, saves: [9, 10, 11, 12, 13] },
    { level: 7, xp: 64000, hp: "+1d8", attack: 5, saves: [8, 9, 10, 11, 12] },
    { level: 8, xp: 128000, hp: "+1d8", attack: 5, saves: [8, 9, 10, 11, 12] },
    { level: 9, xp: 260000, hp: "+1d8", attack: 6, saves: [7, 8, 9, 10, 11] },
    { level: 10, xp: 380000, hp: "+1d8", attack: 7, saves: [6, 7, 8, 9, 10] },
    { level: 11, xp: 500000, hp: "+2", attack: 7, saves: [6, 7, 8, 9, 10] },
    { level: 12, xp: 620000, hp: "+2", attack: 8, saves: [5, 6, 7, 8, 9] },
    { level: 13, xp: 740000, hp: "+2", attack: 9, saves: [4, 5, 6, 7, 8] },
    { level: 14, xp: 860000, hp: "+2", attack: 9, saves: [4, 5, 6, 7, 8] },
    { level: 15, xp: 980000, hp: "+2", attack: 10, saves: [3, 4, 5, 6, 7] },
  ],
  friar: [
    { level: 1, xp: 0, hp: "1d4", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 2, xp: 1750, hp: "+1d4", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 3, xp: 3500, hp: "+1d4", attack: 0, saves: [11, 12, 13, 16, 14] },
    { level: 4, xp: 7000, hp: "+1d4", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 5, xp: 14000, hp: "+1d4", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 6, xp: 28000, hp: "+1d4", attack: 1, saves: [10, 11, 12, 15, 13] },
    { level: 7, xp: 56000, hp: "+1d4", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 8, xp: 112000, hp: "+1d4", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 9, xp: 220000, hp: "+1d4", attack: 2, saves: [9, 10, 11, 14, 12] },
    { level: 10, xp: 340000, hp: "+1d4", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 11, xp: 460000, hp: "+1", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 12, xp: 580000, hp: "+1", attack: 3, saves: [8, 9, 10, 13, 11] },
    { level: 13, xp: 700000, hp: "+1", attack: 4, saves: [7, 8, 9, 12, 10] },
    { level: 14, xp: 820000, hp: "+1", attack: 4, saves: [7, 8, 9, 12, 10] },
    { level: 15, xp: 940000, hp: "+1", attack: 4, saves: [7, 8, 9, 12, 10] },
  ],
  hunter: [
    { level: 1, xp: 0, hp: "1d8", attack: 1, saves: [12, 13, 14, 15, 16] },
    { level: 2, xp: 2250, hp: "+1d8", attack: 1, saves: [12, 13, 14, 15, 16] },
    { level: 3, xp: 4500, hp: "+1d8", attack: 2, saves: [11, 12, 13, 14, 15] },
    { level: 4, xp: 9000, hp: "+1d8", attack: 3, saves: [10, 11, 12, 13, 14] },
    { level: 5, xp: 18000, hp: "+1d8", attack: 3, saves: [10, 11, 12, 13, 14] },
    { level: 6, xp: 36000, hp: "+1d8", attack: 4, saves: [9, 10, 11, 12, 13] },
    { level: 7, xp: 72000, hp: "+1d8", attack: 5, saves: [8, 9, 10, 11, 12] },
    { level: 8, xp: 144000, hp: "+1d8", attack: 5, saves: [8, 9, 10, 11, 12] },
    { level: 9, xp: 290000, hp: "+1d8", attack: 6, saves: [7, 8, 9, 10, 11] },
    { level: 10, xp: 420000, hp: "+1d8", attack: 7, saves: [6, 7, 8, 9, 10] },
    { level: 11, xp: 550000, hp: "+2", attack: 7, saves: [6, 7, 8, 9, 10] },
    { level: 12, xp: 680000, hp: "+2", attack: 8, saves: [5, 6, 7, 8, 9] },
    { level: 13, xp: 810000, hp: "+2", attack: 9, saves: [4, 5, 6, 7, 8] },
    { level: 14, xp: 940000, hp: "+2", attack: 9, saves: [4, 5, 6, 7, 8] },
    { level: 15, xp: 1070000, hp: "+2", attack: 10, saves: [3, 4, 5, 6, 7] },
  ],
  knight: [
    { level: 1, xp: 0, hp: "1d8", attack: 1, saves: [12, 13, 12, 15, 15] },
    { level: 2, xp: 2250, hp: "+1d8", attack: 1, saves: [12, 13, 12, 15, 15] },
    { level: 3, xp: 4500, hp: "+1d8", attack: 2, saves: [11, 12, 11, 14, 14] },
    { level: 4, xp: 9000, hp: "+1d8", attack: 3, saves: [10, 11, 10, 13, 13] },
    { level: 5, xp: 18000, hp: "+1d8", attack: 3, saves: [10, 11, 10, 13, 13] },
    { level: 6, xp: 36000, hp: "+1d8", attack: 4, saves: [9, 10, 9, 12, 12] },
    { level: 7, xp: 72000, hp: "+1d8", attack: 5, saves: [8, 9, 8, 11, 11] },
    { level: 8, xp: 144000, hp: "+1d8", attack: 5, saves: [8, 9, 8, 11, 11] },
    { level: 9, xp: 290000, hp: "+1d8", attack: 6, saves: [7, 8, 7, 10, 10] },
    { level: 10, xp: 420000, hp: "+1d8", attack: 7, saves: [6, 7, 6, 9, 9] },
    { level: 11, xp: 550000, hp: "+2", attack: 7, saves: [6, 7, 6, 9, 9] },
    { level: 12, xp: 680000, hp: "+2", attack: 8, saves: [5, 6, 5, 8, 8] },
    { level: 13, xp: 810000, hp: "+2", attack: 9, saves: [4, 5, 4, 7, 7] },
    { level: 14, xp: 940000, hp: "+2", attack: 9, saves: [4, 5, 4, 7, 7] },
    { level: 15, xp: 1070000, hp: "+2", attack: 10, saves: [3, 4, 3, 6, 6] },
  ],
  magician: [
    { level: 1, xp: 0, hp: "1d4", attack: 0, saves: [14, 14, 13, 16, 14] },
    { level: 2, xp: 2500, hp: "+1d4", attack: 0, saves: [14, 14, 13, 16, 14] },
    { level: 3, xp: 5000, hp: "+1d4", attack: 0, saves: [14, 14, 13, 16, 14] },
    { level: 4, xp: 10000, hp: "+1d4", attack: 1, saves: [13, 13, 12, 15, 13] },
    { level: 5, xp: 20000, hp: "+1d4", attack: 1, saves: [13, 13, 12, 15, 13] },
    { level: 6, xp: 40000, hp: "+1d4", attack: 1, saves: [13, 13, 12, 15, 13] },
    { level: 7, xp: 80000, hp: "+1d4", attack: 2, saves: [12, 12, 11, 14, 12] },
    { level: 8, xp: 160000, hp: "+1d4", attack: 2, saves: [12, 12, 11, 14, 12] },
    { level: 9, xp: 320000, hp: "+1d4", attack: 2, saves: [12, 12, 11, 14, 12] },
    { level: 10, xp: 470000, hp: "+1d4", attack: 3, saves: [11, 11, 10, 13, 11] },
    { level: 11, xp: 620000, hp: "+1", attack: 3, saves: [11, 11, 10, 13, 11] },
    { level: 12, xp: 770000, hp: "+1", attack: 3, saves: [11, 11, 10, 13, 11] },
    { level: 13, xp: 920000, hp: "+1", attack: 4, saves: [10, 10, 9, 12, 10] },
    { level: 14, xp: 1070000, hp: "+1", attack: 4, saves: [10, 10, 9, 12, 10] },
    { level: 15, xp: 1220000, hp: "+1", attack: 4, saves: [10, 10, 9, 12, 10] },
  ],
  thief: [
    { level: 1, xp: 0, hp: "1d4", attack: 0, saves: [13, 14, 13, 15, 15] },
    { level: 2, xp: 1200, hp: "+1d4", attack: 0, saves: [13, 14, 13, 15, 15] },
    { level: 3, xp: 2400, hp: "+1d4", attack: 1, saves: [12, 13, 12, 14, 14] },
    { level: 4, xp: 4800, hp: "+1d4", attack: 1, saves: [12, 13, 12, 14, 14] },
    { level: 5, xp: 9600, hp: "+1d4", attack: 2, saves: [11, 12, 11, 13, 13] },
    { level: 6, xp: 19200, hp: "+1d4", attack: 2, saves: [11, 12, 11, 13, 13] },
    { level: 7, xp: 38400, hp: "+1d4", attack: 3, saves: [10, 11, 10, 12, 12] },
    { level: 8, xp: 76800, hp: "+1d4", attack: 3, saves: [10, 11, 10, 12, 12] },
    { level: 9, xp: 150000, hp: "+1d4", attack: 4, saves: [9, 10, 9, 11, 11] },
    { level: 10, xp: 270000, hp: "+1d4", attack: 4, saves: [9, 10, 9, 11, 11] },
    { level: 11, xp: 390000, hp: "+1", attack: 5, saves: [8, 9, 8, 10, 10] },
    { level: 12, xp: 510000, hp: "+1", attack: 5, saves: [8, 9, 8, 10, 10] },
    { level: 13, xp: 630000, hp: "+1", attack: 6, saves: [7, 8, 7, 9, 9] },
    { level: 14, xp: 750000, hp: "+1", attack: 6, saves: [7, 8, 7, 9, 9] },
    { level: 15, xp: 870000, hp: "+1", attack: 7, saves: [6, 7, 6, 8, 8] },
  ],
};

