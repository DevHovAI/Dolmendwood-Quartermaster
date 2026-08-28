import { MODULE_ID, FLAGS, TEMPLATES, LOOT_ZONE } from "../constants";
import { CatalogManager } from "../data/CatalogManager";
import { definitionFor } from "../data/itemDefs";
import { canReachLoot } from "../data/partyPlace";
import { FlagManager } from "../data/FlagManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { addItemWithZones, getEncumbranceMode } from "../data/zoneGrants";
import { displayQuantity, portionOf, reduceItem } from "../data/consumables";
import { getPartyActors } from "../data/sharedStore";
import { discardItem } from "../data/trash";
import {
  COIN_KEYS,
  COIN_LABELS,
  coinCount,
  createLootActor,
  emptyCoins,
  getLootActors,
  getLootIcon,
  setLootIcon,
  DEFAULT_LOOT_ICON,
  isLootReleased,
  linkLootNote,
  lootCoins,
  lootNoteScene,
  placeLootNote,
  setLootReleased,
  type LootNoteFlag,
  splitLootCoins,
  takeLootCoins,
  type CoinKey,
} from "../data/lootStore";
import {
  AddItemDialog,
  AddCustomItemDialog,
  amountFieldHTML,
  populateGiveZoneSelect,
} from "./PlayerInventoryApp";
import {
  escapeHTML,
  buildIconPickerHTML,
  activateIconPicker,
  LOOT_ICONS,
} from "../helpers/handlebars";
import type { InventoryItem, ItemDefinition, ZoneCoins } from "../types";

/**
 * A loot box's own window. Deliberately not the player inventory: a hoard is a
 * flat pile nobody is carrying, so it has no zones, no encumbrance and no
 * convoy — one list, one purse, and a Take button per row.
 *
 * The GM stages the box here too, which is why the add/remove controls live in
 * the same window as the taking. The one thing that separates the two phases is
 * the release button, which is nothing but an ownership flip (see lootStore).
 */
