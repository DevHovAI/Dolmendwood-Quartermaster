import { MODULE_ID, SETTINGS } from "../constants";
import {
  LODGING_TABLES,
  EXTRAS_TABLES,
  FOOD_POOLS,
  FOOD_PRICES,
  FOOD_DRAW,
  FOOD_TEXT,
  BEVERAGE_POOLS,
  BEVERAGE_DRAW,
  BEVERAGE_TEXT,
  INN_SECTIONS,
} from "./innData";
import type { InnEntry, InnQuality, InnSection, DrawRange } from "./innData";

/**
 * Per-inn configuration: the editable copy of the book tables.
 *
 * An inn is seeded from the defaults for its quality the first time it is
 * touched, and from then on the stored copy is the truth. That is what makes a
 * house speciality possible ("only Fishfop's is served here") without every
 * other inn in the world inheriting it — and it means changing the book tables
 * later will not disturb inns already in play.
 *
 * Keyed by inn name, the same way shops key their own stock. Renaming an inn
 * therefore starts it over from the defaults; the old entry stays behind under
 * the old name.
 */

export interface InnSectionConfig {
  /** Descriptive paragraph shown above the lines. */
  text: string;
  /**
   * Beverages only: does this house sell drink by the bottle or cask to take
   * away? Undefined counts as true, so configs stored before this existed keep
   * behaving like a normal establishment. Individual drinks may override it.
   */
  sellsContainers?: boolean;
  /**
   * How many of each group are on offer on a given day. A group missing from
   * this map is offered in full — that is how "all common beverages" works.
   */
  draw: Record<string, DrawRange>;
  entries: InnEntry[];
}

export interface InnConfig {
  quality: InnQuality;
  /**
   * Per-section exceptions to the house quality. Chateau Shantywood has fancy
   * lodgings and common food, so the quality cannot be a single value.
   */
  sectionQuality: Partial<Record<InnSection, InnQuality>>;
  sections: Record<InnSection, InnSectionConfig>;
  /** Bumped by the GM's "roll again", so the day's draw changes without the day changing. */
  reroll: number;
}

type InnConfigMap = Record<string, InnConfig>;

/** The quality that applies to one section — the house quality unless overridden. */
export function sectionQuality(config: InnConfig, section: InnSection): InnQuality {
  return config.sectionQuality[section] ?? config.quality;
}

/** Whether this house sells drink to take away at all. Absent counts as yes. */
export function sellsContainers(config: InnConfig, section: InnSection): boolean {
  return config.sections[section]?.sellsContainers !== false;
}

// ─── Seeding from the book defaults ───────────────────────────────────────────

export function seedSection(section: InnSection, quality: InnQuality): InnSectionConfig {
  switch (section) {
    case "lodging":
      return { text: "", draw: {}, entries: LODGING_TABLES[quality].map((e) => ({ ...e })) };

    case "extras":
      return { text: "", draw: {}, entries: EXTRAS_TABLES[quality].map((e) => ({ ...e })) };

    case "food": {
      const prices = FOOD_PRICES[quality];
      return {
        text: FOOD_TEXT[quality],
        draw: { ...FOOD_DRAW[quality] },
        // The book prices by course, so each dish is seeded with its course
        // price. Storing it per dish is what lets a single dish be repriced.
        entries: FOOD_POOLS[quality]
          .filter((e) => prices[e.group])
          .map((e) => ({
            id: e.id,
            name: e.name,
            group: e.group,
            description: e.description,
            cost: { ...prices[e.group] },
          })),
      };
    }

    case "beverages": {
      const draw = BEVERAGE_DRAW[quality];
      const stocked: Record<string, DrawRange> = {};
      for (const [group, range] of Object.entries(draw)) {
        // null means "the whole tier" — leaving it out of `draw` says exactly that
        if (range) stocked[group] = range;
      }
      return {
        text: BEVERAGE_TEXT[quality],
        draw: stocked,
        sellsContainers: true,
        entries: BEVERAGE_POOLS
          .filter((e) => e.group in draw)
          .map((e) => ({
            id: e.id,
            name: e.name,
            group: e.group,
            tag: e.type,
            description: e.description,
            cost: { ...e.cost },
          })),
      };
    }
  }
}

export function seedConfig(quality: InnQuality): InnConfig {
  const sections = {} as Record<InnSection, InnSectionConfig>;
  for (const { key } of INN_SECTIONS) sections[key] = seedSection(key, quality);
  return { quality, sectionQuality: {}, sections, reroll: 0 };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function allConfigs(): InnConfigMap {
  return ((game as Game).settings.get(MODULE_ID, SETTINGS.INN_CONFIGS) ?? {}) as InnConfigMap;
}

export function hasStoredConfig(key: string): boolean {
  return key in allConfigs();
}

/**
 * This inn's configuration. Falls back to a freshly seeded one when the inn has
 * never been edited — deliberately without writing it, so that merely opening an
 * inn as a player (who cannot write world settings anyway) costs nothing.
 */
export function getInnConfig(key: string, quality: InnQuality): InnConfig {
  const stored = allConfigs()[key];
  if (!stored) return seedConfig(quality);

  // The quality asked for wins over the stored copy — it is what the map note
  // says, and the note is where the GM set it. Because the three levels are
  // separate tables and not a progression, the stored sections cannot be
  // carried over to a different level, so a fresh seed is the only honest
  // answer. The stored copy is left alone: switching back restores it.
  if (stored.quality !== quality) return seedConfig(quality);
  return stored;
}

/** GM only — players cannot write world settings. */
export async function saveInnConfig(key: string, config: InnConfig): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const all = allConfigs();
  all[key] = config;
  await g.settings.set(MODULE_ID, SETTINGS.INN_CONFIGS, all);
}

export async function deleteInnConfig(key: string): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const all = allConfigs();
  delete all[key];
  await g.settings.set(MODULE_ID, SETTINGS.INN_CONFIGS, all);
}

// ─── Editing helpers ──────────────────────────────────────────────────────────

/** Deep copy for edit-then-save — the stored object must never be mutated in place. */
export function cloneConfig(config: InnConfig): InnConfig {
  return foundry.utils.deepClone(config) as InnConfig;
}
