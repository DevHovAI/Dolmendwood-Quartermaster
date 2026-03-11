import { MODULE_ID, FLAGS } from "../constants";
import { CatalogManager } from "./CatalogManager";
import type { CharacterInventory, ZoneCoins, Transaction } from "../types";

function defaultInventory(actorId: string): CharacterInventory {
  return {
    actorId,
    coins: { cp: 0, sp: 0, gp: 0, pp: 0 },
    coinsByZone: { equipped: { cp: 0, sp: 0, gp: 0, pp: 0 } },
    items: [],
  };
}

// ─── Coin Helpers (exported for use in SocketHandler, innPurchase, etc.) ──────

export function totalZoneCoins(coinsByZone: Record<string, ZoneCoins>): ZoneCoins {
  const t = { cp: 0, sp: 0, gp: 0, pp: 0 };
  for (const z of Object.values(coinsByZone)) {
    t.cp += z.cp; t.sp += z.sp; t.gp += z.gp; t.pp += z.pp;
  }
  return t;
}

/**
 * Deduct costCp worth of coins from zones (equipped → stowed → tiny → extras).
 * Mutates coinsByZone in place. Returns true if successful.
 */
export function deductCoins(coinsByZone: Record<string, ZoneCoins>, costCp: number): boolean {
  const avail = Object.values(coinsByZone)
    .reduce((s, z) => s + z.cp + z.sp * 10 + z.gp * 100 + z.pp * 500, 0);
  if (avail < costCp) return false;
  const extras = Object.keys(coinsByZone).filter(k => !["equipped", "stowed", "tiny"].includes(k));
  const order = ["equipped", "stowed", "tiny", ...extras];
  let rem = costCp;
  for (const id of order) {
    if (rem <= 0) break;
    const z = coinsByZone[id];
    if (!z) continue;
    const inZone = z.cp + z.sp * 10 + z.gp * 100 + z.pp * 500;
    if (inZone <= 0) continue;
    if (inZone <= rem) {
      rem -= inZone;
      z.cp = 0; z.sp = 0; z.gp = 0; z.pp = 0;
    } else {
      const left = inZone - rem; rem = 0;
      z.pp = 0; z.gp = Math.floor(left / 100);
      z.sp = Math.floor((left % 100) / 10); z.cp = left % 10;
    }
  }
  return true;
}

/** Add coins to a specific zone (default: equipped). Mutates coinsByZone in place. */
export function addCoinsToZone(
  coinsByZone: Record<string, ZoneCoins>,
  coins: ZoneCoins,
  zoneId = "equipped"
): void {
  if (!coinsByZone[zoneId]) coinsByZone[zoneId] = { cp: 0, sp: 0, gp: 0, pp: 0 };
  const z = coinsByZone[zoneId];
  z.cp += coins.cp; z.sp += coins.sp; z.gp += coins.gp; z.pp += coins.pp;
}

// ─── Internal sync ─────────────────────────────────────────────────────────────

/**
 * Ensures coinsByZone exists (migrating from legacy coins if needed),
 * clamps all values, prunes orphaned zone entries, and syncs inv.coins total.
 */
function syncCoins(inv: CharacterInventory): void {
  // One-time migration: if coinsByZone has never been set, seed it from the legacy coins total.
  // After this runs once, coinsByZone is always present and inv.coins becomes a derived total.
  // We use inv.coinsByZone == null (not just falsy) to avoid re-migrating if explicitly set to {}.
  if (inv.coinsByZone == null) {
    inv.coinsByZone = {
      equipped: {
        cp: inv.coins.cp ?? 0,
        sp: inv.coins.sp ?? 0,
        gp: inv.coins.gp ?? 0,
        pp: inv.coins.pp ?? 0,
      },
    };
  }

  // Valid zone IDs: standard zones + current extra zones
  const validIds = new Set([
    "tiny", "equipped", "stowed",
    ...(inv.extraZones ?? []).map(ez => ez.id),
  ]);

  // Prune coins from zones that no longer exist → move to equipped
  const equip = (inv.coinsByZone["equipped"] ??= { cp: 0, sp: 0, gp: 0, pp: 0 });
  for (const zoneId of Object.keys(inv.coinsByZone)) {
    if (!validIds.has(zoneId)) {
      const z = inv.coinsByZone[zoneId];
      equip.cp += z.cp; equip.sp += z.sp; equip.gp += z.gp; equip.pp += z.pp;
      delete inv.coinsByZone[zoneId];
    }
  }

  // Clamp all values to non-negative integers
  for (const z of Object.values(inv.coinsByZone)) {
    z.cp = Math.max(0, Math.round(z.cp ?? 0));
    z.sp = Math.max(0, Math.round(z.sp ?? 0));
    z.gp = Math.max(0, Math.round(z.gp ?? 0));
    z.pp = Math.max(0, Math.round(z.pp ?? 0));
  }

  // Sync inv.coins to the total across all zones
  inv.coins = totalZoneCoins(inv.coinsByZone);
}

// ─── FlagManager ───────────────────────────────────────────────────────────────

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
    syncCoins(updated);
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
    const trimmed = log.slice(-200);
    await (game as Game).settings.set(MODULE_ID, FLAGS.TRANSACTION_LOG, trimmed);
  }
}
