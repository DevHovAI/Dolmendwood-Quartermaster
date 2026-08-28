/**
 * The Campaign Book's treasure tables (p392–394), and nothing that rolls them.
 *
 * A creature's stat block names its hoard in the book's own shorthand — `C3 +
 * R3 + M3` — and every one of those codes is a row in one of three tables:
 * **C** for coins, **R** for gems and art objects, **M** for magic items. Each
 * row is a *chance* and a *quantity*, not a certainty: `C5` says copper is 45%
 * likely, and a hoard that rolls badly on all four metals holds no coins at all.
 *
 * **Transcribed with `pdftotext -table`**, not `-layout`. The layout mode broke
 * the four-column Coins table into orphaned cells and silently mis-paired half
 * of them; the table mode kept the grid. The transcription is checked the way
 * the book itself offers to check it: every row prints its own **Average
 * Value**, and `check-treasure.js` recomputes that average from the chances and
 * dice here and compares. A mis-keyed row moves its average, so a typo in this
 * file fails a test rather than quietly making a dragon poor.
 *
 * Nothing here touches `game`, holds a Roll, or knows what a loot box is —
 * `treasureRolls.ts` owns all three.
 */

import type { CoinKey } from "./lootStore";

/**
 * One entry in a hoard table: how likely it is to be there at all, and how much
 * of it there is when it is.
 *
 * `formula` is written for Foundry's own dice parser, so `1d4 * 1000` is what
 * it says. The book prints "1d4 × 1,000".
 */
export interface HoardChance {
  chance: number;
  formula: string;
}

/**
 * Pellucidium against gold.
 *
 * The book gives the rate in passing — *"50sp = 1pp"* (Campaign Book p393) —
 * and it is the number that makes the printed averages come out: C9 is 30% of
 * 1d8 × 1,000pp and is listed at 6,750gp, which is only true at five gold to
 * the pellucidium.
 */
export const PELLUCIDIUM_IN_GP = 5;

/** What one coin of each kind is worth in gold, for checking the averages. */
export const COIN_VALUE_IN_GP: Record<CoinKey, number> = {
  cp: 0.01,
  sp: 0.1,
  gp: 1,
  pp: PELLUCIDIUM_IN_GP,
};

/** COINS, Campaign Book p393. Twelve rows, four metals. */
export const COIN_HOARDS: Record<string, Partial<Record<CoinKey, HoardChance>>> = {
  C1: { cp: { chance: 25, formula: "1d4 * 1000" }, sp: { chance: 10, formula: "1d3 * 1000" } },
  C2: { cp: { chance: 50, formula: "1d8 * 1000" }, sp: { chance: 35, formula: "1d8 * 1000" } },
  C3: { cp: { chance: 50, formula: "1d12 * 1000" }, sp: { chance: 40, formula: "1d8 * 1000" } },
  C4: {
    cp: { chance: 40, formula: "1d8 * 1000" },
    sp: { chance: 30, formula: "1d6 * 1000" },
    gp: { chance: 40, formula: "1d3 * 1000" },
  },
  C5: {
    cp: { chance: 45, formula: "1d10 * 1000" },
    sp: { chance: 40, formula: "1d12 * 1000" },
    gp: { chance: 30, formula: "1d8 * 1000" },
  },
  C6: {
    cp: { chance: 10, formula: "1d8 * 1000" },
    sp: { chance: 15, formula: "1d12 * 1000" },
    gp: { chance: 60, formula: "1d6 * 1000" },
  },
  C7: {
    cp: { chance: 10, formula: "1d6 * 1000" },
    sp: { chance: 40, formula: "2d8 * 1000" },
    gp: { chance: 35, formula: "2d6 * 1000" },
    pp: { chance: 25, formula: "1d2 * 1000" },
  },
  C8: {
    sp: { chance: 50, formula: "2d10 * 1000" },
    gp: { chance: 45, formula: "1d12 * 1000" },
    pp: { chance: 30, formula: "1d3 * 1000" },
  },
  C9: { pp: { chance: 30, formula: "1d8 * 1000" } },
  C10: { gp: { chance: 50, formula: "1d4 * 10000" }, pp: { chance: 50, formula: "1d6 * 1000" } },
  C11: {
    cp: { chance: 25, formula: "3d8 * 1000" },
    sp: { chance: 75, formula: "1d100 * 1000" },
    gp: { chance: 50, formula: "1d8 * 10000" },
    pp: { chance: 25, formula: "5d4 * 1000" },
  },
  C12: { gp: { chance: 40, formula: "2d4 * 1000" }, pp: { chance: 50, formula: "5d6 * 1000" } },
};

