import { MODULE_ID, FLAGS, LOOT_ACTOR_IMG, LOOT_ZONE } from "../constants";
import { FlagManager, addCoinsToZone } from "./FlagManager";
import { LOOT_ICON_ARTWORK } from "../helpers/handlebars";
import type { ZoneCoins } from "../types";

/**
 * A loot box is an ordinary actor carrying the module's `inventory` flag, marked
 * with the `loot` flag. It goes through two phases:
 *
 *  - **staged**: `ownership.default = NONE`. Only the GM sees it or can touch it.
 *  - **released**: `ownership.default = OWNER`. Every player may read *and write*
 *    it, so taking something is two writes the player performs themselves — no
 *    socket, no GM online. Releasing is that one ownership flip and nothing else.
 *
 * Unlike the single shared store there is no world setting pointing at "the"
 * loot actor: boxes are many and disposable, so they are found by their flag.
 */

/**
 * The marker flag. Boxes created before icons were pickable carry a bare `true`,
 * which is why the flag is read for truthiness and the icon separately.
 */
export type LootFlag = true | { icon?: string };

export const DEFAULT_LOOT_ICON = "fa-treasure-chest";

export function isLootActor(actor: Actor | null | undefined): boolean {
  return !!actor?.getFlag(MODULE_ID, FLAGS.LOOT);
}

export function getLootIcon(actor: Actor): string {
  const flag = actor.getFlag(MODULE_ID, FLAGS.LOOT) as LootFlag | undefined;
  if (flag && typeof flag === "object" && flag.icon) return flag.icon;
  return DEFAULT_LOOT_ICON;
}

export async function setLootIcon(actor: Actor, icon: string): Promise<void> {
  await actor.setFlag(MODULE_ID, FLAGS.LOOT, { icon } as LootFlag);
  // The pin on the map is artwork, not a glyph, so it has to be re-pointed
  await syncLootNoteArtwork(actor);
}

/** The map-note artwork matching a box's chosen icon. */
export function lootArtwork(actor: Actor): string {
  return LOOT_ICON_ARTWORK[getLootIcon(actor)] ?? LOOT_ACTOR_IMG;
}

/** Re-point every pin for this box after its icon changed. */
export async function syncLootNoteArtwork(actor: Actor): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const src = lootArtwork(actor);
  for (const note of notesForLoot(actor)) {
    await (note as unknown as {
      update: (data: unknown) => Promise<unknown>;
    }).update({ texture: { src } });
  }
}

/** Released means every player is an owner and can take from it. */
export function isLootReleased(actor: Actor): boolean {
  const level = (actor.ownership as Record<string, number> | undefined)?.default ?? 0;
  return level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
}

/**
 * Every loot box the current user may see: all of them for the GM, only the
 * released ones for a player. Newest first — a fresh hoard is the interesting one.
 */
export function getLootActors(): Actor[] {
  const g = game as Game;
  const isGM = g.user?.isGM ?? false;
  return (g.actors?.contents ?? [])
    .filter((actor) => isLootActor(actor) && (isGM || isLootReleased(actor)))
    .reverse();
}

/** Only a GM may create actors. */
export async function createLootActor(name: string, icon = DEFAULT_LOOT_ICON): Promise<Actor | null> {
  const g = game as Game;
  if (!g.user?.isGM) return null;

  // Actor.create needs a type the active system actually defines; game.model is
  // the fallback for systems where game.documentTypes comes back empty.
  const g2 = g as unknown as {
    documentTypes?: Record<string, string[]>;
    model?: { Actor?: Record<string, unknown> };
  };
  const declared = g2.documentTypes?.Actor?.length
    ? g2.documentTypes.Actor
    : Object.keys(g2.model?.Actor ?? {});
  const types = declared.filter((t) => t !== CONST.BASE_DOCUMENT_TYPE);
  const type = types.find((t) => t === "npc") ?? types[0];
  if (!type) {
    ui.notifications?.error("Cannot create a loot box: the game system defines no actor types.");
    return null;
  }

  const created = await Actor.create({
    name,
    type,
    img: LOOT_ACTOR_IMG,
    // Staged: invisible to players until released
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    flags: { [MODULE_ID]: { [FLAGS.LOOT]: { icon } } },
  } as Parameters<typeof Actor.create>[0]);

  return (created as Actor | undefined) ?? null;
}

