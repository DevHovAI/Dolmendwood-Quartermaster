import { FlagManager } from "./FlagManager";
import { CatalogManager } from "./CatalogManager";
import { addItemWithZones, getEncumbranceMode } from "./zoneGrants";
import type { InventoryItem, ItemDefinition } from "../types";

/**
 * Putting food the party found into the party's packs.
 *
 * **The book prescribes the weight and the module already had it right**, which
 * is worth stating because it is the first question anyone asks: a fresh ration
 * is 1gp and **20 coins of weight**, and in slot encumbrance it is a "general
 * item" — **1 gear slot** (Player's Book p116 and p149). So foraged food weighs
 * exactly what bought food weighs, which is the only answer that keeps a
 * shop honest: if a day's fishing were free to carry, nobody would ever buy
 * rations again.
 *
 * That has a consequence a Referee should see coming rather than discover: a
 * good day's fishing is **2d6 rations**, and twelve of them is twelve slots —
 * more than a backpack holds. Hence the dialogs offer the shared party store as
 * a destination beside the character who found the food; a pack animal is what
 * the rules expect a party to answer with.
 *
 * **Spoilage is not tracked.** Fresh rations last a week, or a day in dank
 * conditions (p116) — the module says so on the card and leaves the crossing-off
 * to the table, because a clock nobody can see would rot food behind their back.
 */

/** The catalogue row every kind of found food becomes. */
export const FRESH_RATION_ID = "rations-fresh";

/** What one ration costs a character to carry, straight off the catalogue. */
export function rationWeight(): number {
  return CatalogManager.getDefinition(FRESH_RATION_ID)?.weight ?? 20;
}

/**
 * Rations from a kill: "1 ration per HP for Small animals, 2 per HP for
 * Medium, and 4 for Large" (Player's Book p152).
 *
 * Hunting is the one method that cannot pay out when it is rolled — the book
 * sends the party into a combat first — so this is applied afterwards, from the
 * card, once the Referee knows what fell.
 */
export const KILL_YIELD: { size: "small" | "medium" | "large"; per: number; label: string }[] = [
  { size: "small", per: 1, label: "Small — 1 ration per Hit Point" },
  { size: "medium", per: 2, label: "Medium — 2 rations per Hit Point" },
  { size: "large", per: 4, label: "Large — 4 rations per Hit Point" },
];

export function rationsFromKill(hitPoints: number, size: "small" | "medium" | "large"): number {
  const per = KILL_YIELD.find((k) => k.size === size)?.per ?? 1;
  return Math.max(0, Math.floor(hitPoints)) * per;
}

/**
 * What was actually found, where the tables named it.
 *
 * Leander's point, and it changes the shape of the row: *"schließlich haben die
 * Dinge manchmal auch Effekte beim Essen, es sollten also nicht einfach 'fresh
 * rations' sein."* A cap of bogbell and a brace of hare are both "1 day's fresh
 * food" to the encumbrance rules and nothing alike on the plate — and the
 * Campaign Book prints an effect for several of them.
 */
export interface FoundFood {
  /** What the table called it. Becomes the row's name. */
  name: string;
  /**
   * The book's own line about it. It becomes the row's **description** and
   * nothing else — Leander's point, and it is right: writing it into `notes`
   * as well printed the same sentence twice on one row. The notes are the
   * players' own space and they start empty.
   */
  note?: string;
  /**
   * What only the Referee may read — the true name of something the party has
   * not identified yet. Set, the row's `name` is the *cover*: "Rare herb".
   */
  gmNote?: string;
  /**
   * The definition to use in place of a ration's, for weight and size.
   *
   * **For an unidentified find this must be a cover, never the real entry** —
   * see `coverDefinition`.
   */
  as?: ItemDefinition;
}

/**
 * The catalogue's two shelves of herbs, and the line between them.
 *
 * The Player's Book prints a table of **common** fungi and herbs (p130) that
 * any character can be assumed to know on sight — that is what "common" means
 * — and the Campaign Book keeps the **rare** ones in its appendix (p430), where
 * they are treasure. The catalogue carries both, and the category is the only
 * honest way to tell them apart: a rare entry's own `qualities` line reads
 * "Found in hex 0209, 0803", which is a spoiler rather than a description.
 */
const RARE_SHELVES = new Set(["Rare Herbs", "Rare Fungi"]);

