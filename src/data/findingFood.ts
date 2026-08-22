import { seasonInfo, type Season, type Terrain } from "./dayContext";

/**
 * Finding food in the wild (Player's Book p152; Campaign Book pp.116–121).
 *
 * Three procedures, not one. The bar's "Finding food" duty used to be a plain
 * tick, and the three differ in what they need and what they give:
 *
 * - **Fishing** needs a rod and tackle and a hex with a lake or river. 2d6
 *   rations, and a d20 catch table where a third of the entries bite back.
 * - **Foraging** needs nothing. 1d6 rations — 1d4 in winter, 1d8 in autumn —
 *   and a d6 for fungi or plants before the d20 for which.
 * - **Hunting** yields nothing by itself: it ends with the party creeping up on
 *   game animals, and the rations come out of the combat that follows, by the
 *   Hit Points of what they kill.
 *
 * All three are one Survival Check for the group, using the best Skill Target
 * among them, +2 if the whole day is given over to it.
 *
 * **Only the names and the mechanical effects are recorded here**, never the
 * books' descriptive prose. A Referee reading out what a marshgut smells like
 * should be reading it from their own copy.
 */

export type FoodMethod = "fish" | "forage" | "hunt";

export const FOOD_METHODS: {
  id: FoodMethod;
  label: string;
  icon: string;
  yield: string;
  needs: string;
  hint: string;
}[] = [
  {
    id: "fish",
    label: "Fish",
    icon: "fa-fish",
    yield: "2d6 rations",
    needs: "A fishing rod and tackle, and a hex with a lake or river.",
    hint: "Roll 1d20 for the catch. Several of them are a hazard to land or to prepare, and a giant catfish is a combat encounter in its own right.",
  },
  {
    id: "forage",
    label: "Forage",
    icon: "fa-wheat-awn",
    yield: "1d6 rations (1d4 winter, 1d8 autumn)",
    needs: "Nothing but the time.",
    hint: "1d6 decides fungi (1–3) or plants (4–6), then 1d20 for which. Some hexes list their own special finds, instead of or as well as these.",
  },
  {
    id: "hunt",
    label: "Hunt",
    icon: "fa-crosshairs",
    yield: "By the quarry's Hit Points, once killed",
    needs: "The terrain decides what there is to stalk.",
    hint: "Success only means the party has crept up on game. The kill is a normal combat encounter — the party has surprise and starts 1d4×30 feet away — and the rations come from what falls: 1 per HP small, 2 medium, 4 large.",
  },
];

export interface FoodEntry {
  /** As printed. Descriptions are deliberately not reproduced. */
  name: string;
  /** The mechanical exception, where the entry has one. */
  note?: string;
}

/** Edible fish, 1d20 (CB p116). */
export const FISH: FoodEntry[] = [
  {
    name: "Bally-tom",
    note: "The party member with the lowest Wisdom must Save Versus Hold or be dazzled and fall into the water.",
  },
  { name: "Braithgilly" },
  {
    name: "Butter-eel",
    note: "Landed only if at least two PCs make a successful Dexterity Check.",
  },
  { name: "Gaffer" },
  {
    name: "Giant catfish",
    note: "A monster: handle as a normal combat encounter. If killed, its flesh gives 4 rations per Hit Point.",
  },
  { name: "Groper", note: "2-in-6 chance of a random human trinket in a fish's belly." },
  {
    name: "Gurney",
    note: "Characters who have not caught gurneys before must Save Versus Doom or take 1 damage.",
  },
  { name: "Hameth sprat", note: "A smaller catch: 2d4 rations instead of 2d6." },
  { name: "Lardfish" },
  { name: "Maid-o'-the-lake" },
  { name: "Mummer" },
  { name: "Nag-pike", note: "Landed only if at least two PCs make a successful Strength Check." },
  { name: "Orbling" },
  { name: "Pilgrim crab" },
  {
    name: "Puffer",
    note: "Characters who have not caught puffers before must Save Versus Blast or take 1d3 damage when the fish explode.",
  },
  {
    name: "Queen's salmon",
    note: "If the fish are released, every angler gains +4 on their next Saving Throw against a deadly effect.",
  },
  { name: "Screaming jenny" },
  { name: "Smuggler-fish", note: "2-in-6 chance of a small gem (1d20 × 10gp) in one belly." },
  { name: "Twine-eel" },
  {
    name: "Wraithfish",
    note: "Without madcap pipe music the catch is only enough for 1d6 rations.",
  },
];

