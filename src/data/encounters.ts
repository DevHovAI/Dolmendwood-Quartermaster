import { regionInfo, terrainInfo, type Region, type Terrain, type Way } from "./dayContext";
import { t } from "../helpers/i18n";
import type { DutyMode } from "./dayDuties";

/**
 * Wandering monsters (Campaign Book pp.111, 114–115; Player's Book pp.155–157,
 * 164).
 *
 * The Campaign Book's procedure is six steps deep and nearly every one of them
 * is a roll: whether anything turns up at all, which of sixteen tables to read,
 * what is on it, how many, what it is doing, who is surprised, how far off, and
 * how it feels about the party. Done by hand that is a page-turn each; done
 * here it is one click, and the Referee reads a card that has already answered
 * all of them.
 *
 * **Only names, numbers, and mechanical effects live here.** Nothing of what a
 * mogglewomp looks like or how a redcap behaves — that is the Monster Book's,
 * and a Referee who wants it should be reading their own copy.
 *
 * The tables were parsed out of the PDF rather than typed, so a transcription
 * slip is one parser bug rather than three hundred chances to mis-key a die.
 */

/** The book's footnote marks, which say which bestiary section a name is in. */
export type EncounterMark = "animal" | "adventurer" | "everyday";

export const MARK_NOTES: Record<EncounterMark, string> = {
  animal: "Animals — Monster Book",
  adventurer: "Adventurers — Monster Book; typically Level 1 characters",
  everyday: "Everyday Mortals — Monster Book",
};

/** The bestiary section a mark points at, for the line that gives the page. */
export const MARK_SECTIONS: Record<EncounterMark, string> = {
  animal: "Animals",
  adventurer: "Adventurers",
  everyday: "Everyday Mortals",
};

/**
 * One row of an encounter table: what it is, how many, and where to read it up.
 *
 * `count` is usually a dice formula, occasionally a flat number, and for four
 * entries a page reference ("see p355") — those are named beings rather than a
 * group with a size, and the module says so instead of rolling.
 */
export type EncounterEntry = readonly [name: string, count: string, mark?: EncounterMark];

export type CommonTable = "animal" | "monster" | "mortal" | "sentient";

/** The sub-table an Encounter Type roll sends the Referee to. */
export type SubTable = CommonTable | "regional";

export const COMMON_ENCOUNTERS: Record<CommonTable, EncounterEntry[]> = {
  "animal": [
    ["Bat, Giant", "1d10", "animal"],
    ["Bear", "1d4", "animal"],
    ["Boar", "1d6", "animal"],
    ["Burrowing Beetle", "2d4", "animal"],
    ["Carrion Worm", "1d3", "animal"],
    ["Centipede, Giant", "1d8", "animal"],
    ["False Unicorn", "3d4", "animal"],
    ["Fire Beetle, Giant", "2d6", "animal"],
    ["Fly, Giant", "2d6", "animal"],
    ["Insect Swarm", "1d3", "animal"],
    ["Rapacious Beetle", "2d4", "animal"],
    ["Rat, Giant", "3d6", "animal"],
    ["Red Deer", "3d10", "animal"],
    ["Shaggy Mammoth", "2d8", "animal"],
    ["Snake—Adder", "1d8", "animal"],
    ["Stirge", "2d6", "animal"],
    ["Toad, Giant", "1d4", "animal"],
    ["Weasel, Giant", "1d6", "animal"],
    ["Wolf", "3d6", "animal"],
    ["Yegril", "3d8", "animal"],
  ],
  "monster": [
    ["Ant, Giant", "3d4", "animal"],
    ["Centaur—Bestial", "1"],
    ["Cockatrice", "1d4"],
    ["Ghoul", "2d4"],
    ["Griffon", "2d8", "animal"],
    ["Headless Rider", "1d4"],
    ["Mogglewomp", "1"],
    ["Mugwudge", "1d4"],
    ["Ogre", "1d6"],
    ["Owlbear", "1d4", "animal"],
    ["Root Thing", "1d4"],
    ["Snail, Giant—Mutant", "1d3"],
    ["Spinning Spider, Giant", "1d3", "animal"],
    ["Stirge", "2d6", "animal"],
    ["Treowere", "1d8"],
    ["Werewolf", "1d6"],
    ["Wolf, Dire", "2d4", "animal"],
    ["Wyrm—Black Bile", "1"],
    ["Wyrm—Blood", "1"],
    ["Yickerwill", "1d6"],
  ],
  "mortal": [
    ["Adventuring Party", ""],
    ["Cleric", "1d20", "adventurer"],
    ["Crier", "1d6", "everyday"],
    ["Drune—Cottager", "1d4"],
    ["Fighter", "2d6", "adventurer"],
    ["Fortune-Teller", "1d3", "everyday"],
    ["Friar", "1d6", "adventurer"],
    ["Hunter", "3d6", "adventurer"],
    ["Knight", "2d6", "adventurer"],
    ["Lost Soul", "1d4", "everyday"],
    ["Magician", "1d4", "adventurer"],
    ["Merchant", "1d20", "everyday"],
    ["Pedlar", "1d4", "everyday"],
    ["Pedlar", "1d4", "everyday"],
    ["Pilgrim", "4d8", "everyday"],
    ["Priest", "1d6", "everyday"],
    ["Thief (Bandit)", "3d10", "adventurer"],
    ["Thief (Bandit)", "3d10", "adventurer"],
    ["Villager", "2d10", "everyday"],
    ["Witch", "1d6"],
  ],
  "sentient": [
    ["Barrowbogey", "2d6"],
    ["Breggle—Shorthorn", "3d10"],
    ["Crookhorn", "3d10"],
    ["Deorling—Stag", "1d6"],
    ["Elf—Courtier or Knight", "1d4"],
    ["Elf—Wanderer", "1d6"],
    ["Goblin", "2d6"],
    ["Grimalkin", "1d4"],
    ["Mossling", "2d8"],
    ["Nutcap", "2d6"],
    ["Redcap", "2d6"],
    ["Scarecrow", "1d4"],
    ["Scrabey", "1d6"],
    ["Shape-Stealer", "1d6"],
    ["Sprite", "3d6"],
    ["Talking Animal", "1d4"],
    ["Treowere", "1d8"],
    ["Troll", "1d3"],
    ["Wodewose", "1d6"],
    ["Woodgrue", "3d6"],
  ],
};

