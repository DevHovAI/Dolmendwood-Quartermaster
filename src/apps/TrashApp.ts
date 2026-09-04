import { TEMPLATES, SOCKET_EVENTS } from "../constants";
import { definitionFor } from "../data/itemDefs";
import { displayQuantity } from "../data/consumables";
import { getPartyActors, getSharedActor } from "../data/sharedStore";
import { getLootActors, getLootIcon } from "../data/lootStore";
import { getTrash, restoreTrashEntry, emptyTrash, deleteTrashEntry } from "../data/trash";
import { escapeHTML } from "../helpers/handlebars";
import { iconForItemCategory } from "../helpers/handlebars";
import { SocketHandler } from "../socket/SocketHandler";
import { t, tn } from "../helpers/i18n";
import type { TrashedItem } from "../types";

/**
 * The trash window: what has been deleted, and the way back.
 *
 * Everyone may look, but only the GM restores or empties — the party's choice.
 * A player seeing their own bin is the point (they can tell the GM what they
 * lost); a player quietly restoring a sold sword is not.
 *
 * Deliberately its own window rather than a section in the inventory: the GM
 * needs one place that shows every character at once, and the inventory window
 * is already dense.
 */

interface TrashRow {
  entryId: string;
  name: string;
  icon: string;
  quantity: number;
  isSecret: boolean;
  zoneName: string;
  deletedBy: string;
  ago: string;
}

interface TrashGroup {
  actorId: string;
  actorName: string;
  icon: string;
  rows: TrashRow[];
}

/**
 * Rough is fine here — the bin answers "did I just delete that?", so minutes
 * matter and seconds do not.
 */
function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return t("DOLMENWOOD.Trash.Ago.JustNow");
  if (mins < 60) return t("DOLMENWOOD.Trash.Ago.Minutes", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return tn("DOLMENWOOD.Trash.Ago.Hours", hrs);
  const days = Math.floor(hrs / 24);
  return days === 1
    ? t("DOLMENWOOD.Trash.Ago.Yesterday")
    : t("DOLMENWOOD.Trash.Ago.Days", { n: days });
}

function toRow(entry: TrashedItem): TrashRow {
  const def = definitionFor(entry.item);
  return {
    entryId: entry.entryId,
    name: entry.item.name,
    icon: def?.icon ?? iconForItemCategory(def?.category, def?.subcategory),
    quantity: displayQuantity(entry.item, def),
    isSecret: entry.item.isSecret,
    zoneName: entry.zoneName,
    deletedBy: entry.deletedBy,
    ago: timeAgo(entry.deletedAt),
  };
}

/**
 * Whose bins this user may see: their own characters, or — for the GM — the
 * whole party plus the shared store and every loot box, since deleting in a
 * hoard lands in that hoard's bin.
 */
function visibleActors(): Actor[] {
  const isGM = (game as Game).user?.isGM ?? false;
  if (!isGM) return getPartyActors().filter((a) => a.isOwner);

  const actors = [...getPartyActors()];
  const shared = getSharedActor();
  if (shared) actors.push(shared);
  actors.push(...getLootActors());
  return actors;
}

