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
 *
 * **`customDefinition` is an override layer, not a replacement** (2026-08-28,
 * for the item editor). Where a row has both a catalog entry and fields of its
 * own, the row's fields win one at a time and everything untouched still comes
 * from the catalog — so an edited Longsword is the catalogue's Longsword in
 * every respect nobody changed, including the ones no form offers and including
 * a later correction to the catalogue itself. Before this, a row carrying both
 * had its own fields ignored outright, which is why the inn's bottles had to be
 * given an empty `definitionId` to keep their portion counter.
 *
 * `undefined` never overrides: an absent field means "the catalogue's answer",
 * and only an explicit value — `false` and `0` included — replaces one.
 */
export function definitionFor(
  item: Pick<InventoryItem, "definitionId" | "customDefinition">,
  catalogMap?: ReadonlyMap<string, ItemDefinition>
): ItemDefinition | undefined {
  const fromCatalog = catalogMap
    ? catalogMap.get(item.definitionId)
    : CatalogManager.getDefinition(item.definitionId);
  const own = item.customDefinition;
  if (!fromCatalog) return own as ItemDefinition | undefined;
  if (!own) return fromCatalog;
  const merged: Record<string, unknown> = { ...fromCatalog };
  for (const [key, value] of Object.entries(own)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as unknown as ItemDefinition;
}
