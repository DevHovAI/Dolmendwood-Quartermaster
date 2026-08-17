// ─── Inn Reference Data ───────────────────────────────────────────────────────
// Transcribed from the Dolmenwood Player's Book, pp.124–127.
//
// This module holds the *book defaults* only. A concrete inn keeps its own,
// freely editable copy (see innConfig.ts) — these tables are the seed it starts
// from, never what is read at render time.
//
// The three quality levels are alternatives, not a progression: a fancy house
// does not also offer a spot on the common room floor. Each level therefore has
// its own complete table rather than a minimum-quality filter.

export type InnQuality = "poor" | "common" | "fancy";
export type InnSection = "lodging" | "food" | "beverages" | "extras";
export type Currency = "cp" | "sp" | "gp" | "pp";

/**
 * Name for a *placed* inn whose map note was left blank. The toolbar inn is
 * deliberately nameless instead — it is whatever house the party walked into,
 * and inventing one for it only puts a wrong name on the screen.
 */
export const DEFAULT_INN_NAME = "Inn";

/**
 * The name the toolbar inn used to carry. Read back from the old world setting
 * it is treated as "no name", so a world that stored it does not keep showing it.
 */
export const LEGACY_INN_NAME = "The Wayward Boar";

export interface InnCost {
  amount: number;
  currency: Currency;
}

export interface InnEntry {
  id: string;
  name: string;
  cost: InnCost;
  description?: string;
  /**
   * Display group inside its section, and what the daily roll draws against.
   * Food uses "main" | "side" | "dessert", beverages the rarity tier, and
   * lodging/extras leave it empty because every line there is always on offer.
   */
  group?: string;
  /**
   * Always on the menu — a house speciality, never part of the daily roll.
   * Lodging and extras are fixed throughout; food and drink are not, unless the
   * GM marks a line as the establishment's own brew or signature dish.
   */
  fixed?: boolean;
  /** Suffix printed after the price, e.g. "per person". */
  unit?: string;
  /** Small label shown beside the name — the beverage type, for instance. */
  tag?: string;
  /**
   * Whether this drink can be bought by the container to take away.
   * "auto" (the default) follows the section's switch and the book's rule for
   * the drink's type; the explicit values override both, in either direction —
   * a house that sells nothing to take away can still sell its own brew by the
   * cask, and a bottle can be refused for a single drink.
   */
  container?: ContainerChoice;
  /**
   * Catalog definition id of goods handed over rather than consumed on the spot.
   *
   * Set on rations, which every inn sells; the GM can set it on any line to sell
   * any catalog item from an inn (the baker's spice bread, the dockmaster's
   * marmalade). An entry with this set is a purchase of goods, so it loses the
   * eat-and-drink-here buttons entirely.
   */
  grantsItem?: string;
}

/** How many of a group are available on a given day: [min, max] inclusive. */
export type DrawRange = [number, number];

// ─── Bottles and casks ────────────────────────────────────────────────────────
//
// DPB p.126: "Wines, spirits, and specialist beverages can sometimes be bought
// in bottles (30 coins weight) containing 5 portions of the drink for the price
// of 4 portions. Likewise, a cask of beer or cider (80 coins weight) contains 10
// portions of the drink for the price of 8 portions."
//
// This is the one thing bought at an inn that is not consumed on the spot, so it
// is also the only inn purchase that puts something into an inventory.

export type ContainerKind = "bottle" | "cask";
export type ContainerChoice = "auto" | ContainerKind | "none";

export const CONTAINER_SPECS: Record<
  ContainerKind,
  { label: string; portions: number; pricePortions: number; weight: number; icon: string }
> = {
  bottle: { label: "Bottle", portions: 5,  pricePortions: 4, weight: 30, icon: "fa-wine-bottle" },
  cask:   { label: "Cask",   portions: 10, pricePortions: 8, weight: 80, icon: "fa-jug" },
};

/**
 * The container the book allows for a drink of this type. Tea gets neither, and
 * neither does a house drink the GM left untyped — those can still be sold in
 * one by setting the entry's container explicitly.
 */
export function containerForType(tag: string | undefined): ContainerKind | null {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("beer") || t.includes("cider")) return "cask";
  if (t.includes("wine") || t.includes("spirit") || t.includes("specialist")) return "bottle";
  return null;
}