export class TrashApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-trash",
    window: { title: "DOLMENWOOD.Trash.Title", resizable: true },
    position: { width: 460, height: 520 },
    classes: ["dolmenwood-party-inventory", "trash-window"],
    actions: {
      restore: TrashApp._onRestore,
      deleteEntry: TrashApp._onDeleteEntry,
      emptyActor: TrashApp._onEmptyActor,
      emptyAll: TrashApp._onEmptyAll,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.TRASH },
  };

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const isGM = (game as Game).user?.isGM ?? false;

    const groups: TrashGroup[] = [];
    for (const actor of visibleActors()) {
      const entries = getTrash(actor);
      if (entries.length === 0) continue;
      groups.push({
        actorId: actor.id ?? "",
        actorName: actor.name ?? t("DOLMENWOOD.Trash.Unnamed"),
        icon: getLootActors().some((l) => l.id === actor.id) ? getLootIcon(actor) : "fa-user",
        // Newest first — the mis-click you are looking for is the last one.
        rows: [...entries].reverse().map(toRow),
      });
    }

    const total = groups.reduce((n, g) => n + g.rows.length, 0);
    return { isGM, groups, total, isEmpty: total === 0 };
  }

  private static async _onRestore(
    this: TrashApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!(game as Game).user?.isGM) return;
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    const entryId = target.dataset.entryId;
    if (!actor || !entryId) return;

    const result = await restoreTrashEntry(actor, entryId);
    if (!result.ok) {
      ui.notifications?.warn(t("DOLMENWOOD.Trash.Restore.Failed"));
    } else if (result.fellBack) {
      // `zoneName` is optional on the result. The old message interpolated it
      // straight into a template literal, so a missing one read "Restored to
      // undefined." — the typed t() is what turned that up.
      ui.notifications?.info(
        t("DOLMENWOOD.Trash.Restore.Fallback", { zone: result.zoneName ?? "" })
      );
    } else {
      ui.notifications?.info(
        t("DOLMENWOOD.Trash.Restore.Done", { zone: result.zoneName ?? "" })
      );
    }

    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render();
  }

  /**
   * One row gone for good.
   *
   * Confirmed, because it is the one button in this window that destroys
   * something rather than moving it: up to here, deleting was reversible.
   */
  private static async _onDeleteEntry(
    this: TrashApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const actorId = target.dataset.actorId ?? "";
    const entryId = target.dataset.entryId ?? "";
    const actor = (game as Game).actors?.get(actorId) as Actor | undefined;
    if (!actor) return;
    const entry = getTrash(actor).find((t) => t.entryId === entryId);
    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Trash.Discard.Title"),
      content:
        t("DOLMENWOOD.Trash.Discard.Body", {
          name: escapeHTML(entry?.item?.name ?? t("DOLMENWOOD.Trash.Discard.ThisRow")),
        }) + `<p class="qm-hint">${t("DOLMENWOOD.Trash.Discard.Hint")}</p>`
    });
    if (!confirmed) return;
    await deleteTrashEntry(actor, entryId);
    this.render(false);
  }

  private static async _onEmptyActor(
    this: TrashApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!(game as Game).user?.isGM) return;
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    if (!actor) return;

    const count = getTrash(actor).length;
    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Trash.EmptyActor.Title"),
      content: tn("DOLMENWOOD.Trash.EmptyActor.Body", count, {
        name: escapeHTML(actor.name ?? ""),
      }),
    });
    if (!confirmed) return;

    await emptyTrash(actor);
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render();
  }

  private static async _onEmptyAll(this: TrashApp): Promise<void> {
    if (!(game as Game).user?.isGM) return;

    const actors = visibleActors().filter((a) => getTrash(a).length > 0);
    const count = actors.reduce((n, a) => n + getTrash(a).length, 0);
    if (count === 0) return;

    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Trash.EmptyAll.Title"),
      // Two numbers, two plurals, one sentence. `tn` chooses on the item count;
      // the inventories are a noun phrase of their own, localised whole and
      // handed in — so the sentence around it stays one key and German keeps
      // its word order, which joining fragments would have taken away.
      content: tn("DOLMENWOOD.Trash.EmptyAll.Body", count, {
        where: tn("DOLMENWOOD.Trash.EmptyAll.Where", actors.length),
      }),
    });
    if (!confirmed) return;

    for (const actor of actors) await emptyTrash(actor);
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render();
  }
}

export function openTrash(): void {
  const existing = foundry.applications?.instances?.get("dolmenwood-trash") as
    | { render: (force?: boolean) => void }
    | undefined;
  if (existing) existing.render(true);
  else new TrashApp().render(true);
}
