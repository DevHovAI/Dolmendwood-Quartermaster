import { EQUIPPED_SPEED_TIERS, STOWED_SPEED_TIERS, WEIGHT_SPEED_TIERS } from "../constants";
import type { CharacterInventory, EncumbranceResult, ItemDefinition, AnimalSpeedInfo } from "../types";

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

  // Coins: per-zone coins contribute to their zone's slot count.
  // Coin containers (coinCapacity items) in a zone absorb that zone's coin slot usage.
  const coinsByZone = inventory.coinsByZone ?? { equipped: inventory.coins };
  function purseCoinsInZone(zoneId: string): number {
    const zc = coinsByZone[zoneId];
    if (!zc) return 0;
    const total = zc.cp + zc.sp + zc.gp + zc.pp;
    let cap = 0;
    for (const item of inventory.items) {
      if (item.zone === zoneId) {
        const d = catalogMap.get(item.definitionId);
        if (d?.coinCapacity) cap += d.coinCapacity * item.quantity;
      }
    }
    return Math.max(0, total - cap);
  }
  const tinyCoinItems    = purseCoinsInZone("tiny")     > 0 ? Math.ceil(purseCoinsInZone("tiny")     / 100) : 0;
  const equippedCoinSlots = purseCoinsInZone("equipped") > 0 ? Math.ceil(purseCoinsInZone("equipped") / 100) : 0;
  const stowedCoinSlots   = purseCoinsInZone("stowed")   > 0 ? Math.ceil(purseCoinsInZone("stowed")   / 100) : 0;
  tinyCount    += tinyCoinItems;
  equippedSlots += equippedCoinSlots;
  stowedSlots   += stowedCoinSlots;
  const coinSlots = tinyCoinItems + equippedCoinSlots + stowedCoinSlots;

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
    animalSpeeds: [],
    convoySpeed: null,
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
      // Scale weight by remaining uses ratio for consumable items
      const baseW = item.customDefinition?.weight ?? def?.weight ?? 0;
      const usesRatio = (def?.maxUses && item.uses !== undefined) ? item.uses / def.maxUses : 1;
      const w = baseW * usesRatio * item.quantity;
      if (extraZone.isBeltPouch) tinyWeight += w;
      else stowedWeight += w;
      continue;
    }

    // Scale weight by remaining uses ratio for consumable items
    const baseW = item.customDefinition?.weight ?? def?.weight ?? 0;
    const usesRatio = (def?.maxUses && item.uses !== undefined) ? item.uses / def.maxUses : 1;
    const w = baseW * usesRatio * item.quantity;
    if (item.zone === "tiny") tinyWeight += w;
    else if (item.zone === "equipped") equippedWeight += w;
    else stowedWeight += w; // "stowed" and any unknown zone
  }

  // Coins: each coin weighs 1 unit, counted in the zone it's assigned to.
  const coinsByZone = inventory.coinsByZone ?? { equipped: inventory.coins };
  for (const [zoneId, zc] of Object.entries(coinsByZone)) {
    const coinWeight = zc.cp + zc.sp + zc.gp + zc.pp;
    if (coinWeight <= 0) continue;
    if (zoneId === "tiny") {
      tinyWeight += coinWeight;
    } else if (zoneId === "equipped") {
      equippedWeight += coinWeight;
    } else if (zoneId === "stowed") {
      stowedWeight += coinWeight;
    } else {
      const ez = extraZoneMap.get(zoneId);
      if (!ez || !ez.type || ez.type === "vehicle") continue; // vehicle zones excluded
      if (ez.isBeltPouch) tinyWeight += coinWeight;
      else stowedWeight += coinWeight;
    }
  }

  const totalWeight = equippedWeight + stowedWeight + tinyWeight;
  let finalSpeed = getSpeedForWeight(totalWeight);

  // ── Animal / convoy speed ───────────────────────────────────────────────────
  const animalSpeeds: AnimalSpeedInfo[] = [];
  for (const ez of inventory.extraZones ?? []) {
    if (ez.type && ez.type !== "vehicle") continue; // storage zones are not animals
    if (!ez.speed) continue;

    const zoneItems = inventory.items.filter((i) => i.zone === ez.id);
    const coinWeight =
      (inventory.coinsByZone?.[ez.id]?.cp ?? 0) +
      (inventory.coinsByZone?.[ez.id]?.sp ?? 0) +
      (inventory.coinsByZone?.[ez.id]?.gp ?? 0) +
      (inventory.coinsByZone?.[ez.id]?.pp ?? 0);
    const usedWeight = zoneItems.reduce((acc, i) => {
      const def = catalogMap.get(i.definitionId);
      return acc + (i.customDefinition?.weight ?? def?.weight ?? 0) * i.quantity;
    }, 0) + coinWeight;

    const capacity = ez.weightCapacity;
    // Vehicles (carts, wagons, boats) cannot be overloaded — only animals can
    const isOverCapacity = !ez.isVehicle && capacity > 0 && usedWeight > capacity * 2;
    const isOverloaded   = !ez.isVehicle && capacity > 0 && usedWeight > capacity && !isOverCapacity;
    const isOverWeight   = !!ez.isVehicle && capacity > 0 && usedWeight > capacity;
    let effectiveSpeed = ez.speed;
    if (isOverCapacity) effectiveSpeed = 0;
    else if (isOverloaded) effectiveSpeed = Math.floor(ez.speed / 2);

    animalSpeeds.push({ zoneName: ez.name, baseSpeed: ez.speed, usedWeight, capacity, isOverloaded, isOverCapacity, isOverWeight, effectiveSpeed });
  }

  let convoySpeed: number | null = null;
  if (animalSpeeds.length > 0) {
    const notOverCapacity = animalSpeeds.filter((a) => !a.isOverCapacity);
    if (notOverCapacity.length > 0) {
      convoySpeed = Math.min(...notOverCapacity.map((a) => a.effectiveSpeed));
      if (convoySpeed < finalSpeed) finalSpeed = Math.max(10, convoySpeed) as 40 | 30 | 20 | 10;
    }
  }

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
    animalSpeeds,
    convoySpeed,
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