/** The book's own Average Value column, for the transcription check. */
export const COIN_AVERAGES: Record<string, number> = {
  C1: 25, C2: 180, C3: 200, C4: 900, C5: 1600, C6: 2200,
  C7: 4700, C8: 6500, C9: 6750, C10: 21000, C11: 42000, C12: 46000,
};

/** RICHES, Campaign Book p393. Gems and art objects. */
export const RICHES_HOARDS: Record<string, { gems?: HoardChance; art?: HoardChance }> = {
  R1: { gems: { chance: 50, formula: "1d4" } },
  R2: { gems: { chance: 10, formula: "1d10" }, art: { chance: 10, formula: "1d10" } },
  R3: { gems: { chance: 25, formula: "1d4" }, art: { chance: 25, formula: "1d4" } },
  R4: { gems: { chance: 25, formula: "1d6" }, art: { chance: 25, formula: "1d6" } },
  R5: { gems: { chance: 20, formula: "2d12" }, art: { chance: 10, formula: "1d12" } },
  R6: { art: { chance: 50, formula: "1d4" } },
  R7: { gems: { chance: 30, formula: "1d8" }, art: { chance: 30, formula: "1d8" } },
  R8: { gems: { chance: 25, formula: "3d6" }, art: { chance: 25, formula: "1d10" } },
  R9: { gems: { chance: 50, formula: "2d6" }, art: { chance: 50, formula: "2d6" } },
  R10: { gems: { chance: 55, formula: "5d4" }, art: { chance: 45, formula: "2d6" } },
  R11: { gems: { chance: 50, formula: "6d6" }, art: { chance: 50, formula: "6d6" } },
  R12: { gems: { chance: 50, formula: "1d100" }, art: { chance: 50, formula: "1d4 * 10" } },
};

/**
 * What one gem and one art object are worth on average.
 *
 * The book states both outright, as the shortcut it offers for hoards too large
 * to roll one by one: *"200gp for gems and 1,000gp for art objects"* (p394).
 * They are also what its Riches averages are built from.
 */
export const AVERAGE_GEM_GP = 200;
export const AVERAGE_ART_GP = 1000;

/** One thing a Magic Items row asks for. */
export interface MagicPart {
  /** `roll` means the type is rolled on the Magic Item Type table. */
  kind: "roll" | "potion" | "scroll" | "armourOrWeapon";
  /** A formula or a plain number, as the book writes it. */
  count: string;
}

/** MAGIC ITEMS, Campaign Book p393. */
export const MAGIC_HOARDS: Record<string, { chance: number; parts: MagicPart[] }> = {
  M1: { chance: 10, parts: [{ kind: "armourOrWeapon", count: "1" }] },
  M2: { chance: 15, parts: [{ kind: "roll", count: "1" }] },
  M3: { chance: 10, parts: [{ kind: "roll", count: "2" }] },
  M4: { chance: 15, parts: [{ kind: "roll", count: "2" }, { kind: "potion", count: "1" }] },
  M5: { chance: 40, parts: [{ kind: "potion", count: "2d4" }] },
  M6: { chance: 50, parts: [{ kind: "scroll", count: "1d4" }] },
  M7: {
    chance: 15,
    parts: [{ kind: "roll", count: "4" }, { kind: "potion", count: "1" }, { kind: "scroll", count: "1" }],
  },
  M8: { chance: 25, parts: [{ kind: "roll", count: "3" }, { kind: "scroll", count: "1" }] },
  M9: { chance: 30, parts: [{ kind: "roll", count: "3" }] },
  M10: {
    chance: 30,
    parts: [{ kind: "roll", count: "3" }, { kind: "potion", count: "1" }, { kind: "scroll", count: "1" }],
  },
  M11: { chance: 35, parts: [{ kind: "roll", count: "4" }, { kind: "scroll", count: "1" }] },
  M12: { chance: 50, parts: [{ kind: "roll", count: "2d4" }] },
};

/** A d100 band: `min` and `max` inclusive, where 100 is the book's "00". */
export interface Band<T> {
  min: number;
  max: number;
  it: T;
}

