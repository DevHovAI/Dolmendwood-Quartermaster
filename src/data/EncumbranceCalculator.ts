import { EQUIPPED_SPEED_TIERS, STOWED_SPEED_TIERS, WEIGHT_SPEED_TIERS } from "../constants";
import { effectiveWeightCapacity } from "./zoneCapacity";
import { stackUnits } from "./consumables";
import { definitionFor } from "./itemDefs";
import type { CharacterInventory, EncumbranceResult, ItemDefinition, AnimalSpeedInfo, InventoryItem } from "../types";

function getSpeedForSlots(
  slots: number,
  tiers: [number, number, 40 | 30 | 20 | 10][]
): 40 | 30 | 20 | 10 {
  for (const [min, max, speed] of tiers) {
    if (slots >= min && slots <= max) return speed;
  }
  return 10;
}

/**
 * Weight of a whole inventory row — the calculator's own copy of
 * zoneGrants.itemStackWeight, which it cannot import (that module reaches
 * helpers/handlebars, which imports this one).
 */
function stackWeight(
  item: InventoryItem,
  catalogMap: ReadonlyMap<string, ItemDefinition>
): number {
  const def = definitionFor(item, catalogMap);
  const baseWeight = def?.weight ?? 0;
  const maxUses = def?.maxUses;
  if (maxUses && maxUses > 0) {
    return (baseWeight / maxUses) * stackUnits(item, maxUses);
  }
  return baseWeight * item.quantity;
}

function getSpeedForWeight(weight: number): 40 | 30 | 20 | 10 | 0 {
  for (const [max, speed] of WEIGHT_SPEED_TIERS) {
    if (weight <= max) return speed;
  }
  return 0; // beyond 1600 coins nothing moves — 0, not the slowest tier
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
    const effectiveDefSlot = definitionFor(item, catalogMap);
    // Zone-only items (animals/vehicles with grantsZone) don't count toward encumbrance
    if (effectiveDefSlot?.grantsZone && (effectiveDefSlot?.category === "Animals & Vehicles" || item.customDefinition?.grantsZone)) continue;
    const size: ItemDefinition["size"] = effectiveDefSlot?.size ?? "normal";
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
    footSpeed: finalSpeed,
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

  // A container item (the backpack itself) is pinned to "equipped" and does not
  // live inside its own zone, so excluding the zone's *contents* still left its
  // 50 wt on the character. Dropping a pack means putting the pack down too.
  const droppedContainerItemIds = new Set<string>();
  for (const zone of inventory.extraZones ?? []) {
    if (!zone.isDropped) continue;
    if (zone.itemId) {
      droppedContainerItemIds.add(zone.itemId);
      continue;
    }
    // Zones predating the itemId link: match by the zone name the definition
    // grants, the same fallback reconcileZones uses.
    const match = inventory.items.find((i) => {
      const d = definitionFor(i, catalogMap);
      return (d?.grantsStorageZone?.name ?? d?.grantsZone?.name) === zone.name;
    });
    if (match) droppedContainerItemIds.add(match.id);
  }

  for (const item of inventory.items) {
    const effectiveDef = definitionFor(item, catalogMap);
    // Animals/vehicles with grantsZone don't count toward character weight
    if (effectiveDef?.grantsZone && (effectiveDef?.category === "Animals & Vehicles" || item.customDefinition?.grantsZone)) continue;
    if (droppedContainerItemIds.has(item.id)) continue;

    const extraZone = extraZoneMap.get(item.zone);
    if (extraZone) {
      if (extraZone.isDropped) continue; // dropped zones excluded entirely
      if (!extraZone.type || extraZone.type === "vehicle") continue; // vehicle zones excluded from character weight
      // storage zone — items count toward character weight
      const w = stackWeight(item, catalogMap);
      if (extraZone.isBeltPouch) tinyWeight += w;
      else stowedWeight += w;
      continue;
    }

    const w = stackWeight(item, catalogMap);
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
      if (ez.isDropped) continue; // dropped zones excluded
      if (ez.isBeltPouch) tinyWeight += coinWeight;
      else stowedWeight += coinWeight;
    }
  }

  const totalWeight = equippedWeight + stowedWeight + tinyWeight;
  const footSpeed = getSpeedForWeight(totalWeight);
  // Not one of the tiers: a half-speed animal lands on 15, a stuck one on 0
  let finalSpeed: number = footSpeed;

  // ── Animal / convoy speed ───────────────────────────────────────────────────
  const animalSpeeds: AnimalSpeedInfo[] = [];
  for (const ez of inventory.extraZones ?? []) {
    if (ez.type && ez.type !== "vehicle") continue; // storage zones are not animals
    if (!ez.speed) continue;
    if (ez.isDropped) continue; // dropped zones excluded from convoy speed

    const zoneItems = inventory.items.filter((i) => i.zone === ez.id);
    const coinWeight =
      (inventory.coinsByZone?.[ez.id]?.cp ?? 0) +
      (inventory.coinsByZone?.[ez.id]?.sp ?? 0) +
      (inventory.coinsByZone?.[ez.id]?.gp ?? 0) +
      (inventory.coinsByZone?.[ez.id]?.pp ?? 0);
    // This branch ignored remaining uses entirely, so a half-empty quiver on a
    // pack horse was billed as a full one
    const usedWeight = zoneItems.reduce((acc, i) => acc + stackWeight(i, catalogMap), 0) + coinWeight;

    // Doubling the draught team doubles what the vehicle can haul
    const capacity = effectiveWeightCapacity(ez);
    // A vehicle past its cargo rating simply cannot be pulled; an animal past
    // its own carries on at half speed until double, and stops beyond that.
    const isOverCapacity = capacity > 0 && usedWeight > (ez.isVehicle ? capacity : capacity * 2);
    const isOverloaded   = !ez.isVehicle && capacity > 0 && usedWeight > capacity && !isOverCapacity;
    const isOverWeight   = !!ez.isVehicle && capacity > 0 && usedWeight > capacity;
    let effectiveSpeed = ez.speed;
    if (isOverCapacity) effectiveSpeed = 0;
    else if (isOverloaded) effectiveSpeed = Math.floor(ez.speed / 2);

    animalSpeeds.push({ zoneName: ez.name, zoneIcon: ez.icon, baseSpeed: ez.speed, usedWeight, capacity, isOverloaded, isOverCapacity, isOverWeight, effectiveSpeed });
  }

  // An animal or vehicle that cannot move holds everyone up — it counts here
  // exactly like a slow one. The way out is to unload it or leave it behind,
  // and a zone marked as dropped never reaches this loop at all.
  let convoySpeed: number | null = null;
  if (animalSpeeds.length > 0) {
    convoySpeed = Math.min(...animalSpeeds.map((a) => a.effectiveSpeed));
    if (convoySpeed < finalSpeed) finalSpeed = convoySpeed;
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
    footSpeed,
    animalSpeeds,
    convoySpeed,
  };
}

/** Speed in ft to a CSS color class name */
/** Thresholds, not exact tiers — halved animal speeds land between them. */
export function speedColorClass(speed: number): string {
  if (speed >= 40) return "speed-green";
  if (speed >= 30) return "speed-yellow";
  if (speed >= 20) return "speed-orange";
  return "speed-red";
}