export const REGIONAL_ENCOUNTERS: Record<Region, EncounterEntry[]> = {
  "aldweald": [
    ["Antler Wraith", "2d4"],
    ["Breggle—Shorthorn", "3d10"],
    ["Centaur—Sylvan", "2d6"],
    ["Deorling—Doe", "4d4"],
    ["Elf—Knight", "1d4"],
    ["Elf—Wanderer", "1d6"],
    ["Fairy Horse", "1"],
    ["Gelatinous Hulk", "1d4"],
    ["Gloam", "1"],
    ["Goblin", "2d6"],
    ["Grimalkin", "1d4"],
    ["Pedlar", "1d4", "everyday"],
    ["Redcap", "2d6"],
    ["Snail, Giant—Psionic", "1"],
    ["Sprite", "3d6"],
    ["Thief (Bandit)", "3d10", "adventurer"],
    ["Unicorn—Blessed", "1d6"],
    ["Wild Hunt", "see p355"],
    ["Witch", "1d6"],
    ["Woodgrue", "3d6"],
  ],
  "aquatic": [
    ["Adventuring Party", ""],
    ["Angler", "2d4", "everyday"],
    ["Boggin", "1d6"],
    ["Catfish, Giant", "1d2", "animal"],
    ["Crab, Giant", "1d6", "animal"],
    ["Fly, Giant", "2d6", "animal"],
    ["Insect Swarm", "1d3", "animal"],
    ["Kelpie", "1"],
    ["Killer Bee", "2d6", "animal"],
    ["Leech, Giant", "1d4", "animal"],
    ["Madtom", "1d12"],
    ["Merchant", "1d20", "everyday"],
    ["Merfaun", "2d6"],
    ["Pedlar", "1d4", "everyday"],
    ["Pike, Giant", "1d4", "animal"],
    ["Stirge", "2d6", "animal"],
    ["Thief (Pirate)", "3d10", "adventurer"],
    ["Toad, Giant", "1d4", "animal"],
    ["Water Termite, Giant", "1d3", "animal"],
    ["Wyrm—Phlegm", "1"],
  ],
  "dwelmfurgh": [
    ["Antler Wraith", "2d4"],
    ["Basilisk", "1d6"],
    ["Brambling", "1d4"],
    ["Centipede, Giant", "1d8", "animal"],
    ["Crookhorn", "3d10"],
    ["Drune—Audrune", "1"],
    ["Drune—Braithmaid", "1d4"],
    ["Drune—Cottager", "1d4"],
    ["Drune—Cottager", "2d6"],
    ["Drune—Drunewife", "1"],
    ["Lost Soul", "1d4", "everyday"],
    ["Shadow", "1d8"],
    ["Skeleton", "3d6"],
    ["Spinning Spider, Giant", "1d3", "animal"],
    ["Sprite", "3d6"],
    ["Thief (Bandit)", "3d10", "adventurer"],
    ["Wicker Giant", "1"],
    ["Wight", "1d6"],
    ["Witch", "1d6"],
    ["Wyrm—Yellow Bile", "1"],
  ],
  "fever-marsh": [
    ["Bat, Vampire", "1d10", "animal"],
    ["Black Tentacles", "1d4"],
    ["Bog Salamander", "1d3"],
    ["Centaur—Bestial", "1"],
    ["Crookhorn", "3d10"],
    ["Fly, Giant", "2d6", "animal"],
    ["Galosher", "2d6"],
    ["Gelatinous Hulk", "1d4"],
    ["Harridan", "1d3"],
    ["Insect Swarm", "1d3", "animal"],
    ["Jack-o’-Lantern", "1d8"],
    ["Leech, Giant", "1d4", "animal"],
    ["Madtom", "1d12"],
    ["Marsh Lantern", "1d12"],
    ["Mugwudge", "1d4"],
    ["Redcap", "2d6"],
    ["Shadow", "1d8"],
    ["Toad, Giant", "1d4", "animal"],
    ["Troll", "1d3"],
    ["Wyrm—Phlegm", "1"],
  ],
  "hags-addle": [
    ["Banshee", "1"],
    ["Bat, Giant", "1d10", "animal"],
    ["Black Tentacles", "1d4"],
    ["Bog Corpse", "2d4"],
    ["Bog Salamander", "1d3"],
    ["Boggin", "1d6"],
    ["Galosher", "2d6"],
    ["Ghoul", "2d4"],
    ["Gloam", "1"],
    ["Leech, Giant", "1d4", "animal"],
    ["Marsh Lantern", "1d12"],
    ["Mugwudge", "1d4"],
    ["Shadow", "1d8"],
    ["Swamp Sloth", "1d6", "animal"],
    ["Swamp Spider, Giant", "1d3", "animal"],
    ["The Hag", "see p82"],
    ["Toad, Giant", "1d4", "animal"],
    ["Troll", "1d3"],
    ["Unicorn—Corrupt", "1d6"],
    ["Wronguncle", "1"],
  ],
  "high-wold": [
    ["Barrowbogey", "2d6"],
    ["Breggle—Longhorn", "2d4"],
    ["Breggle—Shorthorn", "3d10"],
    ["Breggle—Shorthorn", "3d10"],
    ["Crier", "1d6", "everyday"],
    ["Devil Goat", "1d4"],
    ["Drune—Braithmaid", "1d4"],
    ["Drune—Cottager", "1d4"],
    ["Elf—Knight", "1d4"],
    ["Goblin", "2d6"],
    ["Grimalkin", "1d4"],
    ["Knight", "2d6", "adventurer"],
    ["Merchant", "1d20", "everyday"],
    ["Pedlar", "1d4", "everyday"],
    ["Priest", "1d6", "everyday"],
    ["Scrabey", "1d6"],
    ["Thief (Bandit)", "3d10", "adventurer"],
    ["Witch", "1d6"],
    ["Witch Owl", "1d6"],
    ["Woodgrue", "3d6"],
  ],
  "mulchgrove": [
    ["Bat, Vampire", "1d10", "animal"],
    ["Bog Corpse", "2d4"],
    ["Bog Salamander", "1d3"],
    ["Brainconk", "1d8"],
    ["Gelatinous Hulk", "1d4"],
    ["Jack-o’-Lantern", "1d8"],
    ["Mossling", "2d8"],
    ["Mossling", "2d8"],
    ["Mossling", "2d8"],
    ["Mossling", "4d8"],
    ["Mould Oracle", "1d3"],
    ["Ochre Slime-Hulk", "1"],
    ["Ochre Slime-Hulk", "1"],
    ["Onyx Blob", "1"],
    ["Pook Morel", "2d10"],
    ["Pook Morel", "2d10"],
    ["Redslob", "1d4"],
    ["Redslob", "1d4"],
    ["Wodewose", "1d6"],
    ["Wronguncle", "1"],
  ],
  "nagwood": [
    ["Atanuwë", "see p45"],
    ["Bat, Vampire", "1d10", "animal"],
    ["Bog Corpse", "2d4"],
    ["Centaur—Bestial", "1"],
    ["Crookhorn", "3d10"],
    ["Crookhorn", "3d10"],
    ["Crookhorn", "6d10"],
    ["Harpy", "2d4"],
    ["Harridan", "1d3"],
    ["Manticore", "1d4"],
    ["Ochre Slime-Hulk", "1"],
    ["Ogre", "1d6"],
    ["Ogre", "1d6"],
    ["Owlbear", "1d4", "animal"],
    ["Snail, Giant—Mutant", "1d3"],
    ["Spinning Spider, Giant", "1d4"],
    ["Treowere (Chaotic)", "1d8"],
    ["Unicorn—Corrupt", "1d6"],
    ["Wolf, Dire", "2d4", "animal"],
    ["Wyrm—Black Bile", "1"],
  ],
  "northern-scratch": [
    ["Banshee", "1"],
    ["Bat, Vampire", "1d10", "animal"],
    ["Black Tentacles", "1d4"],
    ["Bog Corpse", "2d4"],
    ["Bog Salamander", "1d3"],
    ["Deorling—Stag", "1d6"],
    ["Fomorian", "1d3"],
    ["Galosher", "2d6"],
    ["Gloam", "1"],
    ["Harridan", "1d3"],
    ["Leech, Giant", "1d4", "animal"],
    ["Madtom", "1d12"],
    ["Marsh Lantern", "1d12"],
    ["Mugwudge", "1d4"],
    ["Redcap", "2d6"],
    ["Scarecrow", "1d4"],
    ["Shadow", "1d8"],
    ["Spectre", "1d4"],
    ["Wight", "1d6"],
    ["Witch Owl", "1d6"],
  ],
  "table-downs": [
    ["Banshee", "1"],
    ["Crookhorn", "3d10"],
    ["Deorling—Doe", "4d4"],
    ["Drune—Cottager", "1d4"],
    ["Elf—Wanderer", "1d6"],
    ["Fly, Giant", "2d6", "animal"],
    ["Ghoul", "2d4"],
    ["Gloam", "1"],
    ["Harpy", "2d4"],
    ["Headless Rider", "1d4"],
    ["Lost Soul", "1d4", "everyday"],
    ["Peryton", "2d4"],
    ["Peryton", "2d4"],
    ["Shadow", "1d8"],
    ["Shape-Stealer", "1d6"],
    ["Skeleton", "3d6"],
    ["Spectre", "1d4"],
    ["Wight", "1d6"],
    ["Witch", "1d6"],
    ["Woodgrue", "3d6"],
  ],
  "tithelands": [
    ["Breggle—Shorthorn", "3d10"],
    ["Cleric", "1d20", "adventurer"],
    ["Elf—Wanderer", "1d6"],
    ["Fighter", "2d6", "adventurer"],
    ["Friar", "1d6", "adventurer"],
    ["Gloam", "1"],
    ["Goblin", "2d6"],
    ["Griffon", "2d8"],
    ["Grimalkin", "1d4"],
    ["Killer Bee", "2d6", "animal"],
    ["Knight", "2d6", "adventurer"],
    ["Merchant", "1d20", "everyday"],
    ["Mossling", "2d8"],
    ["Pilgrim", "4d8", "everyday"],
    ["Pook Morel", "2d10"],
    ["Scrabey", "1d6"],
    ["Sprite", "3d6"],
    ["Villager", "2d10", "everyday"],
    ["Witch", "1d6"],
    ["Woodgrue", "3d6"],
  ],
  "valley-of-wise-beasts": [
    ["Cobbin", "1d4"],
    ["Cobbin", "1d4"],
    ["Cobbin", "1d4"],
    ["Cobbin", "3d8"],
    ["Crookhorn", "3d10"],
    ["Crookhorn", "3d10"],
    ["Crookhorn", "3d10"],
    ["Deorling—Stag", "1d6"],
    ["Goblin", "2d6"],
    ["Grimalkin", "1d4"],
    ["Lost Soul", "1d4", "everyday"],
    ["Mossling", "2d8"],
    ["Ochre Slime-Hulk", "1"],
    ["Ogre", "1d6"],
    ["Owlbear", "1d4", "animal"],
    ["Redslob", "1d4"],
    ["Sprite", "3d6"],
    ["Troll", "1d3"],
    ["Wodewose", "1d6"],
    ["Woodgrue", "3d6"],
  ],
};