/**
 * MAGIC ITEM TYPE, Campaign Book p393.
 *
 * **The type is as far as this module goes.** Each of these twelve names heads
 * a chapter of its own with its own tables — appearance, powers, charges,
 * value — and the module ships no spell list, no monster list and no magic-item
 * list on purpose: the table has the book. So a hoard produces *"Magic ring,
 * not yet identified"* with the page in the Referee's own note, and the Referee
 * turns to p410 and chooses.
 */
export const MAGIC_ITEM_TYPES: Band<{ name: string; page: number }>[] = [
  { min: 1, max: 5, it: { name: "Amulet / talisman", page: 398 } },
  { min: 6, max: 20, it: { name: "Magic armour", page: 400 } },
  { min: 21, max: 25, it: { name: "Magic balm / oil", page: 402 } },
  { min: 26, max: 28, it: { name: "Magic crystal", page: 404 } },
  { min: 29, max: 30, it: { name: "Magic garment", page: 406 } },
  { min: 31, max: 32, it: { name: "Magic instrument", page: 408 } },
  { min: 33, max: 37, it: { name: "Magic ring", page: 410 } },
  { min: 38, max: 62, it: { name: "Magic weapon", page: 412 } },
  { min: 63, max: 77, it: { name: "Potion", page: 414 } },
  { min: 78, max: 82, it: { name: "Rod / staff / wand", page: 416 } },
  { min: 83, max: 97, it: { name: "Scroll / book", page: 418 } },
  { min: 98, max: 100, it: { name: "Wondrous item", page: 420 } },
];

/** GEM VALUE, Campaign Book p394. */
export const GEM_VALUES: Band<{ category: string; value: number }>[] = [
  { min: 1, max: 20, it: { category: "Ornamental", value: 10 } },
  { min: 21, max: 45, it: { category: "Semi-precious", value: 50 } },
  { min: 46, max: 75, it: { category: "Fancy", value: 100 } },
  { min: 76, max: 95, it: { category: "Precious", value: 500 } },
  { min: 96, max: 100, it: { category: "Gemstone", value: 1000 } },
];

/** GEM TYPE, Campaign Book p394. A d12 per value category. */
export const GEM_TYPES: Record<string, string[]> = {
  Ornamental: ["Azurite", "Banded agate", "Clear quartz", "Eye agate", "Hematite", "Lapis lazuli",
    "Malachite", "Moss agate", "Obsidian", "Rhodochrosite", "Tiger eye", "Turquoise"],
  "Semi-precious": ["Bloodstone", "Carnelian", "Chalcedony", "Chrysoprase", "Citrine", "Jasper",
    "Moonstone", "Onyx", "Rose quartz", "Sardonyx", "Smoky quartz", "Zircon"],
  Fancy: ["Amber", "Amethyst", "Ametrine", "Chrysoberyl", "Coral", "Grey ioun",
    "Jade", "Jet", "Kunzite", "Red garnet", "Tourmaline", "Violet spinel"],
  Precious: ["Amber with a trapped insect", "Aquamarine", "Beryl", "Blue spinel", "Chrysolite",
    "Diamond", "Pearl", "Peridot", "Red spinel", "Scintillant ioun", "Topaz", "Violet garnet"],
  Gemstone: ["Black opal", "Black pearl", "Black sapphire", "Blue diamond", "Emerald", "Fire opal",
    "Jacinth", "Opal", "Ruby", "Sapphire", "Star ruby", "Star sapphire"],
};

/**
 * ART OBJECTS, Campaign Book p394.
 *
 * The value is one roll for every object; the three tables under it are the
 * book's *optional* flavour, and they are rolled because an unnamed "art object,
 * 900gp" is a number rather than a thing. **Only the Jewellery table** is here:
 * the Miscellaneous Art Objects table beside it runs to fifty entries of
 * furniture and instruments, and the book itself says to use common sense about
 * what turns up in an animal's lair.
 */
export const ART_VALUE_FORMULA = "3d6 * 100";
/** Gems weigh 1 coin; a small art object weighs 10 (p394). */
export const GEM_WEIGHT = 1;
export const ART_WEIGHT = 10;

/**
 * MISCELLANEOUS ART OBJECTS, Campaign Book p395 — and what each one weighs.
 *
 * **The weights are this module's, not the book's.** The book gives one figure
 * and then hands the rest over: *"Small items (e.g. pieces of jewellery) weigh
 * 10 coins... The Referee should judge the weight of larger items."* A tapestry
 * that weighed the same as a comb was Leander's catch (2026-08-28), and a
 * hoard whose weight is a lie is worse than one with no weight at all, because
 * the party carries it home without noticing.
 *
 * So every entry is judged here once, against the catalogue's own scale — a
 * longsword is 30 coins, a shield 100, a backpack 50, a tent 20 — and the row
 * lands in the loot box **editable**, which is the honest place for a number
 * the book left to the table.
 *
 * `size` matters as much as the weight: a party playing in slots feels a rug as
 * two slots and a comb as none, and that is the whole difference between
 * carrying the hoard out and making two trips.
 */
