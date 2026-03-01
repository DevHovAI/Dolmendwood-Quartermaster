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

  static getAllTags(): string[] {
    return [...new Set(CATALOG.flatMap((d) => d.tags))].sort();
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