/**
 * The two unseasons that overrule the whole procedure (CB p111).
 *
 * During Chame there is a 2-in-6 chance that an encounter is serpents and wyrms
 * instead; during a Vague, that it is the risen dead. Where it applies the
 * Encounter Type roll is not made at all — this one d10 replaces every table.
 */
export const UNSEASON_ENCOUNTERS: Record<"chame" | "vague", EncounterEntry[]> = {
  "chame": [
    ["Galosher", "2d6"],
    ["Snake—Adder", "1d8"],
    ["Snake—Adder", "1d8"],
    ["Snake—Adder", "1d8"],
    ["Snake—Giant Python", "1d3"],
    ["Snake—Giant Python", "1d3"],
    ["Wyrm—Black Bile", "1"],
    ["Wyrm—Blood", "1"],
    ["Wyrm—Phlegm", "1"],
    ["Wyrm—Yellow Bile", "1"],
  ],
  "vague": [
    ["Banshee", "1"],
    ["Bog Corpse", "2d4"],
    ["Bog Corpse", "2d4"],
    ["Ghoul", "2d4"],
    ["Ghoul", "2d4"],
    ["Gloam", "1"],
    ["Headless Rider", "1"],
    ["Skeleton", "3d6"],
    ["Spectre", "1d4"],
    ["Wight", "1d6"],
  ],
};