/** What this entry is sold as, weighing the section's switch against its own override. */
export function resolveContainer(
  entry: Pick<InnEntry, "tag" | "container">,
  sectionSellsContainers: boolean
): ContainerKind | null {
  switch (entry.container) {
    case "none":   return null;
    case "bottle": return "bottle";
    case "cask":   return "cask";
    default:       return sectionSellsContainers ? containerForType(entry.tag) : null;
  }
}

/** A container costs fewer portions than it holds — that is the whole point of buying one. */
export function containerCost(portionCost: InnCost, kind: ContainerKind): InnCost {
  return {
    amount: portionCost.amount * CONTAINER_SPECS[kind].pricePortions,
    currency: portionCost.currency,
  };
}

export const INN_SECTIONS: { key: InnSection; label: string; icon: string }[] = [
  { key: "lodging",   label: "Lodging",   icon: "fa-bed" },
  { key: "food",      label: "Food",      icon: "fa-utensils" },
  { key: "beverages", label: "Beverages", icon: "fa-beer-mug-empty" },
  { key: "extras",    label: "Extras",    icon: "fa-hand-sparkles" },
];

export const INN_QUALITIES: { key: InnQuality; label: string }[] = [
  { key: "poor",   label: "Poor" },
  { key: "common", label: "Common" },
  { key: "fancy",  label: "Fancy" },
];

/** Labels for the food groups, in the order they should be shown. */
export const FOOD_GROUPS: { key: string; label: string }[] = [
  { key: "main",    label: "Main Dishes" },
  { key: "side",    label: "Side Dishes" },
  { key: "dessert", label: "Desserts" },
];

/** Labels for the beverage groups (the book's rarity tiers), in display order. */
export const BEVERAGE_GROUPS: { key: string; label: string }[] = [
  { key: "common",   label: "Common" },
  { key: "uncommon", label: "Uncommon" },
  { key: "rare",     label: "Rare" },
];

// ─── Lodging ──────────────────────────────────────────────────────────────────

export const LODGING_TABLES: Record<InnQuality, InnEntry[]> = {
  poor: [
    { id: "lodging-floor",      name: "Common room floor, 1 night",   cost: { amount: 2, currency: "cp" }, fixed: true },
    { id: "lodging-shared-8",   name: "Shared room (8 beds), 1 night", cost: { amount: 1, currency: "sp" }, fixed: true },
    { id: "lodging-shared-4",   name: "Shared room (4 beds), 1 night", cost: { amount: 2, currency: "sp" }, fixed: true },
  ],
  common: [
    { id: "lodging-floor",      name: "Common room floor, 1 night",   cost: { amount: 5, currency: "cp" }, fixed: true },
    { id: "lodging-shared-2",   name: "Shared room (2 beds), 1 night", cost: { amount: 4, currency: "sp" }, fixed: true },
    { id: "lodging-private",    name: "Private room, 1 night",         cost: { amount: 8, currency: "sp" }, fixed: true },
  ],
  fancy: [
    { id: "lodging-private",    name: "Private room, 1 night",  cost: { amount: 1, currency: "gp" }, fixed: true },
    { id: "lodging-double",     name: "Double room, 1 night",   cost: { amount: 2, currency: "gp" }, fixed: true },
    { id: "lodging-suite",      name: "Private suite, 1 night", cost: { amount: 5, currency: "gp" }, fixed: true },
  ],
};

// ─── Extras (stabling, baths, services) ───────────────────────────────────────

/**
 * Travel rations, sold at every inn regardless of quality — a house that feeds
 * travellers will pack them a meal for the road. Prices and weights are the
 * catalog's own (DPB p.116), and `grantsItem` points at the catalog entry so a
 * ration bought here stacks with one bought in a shop instead of becoming a
 * second, subtly different row.
 */
const RATION_ENTRIES: InnEntry[] = [
  {
    id: "extra-rations-preserved",
    name: "Rations (preserved, 1 day)",
    cost: { amount: 2, currency: "gp" },
    description: "Preserved rations last up to 2 months, or 1 week in dank conditions.",
    grantsItem: "rations-preserved",
    fixed: true,
  },
  {
    id: "extra-rations-fresh",
    name: "Rations (fresh, 1 day)",
    cost: { amount: 1, currency: "gp" },
    description: "Fresh rations last for 1 week, or 1 day in dank conditions.",
    grantsItem: "rations-fresh",
    fixed: true,
  },
];

