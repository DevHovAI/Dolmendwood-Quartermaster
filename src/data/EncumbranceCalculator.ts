import { EQUIPPED_SPEED_TIERS, STOWED_SPEED_TIERS } from "../constants";
import type { CharacterInventory, EncumbranceResult, ItemDefinition } from "../types";

function getSpeedForSlots(
  slots: number,
  tiers: [number, number, 40 | 30 | 20 | 10][]
): 40 | 30 | 20 | 10 {
  for (const [min, max, speed] of tiers) {
    if (slots >= min && slots <= max) return speed;
  }
  return 10; // beyond the highest tier cap
}

/**
 * Calculate encumbrance from a CharacterInventory.
 * The catalog map is passed in to avoid a circular dependency with CatalogManager.
 */
export function calculateEncumbrance(
  inventory: CharacterInventory,
  catalogMap: ReadonlyMap<string, ItemDefinition>
): EncumbranceResult {
  let equippedSlots = 0;
  let stowedSlots = 0;
  let tinyCount = 0;

  for (const item of inventory.items) {
    const def = catalogMap.get(item.definitionId);
    // Zone-only items (animals/vehicles with grantsZone) don't count toward encumbrance
    if (def?.grantsZone && def?.category === "Animals & Vehicles") continue;
    // Custom definition overrides the catalog definition's size
    const size: ItemDefinition["size"] =
      item.customDefinition?.size ?? def?.size ?? "normal";
    const qty = item.quantity;

    if (item.zone === "tiny") {
      // Items placed in the tiny zone always count as tiny regardless of their size
      tinyCount += qty;
    } else if (item.zone === "equipped") {
      if (size === "tiny") {
        // Tiny items in equipped zone cost 0 slots
      } else if (size === "normal") {
        equippedSlots += qty;
      } else if (size === "large") {
        equippedSlots += qty * 2;
      }
    } else if (item.zone === "stowed") {
      if (size === "tiny") {
        // Tiny items in stowed zone still count as tiny for overflow purposes
        tinyCount += qty;
      } else if (size === "normal") {
        stowedSlots += qty;
      } else if (size === "large") {
        stowedSlots += qty * 2;
      }
    }
  }

  // Overflow: tiny items beyond 10 add stowed slots (1 slot per 10 overflow tiny items)
  const freeTinySlots = Math.max(0, 10 - tinyCount);
  const tinyOverflow = Math.max(0, tinyCount - 10);
  stowedSlots += Math.ceil(tinyOverflow / 10);

  // Coins: zone-aware if coinSlots are synced, otherwise fall back to all-stowed
  const { cp, sp, gp, pp } = inventory.coins;
  const totalCoins = cp + sp + gp + pp;
  const coinSlotCount = totalCoins > 0 ? Math.ceil(totalCoins / 100) : 0;
  if (inventory.coinSlots && inventory.coinSlots.length === coinSlotCount && coinSlotCount > 0) {
    for (const slot of inventory.coinSlots) {
      if (slot.zone === "tiny") {
        tinyCount += 1;
      } else if (slot.zone === "equipped") {
        equippedSlots += 1;
      } else if (slot.zone === "stowed") {
        stowedSlots += 1;
      }
      // extra zone slots don't affect speed
    }
  } else {
    stowedSlots += coinSlotCount;
  }
  const coinSlots = coinSlotCount;

  const equippedSpeed = getSpeedForSlots(equippedSlots, EQUIPPED_SPEED_TIERS);
  const stowedSpeed = getSpeedForSlots(stowedSlots, STOWED_SPEED_TIERS);
  const finalSpeed = Math.min(equippedSpeed, stowedSpeed) as 40 | 30 | 20 | 10;

  let bottleneck: EncumbranceResult["bottleneck"] = "none";
  if (equippedSpeed < stowedSpeed) {
    bottleneck = "equipped";
  } else if (stowedSpeed < equippedSpeed) {
    bottleneck = "stowed";
  } else if (finalSpeed < 40) {
    bottleneck = "both";
  }

  return {
    equippedSlots,
    stowedSlots,
    equippedSpeed,
    stowedSpeed,
    finalSpeed,
    bottleneck,
    tinyCount,
    freeTinySlots,
    tinyOverflow,
    coinSlots,
  };
}

/** Speed in ft to a CSS color class name */
export function speedColorClass(speed: 40 | 30 | 20 | 10): string {
  switch (speed) {
    case 40: return "speed-green";
    case 30: return "speed-yellow";
    case 20: return "speed-orange";
    case 10: return "speed-red";
  }
}
