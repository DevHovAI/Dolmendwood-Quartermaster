import { FlagManager, addCoinsToZone } from "./FlagManager";
import type { SellItemPayload, Transaction } from "../types";

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
    const count = Math.max(1, Math.min(payload.quantity, row.quantity));

    sold = { definitionId: row.definitionId, name: row.name, quantity: count };

    if (count >= row.quantity) {
      inv.items.splice(idx, 1);
    } else {
      row.quantity -= count;
    }

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