/** Edible fungi, 1d20 (CB p118). */
export const FUNGI: FoodEntry[] = [
  { name: "Amethyst orb" },
  { name: "Chanctonslip" },
  { name: "Drounberry" },
  { name: "Fairy veil" },
  { name: "Goodgilly" },
  { name: "Hell horns", note: "Highly nutritious: one ration nourishes two people." },
  { name: "Liverwort Jack" },
  { name: "Mangy horns" },
  { name: "Marshguts" },
  { name: "Meat and bread", note: "Causes rancid breath, which attracts flies." },
  { name: "Monkskull" },
  { name: "Moonchook", note: "A gourmet item: each ration sells for 1d6gp." },
  { name: "Old Duchess" },
  { name: "Purple piper" },
  { name: "Scrabey's hair" },
  { name: "Shank-orbs", note: "Edible, but with no nutritive effect at all." },
  { name: "Spatchcock" },
  { name: "Willy-be-bold" },
  { name: "Windcap" },
  { name: "Woodsman's fancy" },
];

/** Edible plants, 1d20 (CB p119). */
export const PLANTS: FoodEntry[] = [
  { name: "Barb cone" },
  { name: "Bent leek" },
  { name: "Black medlar" },
  { name: "Bogsnip" },
  { name: "Butter mandrake" },
  { name: "Creeping prune" },
  { name: "Gobble-drop" },
  { name: "Hag's mantle" },
  { name: "Hangleberry" },
  {
    name: "Hob nut",
    note: "Brings on a whimsical foolhardiness until the next day: -2 on Saving Throws against magic.",
  },
  { name: "Jellycup" },
  { name: "Lankleaf root" },
  { name: "Noosenut" },
  { name: "Prehensile radish" },
  { name: "Shankroot" },
  { name: "Snodberry" },
  { name: "Wallow shoot" },
  { name: "Westernut", note: "Grows only at the base of west-facing cliffs or ridges." },
  { name: "Witch-elm lantern" },
  { name: "Wranklefrond" },
];

/**
 * Game Animals, 1d20 per terrain (CB p121).
 *
 * Transcribed from the book by script rather than by hand — twelve columns of
 * twenty is where typing goes wrong — and machine-checked for completeness.
 * Each entry is [name, number appearing].
 */
