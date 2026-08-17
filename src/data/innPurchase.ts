import { FlagManager, deductCoins } from "./FlagManager";
import { recordInnPurchase } from "./innMenu";
import { addItemWithZones, getEncumbranceMode } from "./zoneGrants";
import type { InnPurchasePayload } from "../types";

/**
 * Charges an inn purchase to the payer and notes it in the day's log.
 * Nothing is added to inventory — inn items are consumed on the spot.
 * Extracted into its own module to avoid circular imports between InnApp ↔ SocketHandler.
 *
 * The payer and the recipient are separate: buying a round means one purse is
 * emptied and somebody else's name goes on the board.
 *
 * Returns false when the payer cannot afford it, in which case nothing is
 * deducted and nothing is logged.
 */
export async function processInnPurchase(payload: InnPurchasePayload): Promise<boolean> {
  const g = game as Game;
  const payer = g.actors?.get(payload.actorId);
  if (!payer) return false;

  // The window clamps against the wallet as it was when the item was clicked, so
  // by the time this runs on the GM's client the money may already be spent.
  // deductCoins leaves the purse untouched when it returns false.
  let paid = false;
  await FlagManager.updateInventory(payer, (inv) => {
    const costCp =
      (payload.totalCost.cp ?? 0) +
      (payload.totalCost.sp ?? 0) * 10 +
      (payload.totalCost.gp ?? 0) * 100 +
      (payload.totalCost.pp ?? 0) * 500;

    inv.coinsByZone ??= { equipped: { ...inv.coins } };
    paid = deductCoins(inv.coinsByZone, costCp);
    return inv;
  });

  if (!paid) {
    ui.notifications?.warn(
      `${payer.name} cannot afford ${payload.itemName} — nothing was charged.`
    );
    return false;
  }

  // A bottle or cask is carried away, so it goes to whoever it was bought for —
  // not to whoever paid. Only after the money is confirmed gone: adding first
  // would mint a container if the deduction then failed.
  if (payload.item) {
    const recipient = g.actors?.get(payload.forActorId);
    if (recipient) {
      const encMode = getEncumbranceMode();
      await FlagManager.updateInventory(recipient, (inv) => {
        addItemWithZones(inv, foundry.utils.deepClone(payload.item!), encMode);
        return inv;
      });
    }
  }

  await recordInnPurchase(payload.forActorId, payload.section, payload.itemName);
  return true;
}
