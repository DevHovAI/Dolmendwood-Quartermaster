import { FlagManager, addCoinsToZone } from "./FlagManager";
import { CURRENCY_IN_CP } from "./coins";
import { containerCapacity, isBundle, stackUnits, setStackUnits } from "./consumables";
import { definitionFor } from "./itemDefs";
import type { SellItemPayload, Transaction, InventoryItem, ItemDefinition } from "../types";

/**
 * What a row is worth to a shop, and in what units it is sold.
 *
 * The catalogue prices a **full** thing. A quiver is "Arrows (Quiver of 20)"
 * at 5gp and a single arrow is 25cp — twenty of which is exactly 5gp, so the
 * price of a quiver *is* its arrows and nothing is being paid for the leather.
 * A quiver with seven arrows left is therefore worth seven arrows, and paying
 * a full quiver's price for it was simply wrong.
 *
 * The three shapes the module already distinguishes each sell differently:
 *
 * - a **bundle** (torches, firewood, candles) is loose units in a running
 *   total, so it sells by the unit and one unit is the definition's price
 *   divided by the bundle size;
 * - a **single container** (quiver, case, bottle, cask) is one object whose
 *   `uses` is a fill level, so it sells as one thing, priced by how full;
 * - anything else sells by the piece at its own price.
 *
 * Rounding is deliberately floor, and the floor is 0: a nearly empty quiver is
 * worth nothing to a shop, which is the same answer the price rule already
 * gives for anything valueless.
 */
export interface SaleValue {
  kind: "bundle" | "container" | "plain";
  /** How many sellable units this row holds — what "how many?" is asking about. */
  units: number;
  /** Full value of one unit in cp, before the shop's buy-back rate. */
  unitCp: number;
  /** Fill level, for saying "7 of 20" — only set for a container. */
  fill?: { used: number; capacity: number };
}

export function saleValue(
  item: InventoryItem,
  def: ItemDefinition | undefined
): SaleValue {
  const fullCp = def ? def.cost.amount * CURRENCY_IN_CP[def.cost.currency] : 0;

  const capacity = containerCapacity(item, def);
  if (capacity !== undefined) {
    const used = Math.max(0, Math.min(capacity, item.uses ?? capacity));
    return {
      kind: "container",
      units: 1,
      unitCp: Math.floor((fullCp * used) / capacity),
      fill: { used, capacity },
    };
  }

  if (isBundle(item, def)) {
    const size = def!.maxUses!;
    return {
      kind: "bundle",
      units: stackUnits(item, size),
      unitCp: Math.floor(fullCp / size),
    };
  }

  return { kind: "plain", units: item.quantity, unitCp: fullCp };
}

/**
 * Take `count` units off a row, in whatever unit that row counts in.
 * Returns false when the row is spent and the caller should drop it.
 */
export function removeSoldUnits(
  item: InventoryItem,
  def: ItemDefinition | undefined,
  count: number
): boolean {
  const value = saleValue(item, def);
  if (value.kind === "bundle") {
    return setStackUnits(item, def!.maxUses!, value.units - count);
  }
  // A container is one object: selling it sells the object, part-full or not.
  if (value.kind === "container") return false;
  item.quantity -= count;
  return item.quantity > 0;
}

/**
 * Sells one row out of a character's inventory to the shop standing in front
 * of them.
 *
 * The books' own arrangement, which the settlement notes repeat in every
 * village: a shop buys used gear back at half what it sells for, a jeweller
 * pays 80% for gems, a herbalist 50% for fungi, a fence 50% for anything that
 * would raise questions. So the rate belongs to the *shop*, not to the item,
 * and lives on the map note beside the price factor.
 *
 * No chat card, unlike a service: a sale leaves two traces of its own — the
 * row is gone and the purse is heavier — and the transaction log records it.
 *
 * The proceeds are worked out by the window and passed in, the same way a
 * purchase passes its own total. That trusts the client, and so does every
 * other coin path in the module; making this one the exception would be a
 * change of trust model, not a fix.
 */
export async function processSale(payload: SellItemPayload): Promise<boolean> {
  const g = game as Game;
  const seller = g.actors?.get(payload.actorId);
  if (!seller) {
    ui.notifications?.error("The sale went nowhere: that character is not in this world.");
    return false;
  }

  let sold: { definitionId: string; name: string; quantity: number } | undefined;

  await FlagManager.updateInventory(seller, (inv) => {
    const idx = inv.items.findIndex((i) => i.id === payload.itemId);
    if (idx === -1) return inv;

    const row = inv.items[idx];
    // Units, not rows: three torches out of a bundle, or one part-full quiver.
    // definitionFor reads the row's own customDefinition where it has one, so a
    // GM-invented bottle is valued by the same rule as a catalogue quiver.
    const def = definitionFor(row);
    const count = Math.max(1, Math.min(payload.quantity, saleValue(row, def).units));

    sold = { definitionId: row.definitionId, name: row.name, quantity: count };

    if (!removeSoldUnits(row, def, count)) inv.items.splice(idx, 1);

    inv.coinsByZone ??= { equipped: { ...inv.coins } };
    addCoinsToZone(inv.coinsByZone, {
      cp: payload.proceeds.currency === "cp" ? payload.proceeds.amount : 0,
      sp: payload.proceeds.currency === "sp" ? payload.proceeds.amount : 0,
      gp: payload.proceeds.currency === "gp" ? payload.proceeds.amount : 0,
      pp: payload.proceeds.currency === "pp" ? payload.proceeds.amount : 0,
    });

    return inv;
  });

  if (!sold) {
    // The row named in the payload was not in the inventory the GM read back.
    // Silent here means the player sees nothing whatsoever happen.
    ui.notifications?.error(`${seller.name} was not carrying that item — nothing was sold.`);
    return false;
  }

  const tx: Transaction = {
    id: foundry.utils.randomID(),
    timestamp: Date.now(),
    type: "trade",
    fromActorId: payload.actorId,
    toActorId: "shop",
    items: [sold],
    coinsDelta: [
      {
        actorId: payload.actorId,
        cp: payload.proceeds.currency === "cp" ? payload.proceeds.amount : 0,
        sp: payload.proceeds.currency === "sp" ? payload.proceeds.amount : 0,
        gp: payload.proceeds.currency === "gp" ? payload.proceeds.amount : 0,
        pp: payload.proceeds.currency === "pp" ? payload.proceeds.amount : 0,
      },
    ],
  };
  await FlagManager.appendTransaction(tx);

  ui.notifications?.info(
    `${seller.name} sold ${sold.quantity} × ${sold.name} for ${payload.proceeds.amount} ${payload.proceeds.currency}.`
  );
  return true;
}