export const MISC_ART_OBJECTS: Band<{ name: string; weight: number; size: "tiny" | "normal" | "large" }>[] = [
  { min: 1, max: 1, it: { name: "Ornamental armour", weight: 400, size: "large" } },
  { min: 2, max: 2, it: { name: "Astrolabe", weight: 30, size: "normal" } },
  { min: 3, max: 4, it: { name: "Bell", weight: 100, size: "normal" } },
  { min: 5, max: 7, it: { name: "Book", weight: 30, size: "normal" } },
  { min: 8, max: 9, it: { name: "Bowl", weight: 30, size: "normal" } },
  { min: 10, max: 11, it: { name: "Candelabra", weight: 60, size: "normal" } },
  { min: 12, max: 13, it: { name: "Chalice", weight: 20, size: "normal" } },
  { min: 14, max: 15, it: { name: "Chandelier", weight: 400, size: "large" } },
  { min: 16, max: 17, it: { name: "Clock", weight: 150, size: "large" } },
  { min: 18, max: 18, it: { name: "Comb", weight: 10, size: "tiny" } },
  { min: 19, max: 20, it: { name: "Cutlery", weight: 30, size: "normal" } },
  { min: 21, max: 22, it: { name: "Decanter", weight: 30, size: "normal" } },
  { min: 23, max: 25, it: { name: "Drinking horn", weight: 20, size: "normal" } },
  { min: 26, max: 27, it: { name: "Engraving", weight: 20, size: "normal" } },
  { min: 28, max: 29, it: { name: "Furniture", weight: 800, size: "large" } },
  { min: 30, max: 32, it: { name: "Furs", weight: 100, size: "normal" } },
  { min: 33, max: 33, it: { name: "Game set", weight: 50, size: "normal" } },
  { min: 34, max: 35, it: { name: "Glassware", weight: 40, size: "normal" } },
  { min: 36, max: 36, it: { name: "Gong", weight: 300, size: "large" } },
  { min: 37, max: 37, it: { name: "Ornamental helm", weight: 100, size: "normal" } },
  { min: 38, max: 40, it: { name: "Hunting horn", weight: 20, size: "normal" } },
  { min: 41, max: 42, it: { name: "Incense", weight: 10, size: "tiny" } },
  { min: 43, max: 44, it: { name: "Ivory", weight: 40, size: "normal" } },
  { min: 45, max: 47, it: { name: "Jewellery box", weight: 40, size: "normal" } },
  { min: 48, max: 50, it: { name: "Mirror", weight: 60, size: "normal" } },
  { min: 51, max: 52, it: { name: "Musical instrument", weight: 100, size: "normal" } },
  { min: 53, max: 53, it: { name: "Orb", weight: 30, size: "normal" } },
  { min: 54, max: 55, it: { name: "Painting of a landscape", weight: 150, size: "large" } },
  { min: 56, max: 58, it: { name: "Portrait", weight: 120, size: "large" } },
  { min: 59, max: 60, it: { name: "Triptych", weight: 250, size: "large" } },
  { min: 61, max: 63, it: { name: "Perfume", weight: 10, size: "tiny" } },
  { min: 64, max: 65, it: { name: "Porcelain", weight: 40, size: "normal" } },
  { min: 66, max: 68, it: { name: "Pottery", weight: 50, size: "normal" } },
  { min: 69, max: 71, it: { name: "Reliquary", weight: 50, size: "normal" } },
  { min: 72, max: 74, it: { name: "Rug", weight: 300, size: "large" } },
  { min: 75, max: 75, it: { name: "Sceptre", weight: 30, size: "normal" } },
  { min: 76, max: 76, it: { name: "Ornamental shield", weight: 100, size: "normal" } },
  { min: 77, max: 78, it: { name: "Silks", weight: 60, size: "normal" } },
  { min: 79, max: 80, it: { name: "Spices", weight: 10, size: "tiny" } },
  { min: 81, max: 83, it: { name: "Statuette", weight: 80, size: "normal" } },
  { min: 84, max: 87, it: { name: "Tapestry", weight: 250, size: "large" } },
  { min: 88, max: 90, it: { name: "Taxidermy", weight: 200, size: "large" } },
  { min: 91, max: 92, it: { name: "Tray", weight: 40, size: "normal" } },
  { min: 93, max: 95, it: { name: "Vase", weight: 60, size: "normal" } },
  { min: 96, max: 97, it: { name: "Ornamental weapon", weight: 30, size: "normal" } },
  { min: 98, max: 100, it: { name: "Wine", weight: 80, size: "normal" } },
];