/**
 * The one click that hands the hoard to the party — and its counterpart, which
 * pulls it back out of sight without touching the contents.
 */
export async function setLootReleased(actor: Actor, released: boolean): Promise<void> {
  if (!(game as Game).user?.isGM) return;
  await actor.update({
    ownership: {
      default: released
        ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
    },
  } as Parameters<typeof actor.update>[0]);
  await syncLootNoteVisibility(actor, released);
}

// ─── Map notes ─────────────────────────────────────────────────────────────────

/** What a note flagged as loot carries. `actorId` is written on first open. */
export interface LootNoteFlag {
  name?: string;
  actorId?: string;
}

interface NoteDocLike {
  id?: string | null;
  entryId?: string | null;
  getFlag?: (module: string, key: string) => unknown;
  setFlag?: (module: string, key: string, value: unknown) => Promise<unknown>;
  delete?: () => Promise<unknown>;
}

/** Flag key marking a journal entry the module created for a loot pin. */
const LOOT_ENTRY_FLAG = "lootEntry";

/** Map notes pointing at this box — by id where one was recorded, else by name. */
function notesForLoot(actor: Actor): NoteDocLike[] {
  const g = game as Game;
  const found: NoteDocLike[] = [];
  for (const scene of g.scenes?.contents ?? []) {
    const notes = (scene as unknown as { notes?: { contents?: NoteDocLike[] } }).notes?.contents ?? [];
    for (const note of notes) {
      const flag = note.getFlag?.(MODULE_ID, FLAGS.LOOT) as LootNoteFlag | undefined;
      if (!flag) continue;
      const matches = flag.actorId ? flag.actorId === actor.id : flag.name === actor.name;
      if (matches) found.push(note);
    }
  }
  return found;
}

/** Which scene a box is already pinned on, if any. */
export function lootNoteScene(actor: Actor): { sceneId: string; sceneName: string; note: NoteDocLike } | null {
  const g = game as Game;
  for (const scene of g.scenes?.contents ?? []) {
    const notes = (scene as unknown as { notes?: { contents?: NoteDocLike[] } }).notes?.contents ?? [];
    for (const note of notes) {
      const flag = note.getFlag?.(MODULE_ID, FLAGS.LOOT) as LootNoteFlag | undefined;
      if (!flag) continue;
      const matches = flag.actorId ? flag.actorId === actor.id : flag.name === actor.name;
      if (matches) {
        return { sceneId: scene.id ?? "", sceneName: scene.name ?? "", note };
      }
    }
  }
  return null;
}

/**
 * Drop an existing box onto the current scene.
 *
 * A note is useless without a linked journal entry — it opens nothing and
 * players cannot see it — so one is created here as the permission vehicle.
 * That entry is left at NONE on purpose: **placing a box never reveals it.**
 * Prep happens on the map long before the party gets there, and only the
 * Release button is allowed to hand anything to the players.
 *
 * The pin lands at the centre of the current view; it is a normal note and can
 * be dragged from there.
 */