export class LootApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private actor: Actor;

  /**
   * The id goes through the options rather than an `id` getter: ApplicationV2
   * registers the instance during super(), when `this.actor` is not assigned yet.
   */
  constructor(actor: Actor, options: DeepPartial<ApplicationV2Options> = {}) {
    super({ ...options, id: LootApp.appIdFor(actor) });
    this.actor = actor;
  }

  /** One window per box, so two hoards can sit side by side. */
  static appIdFor(actor: Actor): string {
    return `dolmenwood-loot-${actor.id}`;
  }

  override get title(): string {
    return this.actor.name ?? "Loot";
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-loot",
    window: { title: "Loot", resizable: true },
    position: { width: 560, height: 620 },
    classes: ["dolmenwood-party-inventory", "loot"],
    actions: {
      toggleRelease: LootApp._onToggleRelease,
      addItem: LootApp._onAddItem,
      addCustomItem: LootApp._onAddCustomItem,
      takeItem: LootApp._onTakeItem,
      deleteItem: LootApp._onDeleteItem,
      takeCoins: LootApp._onTakeCoins,
      splitCoins: LootApp._onSplitCoins,
      editCoins: LootApp._onEditCoins,
      renameBox: LootApp._onRenameBox,
      placeOnMap: LootApp._onPlaceOnMap,
      deleteBox: LootApp._onDeleteBox,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.LOOT },
  };

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const g = game as Game;
    const isGM = g.user?.isGM ?? false;
    const encMode = getEncumbranceMode();
    const inventory = FlagManager.getInventory(this.actor);
    const released = isLootReleased(this.actor);

    const items = inventory.items.map((item) => {
      const def = definitionFor(item);
      const effective = def ?? item.customDefinition;
      return {
        ...item,
        def: effective,
        icon: effective?.icon ?? "fa-sack",
        count: displayQuantity(item, def),
        weight: effective?.weight ?? 0,
        size: effective?.size,
      };
    });

    const coins = lootCoins(this.actor);
    const pinnedTo = isGM ? lootNoteScene(this.actor) : null;

    return {
      isGM,
      released,
      // Where the box sits on the map, so the button can say "already placed"
      // instead of quietly refusing a second time
      pinnedSceneName: pinnedTo?.sceneName ?? null,
      // Whether that scene is the one open now, which decides between "drag it"
      // and "bring it here".
      pinnedHere:
        !!pinnedTo &&
        pinnedTo.sceneId ===
          ((game as Game).scenes as unknown as { current?: { id?: string } } | undefined)?.current?.id,
      encMode,
      name: this.actor.name,
      items,
      isEmpty: items.length === 0 && coinCount(coins) === 0,
      coins,
      hasCoins: coinCount(coins) > 0,
      // A player can only take once the box is released; the GM always can
      canTake: (released || isGM) && this.takeTargets().length > 0,
      // Splitting writes to several characters at once, so it stays with the GM
      canSplit: isGM && coinCount(coins) > 0 && getPartyActors().length > 0,
    };
  }

  /** Characters the current user may hand loot to. */
  private takeTargets(): Actor[] {
    const g = game as Game;
    const party = getPartyActors();
    if (g.user?.isGM) return party;
    return party.filter((actor) => actor.isOwner);
  }

  private itemById(itemId: string): InventoryItem | undefined {
    return FlagManager.getInventory(this.actor).items.find((i) => i.id === itemId);
  }

  private rerender(): void {
    this.render();
    // The list of boxes and the released state are both visible in the browser
    getAppInstance("dolmenwood-loot-browser")?.render();
  }

  // ─── Staging (GM) ────────────────────────────────────────────────────────────

  private static async _onToggleRelease(this: LootApp): Promise<void> {
    const g = game as Game;
    if (!g.user?.isGM) return;
    const releasing = !isLootReleased(this.actor);
    await setLootReleased(this.actor, releasing);

    // The chat message is how the party learns about it — a released box is
    // otherwise a silent change to an actor's permissions.
    if (releasing) await postLootMessage(this.actor);
    this.rerender();
  }

  private static _onAddItem(this: LootApp): void {
    if (!(game as Game).user?.isGM) return;
    // fixedZone: the box is one pile, so there is no zone question to ask
    new AddItemDialog(this.actor, LOOT_ZONE, getEncumbranceMode(), () => this.rerender(), {
      fixedZone: true,
    }).render(true);
  }

  private static _onAddCustomItem(this: LootApp): void {
    if (!(game as Game).user?.isGM) return;
    new AddCustomItemDialog(this.actor, LOOT_ZONE, getEncumbranceMode(), () => this.rerender(), {
      fixedZone: true,
    }).render(true);
  }

  private static async _onDeleteItem(this: LootApp, _event: Event, target: HTMLElement): Promise<void> {
    if (!(game as Game).user?.isGM) return;
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    await FlagManager.updateInventory(this.actor, (inv) => {
      discardItem(inv, itemId);
      return inv;
    });
    this.rerender();
  }

  private static _onRenameBox(this: LootApp): void {
    if (!(game as Game).user?.isGM) return;
    new RenameLootDialog(this.actor, () => this.rerender()).render(true);
  }

  private static async _onPlaceOnMap(this: LootApp): Promise<void> {
    if (!(game as Game).user?.isGM) return;
    await placeLootNote(this.actor);
    this.rerender();
  }

  private static async _onDeleteBox(this: LootApp): Promise<void> {
    if (!(game as Game).user?.isGM) return;
    const remaining = FlagManager.getInventory(this.actor);
    const contents = remaining.items.length + coinCount(remaining.coins);
    const warning = contents > 0
      ? "<p><strong>This box is not empty.</strong> Everything still in it is destroyed.</p>"
      : "";
    const pinned = lootNoteScene(this.actor);
    const pinNote = pinned
      ? `<p>Its map pin in “${escapeHTML(pinned.sceneName)}” is removed too.</p>`
      : "";
    const confirmed = await Dialog.confirm({
      title: "Delete Loot Box",
      content: `${warning}<p>Delete “${escapeHTML(this.actor.name ?? "")}” for good?</p>${pinNote}`,
    });
    if (!confirmed) return;
    // The pin is cleaned up by the deleteActor hook, which also catches a box
    // deleted straight from the sidebar
    await this.actor.delete();
    void this.close();
    getAppInstance("dolmenwood-loot-browser")?.render();
  }

  private static _onEditCoins(this: LootApp): void {
    if (!(game as Game).user?.isGM) return;
    new SetLootCoinsDialog(this.actor, () => this.rerender()).render(true);
  }

  // ─── Taking ──────────────────────────────────────────────────────────────────

  private static _onTakeItem(this: LootApp, _event: Event, target: HTMLElement): void {
    const itemId = target.dataset.itemId;
    const item = itemId ? this.itemById(itemId) : undefined;
    if (!item) return;

    const targets = this.takeTargets();
    if (targets.length === 0) {
      ui.notifications?.warn("You have no character to put this into.");
      return;
    }

    new TakeLootItemDialog(this.actor, item, targets, () => this.rerender()).render(true);
  }

  private static _onTakeCoins(this: LootApp): void {
    const targets = this.takeTargets();
    if (targets.length === 0) {
      ui.notifications?.warn("You have no character to put coins into.");
      return;
    }
    new TakeLootCoinsDialog(this.actor, targets, () => this.rerender()).render(true);
  }

  private static _onSplitCoins(this: LootApp): void {
    if (!(game as Game).user?.isGM) return;
    new SplitLootCoinsDialog(this.actor, () => this.rerender()).render(true);
  }
}