/**
 * Creature Activity (CB p114), optional.
 *
 * Four entries end in a question mark, which the book explains as: roll another
 * encounter to find out who the other creature is. The card offers that as a
 * button rather than rolling it unasked — most of the time the Referee already
 * knows who is being chased.
 */
export const ACTIVITIES: string[] = [
  "Celebrating",
  "Chasing ?",
  "Constructing",
  "Defecating",
  "Dying / wounded",
  "Fleeing from ?",
  "Hallucinating",
  "Hunting / foraging",
  "In combat with ?",
  "Journey / pilgrimage",
  "Lost / exploring",
  "Marking territory",
  "Mating / courting",
  "Negotiating with ?",
  "Patrolling / guarding",
  "Resting / camping",
  "Ritual / magic",
  "Sleeping",
  "Trapped / imprisoned",
  "Washing",
];

/**
 * Where to read each creature up, and how likely it is to be at home.
 *
 * Two facts the Referee wants the moment a name is rolled, and both are in the
 * Monster Book rather than the Campaign Book: the page, and the creature's own
 * chance of being encountered in its lair. The procedure's step 3 offers a flat
 * 30% "for other creatures" — that is the fallback for the animals and everyday
 * mortals, whose compact stat blocks print no lair figure at all. Where the
 * bestiary gives one, it is used instead of the flat rate.
 *
 * **The pages were taken by position, not by name.** The Monster Book reprints
 * all sixteen encounter tables in its appendix with a page reference on every
 * row, so row 13 of Hag's Addle there is row 13 of Hag's Addle here. Its
 * appendix abbreviates some names where the Campaign Book does not ("Snail,
 * Gt.—Mutant"), and matching names across the two books would have had to guess
 * at exactly those. That the two orders agree was verified separately, all 320
 * rows. The handful of names that appear only in the Chame and Vague tables
 * took their page from the book's own by-type index instead.
 *
 * `lair` is the percentage the bestiary prints; `"none"` is the book saying the
 * creature keeps no lair; absent means it gives no figure, and the flat 30%
 * applies.
 */
