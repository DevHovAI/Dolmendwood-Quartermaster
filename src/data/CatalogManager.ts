import { CATALOG, CATALOG_MAP } from "./catalog";
import type { ItemDefinition } from "../types";

/**
 * Provides access to the item catalog.
 * The catalog is a static TypeScript data file — no compendium loading needed.
 */
export class CatalogManager {
  static getDefinition(id: string): ItemDefinition | undefined {
    return CATALOG_MAP.get(id);
  }

  static getAllDefinitions(): ItemDefinition[] {
    return CATALOG;
  }

  static getMap(): ReadonlyMap<string, ItemDefinition> {
    return CATALOG_MAP;
  }

  static getByCategory(category: string): ItemDefinition[] {
    return CATALOG.filter((d) => d.category === category);
  }

  static getBySubcategory(subcategory: string): ItemDefinition[] {
    return CATALOG.filter((d) => d.subcategory === subcategory);
  }

  /** Returns items that have ALL of the specified tags, plus items with no tags (always visible). */
  static filterByTags(activeTags: string[]): ItemDefinition[] {
    if (activeTags.length === 0) return CATALOG;
    return CATALOG.filter(
      (d) => d.tags.length === 0 || activeTags.every((t) => d.tags.includes(t))
    );
  }

  static getCategories(): string[] {
    return [...new Set(CATALOG.map((d) => d.category))];
  }

  static getSubcategories(category?: string): string[] {
    const source = category ? CATALOG.filter((d) => d.category === category) : CATALOG;
    return [...new Set(source.map((d) => d.subcategory))];
  }

  /**
   * The categories worth offering as a shop's stock list, and the ones that are
   * not.
   *
   * A category where **every** entry is `notSold` is the Campaign Book's
   * treasure: amulets, magic rings, rare herbs and the rest. Ticking one on a
   * map note does precisely nothing, because a shop filters `notSold` away
   * *before* it applies the category list — those items reach a shelf only
   * through **From Catalogue**, which ignores the flag on purpose.
   *
   * Derived rather than listed, so importing more treasures later sorts itself.
   */
  static getCategoriesBySale(): { sold: string[]; treasure: string[] } {
    const sold: string[] = [];
    const treasure: string[] = [];
    for (const category of CatalogManager.getCategories()) {
      const anyForSale = CATALOG.some((d) => d.category === category && !d.notSold);
      (anyForSale ? sold : treasure).push(category);
    }
    return { sold, treasure };
  }

  /**
   * Tags that describe how an item behaves rather than what a shopper would
   * browse by. They stay on the items — zone rules read them through
   * `allowedItemTags` — but they are not offered as shop filters, where they
   * only add a chip that filters nothing (`filterByTags` always lets untagged
   * items through, and nearly everything is untagged).
   */
  private static readonly STRUCTURAL_TAGS = new Set(["ammo-single"]);

  /** Tags worth offering as shop filters. */
  static getAllTags(): string[] {
    return [...new Set(CATALOG.flatMap((d) => d.tags))]
      .filter((t) => !CatalogManager.STRUCTURAL_TAGS.has(t))
      .sort();
  }

  /** Group catalog items by category, then subcategory */
  static groupedByCategoryAndSubcategory(): Record<
    string,
    Record<string, ItemDefinition[]>
  > {
    const result: Record<string, Record<string, ItemDefinition[]>> = {};
    for (const item of CATALOG) {
      if (!result[item.category]) result[item.category] = {};
      if (!result[item.category][item.subcategory]) {
        result[item.category][item.subcategory] = [];
      }
      result[item.category][item.subcategory].push(item);
    }
    return result;
  }
}
