import { MODULE_ID, FLAGS } from "../constants";
import type { CharacterInventory, Transaction } from "../types";

function defaultInventory(actorId: string): CharacterInventory {
  return {
    actorId,
    coins: { cp: 0, sp: 0, gp: 0, pp: 0 },
    items: [],
  };
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