export interface MonsterInfo {
  page: number;
  lair?: number | "none";
  /** The yickerwill alone: 90% at home by day and 10% at night. */
  lairNight?: number;
  /**
   * The condition the book attaches to the figure — "sleeping", "keeps no lair
   * in the mortal world", "its lairs are described on the campaign map".
   */
  lairNote?: string;
  /** Where a row names two creatures and the book gives two pages. */
  pageNote?: string;
}

export const MONSTERS: Record<string, MonsterInfo> = {
  "Adventuring Party": { page: 108 },
  "Angler": { page: 110 },
  "Ant, Giant": { page: 112 },
  "Antler Wraith": { page: 12, lair: 75 },
  "Banshee": { page: 13, lair: 10 },
  "Bard": { page: 104 },
  "Barrowbogey": { page: 14, lair: 25 },
  "Basilisk": { page: 15, lair: 40 },
  "Bat, Giant": { page: 112 },
  "Bat, Vampire": { page: 112 },
  "Bear": { page: 112 },
  "Black Tentacles": { page: 16, lair: "none" },
  "Boar": { page: 113 },
  "Bog Corpse": { page: 17, lair: 35 },
  "Bog Salamander": { page: 18, lair: 25 },
  "Boggin": { page: 19, lair: 25 },
  "Brainconk": { page: 20, lair: "none" },
  "Brambling": { page: 21, lair: "none" },
  "Breggle—Longhorn": { page: 22, lair: 10 },
  "Breggle—Shorthorn": { page: 23, lair: 20 },
  "Burrowing Beetle": { page: 113 },
  "Burrowing Beetle, Gt.": { page: 113 },
  "Carrion Worm": { page: 113 },
  "Catfish, Giant": { page: 113 },
  "Cave Salamander": { page: 113 },
  "Centaur—Bestial": { page: 24, lair: 25 },
  "Centaur—Sylvan": { page: 25, lair: "none" },
  "Centipede, Giant": { page: 113 },
  "Cleric": { page: 104 },
  "Cobbin": { page: 26, lair: 15 },
  "Cockatrice": { page: 27, lair: 25 },
  "Crab, Giant": { page: 113 },
  "Crier": { page: 110 },
  "Crookhorn": { page: 28, lair: 25 },
  "Crystaloid": { page: 29, lair: 70 },
  "Deorling—Doe": { page: 30, lair: "none" },
  "Deorling—Stag": { page: 31, lair: "none" },
  "Devil Goat": { page: 32, lair: "none" },
  "Drune—Audrune": { page: 33, lairNote: "its lairs are described on the campaign map" },
  "Drune—Braithmaid": { page: 34, lair: 20 },
  "Drune—Cottager": { page: 35, lair: 20 },
  "Drune—Drunewife": { page: 36, lair: 30 },
  "Earthworm, Giant": { page: 113 },
  "Elf—Courtier": { page: 37, lair: "none", lairNote: "keeps no lair in the mortal world" },
  "Elf—Courtier or Knight": { page: 37, lair: "none", lairNote: "keeps no lair in the mortal world", pageNote: "Knight on p38" },
  "Elf—Knight": { page: 38, lair: "none", lairNote: "keeps no lair in the mortal world" },
  "Elf—Wanderer": { page: 39, lair: "none", lairNote: "keeps no lair in the mortal world" },
  "Enchanter": { page: 105 },
  "Fairy Horse": { page: 40, lair: "none" },
  "False Unicorn": { page: 113 },
  "Fighter": { page: 105 },
  "Fire Beetle, Giant": { page: 114 },
  "Fly, Giant": { page: 114 },
  "Fomorian": { page: 41, lair: 35 },
  "Fortune-Teller": { page: 110 },
  "Friar": { page: 106 },
  "Frog, Giant": { page: 114 },
  "Galosher": { page: 42, lair: 75 },
  "Gargoyle": { page: 43, lair: 100 },
  "Gelatinous Ape": { page: 114 },
  "Gelatinous Hulk": { page: 44, lair: "none" },
  "Ghoul": { page: 45, lair: 20 },
  "Gloam": { page: 46, lair: 20 },
  "Gobble": { page: 114 },
  "Goblin": { page: 47, lair: "none", lairNote: "keeps no lair in the mortal world" },
  "Griffon": { page: 114 },
  "Grimalkin": { page: 48, lair: 10 },
  "Harpy": { page: 49, lair: 25 },
  "Harridan": { page: 50, lair: 40 },
  "Hawk": { page: 114 },
  "Hawk, Giant": { page: 115 },
  "Headhog": { page: 115 },
  "Headless Rider": { page: 51, lair: "none" },
  "Honey Badger": { page: 115 },
  "Hunter": { page: 106 },
  "Insect Swarm": { page: 115 },
  "Jack-o’-Lantern": { page: 52, lair: 15 },
  "Kelpie": { page: 53, lair: "none" },
  "Killer Bee": { page: 116 },
  "Knight": { page: 106 },
  "Leech, Giant": { page: 116 },
  "Lost Soul": { page: 111 },
  "Lurkey": { page: 116 },
  "Madtom": { page: 54, lair: 25 },
  "Magician": { page: 107 },
  "Manikin": { page: 55, lair: 75 },
  "Manticore": { page: 56, lair: 20 },
  "Marsh Lantern": { page: 57, lair: 100 },
  "Merchant": { page: 111 },
  "Merfaun": { page: 58, lair: 10 },
  "Merriman": { page: 116 },
  "Mogglewomp": { page: 59, lair: 50 },
  "Moss Mole": { page: 116 },
  "Mossling": { page: 60, lair: 50 },
  "Mould Oracle": { page: 61, lair: 65 },
  "Mugwudge": { page: 62, lair: 33 },
  "Nutcap": { page: 63, lair: 50 },
  "Ochre Slime-Hulk": { page: 64, lair: "none" },
  "Ogre": { page: 65, lair: 40 },
  "Onyx Blob": { page: 66, lair: "none" },
  "Ooze Salamander": { page: 116 },
  "Owlbear": { page: 116 },
  "Pedlar": { page: 111 },
  "Peryton": { page: 67, lair: 25 },
  "Pike, Giant": { page: 116 },
  "Pilgrim": { page: 111 },
  "Pook Morel": { page: 68, lair: 25 },
  "Priest": { page: 111 },
  "Puggle": { page: 117 },
  "Purple Worm": { page: 117 },
  "Rapacious Beetle": { page: 117 },
  "Rapacious Beetle, Gt.": { page: 117 },
  "Rat, Giant": { page: 117 },
  "Red Deer": { page: 117 },
  "Redcap": { page: 69, lair: "none", lairNote: "keeps no lair in the mortal world" },
  "Redslob": { page: 70, lair: "none" },
  "Root Thing": { page: 71, lair: "none" },
  "Scarecrow": { page: 72, lair: "none" },
  "Scrabey": { page: 73, lair: 15 },
  "Shadow": { page: 74, lair: 40 },
  "Shaggy Mammoth": { page: 117 },
  "Shape-Stealer": { page: 75, lair: 20 },
  "Skeleton": { page: 76, lair: "none" },
  "Slug, Giant": { page: 118 },
  "Snail, Giant—Mutant": { page: 77, lair: "none" },
  "Snail, Giant—Psionic": { page: 78, lair: 35, lairNote: "sleeping" },
  "Snake—Adder": { page: 118 },
  "Snake—Giant Python": { page: 118 },
  "Spectre": { page: 79, lair: 80 },
  "Spinning Spider, Giant": { page: 118 },
  "Sprite": { page: 80, lair: 15 },
  "Stirge": { page: 118 },
  "Swamp Sloth": { page: 118 },
  "Swamp Spider, Giant": { page: 118 },
  "Talking Animal": { page: 82, lair: 15 },
  "Thief": { page: 107 },
  "Toad, Giant": { page: 118 },
  "Treowere": { page: 83, lair: 50 },
  "Troll": { page: 84, lair: 30 },
  "Trotteling": { page: 119 },
  "Unicorn—Blessed": { page: 85, lair: "none" },
  "Unicorn—Corrupt": { page: 86, lair: "none" },
  "Villager": { page: 111 },
  "Water Termite, Giant": { page: 119 },
  "Weasel, Giant": { page: 119 },
  "Werewolf": { page: 87, lair: 25 },
  "Wicker Giant": { page: 88, lair: 50 },
  "Wight": { page: 89, lair: 50 },
  "Witch": { page: 90, lair: 20 },
  "Witch Owl": { page: 92, lair: 25 },
  "Woad": { page: 119 },
  "Wodewose": { page: 93, lair: "none" },
  "Wolf": { page: 119 },
  "Wolf, Dire": { page: 119 },
  "Woodgrue": { page: 94, lair: "none" },
  "Wronguncle": { page: 95, lair: "none" },
  "Wyrm—Black Bile": { page: 97, lair: 50 },
  "Wyrm—Blood": { page: 98, lair: 50 },
  "Wyrm—Phlegm": { page: 99, lair: 50 },
  "Wyrm—Yellow Bile": { page: 100, lair: 50 },
  "Yegril": { page: 119 },
  "Yickerwill": { page: 101, lair: 90, lairNight: 10, lairNote: "by day; 10% at night" },
};