export const EXTRAS_TABLES: Record<InnQuality, InnEntry[]> = {
  poor: [
    { id: "extra-stabling", name: "Stabling and fodder, 1 night", cost: { amount: 2, currency: "sp" }, fixed: true },
    ...RATION_ENTRIES.map((e) => ({ ...e, cost: { ...e.cost } })),
  ],
  common: [
    { id: "extra-stabling", name: "Stabling and fodder, 1 night", cost: { amount: 4, currency: "sp" }, fixed: true },
    { id: "extra-bath",     name: "Bath in private room",         cost: { amount: 5, currency: "sp" }, fixed: true },
    ...RATION_ENTRIES.map((e) => ({ ...e, cost: { ...e.cost } })),
  ],
  fancy: [
    { id: "extra-stabling", name: "Stabling and fodder, 1 night", cost: { amount: 6, currency: "sp" }, fixed: true },
    { id: "extra-bath",     name: "Bath in private room",         cost: { amount: 4, currency: "sp" }, fixed: true },
    { id: "extra-services", name: "Personal services (coiffure, laundry, etc.)", cost: { amount: 1, currency: "gp" }, fixed: true },
    { id: "extra-dining",   name: "Private dining room", cost: { amount: 1, currency: "gp" }, unit: "per person", fixed: true },
    ...RATION_ENTRIES.map((e) => ({ ...e, cost: { ...e.cost } })),
  ],
};

// ─── Food ─────────────────────────────────────────────────────────────────────

/**
 * The book prices food by course, not by dish — every main dish in a common
 * house costs the same 3sp. The rolled dishes are seeded with their course
 * price, which is also what makes a per-dish override possible afterwards.
 */
export const FOOD_PRICES: Record<InnQuality, Record<string, InnCost>> = {
  poor:   { main: { amount: 1, currency: "sp" },  side: { amount: 5,  currency: "cp" } },
  common: { main: { amount: 3, currency: "sp" },  side: { amount: 2,  currency: "sp" } },
  fancy:  { main: { amount: 2, currency: "gp" },  side: { amount: 15, currency: "sp" }, dessert: { amount: 2, currency: "gp" } },
};

export const FOOD_DRAW: Record<InnQuality, Record<string, DrawRange>> = {
  poor:   { main: [1, 2], side: [1, 1] },
  common: { main: [2, 3], side: [1, 2] },
  fancy:  { main: [3, 4], side: [1, 2], dessert: [1, 2] },
};

/** Descriptive line shown above each food section, straight from the book. */
export const FOOD_TEXT: Record<InnQuality, string> = {
  poor:   "Poor establishments typically have 1–2 main dishes and 1 side dish available on any given day.",
  common: "Common establishments typically have 2–3 main dishes and 1–2 side dishes available on any given day.",
  fancy:  "Fancy establishments typically have 3–4 main dishes, 1–2 side dishes, and 1–2 desserts available on any given day.",
};

type PoolEntry = { id: string; name: string; group: string; description: string };