function catalogEntry(name: string): ItemDefinition | undefined {
  return CatalogManager.getAllDefinitions().find(
    (d) => d.name.toLowerCase() === name.trim().toLowerCase()
  );
}

/**
 * What a hex grows on top of the foraging table, on its way into a pack.
 *
 * **Common is named, rare is covered** — Leander's ruling, 2026-08-27, and it
 * settles a question the first cut got backwards. A forager who comes back with
 * an armful of Bosun's Balm knows it is Bosun's Balm; the table is in the book
 * they are holding. What they cannot name is the appendix's treasure, and that
 * is the only thing worth hiding.
 *
 * The earlier version read `subcategory`, which is `Plant` or `Fungus` on
 * exactly the *common* entries and `Rare Herbs` on the rare ones — so it
 * covered up the herbs everybody knows and let the rare ones through under the
 * vaguest label of the three. Reading the category puts it the right way round.
 */
export function hexFind(name: string, where: string): FoundFood {
  const real = catalogEntry(name);

  // Known, and known to be ordinary: it goes in under its own name, with the
  // catalogue's description and its effect on the row, like any other find.
  if (real && !RARE_SHELVES.has(real.category)) {
    return { name: real.name, note: real.description, as: real };
  }
  return unidentified(name, where, real);
}

/**
 * A rare herb or fungus a hex grows, packed away before anyone knows what it is.
 *
 * **The players must not be told and the Referee must not have to remember** —
 * Leander's requirement, and the two halves pull in opposite directions, which
 * is why the row carries a public name and a private one. The cover comes from
 * the catalogue's own shelf: "Rare herb" for one appendix list, "Rare fungus"
 * for the other. Anything the catalogue has never heard of is a "Rare find",
 * because guessing which it is would be worse than saying so.
 */
export function unidentified(name: string, where: string, entry?: ItemDefinition): FoundFood {
  const real = entry ?? catalogEntry(name);
  const cover =
    real?.category === "Rare Fungi"
      ? "Rare fungus"
      : real?.category === "Rare Herbs"
        ? "Rare herb"
        : "Rare find";

  // What the Referee needs at a glance is the **effect**, and for the appendix's
  // treasures that is the description ("Interact with incorporeal creatures");
  // the qualities line beside it is where the hex numbers live, which is worth
  // having on the same line and worth never showing anyone else.
  const known = [real?.description, ...(real?.qualities ?? [])].filter(Boolean).join(" · ");

  return {
    name: cover,
    // The players get the honest half: they know they have something unusual
    // and they know they cannot use it yet.
    note: "Unidentified. Somebody who knows herbs could put a name to it.",
    // How many were found is *not* repeated here: that is the row's own
    // quantity, standing an inch to the right of this line. Leaving it out
    // also lets two harvests of the same herb stack into one row, because the
    // Referee's line is then the same on both.
    gmNote: `${name}${known ? ` — ${known}` : ""} (${where})`,
    // Herbs are tiny and sold by the portion; a rare find should not weigh a
    // day's rations just because it arrived through the same door. What comes
    // across is the weight and nothing that names it.
    ...(real ? { as: coverDefinition(real) } : {}),
  };
}

/**
 * The physical facts of a find, with everything that would name it left behind.
 *
 * **This is the bug it exists to close**, and it was a real leak: the cover row
 * borrowed the catalogue entry *whole* — for its weight, which is the honest
 * reason — and a catalogue entry carries `qualities`, which `item-row.hbs`
 * prints for everybody. So a row reading "Rare herb" sat in the pack
 * announcing "Psychedelic; increases alertness", which is the one thing the
 * cover was there to hide. Its category said "Common Fungi and Herbs" too,
 * under an icon anyone can hover.
 *
 * What a cover may keep is what a character can tell by holding the thing: how
 * heavy it is, how much room it takes, that it is counted in portions.
 * Everything else — name, description, qualities, category, price — is
 * knowledge, and knowledge is precisely what they have not got yet.
 */