/**
 * Where one of the module's own tables spells a creature differently from the
 * Monster Book's index.
 *
 * One entry so far: the Campaign Book's fishing table lands a "Giant catfish"
 * and the bestiary files it under "Catfish, Giant". Kept as a list rather than
 * solved by clever matching — a rule that turns one name into the other would
 * also turn names into each other that should stay apart.
 */
const NAME_ALIASES: Record<string, string> = {
  "Giant catfish": "Catfish, Giant",
  // Three encounter rows qualify a creature in brackets before giving its
  // number: "Thief (Bandit)† (3d10)", "Treowere (Chaotic) (1d8)". The
  // qualifier is the row's, not the bestiary's, so it is dropped for the lookup.
  "Thief (Bandit)": "Thief",
  "Thief (Pirate)": "Thief",
  "Treowere (Chaotic)": "Treowere",
};

export function monsterInfo(name: string | undefined): MonsterInfo | undefined {
  if (!name) return undefined;
  return MONSTERS[name] ?? MONSTERS[NAME_ALIASES[name] ?? ""];
}

/**
 * The chance this creature is at home, and where that figure comes from.
 *
 * Returns nothing at all for a creature the book says keeps no lair: there is
 * no roll to offer, and the card states it as a fact instead.
 */
export function lairChance(
  name: string | undefined,
  period: "day" | "night" = "day"
): { percent: number; source: string } | undefined {
  const info = monsterInfo(name);
  if (info?.lair === "none") return undefined;
  // One creature keeps different hours: the yickerwill is at home 90% of the
  // day and 10% of the night, and the check knows which it is being asked about.
  const printed = period === "night" && typeof info?.lairNight === "number" ? info.lairNight : info?.lair;
  if (typeof printed === "number")
    return {
      percent: printed,
      source:
        `the Monster Book's own figure for this creature (p${info?.page})` +
        (typeof info?.lairNight === "number" ? ` ${period === "night" ? "at night" : "by day"}` : "") +
        (info?.lairNote && typeof info.lairNight !== "number" ? ` — ${info.lairNote}` : ""),
    };
  return { percent: 30, source: "the basic 30%, which the procedure offers where the bestiary prints no figure" };
}