// ─── Browser: every box the current user may see ───────────────────────────────

export class LootBrowserApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-loot-browser",
    window: { title: "Loot", resizable: true },
    position: { width: 420, height: 480 },
    classes: ["dolmenwood-party-inventory", "loot-browser"],
    actions: {
      openBox: LootBrowserApp._onOpenBox,
      newBox: LootBrowserApp._onNewBox,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.LOOT_BROWSER },
  };

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const isGM = (game as Game).user?.isGM ?? false;
    const boxes = getLootActors().map((actor) => {
      const inv = FlagManager.getInventory(actor);
      return {
        id: actor.id,
        name: actor.name,
        icon: getLootIcon(actor),
        released: isLootReleased(actor),
        itemCount: inv.items.length,
        coinCount: coinCount(inv.coins),
      };
    });
    return { isGM, boxes, isEmpty: boxes.length === 0 };
  }

  private static _onOpenBox(this: LootBrowserApp, _event: Event, target: HTMLElement): void {
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    if (actor) openLootBox(actor);
  }

  private static async _onNewBox(this: LootBrowserApp): Promise<void> {
    new NewLootBoxDialog(async (name, icon) => {
      const actor = await createLootActor(name, icon);
      if (actor) {
        this.render();
        openLootBox(actor);
      }
    }).render(true);
  }
}

// ─── Opening ───────────────────────────────────────────────────────────────────

function getAppInstance(id: string): { render: (force?: boolean) => void } | null {
  const instances = foundry.applications?.instances;
  if (!instances) return null;
  return (instances.get(id) as { render: (force?: boolean) => void } | undefined) ?? null;
}

/**
 * Open a box — for the Referee always, and for a player only where they are
 * standing next to it.
 *
 * **The check lives here and not on each door**, because there are three of
 * them: the pin on the map, the browser, and the card in chat. A rule enforced
 * at one door is a rule with two ways round it (Leander, 2026-08-28).
 *
 * Being *released* is still what lets a player read the box at all — that is
 * Foundry's own ownership and no module can talk its way past it. Standing
 * beside it is the second half: released says *the party may have this*, the
 * pin's hex says *this is where it is*.
 */
export function openLootBox(actor: Actor): void {
  const note = lootNoteScene(actor)?.note;
  if (!(game as Game).user?.isGM) {
    if (!note) {
      ui.notifications?.warn(`“${actor.name}” is not on any map, so there is nothing to walk up to.`);
      return;
    }
    const verdict = canReachLoot(note as Parameters<typeof canReachLoot>[0]);
    if (!verdict.ok) {
      ui.notifications?.warn(`“${actor.name}” is out of reach. ${verdict.reason}`);
      return;
    }
  }
  const existing = getAppInstance(LootApp.appIdFor(actor));
  if (existing) existing.render(true);
  else new LootApp(actor).render(true);
}

export function openLootBrowser(): void {
  const existing = getAppInstance("dolmenwood-loot-browser");
  if (existing) existing.render(true);
  else new LootBrowserApp().render(true);
}

/**
 * Open the box a map note points at, creating it on first use.
 *
 * The note records the box's actor id the first time it is opened, so renaming
 * the box later does not orphan the pin; the name is only the fallback for a
 * note configured before that id existed.
 */
