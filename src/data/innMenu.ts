import { MODULE_ID, SETTINGS } from "../constants";
import { hashString, mulberry32 } from "./seededRandom";
import type { InnEntry, InnSection } from "./innData";
import type { InnConfig } from "./innConfig";

/**
 * The daily menu, the in-game day counter, and the day's purchase log.
 *
 * The menu is NOT stored. It is derived from (inn key, section, day, reroll) by
 * a seeded shuffle, so every client computes the identical list on its own. That
 * matters because players cannot write world settings: if the draw had to be
 * persisted, a player opening an inn before the GM did would see no menu at all.
 * The GM's "roll again" bumps a counter in the inn's config, which changes the
 * seed — that write is a GM action, so it is allowed.
 */

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
//
// The two primitives now live in seededRandom.ts, because the shop needs the
// same determinism for its X-in-6 stock and an RNG copied into two files is an
// RNG that drifts.

/** Fisher–Yates against a seeded generator, so the order is reproducible. */
function seededShuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── The daily menu ───────────────────────────────────────────────────────────

/**
 * What this inn offers in the given section today.
 *
 * Fixed entries — the house's own brew, its signature dish — are always on the
 * list. Everything else belongs to a group and is drawn against that group's
 * range; a group with no range is offered in full ("all common beverages").
 *
 * The stored order of `entries` is preserved, so the GM's arrangement survives
 * the draw instead of the list reshuffling itself every day.
 */
export function dailyEntries(
  key: string,
  config: InnConfig,
  section: InnSection,
  day: number
): InnEntry[] {
  const sec = config.sections[section];

  const groups = new Map<string, InnEntry[]>();
  for (const entry of sec.entries) {
    if (entry.fixed) continue;
    const group = entry.group ?? "";
    const list = groups.get(group);
    if (list) list.push(entry);
    else groups.set(group, [entry]);
  }

  const picked = new Set<string>();
  for (const [group, list] of groups) {
    const range = sec.draw[group];
    if (!range) {
      for (const entry of list) picked.add(entry.id);
      continue;
    }
    // Seeded per group, so changing how many main dishes are served does not
    // also reshuffle the side dishes.
    const rand = mulberry32(hashString(`${key}|${section}|${group}|${day}|${config.reroll}`));
    const [min, max] = range;
    const count = Math.min(list.length, min + Math.floor(rand() * (Math.max(min, max) - min + 1)));
    for (const entry of seededShuffle(list, rand).slice(0, count)) picked.add(entry.id);
  }

  return sec.entries.filter((entry) => entry.fixed || picked.has(entry.id));
}

// ─── In-game day ──────────────────────────────────────────────────────────────

export function getInnDay(): number {
  return ((game as Game).settings.get(MODULE_ID, SETTINGS.INN_DAY) ?? 1) as number;
}

/**
 * Start a new in-game day: every inn's menu goes stale at once and the day's
 * purchases are forgotten. GM only — both are world settings.
 */
export async function advanceInnDay(): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  await g.settings.set(MODULE_ID, SETTINGS.INN_DAY, getInnDay() + 1);
  await g.settings.set(MODULE_ID, SETTINGS.INN_DAY_LOG, {});
}

// ─── The day's purchases ──────────────────────────────────────────────────────

/** actorId → which sections that character has already bought from today. */
export type InnDayLog = Record<string, Partial<Record<InnSection, string>>>;

/** Sections worth tracking. Nobody cares who had a second ale. */
export const TRACKED_SECTIONS: InnSection[] = ["lodging", "food"];

export function getDayLog(): InnDayLog {
  return ((game as Game).settings.get(MODULE_ID, SETTINGS.INN_DAY_LOG) ?? {}) as InnDayLog;
}

/**
 * Note that a character has had their bed or their meal for the day.
 * GM only, and called from the GM-side purchase handler for exactly that reason.
 */
export async function recordInnPurchase(
  actorId: string,
  section: InnSection,
  entryName: string
): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  if (!TRACKED_SECTIONS.includes(section)) return;

  const log = getDayLog();
  log[actorId] = { ...log[actorId], [section]: entryName };
  await g.settings.set(MODULE_ID, SETTINGS.INN_DAY_LOG, log);
}