/** Does this activity leave a second creature to be determined? */
export function activityNeedsOther(activity: string): boolean {
  return activity.includes("?");
}

/**
 * Encounter Reactions (PB p165), 2d6.
 *
 * Rolled every time rather than only when "the creatures' potential reaction is
 * unclear", because a number the Referee is free to ignore costs nothing and a
 * page-turn costs the table its momentum. When parleying, the speaking
 * character's Charisma Modifier applies — which is why the card offers a
 * re-roll rather than treating the first one as final.
 */
export const REACTIONS: { max: number; label: string; hint: string }[] = [
  { max: 2, label: "Attacks", hint: "No parley: it is already coming." },
  { max: 5, label: "Hostile", hint: "May attack. Talking is possible but uphill." },
  { max: 8, label: "Uncertain", hint: "Wary, watching to see what the party does." },
  { max: 11, label: "Indifferent", hint: "May negotiate." },
  { max: 99, label: "Eager", hint: "Friendly." },
];

export function reactionFor(roll: number): { max: number; label: string; hint: string } {
  return REACTIONS.find((r) => roll <= r.max) ?? REACTIONS[REACTIONS.length - 1];
}

/** Which column of the Encounter Type table today's circumstances read. */
export type TypeColumn = "road" | "wild" | "fire" | "no-fire";

/**
 * The Encounter Type table (CB p114), 1d8 down each of four columns.
 *
 * Daytime splits on whether the party is on a made way or off it; nighttime on
 * whether the camp has a fire, which draws different things out of the dark.
 */
export const ENCOUNTER_TYPES: Record<TypeColumn, { label: string; rolls: SubTable[] }> = {
  road: {
    label: "daytime, road or track",
    rolls: ["animal", "monster", "mortal", "mortal", "sentient", "sentient", "regional", "regional"],
  },
  wild: {
    label: "daytime, travelling wild",
    rolls: ["animal", "monster", "mortal", "sentient", "regional", "regional", "regional", "regional"],
  },
  fire: {
    label: "nighttime, by a fire",
    rolls: ["monster", "monster", "mortal", "mortal", "sentient", "sentient", "regional", "regional"],
  },
  "no-fire": {
    label: "nighttime, no fire",
    rolls: ["animal", "animal", "monster", "monster", "monster", "regional", "regional", "regional"],
  },
};

/**
 * Which column to read.
 *
 * The fire is not asked for: the Camp tab already has a tick for lighting one,
 * and asking a second time for something the bar has been told would be the
 * kind of double question this module keeps removing.
 */
export function typeColumn(period: "day" | "night", way: Way, fire: boolean): TypeColumn {
  if (period === "night") return fire ? "fire" : "no-fire";
  return way === "wild" ? "wild" : "road";
}

export const SUB_TABLE_LABELS: Record<CommonTable, string> = {
  animal: "Animal",
  monster: "Monster",
  mortal: "Mortal",
  sentient: "Sentient",
};

/** The d20 a type roll sends the Referee to, and what to call it on the card. */
export function subTable(
  table: SubTable,
  region: Region
): { label: string; entries: EncounterEntry[] } {
  if (table === "regional") {
    return {
      label: regionInfo(region).label,
      entries: REGIONAL_ENCOUNTERS[region],
    };
  }
  return { label: SUB_TABLE_LABELS[table], entries: COMMON_ENCOUNTERS[table] };
}

/**
 * The chance of anything turning up at all.
 *
 * In the wilds it is the terrain's own figure — the same 1/2/3-in-6 that
 * governs getting lost (PB p157) — whether the party is walking through it or
 * camped in it. A settlement has its own pair: 2-in-6 by day and 1-in-6 by
 * night, and only while the characters are out and about rather than sitting in
 * an inn (PB p160), which is why the tick can simply be skipped on a quiet day.
 *
 * Poor visibility deliberately adds nothing. It raises the chance of *getting
 * lost*, and the Campaign Book says nothing about it raising this one.
 */