export async function openLootFromNote(note: {
  getFlag?: (m: string, k: string) => unknown;
  setFlag?: (m: string, k: string, v: unknown) => Promise<unknown>;
  entryId?: string | null;
}): Promise<void> {
  const flag = (note.getFlag?.(MODULE_ID, FLAGS.LOOT) as LootNoteFlag | undefined) ?? {};
  const name = flag.name ?? "Loot";
  const boxes = getLootActors();
  const match =
    (flag.actorId ? boxes.find((actor) => actor.id === flag.actorId) : undefined) ??
    boxes.find((actor) => actor.name === name);

  if (match) {
    await linkLootNote(note, match);
    openLootBox(match);
    return;
  }

  if (!(game as Game).user?.isGM) {
    // Either nothing has been staged here, or it is staged and not yet released
    ui.notifications?.info("There is nothing here yet.");
    return;
  }

  const created = await createLootActor(name);
  if (!created) return;
  await linkLootNote(note, created);
  openLootBox(created);
}

/**
 * Announce a released box in chat. The message is how players find out at all,
 * and its button reopens the box later without hunting through the sidebar.
 */
async function postLootMessage(actor: Actor): Promise<void> {
  const inv = FlagManager.getInventory(actor);
  const lines = inv.items
    .slice(0, 8)
    .map((item) => {
      const def = definitionFor(item);
      const count = displayQuantity(item, def);
      return `<li>${escapeHTML(item.name)}${count > 1 ? ` ×${count}` : ""}</li>`;
    })
    .join("");
  const more = inv.items.length > 8 ? `<li>…and ${inv.items.length - 8} more</li>` : "";
  const coins = coinCount(inv.coins) > 0 ? `<p>${coinSummary(inv.coins)}</p>` : "";

  await ChatMessage.create({
    content: `
      <div class="dw-loot-message">
        <h3><i class="fas ${getLootIcon(actor)}"></i> ${escapeHTML(actor.name ?? "Loot")}</h3>
        ${lines || more ? `<ul>${lines}${more}</ul>` : "<p><em>Empty</em></p>"}
        ${coins}
        <button type="button" class="dw-open-loot" data-actor-id="${actor.id}">Open</button>
      </div>`,
  } as Parameters<typeof ChatMessage.create>[0]);
}

export function coinSummary(coins: ZoneCoins): string {
  const parts = COIN_KEYS.filter((k) => coins[k] > 0).map((k) => `${coins[k]} ${COIN_LABELS[k]}`);
  return parts.length ? parts.join(", ") : "—";
}

// ─── Dialogs ───────────────────────────────────────────────────────────────────

