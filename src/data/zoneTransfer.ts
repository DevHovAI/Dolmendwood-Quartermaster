import { FlagManager } from "./FlagManager";
import { definitionFor } from "./itemDefs";
import type { CharacterInventory, ExtraZone, InventoryItem, ItemDefinition, ZoneCoins } from "../types";

const STANDARD_ZONES = ["tiny", "equipped", "stowed"];

/** Local alias — the shared resolver lives in itemDefs.ts so every module can use it. */
function effectiveDefinition(item: InventoryItem): ItemDefinition | undefined {
  return definitionFor(item);
}

/**
 * The item that produced this zone. New zones point at it via `itemId`; zones
 * created before that link existed are matched by the granted zone name, the
 * same fallback reconcileZones uses.
 */
function findGrantingItemIndex(inv: CharacterInventory, zone: ExtraZone): number {
  if (zone.itemId) return inv.items.findIndex((i) => i.id === zone.itemId);
  return inv.items.findIndex((i) => {
    const def = effectiveDefinition(i);
    return (def?.grantsZone?.name ?? def?.grantsStorageZone?.name) === zone.name;
  });
}

export interface ZoneTransferResult {
  zone: ExtraZone;
  newZoneId: string;
  items: InventoryItem[];
  coins: ZoneCoins;
}

/**
 * Move an extra zone from one actor to another with everything attached to it:
 * its items, its coin purse, and the container/animal item that granted it.
 *
 * That last part is easy to miss and not optional. The granting item does not
 * live *inside* its own zone, so a filter on `item.zone === zoneId` leaves it
 * behind — and on the giver's very next inventory write, reconcileZones finds a
 * zone-granting item with no zone and mints a fresh empty duplicate.
 *
 * Returns null when the zone does not exist on the giver.
 */
export async function transferZone(
  fromActor: Actor,
  toActor: Actor,
  zoneId: string,
  options: { clearSecret?: boolean } = {}
): Promise<ZoneTransferResult | null> {
  let movedZone: ExtraZone | undefined;
  let movedItems: InventoryItem[] = [];
  let grantingItem: InventoryItem | undefined;
  let movedCoins: ZoneCoins = { cp: 0, sp: 0, gp: 0, pp: 0 };

  await FlagManager.updateInventory(fromActor, (inv) => {
    const zoneIdx = (inv.extraZones ?? []).findIndex((ez) => ez.id === zoneId);
    if (zoneIdx === -1) return inv;
    [movedZone] = inv.extraZones!.splice(zoneIdx, 1);

    movedItems = inv.items.filter((i) => i.zone === zoneId);
    inv.items = inv.items.filter((i) => i.zone !== zoneId);

    const grantIdx = findGrantingItemIndex(inv, movedZone);
    if (grantIdx !== -1) [grantingItem] = inv.items.splice(grantIdx, 1);

    if (inv.coinsByZone?.[zoneId]) {
      movedCoins = { ...inv.coinsByZone[zoneId] };
      // Zeroed rather than deleted: Foundry merges flag updates recursively, so
      // a removed key would survive in stored data (see syncCoins).
      inv.coinsByZone[zoneId] = { cp: 0, sp: 0, gp: 0, pp: 0 };
    }
    return inv;
  });

  if (!movedZone) return null;

  const newZoneId = foundry.utils.randomID();
  await FlagManager.updateInventory(toActor, (inv) => {
    inv.extraZones ??= [];

    let newGrantingId: string | undefined;
    if (grantingItem) {
      newGrantingId = foundry.utils.randomID();
      inv.items.push({
        ...grantingItem,
        id: newGrantingId,
        // The granting item's old home zone may not exist on the recipient
        zone: STANDARD_ZONES.includes(grantingItem.zone) ? grantingItem.zone : "equipped",
        ...(options.clearSecret ? { isSecret: false } : {}),
      });
    }

    inv.extraZones.push({ ...movedZone!, id: newZoneId, itemId: newGrantingId });

    for (const item of movedItems) {
      inv.items.push({
        ...item,
        id: foundry.utils.randomID(),
        zone: newZoneId,
        ...(options.clearSecret ? { isSecret: false } : {}),
      });
    }

    if (movedCoins.cp + movedCoins.sp + movedCoins.gp + movedCoins.pp > 0) {
      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      inv.coinsByZone[newZoneId] = { ...movedCoins };
    }
    return inv;
  });

  return { zone: movedZone, newZoneId, items: movedItems, coins: movedCoins };
}