export function encounterChance(
  mode: DutyMode,
  period: "day" | "night",
  terrain: Terrain
): { inSix: number; reason: string } {
  if (mode === "settlement") {
    return period === "day"
      ? {
          inSix: 2,
          reason:
            "2-in-6 by day in a settlement, while the characters are out and about (Player's Book p160).",
        }
      : {
          inSix: 1,
          reason: "1-in-6 at night in a settlement, if the characters are active (Player's Book p160).",
        };
  }
  const terr = terrainInfo(terrain);
  return {
    inSix: terr.chanceIn6,
    reason: t("DOLMENWOOD.Encounter.Reason.Terrain", {
      chance: terr.chanceIn6,
      terrain: t(terr.labelKey),
      band: t(terr.bandLabelKey).toLowerCase(),
    }),
  };
}

/** What one encounter turned out to be. Stored on the day; cleared with it. */
export interface EncounterResult {
  period: "day" | "night";
  /** The check that decided whether anything turned up at all. */
  roll: number;
  chance: number;
  happened: boolean;

  // ── Everything below is present only once something did ──
  /** Set when the Chame or Vague override took over from the normal tables. */
  unseason?: "chame" | "vague";
  column?: TypeColumn;
  typeRoll?: number;
  table?: SubTable;
  tableLabel?: string;
  entryRoll?: number;
  /** The type the d8 first landed on, where the hex sent it back (only 1310). */
  rerolledType?: SubTable;
  name?: string;
  mark?: EncounterMark;
  /** The rolled size of the group; absent for a unique being. */
  number?: number;
  numberFormula?: string;
  /** A page reference instead of a number, for the four named beings. */
  reference?: string;
  /**
   * Set once the lair check has landed, in which case `number` is the number
   * at home rather than the number that would have been wandering.
   */
  inLair?: boolean;
  /**
   * What the number was before the lair multiplied it.
   *
   * Kept so a second press of the lair button re-derives from the wandering
   * number instead of multiplying the lair number again — one mis-click used to
   * turn twenty-eight shadows into a hundred and forty.
   */
  wanderingNumber?: number;
  /**
   * The lair check as it was rolled with the encounter, for the card to print.
   *
   * Kept beside `inLair` rather than folded into it because the card says both
   * *what* and *against what*: "1d100 = 43, against 30%" is the line a Referee
   * reads back when a player asks why there are twenty-eight of them.
   */
  lairRoll?: { roll: number; percent: number; source: string };
  activity?: string;
  activityRoll?: number;
  /**
   * Each side's 1d6; 1–2 is surprised (CB p114).
   *
   * `partyChance` is there because three hexes raise the party's own chance —
   * Red Gwen's bandits hide in the woods, and "opposing side has a 3-in-6
   * chance of being surprised" means the side opposing *them*.
   */
  surprise?: { party: number; creature: number; partyChance?: number };
  /**
   * The hex's own encounter rule, rolled and printed whether or not it fired.
   *
   * A miss belongs on the card as much as a hit: the Referee reading "this hex:
   * 2-in-6 marsh lanterns — 1d6 = 5" can see that the tables were consulted
   * *because* the hex declined, rather than because the rule was forgotten.
   */
  hexOwn?: {
    /** Absent where the book states the rule flatly rather than as a chance. */
    chance?: number;
    roll?: number;
    what: string;
    where?: string;
    kind: "instead" | "colour";
    fired: boolean;
    /** Set when the Referee pressed “the ordinary tables” and read them instead. */
    overruled?: boolean;
  }[];
  /**
   * What the hex supplied, where it supplied something the bestiary has no name
   * for — "a Wild Hunt in pursuit of 1d4 blessed unicorns", "the Moonlit Maw".
   *
   * `name` stays empty in that case, because everything hung off it (the stat
   * line, the HP roll, the map button) needs a creature the Monster Book knows.
   */
  hexWhat?: string;
  /**
   * Which of the night's four watches it falls in (1–4), for a nighttime check.
   *
   * The book leaves the timing to the Referee and suggests rolling for it; four
   * two-hour watches across eight hours of rest is the arrangement the Player's
   * Book describes and the bar's Watches duty already assumes.
   */
  watch?: number;
  distance?: { formula: string; feet: number };
  reaction?: { roll: number; label: string };
  /**
   * The Actor this name was found on, if it was found at all.
   *
   * Resolved once while the card is being built, so the button on it needs only
   * a lookup rather than a search of every compendium at click time. Absent
   * when nothing in the world or its compendia carries the name — most worlds
   * have no Dolmenwood bestiary installed, and the card simply prints the name.
   */
  uuid?: string;

  /**
   * Set when the party was in town, in which case nothing above it is.
   *
   * A settlement encounter is a scene off that settlement's own d6 table, not a
   * creature off the wilderness ones — no type roll, no number, no surprise, no
   * distance. Only the chance is shared. `text` is empty when the party is
   * somewhere the book does not detail and there was no table to read.
   */
  settlement?: { id: string; label: string; page: number; roll: number; text: string };
}