class NewLootBoxDialog extends Dialog {
  constructor(onPick: (name: string, icon: string) => void | Promise<void>) {
    super({
      title: "New Loot Box",
      content: `
        <form>
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="loot-box-name" placeholder="e.g. Barrow Hoard" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            ${buildIconPickerHTML(DEFAULT_LOOT_ICON, LOOT_ICONS)}
          </div>
        </form>`,
      buttons: {
        create: {
          label: "Create",
          callback: (html: JQuery) => {
            const name = (html.find("#loot-box-name").val() as string).trim() || "Loot";
            const icon = (html.find("#custom-icon-value").val() as string) || DEFAULT_LOOT_ICON;
            void onPick(name, icon);
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "create",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
  }
}

/** Name and icon together — there is no reason to make them two trips. */
class RenameLootDialog extends Dialog {
  constructor(actor: Actor, onComplete: () => void) {
    super({
      title: "Edit Loot Box",
      content: `
        <form>
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="loot-rename" value="${escapeHTML(actor.name ?? "")}" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            ${buildIconPickerHTML(getLootIcon(actor), LOOT_ICONS)}
          </div>
        </form>`,
      buttons: {
        save: {
          label: "Save",
          callback: async (html: JQuery) => {
            const name = (html.find("#loot-rename").val() as string).trim();
            const icon = (html.find("#custom-icon-value").val() as string) || DEFAULT_LOOT_ICON;
            if (name && name !== actor.name) {
              await actor.update({ name } as Parameters<typeof actor.update>[0]);
            }
            // Written even when unchanged: it also re-points the map pin, which
            // is how a box placed before it had a chosen icon gets fixed up
            await setLootIcon(actor, icon);
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "save",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
  }
}

/** GM-only: set what cash the hoard contains. */
class SetLootCoinsDialog extends Dialog {
  constructor(actor: Actor, onComplete: () => void) {
    const coins = lootCoins(actor);
    const fields = COIN_KEYS.map(
      (key) => `
        <div class="form-group">
          <label>${COIN_LABELS[key]}</label>
          <input type="number" id="loot-coin-${key}" value="${coins[key]}" min="0" />
        </div>`
    ).join("");

    super({
      title: "Coins in the Hoard",
      content: `<form>${fields}</form>`,
      buttons: {
        save: {
          label: "Save",
          callback: async (html: JQuery) => {
            const next = emptyCoins();
            for (const key of COIN_KEYS) {
              next[key] = Math.max(0, parseInt(html.find(`#loot-coin-${key}`).val() as string, 10) || 0);
            }
            await FlagManager.updateInventory(actor, (inv) => {
              // One pile, one purse: the box has a single zone, so overwriting
              // it wholesale is the whole edit
              inv.coinsByZone = { [LOOT_ZONE]: next };
              return inv;
            });
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "save",
    });
  }
}

/**
 * Take one row out of the hoard. Mirrors GiveItemDialog in reverse: pick the
 * character, then a zone that can actually hold it, then how much.
 */
class TakeLootItemDialog extends Dialog {
  private item: InventoryItem;

  constructor(lootActor: Actor, item: InventoryItem, targets: Actor[], onComplete: () => void) {
    const def = definitionFor(item);
    const available = displayQuantity(item, def);
    const targetOptions = targets
      .map((a) => `<option value="${a.id}">${escapeHTML(a.name ?? "")}</option>`)
      .join("");

    super({
      title: `Take ${item.name}`,
      content: `
        <form>
          <div class="form-group">
            <label>To</label>
            <select id="take-target">${targetOptions}</select>
          </div>
          <div class="form-group">
            <label>Into</label>
            <select id="take-zone"></select>
          </div>
          ${amountFieldHTML(available > 1 ? available : 0, "take-qty")}
        </form>`,
      buttons: {
        take: {
          label: "Take",
          callback: async (html: JQuery) => {
            const toActor = (game as Game).actors?.get(html.find("#take-target").val() as string);
            const zoneId = html.find("#take-zone").val() as string;
            if (!toActor || !zoneId) return;
            const amount = available > 1
              ? Math.min(available, Math.max(1, parseInt(html.find("#take-qty").val() as string, 10) || 1))
              : available;
            await takeLootItem(lootActor, toActor, item.id, zoneId, amount);
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "take",
    });

    this.item = item;
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const def = definitionFor(this.item);
    const available = displayQuantity(this.item, def);
    const refresh = () => {
      const toActor = (game as Game).actors?.get(html.find("#take-target").val() as string) ?? null;
      const count = available > 1
        ? Math.min(available, Math.max(1, parseInt(html.find("#take-qty").val() as string, 10) || 1))
        : available;
      populateGiveZoneSelect(html.find("#take-zone"), toActor, [portionOf(this.item, def, count)]);
    };
    refresh();
    html.find("#take-target").on("change", refresh);
    html.find("#take-qty").on("change input", refresh);
  }
}

/**
 * Move one row (or part of it) from the box into a character.
 * Both writes belong to the caller: a released box is OWNER for everyone.
 */
async function takeLootItem(
  lootActor: Actor,
  toActor: Actor,
  itemId: string,
  zoneId: string,
  amount: number
): Promise<void> {
  const item = FlagManager.getInventory(lootActor).items.find((i) => i.id === itemId);
  if (!item) return;
  const def = definitionFor(item);
  const taken = portionOf(item, def, amount);
  taken.zone = zoneId as InventoryItem["zone"];
  // A hoard may hold things the GM marked secret while staging; once it is in a
  // character's hands there is nothing left to hide.
  taken.isSecret = false;

  await FlagManager.updateInventory(lootActor, (inv) => {
    const source = inv.items.find((i) => i.id === itemId);
    if (source && !reduceItem(source, def, amount)) {
      inv.items = inv.items.filter((i) => i.id !== itemId);
    }
    return inv;
  });

  await FlagManager.updateInventory(toActor, (inv) => {
    addItemWithZones(
      inv,
      taken,
      getEncumbranceMode(),
      def ?? (taken.customDefinition as ItemDefinition | undefined)
    );
    return inv;
  });
}

/** Take cash out of the hoard, with the load it adds spelled out. */
class TakeLootCoinsDialog extends Dialog {
  constructor(lootActor: Actor, targets: Actor[], onComplete: () => void) {
    const coins = lootCoins(lootActor);
    const targetOptions = targets
      .map((a) => `<option value="${a.id}">${escapeHTML(a.name ?? "")}</option>`)
      .join("");
    const fields = COIN_KEYS.filter((key) => coins[key] > 0)
      .map(
        (key) => `
        <div class="form-group">
          <label>${COIN_LABELS[key]} <span style="opacity:0.7;">(of ${coins[key]})</span></label>
          <input type="number" class="loot-take-coin" data-coin="${key}" id="take-coin-${key}"
                 value="0" min="0" max="${coins[key]}" />
        </div>`
      )
      .join("");

    super({
      title: "Take Coins",
      content: `
        <form>
          <div class="form-group">
            <label>To</label>
            <select id="take-coin-target">${targetOptions}</select>
          </div>
          ${fields}
          <p class="loot-load-hint" id="take-coin-load"></p>
        </form>`,
      buttons: {
        take: {
          label: "Take",
          callback: async (html: JQuery) => {
            const toActor = (game as Game).actors?.get(html.find("#take-coin-target").val() as string);
            if (!toActor) return;
            const wanted = readCoinInputs(html, ".loot-take-coin");
            if (coinCount(wanted) === 0) return;
            const ok = await takeLootCoins(lootActor, toActor, wanted);
            if (!ok) ui.notifications?.warn("Those coins are no longer in the box.");
            onComplete();
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "take",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const refresh = () => {
      const toActor = (game as Game).actors?.get(html.find("#take-coin-target").val() as string) ?? null;
      const wanted = readCoinInputs(html, ".loot-take-coin");
      html.find("#take-coin-load").html(loadPreviewHTML(toActor, wanted));
    };
    refresh();
    html.find("#take-coin-target").on("change", refresh);
    html.find(".loot-take-coin").on("change input", refresh);
  }
}

/**
 * Divide the hoard's cash among the party, per denomination.
 *
 * Two things make this more than a division: coins weigh one unit each
 * regardless of value, so a share can genuinely slow someone down — hence the
 * load preview per recipient; and coins cannot be broken into smaller
 * denominations without a money changer, so whatever will not go round stays in
 * the box rather than being silently converted.
 */
class SplitLootCoinsDialog extends Dialog {
  private lootActor: Actor;

  constructor(lootActor: Actor, onComplete: () => void) {
    const party = getPartyActors();
    const rows = party
      .map(
        (actor) => `
        <label class="loot-split-row">
          <input type="checkbox" class="loot-split-member" value="${actor.id}" checked />
          <span class="loot-split-name">${escapeHTML(actor.name ?? "")}</span>
          <span class="loot-split-share" data-actor-id="${actor.id}"></span>
        </label>`
      )
      .join("");

    super(
      {
        title: "Split the Hoard",
        content: `
          <form>
            <p class="loot-split-total">In the box: <strong>${coinSummary(lootCoins(lootActor))}</strong></p>
            <div class="loot-split-list">${rows}</div>
            <p class="loot-split-remainder" id="loot-split-remainder"></p>
          </form>`,
        buttons: {
          split: {
            label: "Split",
            callback: async (html: JQuery) => {
              const recipients = actorsByIds(selectedMemberIds(html));
              if (recipients.length === 0) return;

              const split = splitLootCoins(lootCoins(lootActor), recipients);
              for (const share of split.shares) {
                const [actor] = actorsByIds([share.actorId]);
                if (actor) await takeLootCoins(lootActor, actor, share.coins);
              }
              onComplete();
            },
          },
          cancel: { label: "Cancel" },
        },
        default: "split",
      },
      { width: 460 }
    );

    this.lootActor = lootActor;
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    const refresh = () => {
      const recipients = actorsByIds(selectedMemberIds(html));
      const split = splitLootCoins(lootCoins(this.lootActor), recipients);

      html.find(".loot-split-share").html("");
      for (const share of split.shares) {
        const actor = actorsByIds([share.actorId])[0] ?? null;
        html
          .find(`.loot-split-share[data-actor-id="${share.actorId}"]`)
          .html(`${coinSummary(share.coins)} ${loadPreviewHTML(actor, share.coins)}`);
      }

      const rest = coinCount(split.remainder) > 0
        ? `Stays in the box: <strong>${coinSummary(split.remainder)}</strong> — coins cannot be broken down without a money changer.`
        : "Divides evenly, nothing left over.";
      html.find("#loot-split-remainder").html(rest);
    };
    refresh();
    html.find(".loot-split-member").on("change", refresh);
  }
}

// ─── Shared dialog helpers ─────────────────────────────────────────────────────

function selectedMemberIds(html: JQuery): string[] {
  const ids: string[] = [];
  html.find(".loot-split-member:checked").each((_i, el) => {
    ids.push((el as HTMLInputElement).value);
  });
  return ids;
}

/** Actors for a list of IDs, skipping any that no longer exist. */
function actorsByIds(ids: string[]): Actor[] {
  const g = game as Game;
  const actors: Actor[] = [];
  for (const id of ids) {
    const actor = g.actors?.get(id);
    if (actor) actors.push(actor as Actor);
  }
  return actors;
}

function readCoinInputs(html: JQuery, selector: string): ZoneCoins {
  const coins = emptyCoins();
  html.find(selector).each((_i, el) => {
    const input = el as HTMLInputElement;
    const key = input.dataset.coin as CoinKey | undefined;
    if (!key) return;
    const max = parseInt(input.max, 10);
    coins[key] = Math.min(
      Number.isFinite(max) ? max : Number.MAX_SAFE_INTEGER,
      Math.max(0, parseInt(input.value, 10) || 0)
    );
  });
  return coins;
}

/**
 * What this many coins does to a character's pace. Every coin weighs one unit,
 * so a hoard's worth of copper is a real load — which is exactly the thing a
 * split has to be honest about before it happens.
 */
function loadPreviewHTML(actor: Actor | null, coins: ZoneCoins): string {
  if (!actor || coinCount(coins) === 0) return "";
  const encMode = getEncumbranceMode();
  if (encMode !== "weight") return "";

  const inventory = FlagManager.getInventory(actor);
  const before = calculateEncumbrance(inventory, CatalogManager.getMap(), encMode);

  const after = structuredClone(inventory);
  after.coinsByZone ??= { equipped: { ...after.coins } };
  const purse = (after.coinsByZone.equipped ??= emptyCoins());
  for (const key of COIN_KEYS) purse[key] += coins[key];
  const afterEnc = calculateEncumbrance(after, CatalogManager.getMap(), encMode);

  // loadSpeed, not footSpeed or finalSpeed: the question is what this pile does
  // to what the character can carry. footSpeed also carries their hunger, and a
  // starving character already pinned at 10 ft would show no warning at all;
  // finalSpeed is clamped by whatever pack animal happens to be along.
  const label = `+${coinCount(coins)} wt → ${afterEnc.totalWeight} wt`;
  if (afterEnc.loadSpeed >= before.loadSpeed) return `<span class="loot-load ok">${label}</span>`;
  return `<span class="loot-load warn">⚠ ${label}, ${before.loadSpeed}→${afterEnc.loadSpeed} ft</span>`;
}

/** Wire up the Open button on the chat announcement. */
export function activateLootChatButtons(html: HTMLElement): void {
  html.querySelectorAll<HTMLElement>(".dw-open-loot").forEach((button) => {
    // Never wire the same button twice: a render hook that fires more than once
    // would otherwise make one click do its work twice over.
    if (button.dataset.dwWired === "1") return;
    button.dataset.dwWired = "1";
    // **The chat is not a door, for anybody** — Leander, 2026-08-28: *"Loot am
    // besten auch nicht mehr aus dem Chat öffnen... kann ganz raus."* A card is
    // the record of something that happened; a body is a place on a map, and it
    // is reached by going there.
    //
    // New cards carry no such button. This meets the ones already posted and
    // **takes the button off them** as they are re-rendered, rather than
    // leaving a control that answers a click with an apology.
    button.remove();
  });
}
