import { MODULE_ID, SETTINGS } from "../constants";
import type { ShopEntry } from "../types";

/**
 * What a particular shop has on its own shelf, and the services it can offer.
 *
 * Two stores, one shape:
 *
 * - **A shop's stock** — `SETTINGS.LOCAL_CUSTOM_ITEMS`, keyed by shop name, the
 *   generic toolbar shop under its reserved key. This is where **Add to Shop**
 *   and **From Catalogue** have always written; services simply arrive in it
 *   with `service: true` set.
 * - **The service library** — `SETTINGS.SERVICE_LIBRARY`, one flat list the
 *   whole world shares. A guide costs 5gp a day in every settlement in
 *   Dolmenwood, and typing that into twelve shops by hand is how a price ends
 *   up different in each of them.
 *
 * The library is a *source to copy from*, never a live link: picking a service
 * out of it puts a copy on that shop's shelf, which the Referee may then reprice
 * for a particular village. Changing the library afterwards leaves shops alone.
 */

// ─── Storage ──────────────────────────────────────────────────────────────────

/** Everything on this shop's own shelf, services and goods alike. */
export function shopEntries(shopKey: string): ShopEntry[] {
  const all =
    ((game as Game).settings.get(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS) as Record<string, ShopEntry[]>) ?? {};
  return all[shopKey] ?? [];
}

export async function setShopEntries(shopKey: string, entries: ShopEntry[]): Promise<void> {
  const g = game as Game;
  const all = (g.settings.get(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS) as Record<string, ShopEntry[]>) ?? {};
  all[shopKey] = entries;
  await g.settings.set(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS, all);
}

/** Add to a shop's shelf, ignoring anything already standing on it. */
export async function addShopEntries(shopKey: string, entries: ShopEntry[]): Promise<number> {
  const current = shopEntries(shopKey);
  const have = new Set(current.map((e) => e.id));
  const fresh = entries.filter((e) => !have.has(e.id));
  if (!fresh.length) return 0;
  await setShopEntries(shopKey, [...current, ...fresh.map((e) => foundry.utils.deepClone(e))]);
  return fresh.length;
}

/** The Referee's own services, kept apart from any one shop. */
export function serviceLibrary(): ShopEntry[] {
  return ((game as Game).settings.get(MODULE_ID, SETTINGS.SERVICE_LIBRARY) as ShopEntry[]) ?? [];
}

export async function setServiceLibrary(entries: ShopEntry[]): Promise<void> {
  await (game as Game).settings.set(MODULE_ID, SETTINGS.SERVICE_LIBRARY, entries);
}

/**
 * Everything a shop can be stocked with from stored knowledge: the book's own
 * specialists first, then whatever the Referee has written since.
 *
 * A library entry that carries a built-in id replaces the built-in one, so a
 * table that decided a guide costs 3gp keeps its answer and does not see both.
 */
export function allLibraryServices(): ShopEntry[] {
  const own = serviceLibrary();
  const overridden = new Set(own.map((e) => e.id));
  return [...SPECIAL_SERVICES.filter((e) => !overridden.has(e.id)), ...own];
}

// ─── The Player's Book specialists ────────────────────────────────────────────
//
// Player's Book p132–133, the wages and the mechanical conditions only. The
// book's own prose stays in the book: what is transcribed here is what the
// table needs to charge for a thing and to know what it bought.
//
// `cost.amount: 0` means the price is not a number the book prints — the
// alchemist charges the potion's own value, and the shop shows those as
// "by arrangement" rather than as free.

function service(
  id: string,
  name: string,
  subcategory: string,
  amount: number,
  currency: ShopEntry["cost"]["currency"],
  unit: string,
  icon: string,
  description: string
): ShopEntry {
  return {
    id,
    name,
    category: "Special Services",
    subcategory,
    size: "tiny",
    cannotBeStowed: false,
    unit,
    cost: { amount, currency },
    weight: 0,
    description,
    icon,
    qualities: [],
    tags: [],
    isCustom: true,
    service: true,
  };
}