export async function placeLootNote(actor: Actor): Promise<boolean> {
  const g = game as Game;
  if (!g.user?.isGM) return false;

  const scene = (g.scenes as unknown as { current?: Scene } | undefined)?.current;
  if (!scene) {
    ui.notifications?.warn("Open the scene you want to place this box on first.");
    return false;
  }

  // **A pin can be moved to another map** (Leander, 2026-08-28): *"wenn zuerst
  // auf der Battlemap platziert und wir wechseln wieder zur Weltkarte, dann
  // möchte ich das Icon gerne auf die große Karte mitnehmen."* A fight happens
  // on the battle map and the body stays where it fell — until the party walks
  // away and the hex map is what matters again. The old pin is taken up rather
  // than left behind, so a box is on exactly one map at a time and cannot be
  // opened from a scene the party is not standing on.
  const existing = lootNoteScene(actor);
  const movedFrom = existing && existing.sceneId !== (scene as unknown as { id?: string }).id
    ? existing.sceneName
    : undefined;
  if (existing && !movedFrom) {
    ui.notifications?.info(`This box is already on “${existing.sceneName}” — drag its pin to move it.`);
    return false;
  }
  if (movedFrom) await removeLootNotes(actor);

  const name = actor.name ?? "Loot";
  const entry = await JournalEntry.create({
    name,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
    // Marked as ours, so deleting the box may clean it up again
    flags: { [MODULE_ID]: { [LOOT_ENTRY_FLAG]: true } },
  } as Parameters<typeof JournalEntry.create>[0]);
  if (!entry?.id) {
    ui.notifications?.error("Could not create the journal entry the map note needs.");
    return false;
  }

  const view = (canvas as unknown as { stage?: { pivot?: { x: number; y: number } } } | undefined)?.stage?.pivot;
  const dims = (scene as unknown as { dimensions?: { width?: number; height?: number } }).dimensions;
  const x = view?.x ?? (dims?.width ?? 2000) / 2;
  const y = view?.y ?? (dims?.height ?? 2000) / 2;

  await (scene as unknown as {
    createEmbeddedDocuments: (type: string, data: unknown[]) => Promise<unknown>;
  }).createEmbeddedDocuments("Note", [
    {
      entryId: entry.id,
      x: Math.round(x),
      y: Math.round(y),
      text: name,
      texture: { src: lootArtwork(actor) },
      flags: { [MODULE_ID]: { [FLAGS.LOOT]: { name, actorId: actor.id } } },
    },
  ]);

  // Placing is never an act of revealing: the entry stays at NONE, so the pin is
  // GM-only until the Release button says otherwise. That keeps one rule true —
  // only releasing ever grants the party access to anything.
  ui.notifications?.info(
    movedFrom
      ? `“${name}” moved from “${movedFrom}” to the centre of this scene — drag the pin where you want it.`
      : `“${name}” placed at the centre of this scene — drag the pin where you want it.`
  );
  if (isLootReleased(actor)) {
    ui.notifications?.warn(
      `“${name}” is already released, but its new pin stays hidden from players. Toggle Release off and on to show it.`
    );
  }
  return true;
}

/**
 * Take a box's pins off the map. Called when the box is deleted — otherwise the
 * pin stays behind pointing at an actor that no longer exists.
 *
 * The linked journal entry is only deleted when the module created it as a
 * permission vehicle (`lootEntry` flag). An entry the GM made themselves may
 * hold real notes and is left alone; only the pin goes.
 */
export async function removeLootNotes(actor: Actor): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;

  for (const note of notesForLoot(actor)) {
    const entry = g.journal?.get(note.entryId ?? "");
    await note.delete?.();
    if (entry?.getFlag(MODULE_ID, LOOT_ENTRY_FLAG)) await entry.delete();
  }
}

/**
 * Record which box a note opens, so renaming the box does not orphan its pin.
 */
export async function linkLootNote(note: NoteDocLike, actor: Actor): Promise<void> {
  if (!(game as Game).user?.isGM) return;
  const flag = (note.getFlag?.(MODULE_ID, FLAGS.LOOT) as LootNoteFlag | undefined) ?? {};
  if (flag.actorId === actor.id) return;
  await note.setFlag?.(MODULE_ID, FLAGS.LOOT, { ...flag, actorId: actor.id });
}

/**
 * Make the pin appear for players when the box is released, and vanish again
 * when it is taken back.
 *
 * A map note is only visible to a player if they may see its linked journal
 * entry, so that entry's `ownership.default` is what actually controls the pin —
 * releasing the actor alone leaves the hoard on the map invisible. A note with
 * no journal entry is visible to everyone already and needs nothing.
 */
export async function syncLootNoteVisibility(actor: Actor, released: boolean): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;
  const level = released
    ? CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;

  let pinsWithoutEntry = 0;
  for (const note of notesForLoot(actor)) {
    const entry = g.journal?.get(note.entryId ?? "");
    if (!entry) {
      pinsWithoutEntry++;
      continue;
    }
    const current = (entry.ownership as Record<string, number> | undefined)?.default;
    if (current === level) continue;
    await entry.update({ ownership: { default: level } } as Parameters<typeof entry.update>[0]);
  }

  // Silently doing nothing here is the confusing case: the box is released, but
  // the pin the GM expects the party to click stays invisible forever.
  if (released && pinsWithoutEntry > 0) {
    ui.notifications?.warn(
      "The map note for this box has no journal entry, so players cannot see the pin. Link a blank journal entry to the note — releasing the box then grants the party access to it."
    );
  }
}