function coverDefinition(real: ItemDefinition): ItemDefinition {
  return {
    id: "unidentified-find",
    // Overwritten by the cover name in `storeRations`; here so the shape is a
    // whole definition rather than a half of one.
    name: "Unidentified find",
    // Deliberately blank rather than the real entry's: "Common Fungi and Herbs"
    // contradicts the word "Rare" on the row above it, and the category is only
    // ever read to choose an icon — which is set here outright.
    category: "",
    subcategory: "",
    icon: "fa-seedling",
    size: real.size,
    cannotBeStowed: real.cannotBeStowed,
    unit: real.unit,
    weight: real.weight,
    // No price. Nobody buys what nobody can name, and a shop offering 200gp for
    // it would tell the party more than the row does. Once it is identified and
    // renamed the Referee can price it off the catalogue like anything else.
    cost: { amount: 0, currency: "gp" },
    description: "",
    qualities: [],
    tags: [],
    isCustom: true,
  };
}

/**
 * Add found food to one inventory, under its own name.
 *
 * **A named find becomes a custom item, not a fresh-ration row**, and that is
 * what keeps two different finds apart: `canStackTogether` refuses to merge
 * anything carrying a `customDefinition`, so bogbell never joins hare, and one
 * day's harvest never absorbs the next. The cost of that rule is that two
 * identical finds are two rows, which is the right way round — the notes a
 * player writes on one harvest do not describe the other.
 *
 * Everything the rules care about is copied from the catalogue's fresh ration:
 * **one gear slot, 20 coins, edible**. The name and the note are the only things
 * that differ, so a found meal weighs exactly what a bought one does.
 *
 * Goes in through `addItemWithZones`, the same door a purchase uses. Stowed by
 * default: found food is packed, not held.
 */
export async function storeRations(
  holder: Actor,
  count: number,
  found?: FoundFood,
  zone: "stowed" | "equipped" | (string & {}) = "stowed"
): Promise<number> {
  if (count <= 0) return 0;
  // A rare find borrows its own catalogue entry's weight and size; everything
  // else is a day's food and weighs a day's food.
  const def = found?.as ?? CatalogManager.getDefinition(FRESH_RATION_ID);
  const named = found?.name?.trim();

  // Unnamed food is a plain ration row and stacks like one — that is what the
  // hunt's "some meat" case and any future caller without a table behind it get.
  const custom = named
    ? ({
        ...(def ?? {}),
        id: `found-${FRESH_RATION_ID}`,
        name: named,
        description: found?.note ?? def?.description ?? "",
        // Explicit rather than inherited: a found meal that could not be eaten
        // would be a cruel joke, and this is the flag the Eat button reads.
        // An unidentified find is **not** edible: eating a herb nobody has
        // named is the Referee's ruling, not a button.
        edible: !found?.gmNote,
        isCustom: true,
      } as ItemDefinition)
    : undefined;

  const row: InventoryItem = {
    id: foundry.utils.randomID(),
    definitionId: custom ? "" : FRESH_RATION_ID,
    name: named ?? def?.name ?? "Rations (Fresh, 1 Day)",
    quantity: count,
    zone,
    isSecret: false,
    // **Empty on purpose.** The book's line about the find is the item's
    // description and is printed a line above this; repeating it here said the
    // same thing twice and cost the row a line for nothing (Leander, 2026-08-27).
    // The notes are the players' space, for what they learn afterwards.
    notes: "",
    ...(found?.gmNote ? { gmNote: found.gmNote } : {}),
    ...(custom ? { customDefinition: custom } : {}),
  };

  await FlagManager.updateInventory(holder, (inv) => {
    // **The same find stacks; a different one never does.** A custom definition
    // is invisible to `canStackTogether` — it refuses to merge anything carrying
    // one, which is right for hand-made gear and wrong for a second basket of
    // the same mushroom. So the match is made here and kept deliberately strict:
    // same name, same zone, same notes, same line for the Referee. The moment a
    // player writes something on one basket it stops being interchangeable with
    // the next, which is exactly what those notes are for — and two "Rare herb"
    // rows that are secretly different herbs are kept apart by the `gmNote`,
    // which is the only place the difference is written down.
    if (custom) {
      const twin = inv.items.find(
        (i) =>
          i.zone === zone &&
          i.name === named &&
          (i.notes ?? "") === (row.notes ?? "") &&
          (i.gmNote ?? "") === (row.gmNote ?? "") &&
          !!i.customDefinition
      );
      if (twin) {
        twin.quantity += count;
        return inv;
      }
    }
    addItemWithZones(inv, row, getEncumbranceMode(), custom ?? def);
    return inv;
  });
  return count;
}
