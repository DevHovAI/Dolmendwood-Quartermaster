import { MODULE_ID, FLAGS } from "../constants";
import { CatalogManager } from "./CatalogManager";
import type { CharacterInventory, CoinSlot, Transaction } from "../types";

function defaultInventory(actorId: string): CharacterInventory {
  return {
    actorId,
    coins: { cp: 0, sp: 0, gp: 0, pp: 0 },
    items: [],
  };
}

/**
 * Ensure coinSlots array is in sync with the total coin count.
 * New purses go to "stowed"; excess purses are removed starting from "stowed", then "equipped", then "tiny".
 */
function syncCoinSlots(inv: CharacterInventory): void {
  const total = inv.coins.cp + inv.coins.sp + inv.coins.gp + inv.coins.pp;
  let chestCapacity = 0;
  for (const item of inv.items) {
    const def = CatalogManager.getMap().get(item.definitionId);
    if (def?.coinCapacity) chestCapacity += def.coinCapacity * item.quantity;
  }
  const purseCoins = Math.max(0, total - chestCapacity);
  const needed = purseCoins > 0 ? Math.ceil(purseCoins / 100) : 0;
  const current: CoinSlot[] = (inv.coinSlots ?? []).slice();

  if (needed > current.length) {
    for (let i = current.length; i < needed; i++) {
      current.push({ id: foundry.utils.randomID(), zone: "stowed" });
    }
  } else if (needed < current.length) {
    let excess = current.length - needed;
    // Remove from stowed first, then equipped, then tiny, then anything remaining
    for (const zone of ["stowed", "equipped", "tiny"]) {
      for (let i = current.length - 1; i >= 0 && excess > 0; i--) {
        if (current[i].zone === zone) {
          current.splice(i, 1);
          excess--;
        }
      }
    }
    // Remove any remaining excess (extra zones) from the end
    while (excess > 0) {
      current.pop();
      excess--;
    }
  }

  inv.coinSlots = current;
}

export class FlagManager {
  static getInventory(actor: Actor): CharacterInventory {
    const stored = actor.getFlag(MODULE_ID, FLAGS.INVENTORY) as CharacterInventory | undefined;
    return stored ?? defaultInventory(actor.id ?? "");
  }

  static async setInventory(actor: Actor, inventory: CharacterInventory): Promise<void> {
    await actor.setFlag(MODULE_ID, FLAGS.INVENTORY, inventory);
  }

  static async updateInventory(
    actor: Actor,
    updater: (inv: CharacterInventory) => CharacterInventory
  ): Promise<void> {
    const current = this.getInventory(actor);
    const updated = updater(structuredClone(current));
    syncCoinSlots(updated);
    await this.setInventory(actor, updated);
  }

  static getTransactions(): Transaction[] {
    const stored = (game as Game).settings.get(MODULE_ID, FLAGS.TRANSACTION_LOG) as
      | Transaction[]
      | undefined;
    return stored ?? [];
  }

  static async appendTransaction(tx: Transaction): Promise<void> {
    const log = this.getTransactions();
    log.push(tx);
    // Keep last 200 transactions to prevent unbounded growth
    const trimmed = log.slice(-200);
    await (game as Game).settings.set(MODULE_ID, FLAGS.TRANSACTION_LOG, trimmed);
  }
}