/**
 * The four entries the book marks with an asterisk.
 *
 * *"Ornamental arms, valuable as works of art, but worthless in battle. Such
 * items are destroyed if used in combat."* Worth saying on the row, because an
 * ornamental shield that looks like a shield will otherwise be equipped by
 * somebody in the first round of the next fight.
 */
export const ORNAMENTAL_ARMS = [
  "Ornamental armour",
  "Ornamental helm",
  "Ornamental shield",
  "Ornamental weapon",
];

export const JEWELLERY: Band<string>[] = [
  { min: 1, max: 3, it: "Anklet" },
  { min: 4, max: 8, it: "Armlet" },
  { min: 9, max: 16, it: "Bracelet" },
  { min: 17, max: 24, it: "Brooch" },
  { min: 25, max: 27, it: "Buckle" },
  { min: 28, max: 31, it: "Choker" },
  { min: 32, max: 34, it: "Circlet" },
  { min: 35, max: 36, it: "Coronet" },
  { min: 37, max: 38, it: "Crown" },
  { min: 39, max: 41, it: "Diadem" },
  { min: 42, max: 49, it: "Earrings (pair)" },
  { min: 50, max: 54, it: "Hairpin" },
  { min: 55, max: 60, it: "Locket" },
  { min: 61, max: 68, it: "Medallion" },
  { min: 69, max: 78, it: "Necklace" },
  { min: 79, max: 88, it: "Pendant" },
  { min: 89, max: 98, it: "Ring" },
  { min: 99, max: 100, it: "Tiara" },
];

/** PRECIOUS MATERIALS, d20, Campaign Book p394. */
export const PRECIOUS_MATERIALS = [
  "alabaster", "amber", "brass", "bronze", "copper", "coral", "crystal", "electrum", "gold", "ivory",
  "jade", "meteoric iron", "obsidian", "pellucidium", "platinum", "porcelain", "rare wood", "silver",
  "unicorn horn", "wyrmskin",
];

/** EMBELLISHMENTS, d20, Campaign Book p394. */
export const EMBELLISHMENTS = [
  "adorned with feathers", "beaded", "bejewelled", "enamelled", "engraved with patterns",
  "engraved with unicorns", "engraved with words", "filigreed", "fur-trimmed", "gilded",
  "hammered", "bearing a coat of arms", "inlaid with mirror", "inlaid with precious metal",
  "inlaid with shells", "inlaid with unicorn horn", "intricately carved", "lacquered",
  "pearl-studded", "studded",
];

/**
 * The mean of "3d4", "1d10", "1d4 * 10".
 *
 * Used for the Monster Book's smaller-groups rule (p9): a lair holding fewer
 * creatures than its table averages may hold proportionally less treasure. The
 * average is the only half of that the module can work out; the reduction is
 * the Referee's, because the book says *may*.
 */
export function meanOfDice(formula: string | undefined): number | undefined {
  if (!formula) return undefined;
  const m = /^\s*(\d+)d(\d+)(?:\s*[*x×]\s*(\d+))?\s*$/i.exec(formula);
  if (!m) return undefined;
  return Number(m[1]) * ((Number(m[2]) + 1) / 2) * (m[3] ? Number(m[3]) : 1);
}

/** What a stat block's Possessions line asks for. */
export interface PossessionsPlan {
  /** One lot for the whole band, rather than one each. */
  perGroup: boolean;
  /** A gate on the whole line, where the book puts one — "1-in-4 chance". */
  chance?: { in: number; of: number };
  /** Coin the creature carries: "2d6" of "gp", per creature unless `perGroup`. */
  coins: { formula: string; metal: CoinKey }[];
  /** Treasure codes carried rather than hoarded — a few bands do. */
  codes: string[];
  /** Everything the tables have no room for, in the book's own words. */
  rest: string;
}