export const SPECIAL_SERVICES: ShopEntry[] = [
  service(
    "svc-alchemist-analyse",
    "Analyse a potion",
    "Alchemist",
    200,
    "gp",
    "per potion",
    "fa-flask",
    "Cities. Takes 1d6 days, and there is a 1-in-6 chance the answer is wrong. Player's Book p132."
  ),
  service(
    "svc-alchemist-brew",
    "Brew a potion to order",
    "Alchemist",
    0,
    "gp",
    "the potion's own value",
    "fa-flask",
    "Cities. Costs what the potion is worth, and takes 1d6 days per 500gp of that. A 1-in-6 chance of failure. Player's Book p132."
  ),
  service(
    "svc-animal-trainer",
    "Animal trainer",
    "Animal Trainer",
    500,
    "gp",
    "per month",
    "fa-paw",
    "Cities. One kind of animal per trainer, up to six at a time. The first behaviour takes about a month and each further one a fortnight, and the training must run without interruption. Player's Book p132."
  ),
  service(
    "svc-builder",
    "Builder",
    "Builder",
    25,
    "gp",
    "per week",
    "fa-trowel-bricks",
    "Towns and cities. The wage covers materials and the work crew. One week per 500gp of the building, at least a month; near a settlement the building itself costs half. Player's Book p132."
  ),
  service(
    "svc-guide",
    "Guide",
    "Guide",
    5,
    "gp",
    "per day",
    "fa-signs-post",
    "Any settlement. Leads to and from the landmarks of one region with no risk of getting lost, and gives a 4-in-6 chance to find the path again when the party is lost. Double pay for dangerous regions. Player's Book p132."
  ),
  service(
    "svc-mercenary-standard",
    "Mercenary, standard",
    "Mercenary",
    5,
    "gp",
    "per month",
    "fa-shield-halved",
    "Towns and cities. Hired as a company and never without its captain; one lieutenant per ten. Double pay in wartime. Will not delve or adventure without a military objective. Player's Book p133."
  ),
  service(
    "svc-mercenary-cavalry",
    "Mercenary, cavalry",
    "Mercenary",
    20,
    "gp",
    "per month",
    "fa-horse",
    "Towns and cities. Plate mail, lance, longsword and a charger. Player's Book p133."
  ),
  service(
    "svc-mercenary-lieutenant",
    "Mercenary, lieutenant",
    "Mercenary",
    25,
    "gp",
    "per month",
    "fa-shield-halved",
    "Towns and cities. One is required for every ten mercenaries. Player's Book p133."
  ),
  service(
    "svc-mercenary-captain",
    "Mercenary, captain",
    "Mercenary",
    150,
    "gp",
    "per month",
    "fa-shield-halved",
    "Towns and cities. A company cannot be hired without one. Player's Book p133."
  ),
  service(
    "svc-pack-handler",
    "Pack handler",
    "Pack Handler",
    2,
    "sp",
    "per day",
    "fa-person-walking-luggage",
    "Any settlement. Handles mounts, loads and unloads, drives land vehicles, sets and watches camp. Absolutely refuses dangerous regions. Player's Book p133."
  ),
  service(
    "svc-rower",
    "Rower",
    "Rower",
    2,
    "sp",
    "per day",
    "fa-anchor",
    "Any settlement. Unskilled labour for water vessels. Player's Book p133."
  ),
  service(
    "svc-sage-translate",
    "Translate a text",
    "Sage",
    100,
    "gp",
    "per page or inscription",
    "fa-scroll",
    "Cities. Any language belonging to the sage's own field. Player's Book p133."
  ),
  service(
    "svc-sage-lore",
    "Basic lore or item identification",
    "Sage",
    200,
    "gp",
    "per consultation",
    "fa-book-open",
    "Cities. Questions within the sage's own field. Player's Book p133."
  ),
  service(
    "svc-sage-research",
    "Dedicated research",
    "Sage",
    2000,
    "gp",
    "per month",
    "fa-graduation-cap",
    "Cities. Obscure questions take one or more months, and there is a 5% chance the answer comes back false or misleading. Player's Book p133."
  ),
  service(
    "svc-sailor",
    "Sailor",
    "Sailor",
    10,
    "gp",
    "per month",
    "fa-ship",
    "Any waterside settlement. Comes with shortsword, shield and leather armour. Player's Book p133."
  ),
  service(
    "svc-spell-rank-1",
    "Spell cast, Rank 1",
    "Spell-caster",
    100,
    "gp",
    "per casting",
    "fa-wand-sparkles",
    "Cities. The Referee's guideline price; the caster names their own, and may want a quest as well. Illegal or dubious ends cost double or more. Lesser runes count as Rank 1. Player's Book p133."
  ),
  service(
    "svc-spell-rank-2",
    "Spell cast, Rank 2",
    "Spell-caster",
    250,
    "gp",
    "per casting",
    "fa-wand-sparkles",
    "Cities. Guideline price. Player's Book p133."
  ),
  service(
    "svc-spell-rank-3",
    "Spell cast, Rank 3",
    "Spell-caster",
    500,
    "gp",
    "per casting",
    "fa-wand-sparkles",
    "Cities. Guideline price. Player's Book p133."
  ),
  service(
    "svc-spell-rank-4",
    "Spell cast, Rank 4",
    "Spell-caster",
    1000,
    "gp",
    "per casting",
    "fa-wand-sparkles",
    "Cities. Guideline price. Greater runes count as Rank 4. Player's Book p133."
  ),
  service(
    "svc-spell-rank-5",
    "Spell cast, Rank 5",
    "Spell-caster",
    2500,
    "gp",
    "per casting",
    "fa-wand-sparkles",
    "Cities. Guideline price. Player's Book p133."
  ),
  service(
    "svc-spell-rank-6",
    "Spell cast, Rank 6",
    "Spell-caster",
    5000,
    "gp",
    "per casting",
    "fa-wand-sparkles",
    "Cities. Guideline price. Mighty runes count as Rank 6. Player's Book p133."
  ),
];