export const FOOD_POOLS: Record<InnQuality, PoolEntry[]> = {
  poor: [
    { id: "poor-main-1", group: "main", name: "Battered pizzle", description: "The generative organs of a slaughtered bull, sliced up, battered, and fried. Rich and gristly stuff." },
    { id: "poor-main-2", group: "main", name: "Blood porridge", description: "Oat porridge with a healthy portion of bloodworms mixed in. Some folk like their worms still wriggling." },
    { id: "poor-main-3", group: "main", name: "Bubble and squeak", description: "Fried up leftovers from yesterday's supper. Commonly a mix of cabbage, root vegetables and meat scraps." },
    { id: "poor-main-4", group: "main", name: "Dregger's pie", description: "Acorns and sloppy mixed innards baked in a tough pastry shell. The stench when the crust is cracked open is said to recall the back alleys of Dreg." },
    { id: "poor-main-5", group: "main", name: "Fisher's gruel", description: "Grain slop cooked in a fish-bone stock." },
    { id: "poor-main-6", group: "main", name: "Roast wellington", description: "Layers of leftover mash, cabbage leaves, and chicken skin, rolled up and roasted." },
    { id: "poor-main-7", group: "main", name: "Special pasty", description: "Butter and sheep fat pastry encasing meaty chunks of unknown origin. Best not to ask." },
    { id: "poor-main-8", group: "main", name: "Woad in the hole", description: "Crispy chicken or sparrow feet poking out of a spongy baked batter. No actual woads' legs are anywhere to be seen — they are far too expensive!" },
    { id: "poor-side-1", group: "side", name: "Codswallop", description: "A putrid, off-white slop. No one is quite sure what's in it." },
    { id: "poor-side-2", group: "side", name: "Pig's ear", description: "Crispy fried hog's ear. Nice and hairy." },
    { id: "poor-side-3", group: "side", name: "Sourcroute", description: "Fermented cabbage, often accompanied by an unwanted edge of mould." },
    { id: "poor-side-4", group: "side", name: "Wormskin", description: "The skins of any worms that wriggle in the region (earthworms, bloodworms, nightworms, etc.), fermented in strong vinegar." },
  ],
  common: [
    { id: "common-main-1", group: "main", name: "Mutton roast", description: "Slices of smoky roast mutton, slathered in garlic gravy." },
    { id: "common-main-2", group: "main", name: "Onion sandwich", description: "White bread, butter, raw onion slices, and lashings of congealed whey." },
    { id: "common-main-3", group: "main", name: "Pook's pudding", description: "A suety pudding of mallow and locally foraged mushrooms." },
    { id: "common-main-4", group: "main", name: "Puggle pie", description: "Puggle-flesh and mushroom gravy in flaky pastry. (Puggles are miniature fungivorous dogs that live in Dolmenwood.)" },
    { id: "common-main-5", group: "main", name: "Sausage and mash", description: "Fried bog-swine sausages from Dreg on a bed of mashed swede, potato, or carrot." },
    { id: "common-main-6", group: "main", name: "Shanky", description: "A pair of chicken or quail legs wrapped in vinegared oak leaves and bitter mugwort." },
    { id: "common-main-7", group: "main", name: "Snail skewers", description: "Forest snails skewered on metal spikes and roast over a wood fire. Served with a dipping custard." },
    { id: "common-main-8", group: "main", name: "Trottel mash", description: "Mashed root vegetables (commonly turnip and burdock) laced with trotteling bacon. (Trottelings are tiny forest pigs.)" },
    { id: "common-side-1", group: "side", name: "Pickled eggs", description: "Hard-boiled eggs preserved in vinegar." },
    { id: "common-side-2", group: "side", name: "Coldlanks", description: "Raw, grated onion in a mustard and beer marinade." },
    { id: "common-side-3", group: "side", name: "Hameth sprats", description: "Little fish, crispy fried in batter." },
    { id: "common-side-4", group: "side", name: "Ruddy chad", description: "A hunk of mature, red-veined cheese." },
  ],
  fancy: [
    { id: "fancy-main-1", group: "main", name: "Blackbird pie", description: "A feast of blackbirds (traditionally two dozen whole birds!) baked in a pie crust with cream." },
    { id: "fancy-main-2", group: "main", name: "Brathering", description: "A famed Prigwort speciality: pancakes layered with sliced apple, cured sausage, and gooseberries." },
    { id: "fancy-main-3", group: "main", name: "Jellied lamprey", description: "Thick-sliced lamprey in an exquisite, spiced jelly." },
    { id: "fancy-main-4", group: "main", name: "Longmere pike", description: "A whole pike, stuffed with leek and sage, served with fresh forest greens." },
    { id: "fancy-main-5", group: "main", name: "Maids-o'-the-lake", description: "A Dolmenwood delicacy: thigh-sized, translucent pink squid fried in garlic butter. Many inns refuse to serve this dish on nights of the full moon, as it is said to attract the attention of witches." },
    { id: "fancy-main-6", group: "main", name: "Roast lurkey", description: "Juicy flesh of the notoriously elusive Dolmenwood game bird." },
    { id: "fancy-main-7", group: "main", name: "Unicorn rump", description: "Tender venison of the deer-like beasts known as false unicorns. The flesh of true unicorns may only be served at the duke's table." },
    { id: "fancy-main-8", group: "main", name: "Whole suckling pig", description: "A whole piglet, spit-roast, complete with an apple in its mouth. A true hero's feast!" },
    { id: "fancy-side-1", group: "side", name: "Larks' tongues in aspic", description: "Delicate songbirds' tongues preserved in sweet jelly." },
    { id: "fancy-side-2", group: "side", name: "Old Shuck", description: "Rigid slices of stinking, ultra-mature cheese of mossling manufacture." },
    { id: "fancy-side-3", group: "side", name: "Sparrey", description: "A melt-in-the-mouth confection of crispy, sugared moth wings." },
    { id: "fancy-side-4", group: "side", name: "Vinegared troll moss", description: "Sweet and sour moss, pilfered from the moss-gardens of Dolmenwood trolls." },
    { id: "fancy-dessert-1", group: "dessert", name: "Fondant pastries", description: "Freshly baked, dusted with sugar." },
    { id: "fancy-dessert-2", group: "dessert", name: "Sugared plums", description: "A taste of summer, all year round." },
    { id: "fancy-dessert-3", group: "dessert", name: "Trifle", description: "Layered berries, sponge, custard, and cream." },
    { id: "fancy-dessert-4", group: "dessert", name: "Walnut tarts", description: "Topped with whipped cream." },
  ],
};