/**
 * Reading a Possessions line.
 *
 * Four shapes turn up in the book's 87 stat blocks, and this handles the three
 * that are mechanical:
 *
 *  - **Coin**, per creature: `2d6gp`, `3d6sp`, `5d20pp`.
 *  - **Treasure codes**, the same letters as a hoard: `C2 + R1`, `R3 + M2`.
 *  - **"Carried by group:"**, the book's own wording where one lot is shared
 *    between them. The difference between eight coins and eight purses, so it
 *    is read rather than assumed.
 *  - **Prose** — `platinum torc (350gp)`, `Ancestral sword (see below)`,
 *    `fairy trade goods (DCB)` — handed back untouched, like a hoard's.
 *
 * **A chance clause gates the whole line, unless it belongs to the trade
 * goods.** `3d6sp (1-in-4 chance)` means the coin may not be there at all;
 * `herbal trade goods (DCB, 2-in-6 chance)` is a chance on the trade goods,
 * which are prose anyway. The two are told apart by the `DCB` beside them.
 */
export function parsePossessions(line: string | undefined): PossessionsPlan | undefined {
  if (!line) return undefined;
  let text = line.trim();
  if (/^none\.?$/i.test(text)) return undefined;

  const perGroup = /carried by group:/i.test(text);
  text = text.replace(/carried by group:/i, " ");

  let chance: PossessionsPlan["chance"];
  const gate = /(\d+)-in-(\d+)\s+chance(\s+of)?/i.exec(text);
  // A chance printed beside "DCB" is the trade goods' own and not the line's.
  if (gate && !/DCB[,\s]*$/i.test(text.slice(Math.max(0, gate.index - 10), gate.index))) {
    chance = { in: Number(gate[1]), of: Number(gate[2]) };
    text = text.slice(0, gate.index) + text.slice(gate.index + gate[0].length);
  }

  const coins: PossessionsPlan["coins"] = [];
  text = text.replace(/(\d+d\d+)\s*(cp|sp|gp|pp)\b/g, (_whole, formula: string, metal: string) => {
    coins.push({ formula, metal: metal as CoinKey });
    return " ";
  });

  const { codes, rest } = parseHoard(text);
  return { perGroup, chance, coins, codes, rest };
}

/** Which band a d100 (or d12, or d20) landed in. */
export function bandFor<T>(bands: Band<T>[], roll: number): T {
  return (bands.find((b) => roll >= b.min && roll <= b.max) ?? bands[bands.length - 1]!).it;
}

/**
 * What a stat block's hoard line actually asks for.
 *
 * The Monster Book writes these by hand and not all of them are codes. Beside
 * the ordinary `C3 + R3 + M3` there are lines carrying a repeat — `C9 + R5 +
 * M10 + (R1 × 3)` — and lines carrying prose the tables have no room for: *"+
 * 4d4 gems"*, *"+ magical"*, *"+ earths and ores (1d10 × 100gp)"*, *"(remains of
 * victims)"*.
 *
 * **The codes are rolled and the prose is handed back verbatim.** Guessing at
 * what "collection" is worth would be inventing a rule; printing the book's own
 * words on the Referee's card is telling them what is left to decide. `rest` is
 * whatever was not a code, tidied of the joining punctuation.
 */
export function parseHoard(line: string | undefined): { codes: string[]; rest: string } {
  if (!line) return { codes: [], rest: "" };
  const codes: string[] = [];
  // `(R1 × 3)` — a code followed by a multiplier inside brackets, which is three
  // separate R1 hoards and not one big one.
  const withRepeats = line.replace(
    /[(]\s*([CRM])(\d{1,2})\s*[×x*]\s*(\d)\s*[)]/gi,
    (_whole, letter: string, row: string, times: string) =>
      new Array(Number(times)).fill(`${letter.toUpperCase()}${row}`).join(" + ")
  );
  const rest = withRepeats.replace(/\b([CRM])(\d{1,2})\b/g, (whole, letter: string, row: string) => {
    const code = `${letter.toUpperCase()}${row}`;
    if (code in COIN_HOARDS || code in RICHES_HOARDS || code in MAGIC_HOARDS) {
      codes.push(code);
      return "";
    }
    return whole;
  });
  return {
    codes,
    // What is left is punctuation and prose. The punctuation goes; the prose is
    // the part a Referee has to read.
    rest: rest.replace(/\s*[+/]\s*/g, " ").replace(/\s{2,}/g, " ").replace(/^[\s:+/]+|[\s:+/]+$/g, ""),
  };
}
