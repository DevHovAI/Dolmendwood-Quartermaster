import { FlagManager } from "./FlagManager";
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
    const availCp =
      inv.coins.cp +
      inv.coins.sp * 10 +
      inv.coins.gp * 100 +
      inv.coins.pp * 500;

    if (availCp < costCp) return inv; // insufficient funds — caller should have validated

    const rem = availCp - costCp;
    // Same simplification as ShopApp: pp consumed into gp/sp/cp, pp set to 0
    inv.coins.pp = 0;
    inv.coins.gp = Math.floor(rem / 100);
    inv.coins.sp = Math.floor((rem % 100) / 10);
    inv.coins.cp = rem % 10;
    return inv;
  });
}
