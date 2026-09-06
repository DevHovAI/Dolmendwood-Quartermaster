import { MODULE_ID, SETTINGS, SHARED_ACTOR_ORIGINAL_NAME, SHARED_ACTOR_IMG } from "../constants";
import { t } from "../helpers/i18n";
import { FlagManager } from "./FlagManager";
import { isLootActor } from "./lootStore";
import type { ExtraZone } from "../types";

/**
 * "Gruppenbesitz": one world-wide actor that holds containers, pack animals and
 * vehicles the whole party may use. It carries a perfectly normal `inventory`
 * flag, so every existing zone/item/coin/encumbrance code path works on it
 * unchanged — the only thing special about it is `ownership.default = OWNER`,
 * which lets every player write to it directly without going through the GM.
 *
 * Because it is owned by everyone, the auto-detection used everywhere ("actors
 * a non-GM player owns") would pick it up as a party member. Read party lists
 * through getPartyActors() so it stays out of them, and through
 * getConvoyActors() where its pack animals must still count.
 */

export function getSharedActorId(): string {
  return ((game as Game).settings.get(MODULE_ID, SETTINGS.SHARED_ACTOR_ID) ?? "") as string;
}

export function getSharedActor(): Actor | null {
  const id = getSharedActorId();
  if (!id) return null;
  return (game as Game).actors?.get(id) ?? null;
}

export function isSharedActor(actor: Actor | null | undefined): boolean {
  const id = getSharedActorId();
  return !!id && !!actor && actor.id === id;
}

/**
 * The shared actor, creating it on first use. Only a GM may create actors, so a
 * player gets null back and the caller has to route the action through the GM.
 */
export async function ensureSharedActor(): Promise<Actor | null> {
  const existing = getSharedActor();
  if (existing) return existing;

  const g = game as Game;
  if (!g.user?.isGM) return null;

  // Actor.create needs a type the active system actually defines. game.model is
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
    ui.notifications?.error(t("DOLMENWOOD.Shared.NoActorTypes"));
    return null;
  }

  const created = await Actor.create({
    name: t("DOLMENWOOD.Shared.ActorName"),
    type,
    img: SHARED_ACTOR_IMG,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
  } as Parameters<typeof Actor.create>[0]);

  if (!created?.id) return null;
  await g.settings.set(MODULE_ID, SETTINGS.SHARED_ACTOR_ID, created.id);
  return created as Actor;
}

/**
 * Repair the shared actor's ownership if it was changed by hand — without
 * OWNER for everyone, players silently lose the ability to write to it.
 */
export async function verifySharedActorOwnership(): Promise<void> {
  const actor = getSharedActor();
  if (!actor || !(game as Game).user?.isGM) return;
  const level = (actor.ownership as Record<string, number> | undefined)?.default;
  if (level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) return;
  await actor.update({
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
  } as Parameters<typeof actor.update>[0]);
}

/**
 * Translate the shared store's name, once, and only where nobody has renamed it.
 *
 * **Dolmenmaster's ask, 2026-09-06: *"party stores bitte übersetzen"*.** The
 * name is the one string in this module that is not read out of the language
 * table when it is shown — it is an actor's name, written into the world the
 * first time a container was shared, and every world that did so before today
 * carries the English one.
 *
 * **Guarded three ways, because this writes to somebody's world.** It runs for
 * a GM only; it acts only when the name is *exactly* the name this module gave
 * it, so a table that renamed the actor keeps their own word; and it does
 * nothing when the language already agrees. That also makes it idempotent:
 * after the rename the name is no longer the default, so nothing here fires
 * again — switching the interface back to English does not switch the actor
 * back, which is the right way round for a thing a table may have started
 * calling by its German name.
 *
 * Nothing identifies the actor by name — its id lives in a setting — so this is
 * a label and nothing else depends on it.
 */
export async function renameSharedActorFromDefault(): Promise<void> {
  const actor = getSharedActor();
  if (!actor || !(game as Game).user?.isGM) return;
  if (actor.name !== SHARED_ACTOR_ORIGINAL_NAME) return;

  const wanted = t("DOLMENWOOD.Shared.ActorName");
  // `t` hands back the key when it is asked too early, and an empty table would
  // otherwise rename the actor to "DOLMENWOOD.Shared.ActorName".
  if (!wanted || wanted.startsWith("DOLMENWOOD.") || wanted === actor.name) return;

  await actor.update({ name: wanted } as Parameters<typeof actor.update>[0]);
  ui.notifications?.info(t("DOLMENWOOD.Shared.Renamed", { name: wanted }));
}

// ─── Party lists ───────────────────────────────────────────────────────────────

/**
 * Every actor a non-GM player owns — the shared actor and every loot box
 * excluded. Both are owned by everyone by design, so without this filter a
 * released hoard would join the party as a member.
 */
export function getPartyActors(): Actor[] {
  const g = game as Game;
  const sharedId = getSharedActorId();
  return (g.actors?.contents ?? []).filter(
    (actor) =>
      actor.id !== sharedId &&
      !isLootActor(actor) &&
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
  );
}

/**
 * The party plus the shared actor. Use this wherever the shared containers must
 * still be counted — the party convoy speed above all, since a shared pack
 * animal sets the marching pace exactly like a privately owned one.
 */
export function getConvoyActors(): Actor[] {
  const actors = getPartyActors();
  const shared = getSharedActor();
  if (shared) actors.push(shared);
  return actors;
}

// ─── Shared zones ──────────────────────────────────────────────────────────────

export function getSharedZones(): ExtraZone[] {
  const shared = getSharedActor();
  if (!shared) return [];
  return FlagManager.getInventory(shared).extraZones ?? [];
}

export function isSharedZone(zoneId: string): boolean {
  return getSharedZones().some((z) => z.id === zoneId);
}

/** True if the current user may write to the shared actor at all. */
export function canUseSharedStore(): boolean {
  const shared = getSharedActor();
  return !!shared && shared.isOwner;
}
