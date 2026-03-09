import { EQUIPPED_SPEED_TIERS, STOWED_SPEED_TIERS, WEIGHT_SPEED_TIERS } from "../constants";
import type { CharacterInventory, EncumbranceResult, ItemDefinition } from "../types";

function getSpeedForSlots(
  slots: number,
  tiers: [number, number, 40 | 30 | 20 | 10][]
): 40 | 30 | 20 | 10 {
  for (const [min, max, speed] of tiers) {
    if (slots >= min && slots <= max) return speed;
  }
  return 10;
}

function getSpeedForWeight(weight: number): 40 | 30 | 20 | 10 {
  for (const [max, speed] of WEIGHT_SPEED_TIERS) {
    if (weight <= max) return speed;
  }
  return 10; // > 1600 coins: cannot move, show as 10 (slowest)
}

/**
 * Calculate encumbrance from a CharacterInventory.
 * The catalog map is passed in to avoid a circular dependency with CatalogManager.
 * mode: "slots" (default) uses gear-slot tracking; "weight" uses coin-weight tracking.
 */
export function calculateEncumbrance(
  inventory: CharacterInventory,
  catalogMap: ReadonlyMap<string, ItemDefinition>,
  mode: "slots" | "weight" = "slots"
): EncumbranceResult {
  if (mode === "weight") {
    return calculateWeightEncumbrance(inventory, catalogMap);
  }
  return calculateSlotEncumbrance(inventory, catalogMap);
}

// ─── Slot Encumbrance ─────────────────────────────────────────────────────────

function calculateSlotEncumbrance(
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
    const size: ItemDefinition["size"] =
      item.customDefinition?.size ?? def?.size ?? "normal";
    const qty = item.quantity;

    if (item.zone === "tiny") {
      tinyCount += qty;
    } else if (item.zone === "equipped") {
      if (size === "tiny") {
        // tiny items in equipped zone cost 0 slots
      } else if (size === "normal") {
        equippedSlots += qty;
      } else if (size === "large") {
        equippedSlots += qty * 2;
      }
    } else if (item.zone === "stowed") {
      if (size === "tiny") {
        tinyCount += qty;
      } else if (size === "normal") {
        stowedSlots += qty;
      } else if (size === "large") {
        stowedSlots += qty * 2;
      }
    }
    // Extra zones don't affect speed
  }

  // Overflow: tiny items beyond 10 add stowed slots (1 slot per 10 overflow)
  const freeTinySlots = Math.max(0, 10 - tinyCount);
  const tinyOverflow = Math.max(0, tinyCount - 10);
  stowedSlots += Math.ceil(tinyOverflow / 10);

  // Coins
  const { cp, sp, gp, pp } = inventory.coins;
  const totalCoins = cp + sp + gp + pp;
  let chestCapacity = 0;
  for (const item of inventory.items) {
    const def = catalogMap.get(item.definitionId);
    if (def?.coinCapacity) chestCapacity += def.coinCapacity * item.quantity;
  }
  const purseCoins = Math.max(0, totalCoins - chestCapacity);
  const coinSlotCount = purseCoins > 0 ? Math.ceil(purseCoins / 100) : 0;
  if (inventory.coinSlots && inventory.coinSlots.length === coinSlotCount && coinSlotCount > 0) {
    for (const slot of inventory.coinSlots) {
      if (slot.zone === "tiny") {
        tinyCount += 1;
      } else if (slot.zone === "equipped") {
        equippedSlots += 1;
      } else if (slot.zone === "stowed") {
        stowedSlots += 1;
      }
    }
  } else {
    stowedSlots += coinSlotCount;
  }
  const coinSlots = coinSlotCount;

  const equippedSpeed = getSpeedForSlots(equippedSlots, EQUIPPED_SPEED_TIERS);
  const stowedSpeed = getSpeedForSlots(stowedSlots, STOWED_SPEED_TIERS);
  const finalSpeed = Math.min(equippedSpeed, stowedSpeed) as 40 | 30 | 20 | 10;

  let bottleneck: EncumbranceResult["bottleneck"] = "none";
  if (equippedSpeed < stowedSpeed) bottleneck = "equipped";
  else if (stowedSpeed < equippedSpeed) bottleneck = "stowed";
  else if (finalSpeed < 40) bottleneck = "both";

  return {
    mode: "slots",
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
    // Weight fields unused in slot mode
    totalWeight: 0,
    equippedWeight: 0,
    stowedWeight: 0,
    tinyWeight: 0,
  };
}

