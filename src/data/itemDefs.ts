import { CatalogManager } from "./CatalogManager";
import type { InventoryItem, ItemDefinition } from "../types";

/**
 * The definition behind an inventory row: the catalog entry, or the row's own
 * inline definition when it has no catalog entry at all.
 *
 * This exists because reading `CatalogManager.getDefinition(item.definitionId)`
 * on its own is wrong for every custom item, and the codebase used to paper over
 * that field by field — `item.customDefinition?.weight ?? def?.weight`,
 * `?.size`, `?.tags` — while `maxUses` was read from the catalog alone. That was
 * harmless only because no custom item had ever had `maxUses`. The inn's bottles
 * and casks are the first, and without a single resolver they came out as plain
 * `quantity 1` rows: no portion counter, no per-portion weight, and dead +/−
 * buttons.
 *
 * Pass `catalogMap` where the caller already holds one (the encumbrance
 * calculator takes it as an argument rather than reaching for the singleton).
 *
 * This module deliberately imports nothing but the catalog, so it is safe to
 * import from anywhere — including modules that must not depend on `zoneGrants`.
 */
export function definitionFor(
  item: Pick<InventoryItem, "definitionId" | "customDefinition">,
  catalogMap?: ReadonlyMap<string, ItemDefinition>
): ItemDefinition | undefined {
  const fromCatalog = catalogMap
    ? catalogMap.get(item.definitionId)
    : CatalogManager.getDefinition(item.definitionId);
  return fromCatalog ?? (item.customDefinition as ItemDefinition | undefined);
}