// ─── Beverages ────────────────────────────────────────────────────────────────
//
// Unlike food, the drinks list is NOT split by establishment quality. There is
// one list in three rarity tiers, and the quality only decides how much of each
// tier a house stocks (see BEVERAGE_DRAW).

type BeverageEntry = { id: string; name: string; group: string; type: string; cost: InnCost; description?: string };

export const BEVERAGE_POOLS: BeverageEntry[] = [
  // ── Common (d8) ──
  { id: "bev-barrowblaster", group: "common", name: "Barrowblaster", type: "Beer / cider", cost: { amount: 9, currency: "cp" }, description: "A robust ale, streaked black and white, with a rich, iron-like flavour. Effect: Belching and goggling." },
  { id: "bev-keyes-balm", group: "common", name: "Keye's Balm", type: "Beer / cider", cost: { amount: 1, currency: "sp" }, description: "A golden ale that tastes of honey and hops. Effect: Causes good-natured slumping." },
  { id: "bev-marrowhyte-dark", group: "common", name: "Marrowhyte Dark", type: "Beer / cider", cost: { amount: 2, currency: "sp" }, description: "A thick stout as black as midnight on a moonless night. Tastes of smoky bacon. Effect: Brings on a woozy empathy." },
  { id: "bev-pilstons-heartbreaker", group: "common", name: "Pilston's Heartbreaker", type: "Beer / cider", cost: { amount: 4, currency: "cp" }, description: "A milky white ale that tastes of singed elderberries. Effect: Causes a delirious state of cackling and misdirected aggression." },
  { id: "bev-bards-cordial", group: "common", name: "Bard's Cordial", type: "Spirit", cost: { amount: 2, currency: "sp" }, description: "A frothy, orange spirit that tastes of malted rye. Effect: Brings on a state of unexpected poetry." },
  { id: "bev-old-swythener", group: "common", name: "Old Swythener", type: "Spirit", cost: { amount: 5, currency: "cp" }, description: "A colourless spirit, tasting of charred beech and honey. Effect: Brings on a state of rampant disorientation." },
  { id: "bev-prigwort-tipple", group: "common", name: "Prigwort Tipple", type: "Spirit", cost: { amount: 3, currency: "sp" }, description: "A recent export from the cheaper distilleries of Prigwort. An electric blue spirit that tastes of chestnut and fennel. Effect: Inspires giddy hijinks." },
  { id: "bev-masons", group: "common", name: "Mason's", type: "Tea", cost: { amount: 1, currency: "cp" }, description: "Finely shredded, chestnut brown leaves, commonly drunk with milk. Favoured by the working classes. Effect: Highly invigorating." },

  // ── Uncommon (d20) ──
  { id: "bev-cobsworth-pale", group: "uncommon", name: "Cobsworth Pale", type: "Beer / cider", cost: { amount: 5, currency: "sp" }, description: "A fine, fizzing ale with a yellow hue and the flavour of cherry syrup. Effect: Indulging brings on a propensity for pointed philosophical debate." },
  { id: "bev-halthwiddens", group: "uncommon", name: "Halthwidden's", type: "Beer / cider", cost: { amount: 3, currency: "sp" }, description: "A gloopy, grey ale that tastes of plum and cinnamon. Effect: Provokes indiscriminate romantic advances." },
  { id: "bev-merryweather", group: "uncommon", name: "Merryweather", type: "Beer / cider", cost: { amount: 4, currency: "sp" }, description: "A crisp, pale green, sparkling cider with a hint of butterscotch. Effect: Grinning and redness of face." },
  { id: "bev-tithelands-cider", group: "uncommon", name: "Tithelands Cider", type: "Beer / cider", cost: { amount: 2, currency: "sp" }, description: "Sharp, amber, slightly sour. Leaves a tingling sensation on the palate. Effect: Tranquil daydreaming." },
  { id: "bev-glubwob", group: "uncommon", name: "Glubwob", type: "Specialist", cost: { amount: 2, currency: "sp" }, description: "A stinking grey-green slop of aged lichen and yeast froth. A commonplace mossling beverage. Tastes of rank ditch water. Effect: Induces light-hearted tomfoolery and cathartic vomiting." },
  { id: "bev-mead", group: "uncommon", name: "Mead", type: "Specialist", cost: { amount: 12, currency: "sp" }, description: "A sweet, syrupy wine made from fermented honey. Especially beloved by woodgrues. Effect: Induces a cosy feeling in the belly and a light, eloquent state of mind." },
  { id: "bev-distillation-of-dusk", group: "uncommon", name: "Distillation of Dusk", type: "Spirit", cost: { amount: 7, currency: "sp" }, description: "A rare, ultraviolet spirit with a lingering, oaken after-taste. Effect: Brings on a delightful state of listless lounging." },
  { id: "bev-ether-of-blue", group: "uncommon", name: "Ether of Blue", type: "Spirit", cost: { amount: 5, currency: "sp" }, description: "A spirit with a delicate, translucent aqua hue and a flavour akin to custard with a hint of skunk. Effect: Inspires a state of lucid sensuality." },
  { id: "bev-pokey-nog", group: "uncommon", name: "Pokey Nog", type: "Spirit", cost: { amount: 5, currency: "sp" }, description: "A fermented custard, egg-yolk yellow in hue and with a delightful, creamy flavour. Effect: Brings on a state of rambunctious speaking in tongues." },
  { id: "bev-porrids-full-moon", group: "uncommon", name: "Porrid's Full Moon", type: "Spirit", cost: { amount: 1, currency: "sp" }, description: "A spirit of profound indigo hue that tastes of blackcurrant. Effect: Causes cathartic bellowing and screeching." },
  { id: "bev-the-night-liqueur", group: "uncommon", name: "The Night Liqueur", type: "Spirit", cost: { amount: 6, currency: "sp" }, description: "A spirit of violent, greenish-purple hue. Tasteless but highly astringent. Effect: Brings about a soporific languor." },
  { id: "bev-wakelykes-scarlet", group: "uncommon", name: "Wakelyke's Scarlet", type: "Spirit", cost: { amount: 4, currency: "cp" }, description: "A deep red spirit with a wince-inducing, acrid flavour. Effect: Causes gagging and shouting." },
  { id: "bev-earl-yellow", group: "uncommon", name: "Earl Yellow", type: "Tea", cost: { amount: 5, currency: "cp" }, description: "Dark leaves with flecks of scintillating gold. Mild, aromatic bouquet. Effect: Calms the mind." },
  { id: "bev-buckston-fizz", group: "uncommon", name: "Buckston Fizz", type: "Wine", cost: { amount: 12, currency: "sp" }, description: "A clear, sparkling wine that tastes of bitter herbs. Effect: Brings on dreamlike visions." },
  { id: "bev-faggleys-iced", group: "uncommon", name: "Faggley's Iced", type: "Wine", cost: { amount: 14, currency: "sp" }, description: "An ice wine imported from the far eastern reaches of the Duchy. Tastes of elderflower and spring bouquets. Effect: Inspires a drowsiness punctuated with serene visions of snowdrifts." },
  { id: "bev-inkling-wine", group: "uncommon", name: "Inkling Wine", type: "Wine", cost: { amount: 11, currency: "sp" }, description: "A rich, full-bodied red wine that tastes of syrup, over-ripe plums, and hawberries. Effect: Rankles the spirit, provoking a belligerent and arrogant mood." },

  // ── Rare (d12) ──
  { id: "bev-moons-milk", group: "rare", name: "Moon's Milk", type: "Specialist", cost: { amount: 2, currency: "sp" }, description: "Exported from the mossling village of Orbswallow. A sweet and awfully sour fermented mix of milky and fruity liquids. Effect: Inspires jovial banter." },
  { id: "bev-nippers", group: "rare", name: "Nippers", type: "Specialist", cost: { amount: 5, currency: "sp" }, description: "A distillation of fermented catnip which is a common vice among grimalkins. Insipid stuff for non-grimalkins. Effect: Drives cat-folk wild and raucous." },
  { id: "bev-lord-oberons-ambrosial", group: "rare", name: "Lord Oberon's Ambrosial", type: "Spirit", cost: { amount: 1, currency: "gp" }, description: "Prigwort's finest distillation. An insipid brown spirit tasting of sour rosehips. Effect: Imbibers slip into a blissful reverie." },
  { id: "bev-prigwort-pure", group: "rare", name: "Prigwort Pure", type: "Spirit", cost: { amount: 7, currency: "sp" }, description: "A rich, emerald green spirit with a flavour alike to woody salmon. Effect: Causes a state of eloquent camaraderie." },
  { id: "bev-purple-aspintheon", group: "rare", name: "Purple Aspintheon", type: "Spirit", cost: { amount: 1, currency: "gp" }, description: "A spirit of the utmost refinement. Pale mauve in colour, tasting of bitter liquorice. Effect: Brings on a clear-headed state in which the drinker feels immortal." },
  { id: "bev-tomfoys", group: "rare", name: "Tomfoy's", type: "Tea", cost: { amount: 1, currency: "sp" }, description: "A pale-leafed, smoky tea flavoured with aniseed and wormwood. Favoured by intellectuals. Effect: Clear-minded focus." },
  { id: "bev-lady-mauve", group: "rare", name: "Lady Mauve", type: "Wine", cost: { amount: 3, currency: "gp" }, description: "A delicate, violet wine imported from Fairy. Tastes of plum and charred lavender. Effect: Causes one's sorrows to drift away." },
  { id: "bev-the-cold-prince", group: "rare", name: "The Cold Prince", type: "Wine", cost: { amount: 35, currency: "sp" }, description: "A colourless, bubbling wine always served on ice. Said to contain fairy grapes but not itself produced in the immortal world of Fairy. Tastes like pear and honey. Effect: Inspires the imbiber to feats of romantic daring." },
  { id: "bev-underbroods-vintage", group: "rare", name: "Underbrood's Vintage", type: "Wine", cost: { amount: 5, currency: "gp" }, description: "A gourmet red wine from the legendary, deceased vintner Wayfellow Underbrood. In dwindling supply and priced accordingly. Effect: Overindulgence causes an embarrassingly rapid dissolution of muscle control." },
];