// ─── Coins ─────────────────────────────────────────────────────────────────────

export const COIN_KEYS = ["pp", "gp", "sp", "cp"] as const;
export type CoinKey = (typeof COIN_KEYS)[number];

export const COIN_LABELS: Record<CoinKey, string> = {
  pp: "PP", gp: "GP", sp: "SP", cp: "CP",
};

export function emptyCoins(): ZoneCoins {
  return { cp: 0, sp: 0, gp: 0, pp: 0 };
}

export function coinCount(coins: ZoneCoins): number {
  return coins.pp + coins.gp + coins.sp + coins.cp;
}

/** What a loot box holds in cash. */
export function lootCoins(actor: Actor): ZoneCoins {
  return { ...FlagManager.getInventory(actor).coins };
}

export interface LootShare {
  actorId: string;
  actorName: string;
  coins: ZoneCoins;
}

export interface LootSplit {
  shares: LootShare[];
  /** Coins that cannot be divided without a money changer — they stay in the box. */
  remainder: ZoneCoins;
}

/**
 * Divide a hoard among the party **per denomination**, never by total value.
 *
 * Converting 7 gp into 700 cp to make it divide evenly is a trip to a money
 * changer, not an act of arithmetic, so each denomination is split on its own
 * and what will not go round stays in the box for the table to argue over —
 * exactly what happens when real coins are pushed across a real table.
 */
export function splitLootCoins(coins: ZoneCoins, recipients: Actor[]): LootSplit {
  const remainder = emptyCoins();
  if (recipients.length === 0) return { shares: [], remainder: { ...coins } };

  const each = emptyCoins();
  for (const key of COIN_KEYS) {
    each[key] = Math.floor(coins[key] / recipients.length);
    remainder[key] = coins[key] - each[key] * recipients.length;
  }

  return {
    shares: recipients.map((actor) => ({
      actorId: actor.id ?? "",
      actorName: actor.name ?? "Unknown",
      coins: { ...each },
    })),
    remainder,
  };
}

/**
 * Move coins out of the box into one character's purse.
 * Both writes are ones the caller may perform: a released box is OWNER for
 * everyone, and a player owns their own character.
 */
export async function takeLootCoins(
  lootActor: Actor,
  toActor: Actor,
  coins: ZoneCoins,
  toZone = "equipped"
): Promise<boolean> {
  const wanted = coinCount(coins);
  if (wanted <= 0) return false;

  // Denomination-exact: the box must hand over these very coins, so a plain
  // value deduction (which would make change) is wrong here.
  let taken = false;
  await FlagManager.updateInventory(lootActor, (inv) => {
    const purse = (inv.coinsByZone ??= { [LOOT_ZONE]: { ...inv.coins } });
    if (COIN_KEYS.some((k) => availableCoins(purse, k) < coins[k])) return inv;
    for (const key of COIN_KEYS) removeCoins(purse, key, coins[key]);
    taken = true;
    return inv;
  });
  if (!taken) return false;

  await FlagManager.updateInventory(toActor, (inv) => {
    inv.coinsByZone ??= { equipped: { ...inv.coins } };
    addCoinsToZone(inv.coinsByZone, coins, toZone);
    return inv;
  });
  return true;
}

/** Total of one denomination across every zone of a purse. */
function availableCoins(purse: Record<string, ZoneCoins>, key: CoinKey): number {
  return Object.values(purse).reduce((sum, zone) => sum + (zone[key] ?? 0), 0);
}

/** Take `count` coins of one denomination, walking zones until it is covered. */
function removeCoins(purse: Record<string, ZoneCoins>, key: CoinKey, count: number): void {
  let remaining = count;
  for (const zone of Object.values(purse)) {
    if (remaining <= 0) break;
    const take = Math.min(zone[key] ?? 0, remaining);
    zone[key] -= take;
    remaining -= take;
  }
}