export const GAME_ANIMALS: Record<Terrain, [string, string][]> = {
  "bog": [
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Headhog", "2d6"],
    ["Headhog", "2d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Red Deer", "3d10"],
    ["Swamp Sloth", "1d6"],
    ["Swamp Sloth", "1d6"],
    ["Swamp Sloth", "1d6"],
    ["Swamp Sloth", "1d6"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Woad", "3d6"],
    ["Woad", "3d6"],
    ["Woad", "3d6"],
  ],
  "farmland": [
    ["Boar", "1d6"],
    ["Boar", "1d6"],
    ["Boar", "1d6"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
  ],
  "boggy-forest": [
    ["Boar", "1d6"],
    ["False Unicorn", "3d4"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gobble", "3d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Puggle", "2d4"],
    ["Red Deer", "3d10"],
    ["Swamp Sloth", "1d6"],
    ["Swamp Sloth", "1d6"],
    ["Trotteling", "2d6"],
    ["Woad", "3d6"],
    ["Yegril", "3d8"],
  ],
  "craggy-forest": [
    ["Boar", "1d6"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gobble", "3d6"],
    ["Gobble", "3d6"],
    ["Gobble", "3d6"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Puggle", "2d4"],
    ["Puggle", "2d4"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Yegril", "3d8"],
    ["Yegril", "3d8"],
    ["Yegril", "3d8"],
  ],
  "hilly-forest": [
    ["Boar", "1d6"],
    ["Boar", "1d6"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Gelatinous Ape", "1d12"],
    ["Gobble", "3d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Puggle", "2d4"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Yegril", "3d8"],
  ],
  "open-forest": [
    ["Boar", "1d6"],
    ["Boar", "1d6"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Puggle", "2d4"],
    ["Puggle", "2d4"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Woad", "3d6"],
    ["Yegril", "3d8"],
    ["Yegril", "3d8"],
  ],
  "tangled-forest": [
    ["Boar", "1d6"],
    ["Boar", "1d6"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gobble", "3d6"],
    ["Headhog", "2d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Woad", "3d6"],
  ],
  "thorny-forest": [
    ["Gobble", "3d6"],
    ["Gobble", "3d6"],
    ["Gobble", "3d6"],
    ["Headhog", "2d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
  ],
  "fungal-forest": [
    ["Boar", "1d6"],
    ["Boar", "1d6"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gobble", "3d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Moss Mole", "1d6"],
    ["Puggle", "2d4"],
    ["Puggle", "2d4"],
    ["Puggle", "2d4"],
    ["Puggle", "2d4"],
    ["Red Deer", "3d10"],
    ["Swamp Sloth", "1d6"],
    ["Trotteling", "2d6"],
    ["Yegril", "3d8"],
  ],
  "hills": [
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Headhog", "2d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Moss Mole", "1d6"],
    ["Moss Mole", "1d6"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Yegril", "3d8"],
  ],
  "meadow": [
    ["False Unicorn", "3d4"],
    ["False Unicorn", "3d4"],
    ["Headhog", "2d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Merriman", "1d6"],
    ["Moss Mole", "1d6"],
    ["Red Deer", "3d10"],
    ["Red Deer", "3d10"],
    ["Trotteling", "2d6"],
    ["Trotteling", "2d6"],
    ["Woad", "3d6"],
    ["Yegril", "3d8"],
  ],
  "swamp": [
    ["Boar", "1d6"],
    ["False Unicorn", "3d4"],
    ["Gelatinous Ape", "1d12"],
    ["Gelatinous Ape", "1d12"],
    ["Gobble", "3d6"],
    ["Headhog", "2d6"],
    ["Honey Badger", "1d4"],
    ["Lurkey", "2d4"],
    ["Merriman", "1d6"],
    ["Moss Mole", "1d6"],
    ["Puggle", "2d4"],
    ["Red Deer", "3d10"],
    ["Swamp Sloth", "1d6"],
    ["Swamp Sloth", "1d6"],
    ["Swamp Sloth", "1d6"],
    ["Trotteling", "2d6"],
    ["Woad", "3d6"],
    ["Woad", "3d6"],
    ["Yegril", "3d8"],
    ["Yegril", "3d8"],
  ],
};

/**
 * What a day's foraging yields.
 *
 * The season that counts is the ordinary one an unseason falls inside: a Vague
 * happens in the winter months, so foraging in one gives the winter's 1d4.
 */
export function foragingYield(season: Season): { formula: string; why: string } {
  const host = seasonInfo(season).host;
  if (host === "winter") return { formula: "1d4", why: "winter" };
  if (host === "autumn") return { formula: "1d8", why: "autumn" };
  return { formula: "1d6", why: host };
}

/**
 * The Survival Skill Target the module offers before the Referee corrects it.
 *
 * Six, because that is what every skill defaults to (PB p144) — only a
 * character's Kindred or Class brings it down, and a lower number is a better
 * forager. Where several characters could try, the group uses the best target
 * among them, which is the lowest.
 */
export const DEFAULT_SURVIVAL_TARGET = 6;

/**
 * The bonus for giving a whole day to it, travelling nowhere (PB p152).
 *
 * A modifier added to the roll, not a change to the target — which matters,
 * because no modifier can save a natural 1.
 */
export const FULL_DAY_BONUS = 2;

export function foodMethodInfo(id: FoodMethod) {
  return FOOD_METHODS.find((m) => m.id === id) ?? FOOD_METHODS[0];
}

/** What today's attempt produced. Stored on the day; cleared with it. */
export interface FoodResult {
  method: FoodMethod;
  /** The Survival Check: 1d6 plus modifiers, meeting or exceeding the target. */
  roll: number;
  /** Everything added to the die: the full day, and the Referee's own call. */
  modifier: number;
  /** The party's best Survival Skill Target. Lower is better. */
  target: number;
  fullDay: boolean;
  success: boolean;
  /** Set where a natural 1 or 6 decided it regardless of the total. */
  natural?: "fail" | "success";
  /** What was caught, found, or stalked. Absent on a failed check. */
  find?: { name: string; note?: string; roll: number; kind?: "fungi" | "plants" };
  /** How many game animals, for a hunt. */
  number?: string;
  /** Rations gained, where the procedure gives a number at all. */
  rations?: { formula: string; total: number; why: string };
}
