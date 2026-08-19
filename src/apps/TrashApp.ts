import { TEMPLATES, SOCKET_EVENTS } from "../constants";
import { definitionFor } from "../data/itemDefs";
import { displayQuantity } from "../data/consumables";
import { getPartyActors, getSharedActor } from "../data/sharedStore";
import { getLootActors, getLootIcon } from "../data/lootStore";
import { getTrash, restoreTrashEntry, emptyTrash } from "../data/trash";
import { iconForItemCategory } from "../helpers/handlebars";
import { SocketHandler } from "../socket/SocketHandler";
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
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
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
    window: { title: "Trash", resizable: true },
    position: { width: 460, height: 520 },
    classes: ["dolmenwood-party-inventory", "trash-window"],
    actions: {
      restore: TrashApp._onRestore,
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
        actorName: actor.name ?? "Unnamed",
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
      ui.notifications?.warn("That item could not be restored — nowhere to put it.");
    } else if (result.fellBack) {
      ui.notifications?.info(
        `Restored to ${result.zoneName} — the zone it came from is gone or full.`
      );
    } else {
      ui.notifications?.info(`Restored to ${result.zoneName}.`);
    }

    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render();
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
      title: "Empty Trash",
      content: `<p>Throw away <strong>${count}</strong> deleted item${count === 1 ? "" : "s"} from <strong>${actor.name}</strong>'s trash? This cannot be undone.</p>`,
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
      title: "Empty All Trash",
      content: `<p>Throw away <strong>${count}</strong> deleted item${count === 1 ? "" : "s"} across <strong>${actors.length}</strong> inventor${actors.length === 1 ? "y" : "ies"}? This cannot be undone.</p>`,
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