// ─── Editing a shelf entry ────────────────────────────────────────────────────

/** What the Add/Edit form actually asks about. Everything else is inherited. */
export interface ShopEntryForm {
  name: string;
  category: string;
  subcategory: string;
  cost: ShopEntry["cost"];
  /** "" means the plain each-one price, stored as the catalogue's "piece". */
  unit: string;
  icon: string;
  /** "" clears an inherited description on purpose. */
  description: string;
  /** undefined = always in stock. */
  availability?: number;
  service: boolean;
  edible: boolean;
  /** Whichever of the two the running encumbrance mode puts on screen. */
  size?: ItemSize;
  weight?: number;
}

type ItemSize = "tiny" | "normal" | "large";

/**
 * Fold the form's answers into an entry, keeping everything the form never asked.
 *
 * The form asks about ten fields; an ItemDefinition has twenty. Rebuilding from
 * the form alone strips a quiver's `maxUses`, a backpack's `grantsZone` and a
 * treasure's `notSold` from any row edited after it was stocked from the
 * catalogue — silently, and noticed only when the quiver stops counting.
 *
 * `was` undefined builds a fresh entry with a new id.
 */
export function mergeShopEntry(was: ShopEntry | undefined, form: ShopEntryForm): ShopEntry {
  const merged: ShopEntry = {
    size: "normal",
    cannotBeStowed: false,
    qualities: [],
    tags: [],
    weight: 0,
    ...(was ?? {}),
    id: was?.id ?? foundry.utils.randomID(),
    name: form.name,
    category: form.category,
    subcategory: form.subcategory,
    cost: { ...form.cost },
    unit: form.unit || "piece",
    icon: form.icon,
    isCustom: true,
    description: form.description,
  };

  // Absent means "always", so a chance has to be removable and not merely
  // settable — otherwise a line given 2-in-6 by mistake is stuck with it.
  if (form.availability === undefined) delete merged.availability;
  else merged.availability = form.availability;

  if (form.service) {
    merged.service = true;
    merged.weight = 0;
    delete merged.edible;
  } else {
    delete merged.service;
    if (form.edible) merged.edible = true;
    else delete merged.edible;
    // Only the field the running mode showed may overwrite; the other keeps
    // whatever the entry already carried.
    if (form.weight !== undefined) merged.weight = form.weight;
    if (form.size !== undefined) merged.size = form.size;
    // A brand-new row in slot mode never saw a weight box, and a world that
    // switches to weight encumbrance later should not find it weightless.
    if (!was && form.weight === undefined) merged.weight = 10;
  }

  return merged;
}

// ─── What a shop will buy back ───────────────────────────────────────────────

/**
 * The categories a shop deals in, or null when it deals in everything.
 *
 * A shop buys back only what it would sell: a cheesemonger has no use for your
 * sword, and no way to price it. Both halves of "what it sells" count — the
 * category list from the note, and whatever the GM has put on this shop's own
 * shelf by hand, since a hand-stocked healing potion is as much a thing this
 * shop deals in as a ticked category is.
 *
 * A shop that keeps to its own shelf has no category list at all, so its shelf
 * is the only answer available. An unrestricted shop sells the whole catalogue
 * and therefore buys across it, which is what every shop did before this.
 *
 * Services never count: they are not on a shelf and cannot be sold back.
 */
export function buyCategories(
  localCategories: string[],
  ownStockOnly: boolean,
  ownEntries: ShopEntry[]
): Set<string> | null {
  const own = ownEntries.filter((e) => !e.service).map((e) => e.category).filter(Boolean);
  if (localCategories.length > 0) return new Set([...localCategories, ...own]);
  if (ownStockOnly) return new Set(own);
  return null;
}

/** Whether a shop with those categories would take the thing at all. */
export function shopBuys(category: string | undefined, buys: Set<string> | null): boolean {
  if (!buys) return true;
  return !!category && buys.has(category);
}
