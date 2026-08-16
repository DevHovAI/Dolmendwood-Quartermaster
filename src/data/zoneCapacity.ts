import type { ExtraZone } from "../types";

/**
 * A land vehicle hitched to a double team of draught animals hauls twice the
 * cargo. The multiplier is derived, never stored on top of the capacity, so
 * unhitching the extra animals restores the original rating exactly.
 *
 * This lives in its own module because both EncumbranceCalculator and
 * zoneGrants need it, and importing zoneGrants from the calculator would close
 * a cycle through helpers/handlebars.
 */
export function teamMultiplier(zone: Pick<ExtraZone, "doubleTeam">): number {
  return zone.doubleTeam ? 2 : 1;
}

/** Cargo capacity in coin weight, including a doubled team. */
export function effectiveWeightCapacity(
  zone: Pick<ExtraZone, "weightCapacity" | "doubleTeam">
): number {
  return (zone.weightCapacity ?? 0) * teamMultiplier(zone);
}

/** Cargo capacity in slots, including a doubled team. */
export function effectiveMaxSlots(zone: Pick<ExtraZone, "maxSlots" | "doubleTeam">): number {
  return (zone.maxSlots ?? 0) * teamMultiplier(zone);
}