/**
 * Which rarity tiers a house stocks, and how many of each.
 * A tier listed with `null` is stocked in full ("all common beverages"); a tier
 * missing entirely is not stocked at all.
 */
export const BEVERAGE_DRAW: Record<InnQuality, Record<string, DrawRange | null>> = {
  poor:   { common: [3, 4], uncommon: [1, 1] },
  common: { common: null,   uncommon: [3, 4] },
  fancy:  { common: null,   uncommon: null, rare: [3, 4] },
};

export const BEVERAGE_TEXT: Record<InnQuality, string> = {
  poor:   "3–4 common beverages and one uncommon are stocked.",
  common: "All common beverages are stocked, plus 3–4 uncommon.",
  fancy:  "All common and uncommon beverages are stocked, plus 3–4 rare.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_IN_CP: Record<Currency, number> = { cp: 1, sp: 10, gp: 100, pp: 500 };

export function costToCp(cost: InnCost): number {
  return cost.amount * CURRENCY_IN_CP[cost.currency];
}

/** Apply a shop-style price factor in percent, never dropping below 1 coin. */
export function withPriceFactor(cost: InnCost, factor: number): InnCost {
  if (factor === 100) return cost;
  return { amount: Math.max(1, Math.round(cost.amount * factor / 100)), currency: cost.currency };
}

export function qualityLabel(quality: InnQuality): string {
  return INN_QUALITIES.find((q) => q.key === quality)?.label ?? quality;
}
