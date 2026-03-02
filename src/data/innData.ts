// ─── Inn Menu Data ────────────────────────────────────────────────────────────
// Populated from Dolmenwood Player's Book pp.124–127

export type InnQuality = "poor" | "common" | "fancy";

export interface InnMenuItem {
  id: string;
  name: string;
  description: string;
  cost: { amount: number; currency: "cp" | "sp" | "gp" | "pp" };
  category: "lodgings" | "food" | "beverages" | "stabling";
  /** Minimum inn quality at which this item is available */
  minQuality: InnQuality;
}

const QUALITY_ORDER: Record<InnQuality, number> = { poor: 0, common: 1, fancy: 2 };

export function filterByQuality(items: InnMenuItem[], quality: InnQuality): InnMenuItem[] {
  return items.filter((i) => QUALITY_ORDER[i.minQuality] <= QUALITY_ORDER[quality]);
}

export const INN_MENU: InnMenuItem[] = [
  // ─── Lodgings ──────────────────────────────────────────────────────────────
  {
    id: "lodging-floor",
    name: "Floor Space",
    description: "A spot on the common room floor with a blanket.",
    cost: { amount: 2, currency: "cp" },
    category: "lodgings",
    minQuality: "poor",
  },
  {
    id: "lodging-shared-8",
    name: "Shared Room (8-bed)",
    description: "A bunk in a crowded room shared with up to seven others.",
    cost: { amount: 1, currency: "sp" },
    category: "lodgings",
    minQuality: "poor",
  },
  {
    id: "lodging-shared-4",
    name: "Shared Room (4-bed)",
    description: "A bunk in a smaller shared room with three others.",
    cost: { amount: 3, currency: "sp" },
    category: "lodgings",
    minQuality: "common",
  },
  {
    id: "lodging-private",
    name: "Private Room",
    description: "A clean room to yourself with a proper bed and a lock on the door.",
    cost: { amount: 1, currency: "gp" },
    category: "lodgings",
    minQuality: "fancy",
  },
  {
    id: "lodging-suite",
    name: "Suite",
    description: "A luxurious set of rooms with a hearth, sitting area, and fine linens.",
    cost: { amount: 5, currency: "gp" },
    category: "lodgings",
    minQuality: "fancy",
  },

  // ─── Stabling ──────────────────────────────────────────────────────────────
  {
    id: "stabling-poor",
    name: "Stabling (basic)",
    description: "A shared stall in a drafty stable.",
    cost: { amount: 1, currency: "sp" },
    category: "stabling",
    minQuality: "poor",
  },
  {
    id: "stabling-common",
    name: "Stabling (decent)",
    description: "A private stall with fresh hay and water.",
    cost: { amount: 3, currency: "sp" },
    category: "stabling",
    minQuality: "common",
  },
  {
    id: "stabling-fancy",
    name: "Stabling (fine)",
    description: "A fine private stall with grooming service included.",
    cost: { amount: 6, currency: "sp" },
    category: "stabling",
    minQuality: "fancy",
  },
  {
    id: "horse-feed-inn",
    name: "Horse Feed (1 day)",
    description: "A full day's worth of oats and hay for a horse or mule.",
    cost: { amount: 5, currency: "cp" },
    category: "stabling",
    minQuality: "poor",
  },

  // ─── Food ──────────────────────────────────────────────────────────────────
  {
    id: "food-hunk-bread",
    name: "Hunk of Bread",
    description: "Dense, dark bread — filling if not exactly appetising.",
    cost: { amount: 1, currency: "cp" },
    category: "food",
    minQuality: "poor",
  },
  {
    id: "food-pottage",
    name: "Bowl of Pottage",
    description: "A thick, grey porridge of boiled grains and uncertain vegetables.",
    cost: { amount: 2, currency: "cp" },
    category: "food",
    minQuality: "poor",
  },
  {
    id: "food-pickled-herring",
    name: "Pickled Herring",
    description: "Strongly brined fish, pungent and salty.",
    cost: { amount: 3, currency: "cp" },
    category: "food",
    minQuality: "poor",
  },
  {
    id: "food-common-stew",
    name: "Common Stew",
    description: "A hearty stew of root vegetables and scraps of meat.",
    cost: { amount: 4, currency: "cp" },
    category: "food",
    minQuality: "common",
  },
  {
    id: "food-roast-fowl",
    name: "Roast Fowl",
    description: "A whole roasted bird — chicken, pigeon, or whatever was caught that morning.",
    cost: { amount: 1, currency: "sp" },
    category: "food",
    minQuality: "common",
  },
  {
    id: "food-cheese-board",
    name: "Cheese Board",
    description: "A selection of local cheeses with pickles and fresh bread.",
    cost: { amount: 8, currency: "cp" },
    category: "food",
    minQuality: "common",
  },
  {
    id: "food-roast-haunch",
    name: "Roast Haunch",
    description: "A generous portion of roast boar or venison with gravy and greens.",
    cost: { amount: 3, currency: "sp" },
    category: "food",
    minQuality: "fancy",
  },
  {
    id: "food-feast-platter",
    name: "Feast Platter",
    description: "An indulgent spread of fine meats, sauces, and sweetmeats for one.",
    cost: { amount: 1, currency: "gp" },
    category: "food",
    minQuality: "fancy",
  },

  // ─── Beverages ─────────────────────────────────────────────────────────────
  {
    id: "bev-small-beer",
    name: "Small Beer",
    description: "Weak, slightly sour table beer. Better than river water.",
    cost: { amount: 1, currency: "cp" },
    category: "beverages",
    minQuality: "poor",
  },
  {
    id: "bev-mead",
    name: "Mead",
    description: "Honey wine, sweet and warming.",
    cost: { amount: 2, currency: "cp" },
    category: "beverages",
    minQuality: "poor",
  },
  {
    id: "bev-cheap-wine",
    name: "Cheap Wine (jug)",
    description: "Rough local wine of dubious vintage.",
    cost: { amount: 4, currency: "cp" },
    category: "beverages",
    minQuality: "poor",
  },
  {
    id: "bev-cider",
    name: "Cider",
    description: "Tart apple cider pressed in the local orchards.",
    cost: { amount: 2, currency: "cp" },
    category: "beverages",
    minQuality: "poor",
  },
  {
    id: "bev-ale",
    name: "Ale (pint)",
    description: "A good dark ale, properly brewed and matured.",
    cost: { amount: 3, currency: "cp" },
    category: "beverages",
    minQuality: "common",
  },
  {
    id: "bev-porter",
    name: "Porter (pint)",
    description: "A rich, dark porter with a bitter finish.",
    cost: { amount: 4, currency: "cp" },
    category: "beverages",
    minQuality: "common",
  },
  {
    id: "bev-table-wine",
    name: "Table Wine (bottle)",
    description: "A decent bottle of regional wine, red or white.",
    cost: { amount: 1, currency: "sp" },
    category: "beverages",
    minQuality: "common",
  },
  {
    id: "bev-spiced-wine",
    name: "Spiced Wine (cup)",
    description: "Warmed wine with winter spices — cloves, cinnamon, and dried berries.",
    cost: { amount: 5, currency: "cp" },
    category: "beverages",
    minQuality: "common",
  },
  {
    id: "bev-fine-wine",
    name: "Fine Wine (bottle)",
    description: "An imported bottle of quality wine, fit for a noble's table.",
    cost: { amount: 5, currency: "sp" },
    category: "beverages",
    minQuality: "fancy",
  },
  {
    id: "bev-aged-brandy",
    name: "Aged Brandy (glass)",
    description: "A smooth, golden brandy aged in oak. Served in a crystal glass.",
    cost: { amount: 3, currency: "sp" },
    category: "beverages",
    minQuality: "fancy",
  },
  {
    id: "bev-herbal-cordial",
    name: "Herbal Cordial (glass)",
    description: "A sweet cordial made from forest herbs. Distinctly Dolmenwood.",
    cost: { amount: 2, currency: "sp" },
    category: "beverages",
    minQuality: "fancy",
  },
  {
    id: "bev-honey-spirit",
    name: "Honey Spirit (glass)",
    description: "A potent distilled spirit made from fermented honey. Burns pleasantly.",
    cost: { amount: 4, currency: "sp" },
    category: "beverages",
    minQuality: "fancy",
  },
];

export const INN_CATEGORIES: { key: InnMenuItem["category"]; label: string; icon: string }[] = [
  { key: "lodgings",  label: "Lodgings",  icon: "fa-bed" },
  { key: "stabling",  label: "Stabling",  icon: "fa-horse" },
  { key: "food",      label: "Food",      icon: "fa-utensils" },
  { key: "beverages", label: "Beverages", icon: "fa-beer-mug-empty" },
];
