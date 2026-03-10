import { FlagManager, deductCoins } from "./FlagManager";
import type { InnPurchasePayload } from "../types";

/**
 * Deducts the cost of an inn purchase from the actor's coins.
 * Nothing is added to inventory — inn items are consumed on the spot.
 * Extracted into its own module to avoid circular imports between InnApp ↔ SocketHandler.
 */
export async function processInnPurchase(payload: InnPurchasePayload): Promise<void> {
  const actor = (game as Game).actors?.get(payload.actorId);
  if (!actor) return;

  await FlagManager.updateInventory(actor, (inv) => {
    const costCp =
      (payload.totalCost.cp ?? 0) +
      (payload.totalCost.sp ?? 0) * 10 +
      (payload.totalCost.gp ?? 0) * 100 +
      (payload.totalCost.pp ?? 0) * 500;

    inv.coinsByZone ??= { equipped: { ...inv.coins } };
    deductCoins(inv.coinsByZone, costCp);
    return inv;
  });
}