// ─── Weight Encumbrance ───────────────────────────────────────────────────────

function calculateWeightEncumbrance(
  inventory: CharacterInventory,
  catalogMap: ReadonlyMap<string, ItemDefinition>
): EncumbranceResult {
  let equippedWeight = 0;
  let stowedWeight = 0;
  let tinyWeight = 0;

  // Build a map of extra zone id → zone object
  const extraZoneMap = new Map((inventory.extraZones ?? []).map((z) => [z.id, z]));

  for (const item of inventory.items) {
    const def = catalogMap.get(item.definitionId);
    // Animals/vehicles with grantsZone don't count toward character weight
    if (def?.grantsZone && def?.category === "Animals & Vehicles") continue;

    const extraZone = extraZoneMap.get(item.zone);
    if (extraZone) {
      if (!extraZone.type || extraZone.type === "vehicle") continue; // vehicle zones excluded from character weight
      // storage zone — items count toward character weight
      const w = (item.customDefinition?.weight ?? def?.weight ?? 0) * item.quantity;
      if (extraZone.isBeltPouch) tinyWeight += w;
      else stowedWeight += w;
      continue;
    }

    const w = (item.customDefinition?.weight ?? def?.weight ?? 0) * item.quantity;
    if (item.zone === "tiny") tinyWeight += w;
    else if (item.zone === "equipped") equippedWeight += w;
    else stowedWeight += w; // "stowed" and any unknown zone
  }

  // Coins: each coin weighs 1 unit. Default to equipped in weight mode.
  const { cp, sp, gp, pp } = inventory.coins;
  const totalCoins = cp + sp + gp + pp;

  let coinWeightEquipped = 0;
  let coinWeightStowed = 0;
  let coinWeightTiny = 0;

  if (inventory.coinSlots && inventory.coinSlots.length > 0) {
    let chestCapacity = 0;
    for (const item of inventory.items) {
      const def = catalogMap.get(item.definitionId);
      if (def?.coinCapacity) chestCapacity += def.coinCapacity * item.quantity;
    }
    const purseCoins = Math.max(0, totalCoins - chestCapacity);
    const coinSlotCount = purseCoins > 0 ? Math.ceil(purseCoins / 100) : 0;

    if (inventory.coinSlots.length === coinSlotCount) {
      for (const slot of inventory.coinSlots) {
        const slotWeight = 100;
        const slotZone = extraZoneMap.get(slot.zone);
        if (slotZone && (!slotZone.type || slotZone.type === "vehicle")) continue; // vehicle zone coins excluded
        if (slot.zone === "tiny" || slotZone?.isBeltPouch) coinWeightTiny += slotWeight;
        else coinWeightEquipped += slotWeight; // equipped and storage zones all go to equipped weight bucket for coins
      }
    } else {
      // Fallback: unassigned purse coins default to equipped in weight mode
      coinWeightEquipped += purseCoins;
    }
    // Chest-stored coins add weight to stowed
    coinWeightStowed += Math.min(chestCapacity, totalCoins);
  } else {
    coinWeightEquipped += totalCoins; // no slot tracking — default to equipped
  }

  equippedWeight += coinWeightEquipped;
  stowedWeight += coinWeightStowed;
  tinyWeight += coinWeightTiny;

  const totalWeight = equippedWeight + stowedWeight + tinyWeight;
  const finalSpeed = getSpeedForWeight(totalWeight);

  return {
    mode: "weight",
    finalSpeed,
    totalWeight,
    equippedWeight,
    stowedWeight,
    tinyWeight,
    equippedSlots: 0,
    stowedSlots: 0,
    equippedSpeed: finalSpeed,
    stowedSpeed: finalSpeed,
    bottleneck: "none",
    tinyCount: 0,
    freeTinySlots: 0,
    tinyOverflow: 0,
    coinSlots: 0,
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
