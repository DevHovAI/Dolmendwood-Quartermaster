import { noteHexStep, setDayContext } from "./data/dayContext";
import { MODULE_ID, SETTINGS, FLAGS, SOCKET_EVENTS, TRASH_LIMIT_DEFAULT } from "./constants";
import { registerHandlebarsHelpers, registerHandlebarsPartials, escapeHTML } from "./helpers/handlebars";
import { fitToViewport } from "./helpers/fitToViewport";
import { SocketHandler } from "./socket/SocketHandler";
import { PartyOverviewApp } from "./apps/PartyOverviewApp";
import { PlayerInventoryApp } from "./apps/PlayerInventoryApp";
import { CharacterSheetApp } from "./apps/CharacterSheetApp";
import { ShopApp } from "./apps/ShopApp";
import { InnApp } from "./apps/InnApp";
import { MarketApp } from "./apps/MarketApp";
import { openLootBrowser, openLootFromNote, activateLootChatButtons } from "./apps/LootApp";
import { openTrash } from "./apps/TrashApp";
import { syncDayBar, toggleDayBar, refreshDayBar } from "./apps/DayBarApp";
import { syncDayToWorldTime } from "./data/dayDuties";
import { activateEncounterChatButtons, ENCOUNTER_FOLDER } from "./data/dayRolls";
import { BookApp } from "./apps/BookApp";
import type { BookId } from "./data/books";
import { CatalogManager } from "./data/CatalogManager";
import { verifySharedActorOwnership, getSharedActorId } from "./data/sharedStore";
import { hexOf, tokenPoint, refusePlaceIfAway, canReachLoot } from "./data/partyPlace";
import { bookHexAt, followsToken } from "./data/hexGrid";
import { hexInfo } from "./data/hexes";
import { isLootActor, removeLootNotes } from "./data/lootStore";
import { INN_SECTIONS, DEFAULT_INN_NAME } from "./data/innData";
import type { InnQuality } from "./data/innData";
import type { ShopNoteFlag } from "./types";
import "../styles/module.css";

/**
 * Hooks.on for hook names that are not in fvtt-types' typed registry
 * (Foundry fires them, the type definitions just do not list them).
 *
 * The cast is applied to Hooks itself, not to Hooks.on: the implementation
 * reads private static fields through `this`, so detaching the method into a
 * variable would make `this` undefined and throw on the first call.
 */
function onUntypedHook(hook: string, fn: (...args: any[]) => unknown): number {
  const hooks = Hooks as unknown as {
    on(hook: string, fn: (...args: any[]) => unknown): number;
  };
  return hooks.on(hook, fn);
}

// ─── Module Initialization ────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Register world-scoped settings
  game.settings!.register(MODULE_ID, SETTINGS.SHOP_STATE, {
    name: "Shop State",
    hint: "Active tags and available items for the shop panel.",
    scope: "world",
    config: false,
    type: Object,
    default: { activeTags: [], availableItems: [] },
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, FLAGS.TRANSACTION_LOG, {
    name: "Transaction Log",
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  game.settings!.register(MODULE_ID, SETTINGS.INN_STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: { name: "", quality: "common" },
  });

  // Each inn's own copy of the book tables, keyed by inn name. Seeded on first
  // edit; absent means the inn still runs on the defaults for its quality.
  game.settings!.register(MODULE_ID, SETTINGS.INN_CONFIGS, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // In-game day. Bumping it re-rolls every inn's menu and clears the day's log,
  // which is what the GM's "New day" button does.
  game.settings!.register(MODULE_ID, SETTINGS.INN_DAY, {
    scope: "world",
    config: false,
    type: Number,
    default: 1,
  });

  game.settings!.register(MODULE_ID, SETTINGS.INN_DAY_LOG, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings!.register(MODULE_ID, SETTINGS.LOCAL_HIDDEN, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings!.register(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  // Services the Referee has written, kept apart from any one shop so the same
  // guide can be put on twelve shelves without being priced twelve times.
  game.settings!.register(MODULE_ID, SETTINGS.SERVICE_LIBRARY, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // One counter per shop. Bumping it re-rolls everything that shop stocks on an
  // X-in-6 chance — the shop's equivalent of the inn's new day.
  game.settings!.register(MODULE_ID, SETTINGS.SHOP_VISITS, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings!.register(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE, {
    name: "Encumbrance System",
    hint: "Slot Encumbrance tracks gear slots (equipped ≤10, stowed ≤16). Weight Encumbrance tracks total item weight in coins (max 1,600).",
    scope: "world",
    config: true,
    type: String,
    choices: {
      slots: "Slot Encumbrance (default)",
      weight: "Weight Encumbrance",
    },
    default: "slots",
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // ID of the actor holding shared party containers; "" until one is created
  game.settings!.register(MODULE_ID, SETTINGS.SHARED_ACTOR_ID, {
    scope: "world",
    config: false,
    type: String,
    default: "",
  });

  // Per-user view preference — one player folding away a cached stash should
  // not fold it away for everyone else
  game.settings!.register(MODULE_ID, SETTINGS.HIDE_DROPPED_ZONES, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });

  // The shared store and every released loot box must be owned by all players so
  // they can write to them, which also lands them in the Actors tab. They are
  // reached through the module's own windows, so hiding the sidebar entries costs
  // nothing — but it is a setting, because an actor vanishing from the sidebar
  // with no visible switch is baffling when something goes wrong.
  game.settings!.register(MODULE_ID, SETTINGS.HIDE_MANAGED_ACTORS, {
    name: "Hide Quartermaster actors from the sidebar",
    hint: "Keeps the shared Party Stores actor and all loot boxes out of the Actors tab, for the GM as well. They stay reachable: the shared store has its own card in the Party Overview, and every loot box is listed in the Loot window. Turn this off to get the sidebar entries back.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // Which of the module's toolbar buttons players get. The GM's own toolbar is
  // never affected, so these only ever decide what the players see.
  //
  // onChange re-renders the scene controls: the button list is built once when
  // the controls render, so without it the change would only show up after a
  // scene switch — which reads as the setting not working.
  game.settings!.register(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_INN, {
    name: "Players may open the Inn from the toolbar",
    hint: "Off by default. The toolbar inn is the generic, place-less one — its quality and menu are whatever was last set up, and a player buying there pays real coins for a bed at an inn that does not exist on the map. Every actual inn is reached by double-clicking its map note. Turn this on if you want players to reach the generic inn anyway.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => (ui as unknown as { controls?: { render: () => void } }).controls?.render(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_LOOT, {
    name: "Players may open Loot from the toolbar",
    hint: "On by default. Players only ever see boxes that have been released, and it is the one route back into a half-divided hoard that does not depend on the map pin being visible or the chat message still being on screen.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => (ui as unknown as { controls?: { render: () => void } }).controls?.render(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_TRASH, {
    name: "Players may open the Trash from the toolbar",
    hint: "On by default. Players only ever see what they deleted themselves, and they cannot restore or empty anything — that stays with the GM. Being able to look is what lets a player say which item they lost.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => (ui as unknown as { controls?: { render: () => void } }).controls?.render(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // ── Where the shops are, and who may reach them ────────────────────────────

  game.settings!.register(MODULE_ID, SETTINGS.PLAYER_GENERIC_SHOP, {
    name: "Players may open the general shop from the toolbar",
    hint: "Off by default. The general shop is the place-less one — it belongs to no map note, so it can be neither a specialist nor a buyer, and it is reachable from anywhere at any time. With this off, players buy where the party is standing and the map notes are what a shop means. The GM keeps the button either way.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => (ui as unknown as { controls?: { render: () => void } }).controls?.render(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.PLAYER_ADD_CUSTOM_ITEM, {
    name: "Players may invent items in their own inventory",
    hint: "On by default, which is how it has always worked. The Add Custom Item button lets a player write a line into their own sheet — name, weight and all — without asking anyone. Turn it off for a table where everything should come from the catalogue, a shop, or the GM's hand. The GM's own Add Item button is not affected.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.SHOPS_NEED_PARTY_PRESENT, {
    name: "Places open only where the party is standing",
    hint: "On by default. A player may open a shop, market, inn or loot note only if the party's token is in the same hex on a hex map, or simply on the same scene where there is no hex grid — a village map, say. The GM is never restricted. Turn this off to let players open any of them from anywhere, as before.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.PARTY_MARKER_ACTOR, {
    name: "The party's marker on the map",
    hint: "The name of the actor whose token stands for the party while travelling. Leave this empty and every party character's own token counts instead — which is what you want if you move the characters individually. Name a marker here if the party travels as one token that belongs to no player, since such a token is otherwise invisible to the module.",
    scope: "world",
    config: true,
    type: String,
    default: "",
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.TRASH_LIMIT, {
    name: "Trash size (per inventory)",
    hint: "How many deleted rows each character, loot box and the shared store keeps before the oldest fall out. This is an undo buffer, not an archive. Set it to 0 to switch the trash off entirely — deleting is then final again, as it was before.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 100, step: 5 },
    default: TRASH_LIMIT_DEFAULT,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // The three books, as files the Referee points at once.
  //
  // Nothing of the books is shipped with the module — only the references. A
  // path here turns every "Monster Book p12" on a card into a click that opens
  // the reader's own copy at that page, in Foundry's own PDF reader. The file
  // has to live inside Foundry's data folder: a browser can only fetch what the
  // server hands out, so a path to somewhere else on the disk cannot work. Set
  // once by the GM, it serves every player at the table.
  const bookHint =
    "A PDF inside Foundry's data folder (upload it with the file picker). Page references on the module's cards then open your own copy at the right page. Nothing of the book is stored in the module.";
  (
    [
      [SETTINGS.BOOK_PLAYERS, "Player's Book (PDF)"],
      [SETTINGS.BOOK_CAMPAIGN, "Campaign Book (PDF)"],
      [SETTINGS.BOOK_MONSTERS, "Monster Book (PDF)"],
    ] as const
  ).forEach(([key, name]) => {
    game.settings!.register(MODULE_ID, key, {
      name,
      hint: bookHint,
      scope: "world",
      config: true,
      type: String,
      default: "",
      filePicker: "any",
    } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);
  });

  // The Player's Book is the players' own book; the other two are the
  // Referee's, and a player who can open the Monster Book can read the lair and
  // the treasure of the thing they just met. Default is the honest one.
  // A window that opens itself is a window somebody has to close. It was
  // unconditional for a long time, from before the bar existed; now that the
  // bar carries the shortcut, opening it uninvited is a preference rather than
  // a service, and the default is to leave the screen alone.
  game.settings!.register(MODULE_ID, SETTINGS.AUTO_OPEN_INVENTORY, {
    name: "Open a player's inventory when they log in",
    hint: "Off by default. When on, a player with a character assigned gets their inventory window thrown open as Foundry finishes loading. With the day bar on there is a backpack button on it either way, so this is only about saving the first click.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // The players' half of the bar: the day, the mode, what the party has walked,
  // the weather once it is known, and their own character's hunger and rest.
  // None of the Referee's half — no duty ticks, no hex, no page references.
  game.settings!.register(MODULE_ID, SETTINGS.PLAYER_DAY_BAR, {
    name: "Players get a day bar of their own",
    hint: "A slimmer strip carrying only what the characters would know: the day and what the party is doing, Travel Points walked, the weather once the GM has rolled it, and each player's own hunger and rest clocks. The duty list, the hex, the region and every page reference stay with the GM. Each player still switches their own bar on from the toolbar.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => (ui as unknown as { controls?: { render: () => void } }).controls?.render(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // Everything through one door. Off by default, because the bar can be folded
  // away or switched off and the toolbar is then the only way back in.
  game.settings!.register(MODULE_ID, SETTINGS.BAR_ONLY_ACCESS, {
    name: "Reach the module's windows from the day bar only",
    hint: "Takes the Inn, Loot and Trash buttons off the scene toolbar for anyone who has the day bar, since the bar carries the same shortcuts. The button that shows and hides the bar itself always stays — without it there would be no way back.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => (ui as unknown as { controls?: { render: () => void } }).controls?.render(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.BOOKS_FOR_PLAYERS, {
    name: "Which books players may open",
    hint: "Page references are printed for everyone, but only the GM opens the Campaign and Monster Books by default — those two give away lairs, hoards and what lives in the next hex. A reference a player may not open stays on the card as plain text.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      none: "None — the GM only",
      players: "The Player's Book only (default)",
      all: "All three",
    },
    default: "players",
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.BOOK_PAGE_OFFSET, {
    name: "Book page offset",
    hint: "How far the PDF's page numbering runs ahead of the printed page numbers. All three Dolmenwood books carry two pages of front matter that the printed numbering does not count, so printed p152 is the PDF's page 154 — leave this at 2 unless a reference lands short.",
    scope: "world",
    config: true,
    type: Number,
    range: { min: -10, max: 20, step: 1 },
    default: 2,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // Off by default, and deliberately: it does nothing at all until a map has
  // been calibrated, and a switch that silently needs a second step is worse
  // than one the Referee turns on when they have taken the measurement.
  game.settings!.register(MODULE_ID, SETTINGS.HEX_FROM_TOKEN, {
    name: "Read the hex off the party's token",
    hint: "Once a map has been calibrated — stand the token in a hex you know and press the crosshairs beside the Hex box on the day bar — moving the token sets the hex on the bar by itself, with the terrain and region the book gives it, and brings up the hex briefing. Leave this off and the module only warns that a token has crossed a hex boundary, which is what it did before.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.HEX_CALIBRATION, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.DAY_STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: { day: 1, mode: "travel", done: {}, travelDaysSinceRest: 0 },
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // Sticky on purpose: a party in the High Wold is still there tomorrow, and
  // being asked for the season every morning would be worse than no rolls at all.
  game.settings!.register(MODULE_ID, SETTINGS.DAY_CONTEXT, {
    scope: "world",
    config: false,
    type: Object,
    default: {
      season: "autumn",
      terrain: "tangled-forest",
      way: "track",
      region: "high-wold",
      settlement: "elsewhere",
    },
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // On by default now: the bar is where the day is run from, and for a player
  // it is the only thing the module puts on screen. A client that has already
  // switched it off keeps its own answer — this decides what a new one starts
  // with.
  game.settings!.register(MODULE_ID, SETTINGS.SHOW_DAY_BAR, {
    scope: "client",
    config: false,
    type: Boolean,
    default: true,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.DAY_BAR_COLLAPSED, {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  game.settings!.register(MODULE_ID, SETTINGS.FOLLOW_WORLD_TIME, {
    name: "Tie the day counter to the world clock",
    hint: "Off by default, and it works both ways when on. The world clock passing into a new day moves the counter on, re-rolling the inn menus and the day's duties; and the bar's own ▶ pushes the clock forward to 7:00 the next morning. Built on core's world time rather than any one module's API, so it works with Simple Calendar, SmallTime, about-time or Foundry's own controls alike. However far the clock jumps, the counter only ever advances one day.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => void syncDayToWorldTime(),
  } as Parameters<NonNullable<typeof game.settings>["register"]>[2]);

  // Register Handlebars helpers (synchronous)
  registerHandlebarsHelpers();

  // ─── Note double-click interception ──────────────────────────────────────
  // Must be in "init" (not "ready") so the patch is in place before any canvas
  // renders. The activateNote hook is never called for notes with no linked
  // journal entry, so a prototype patch is the only reliable approach.
  // Use foundry.canvas.placeables.Note — the global Note is deprecated in v13.
  const NoteClass = (foundry as any).canvas?.placeables?.Note as { prototype: { _onClickLeft2?: (event: Event) => unknown } } | undefined;
  if (NoteClass?.prototype && typeof NoteClass.prototype._onClickLeft2 === "function") {
    const _origClick = NoteClass.prototype._onClickLeft2;
    NoteClass.prototype._onClickLeft2 = function(
      this: { document?: { getFlag?: (m: string, k: string) => unknown } },
      event: Event
    ): unknown {
      const getFlag = (key: string) => this.document?.getFlag?.(MODULE_ID, key);
      // A shop is a place: a player reaches one only where the party stands.
      const doc = this.document as Parameters<typeof refusePlaceIfAway>[0];
      const marketFlag = getFlag("market") as { name?: string } | undefined;
      if (marketFlag) {
        if (refusePlaceIfAway(doc, marketFlag.name ?? "That market")) return;
        openMarket(this.document as { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> }); return;
      }
      const innFlag = getFlag("inn") as { name?: string; quality?: InnQuality; categories?: string[]; priceFactor?: number } | undefined;
      if (innFlag) {
        if (refusePlaceIfAway(doc, innFlag.name ?? "That inn")) return;
        openInn(innFlag.name, innFlag.quality, innFlag.categories, innFlag.priceFactor); return;
      }
      const shopFlag = getFlag("shop") as ShopNoteFlag | undefined;
      if (shopFlag) {
        if (refusePlaceIfAway(doc, shopFlag.name ?? "That shop")) return;
        openShop(shopFlag.name, shopFlag.categories ?? [], shopFlag.priceFactor, shopFlag.ownStockOnly, shopFlag.buyBackRate); return;
      }
      const lootFlag = getFlag("loot") as true | { name?: string } | undefined;
      if (lootFlag) {
        const lootName = typeof lootFlag === "object" ? lootFlag.name : undefined;
        // A body is reached by standing *next* to it, not on it, so loot has a
        // rule of its own — see `canReachLoot`. `openLootBox` asks the same
        // question again behind this one; the check here only saves opening a
        // journal entry the player is about to be refused anyway.
        const reach = canReachLoot(doc);
        if (!reach.ok) {
          ui.notifications?.warn(`${lootName ?? "That hoard"} is out of reach. ${reach.reason}`);
          return;
        }
        void openLootFromNote(this.document as Parameters<typeof openLootFromNote>[0]); return;
      }
      return _origClick.call(this, event);
    };
  }
});

Hooks.once("ready", async () => {
  console.log(`${MODULE_ID} | Ready`);

  // Load Handlebars partials
  await registerHandlebarsPartials();

  // Initialize socket handler
  SocketHandler.initialize();

  // Players can only write to the shared store while it is owned by everyone
  await verifySharedActorOwnership();

  // Expose module API on the module object for macro access
  const mod = (game as Game).modules.get(MODULE_ID);
  if (mod) {
    (mod as ModuleData & { api: unknown }).api = {
      openPartyOverview: () => openPartyOverview(),
      openPlayerInventory: (actorOrId?: Actor | string) => openPlayerInventory(actorOrId),
      openShop: (name?: string, categories?: string[], priceFactor?: number, ownStockOnly?: boolean, buyBackRate?: number) =>
        openShop(name, categories, priceFactor, ownStockOnly, buyBackRate),
      openInn: (name?: string, quality?: InnQuality, categories?: string[], priceFactor?: number) => openInn(name, quality, categories, priceFactor),
      openMarket: (noteDoc: { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> }) => openMarket(noteDoc),
      openLoot: () => openLootBrowser(),
      openTrash: () => openTrash(),
      toggleDayBar: () => toggleDayBar(),
      // Every page reference the module prints is a click, and this is the same
      // door for anything outside it: a journal button, a macro, another module.
      openBook: (book: BookId, page: number) => BookApp.open(book, page),
    };
  }

  // A GM who left the bar on last session gets it back straight away.
  syncDayBar();

  // Adopt the world clock's current day without advancing anything, so the
  // first midnight after this is a real change rather than a false one.
  void syncDayToWorldTime();

  /**
   * Any calendar or clock module worth the name advances core's world time, and
   * core fires this when it does — so one hook covers Simple Calendar, SmallTime,
   * about-time and Foundry's own controls alike, with no dependency on any of them.
   *
   * Debounced, because clicking an hour forward half a dozen times in a row fires
   * this half a dozen times. Only where the clock comes to rest matters, and
   * evaluating the intermediate steps is what made a burst of clicks skip several
   * days at once.
   */
  const onWorldTimeChange = foundry.utils.debounce(() => {
    void syncDayToWorldTime().then(() => refreshDayBar());
  }, 500);
  Hooks.on("updateWorldTime", () => onWorldTimeChange());

  // ─── Note / Map Marker Hooks ───────────────────────────────────────────────

  // Cache of pending flag values keyed on the app instance.
  // Updated on every input change; read by closeNoteConfig (which fires without HTML in v13).
  type PendingNoteFlags = { inn?: { name: string; quality: InnQuality; categories: string[]; priceFactor: number } | false; shop?: { name: string; categories: string[]; priceFactor: number; ownStockOnly: boolean; buyBackRate: number } | false; market?: { name: string } | false; loot?: { name: string } | false };
  const pendingNoteFlags = new WeakMap<object, PendingNoteFlags>();

  // v13 ApplicationV2 passes an HTMLElement as the second arg; old Application passed jQuery.
  function toNoteEl(htmlOrEl: unknown): HTMLElement {
    if (htmlOrEl instanceof HTMLElement) return htmlOrEl;
    if (htmlOrEl && typeof (htmlOrEl as { get?: (n: number) => HTMLElement }).get === "function") {
      return (htmlOrEl as { get: (n: number) => HTMLElement }).get(0);
    }
    return htmlOrEl as HTMLElement;
  }

  Hooks.on("renderNoteConfig", (app: object, htmlOrEl: unknown) => {
    const el = toNoteEl(htmlOrEl);
    const note = (app as { document?: { getFlag?: (m: string, k: string) => unknown } }).document;

    // ── Inn fieldset ──────────────────────────────────────────────────────────
    const existingInn = note?.getFlag?.(MODULE_ID, "inn") as { name?: string; quality?: InnQuality; categories?: string[]; priceFactor?: number } | undefined;
    const isInn = !!existingInn;
    const innName = existingInn?.name ?? "";
    const innQuality = existingInn?.quality ?? "common";
    const savedInnCats = existingInn?.categories ?? [];
    const innPriceFactor = existingInn?.priceFactor ?? 100;
    const innCategoryCheckboxes = INN_SECTIONS
      .map((cat) => {
        const checked = savedInnCats.includes(cat.key) ? "checked" : "";
        return `<label class="qm-note-cat">
          <input type="checkbox" class="note-inn-cat" value="${escapeHTML(cat.key)}" ${checked} /> ${escapeHTML(cat.label)}
        </label>`;
      })
      .join("");

    // Markup follows Foundry's own `standard-form` convention — a label, a
    // `.form-fields` box holding the control, and the hint as a `p.hint`. Core
    // lays a `.form-group` out as a flex ROW, so anything dropped in beside the
    // label as a sibling ends up in the same row and the whole form reads as
    // shoved about. That is what these looked like before.
    const innHtml = `
      <fieldset class="qm-note-fieldset">
        <legend>Quartermaster Inn</legend>
        <div class="form-group">
          <label for="note-is-inn">Mark as Inn</label>
          <div class="form-fields">
            <input type="checkbox" id="note-is-inn" ${isInn ? "checked" : ""} />
          </div>
        </div>
        <div id="note-inn-fields" class="qm-note-body" style="${isInn ? "" : "display:none;"}">
          <div class="form-group">
            <label for="note-inn-name">Inn Name</label>
            <div class="form-fields">
              <input type="text" id="note-inn-name" value="${escapeHTML(innName)}" placeholder="e.g. The Silver Stag" />
            </div>
          </div>
          <div class="form-group">
            <label for="note-inn-quality">Quality</label>
            <div class="form-fields">
              <select id="note-inn-quality">
                <option value="poor" ${innQuality === "poor" ? "selected" : ""}>Poor</option>
                <option value="common" ${innQuality === "common" ? "selected" : ""}>Common</option>
                <option value="fancy" ${innQuality === "fancy" ? "selected" : ""}>Fancy</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="note-inn-price-factor">Price factor</label>
            <div class="form-fields">
              <input type="number" id="note-inn-price-factor" value="${innPriceFactor}" min="1" max="10000" step="1" />
            </div>
            <p class="hint">Per cent of the book price. 100 is normal, 200 is double.</p>
          </div>
          <div class="form-group">
            <label>Sections served</label>
            <div class="form-fields qm-note-cats">${innCategoryCheckboxes}</div>
            <p class="hint">Leave every box unticked to serve all of them.</p>
          </div>
        </div>
      </fieldset>`;

    // ── Shop fieldset ─────────────────────────────────────────────────────────
    const existingShop = note?.getFlag?.(MODULE_ID, "shop") as ShopNoteFlag | undefined;
    const isShop = !!existingShop;
    const shopName = existingShop?.name ?? "";
    const savedCats = existingShop?.categories ?? [];
    const shopPriceFactor = existingShop?.priceFactor ?? 100;
    const shopOwnStock = existingShop?.ownStockOnly ?? false;
    const shopBuyBack = existingShop?.buyBackRate ?? 0;
    // Only the categories a shop can actually sell from are offered. The other
    // thirteen are the Campaign Book's treasure, where every entry is marked
    // not-for-sale — and a shop strips `notSold` *before* it reads this list, so
    // ticking one of those did precisely nothing. A potion reaches a particular
    // shelf through **From Catalogue** in the shop window, which ignores the
    // flag on purpose, and that is the only way it ever worked.
    const { sold: soldCats } = CatalogManager.getCategoriesBySale();
    const catBox = (cat: string): string => {
      const checked = savedCats.includes(cat) ? "checked" : "";
      return `<label class="qm-note-cat">
        <input type="checkbox" class="note-shop-cat" value="${escapeHTML(cat)}" ${checked} /> ${escapeHTML(cat)}
      </label>`;
    };
    const categoryCheckboxes = soldCats.map(catBox).join("");

    const shopHtml = `
      <fieldset class="qm-note-fieldset">
        <legend>Quartermaster Shop</legend>
        <div class="form-group">
          <label for="note-is-shop">Mark as Shop</label>
          <div class="form-fields">
            <input type="checkbox" id="note-is-shop" ${isShop ? "checked" : ""} />
          </div>
        </div>
        <div id="note-shop-fields" class="qm-note-body" style="${isShop ? "" : "display:none;"}">
          <div class="form-group">
            <label for="note-shop-name">Shop Name</label>
            <div class="form-fields">
              <input type="text" id="note-shop-name" value="${escapeHTML(shopName)}" placeholder="e.g. The Blacksmith" />
            </div>
          </div>
          <div class="form-group">
            <label for="note-shop-price-factor">Price factor</label>
            <div class="form-fields">
              <input type="number" id="note-shop-price-factor" value="${shopPriceFactor}" min="1" max="10000" step="1" />
            </div>
            <p class="hint">Per cent of the book price. 100 is normal, 200 is double.</p>
          </div>
          <div class="form-group">
            <label for="note-shop-buy-back">Buys back at</label>
            <div class="form-fields">
              <input type="number" id="note-shop-buy-back" value="${shopBuyBack}" min="0" max="200" step="5" />
            </div>
            <p class="hint">Per cent of what a thing is worth, not of this shop's asking price. 50 for used gear, 80 for a jeweller's gems, 0 to buy nothing.</p>
          </div>
          <div class="form-group">
            <label for="note-shop-own-stock">Sells only its own stock</label>
            <div class="form-fields">
              <input type="checkbox" id="note-shop-own-stock" ${shopOwnStock ? "checked" : ""} />
            </div>
            <p class="hint">The cheesemonger, the pipe carver, the magicians' guild: nothing from the catalogue, only what you put on this shop's shelf yourself. The categories below are then ignored.</p>
          </div>
          <div class="form-group">
            <label>Categories sold</label>
            <div class="form-fields qm-note-cats">${categoryCheckboxes}</div>
            <p class="hint">Leave every box unticked to sell the whole catalogue. Treasures are never on a shelf by category — put one there with <strong>From Catalogue</strong> inside the shop.</p>
          </div>
        </div>
      </fieldset>`;

    // ── Market fieldset ───────────────────────────────────────────────────────
    const existingMarket = note?.getFlag?.(MODULE_ID, "market") as { name?: string } | undefined;
    const isMarket = !!existingMarket;
    const marketName = existingMarket?.name ?? "";
    const marketHtml = `
      <fieldset class="qm-note-fieldset">
        <legend>Quartermaster Market</legend>
        <div class="form-group">
          <label for="note-is-market">Mark as Market</label>
          <div class="form-fields">
            <input type="checkbox" id="note-is-market" ${isMarket ? "checked" : ""} />
          </div>
        </div>
        <div id="note-market-fields" class="qm-note-body" style="${isMarket ? "" : "display:none;"}">
          <div class="form-group">
            <label for="note-market-name">Market Name</label>
            <div class="form-fields">
              <input type="text" id="note-market-name" value="${escapeHTML(marketName)}" placeholder="e.g. The Grand Bazaar" />
            </div>
            <p class="hint">Add its shops and inns by opening the market once this note is saved.</p>
          </div>
        </div>
      </fieldset>`;

    // ── Loot fieldset ─────────────────────────────────────────────────────────
    // The note's loot name identifies the box, so the actor is created on the
    // first double-click rather than here — a note marked and never opened
    // leaves nothing behind.
    const existingLoot = note?.getFlag?.(MODULE_ID, "loot") as { name?: string } | undefined;
    const isLoot = !!existingLoot;
    const lootName = existingLoot?.name ?? "";
    // A note with no linked journal entry does not work as a marker at all: it
    // never reaches the double-click handler, and players cannot see it either,
    // because Foundry ties note visibility to journal-entry permission. Verified
    // the hard way — linking an entry made both work at once.
    const hasEntry = !!(note as { entryId?: string | null } | undefined)?.entryId;
    const lootEntryWarning = hasEntry
      ? ""
      : `<p class="notification warning qm-note-warning">
           This note has no journal entry, so it will not open anything and players
           cannot see it. Link a blank journal entry — releasing the box then grants
           the party access to it automatically.
         </p>`;
    const lootHtml = `
      <fieldset class="qm-note-fieldset">
        <legend>Quartermaster Loot</legend>
        <div class="form-group">
          <label for="note-is-loot">Mark as Loot Box</label>
          <div class="form-fields">
            <input type="checkbox" id="note-is-loot" ${isLoot ? "checked" : ""} />
          </div>
        </div>
        <div id="note-loot-fields" class="qm-note-body" style="${isLoot ? "" : "display:none;"}">
          <div class="form-group">
            <label for="note-loot-name">Box Name</label>
            <div class="form-fields">
              <input type="text" id="note-loot-name" value="${escapeHTML(lootName)}" placeholder="e.g. Barrow Hoard" />
            </div>
            <p class="hint">The box is made when you first open it, and stays hidden from players until you release it.</p>
          </div>
          ${lootEntryWarning}
        </div>
      </fieldset>`;

    // Inject before footer
    const footer = el.querySelector("footer");
    if (!footer) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = innHtml + shopHtml + marketHtml + lootHtml;
    footer.before(wrapper);

    /**
     * Fit the sheet to what is now inside it — without walking off the screen.
     *
     * Two facts decide this. Foundry measures a note config's height once, when
     * it renders, and these four fieldsets are added afterwards; and NoteConfig
     * is an ApplicationV2, whose `.window-content` is `overflow: hidden`, so
     * nothing inside it scrolls on its own. Growing the window is therefore the
     * only way the added fields become visible — and growing it without a limit
     * pushes the footer, and with it the Create button, off the bottom of the
     * screen where nothing can scroll it back.
     *
     * So: grow to fit while it fits, and once it would not, cap the window at
     * the viewport and hand the overflow to the injected block, which gets a
     * scrollbar of its own. The footer stays a sibling *below* that block and
     * is always reachable.
     */
    const resize = (): void => {
      const sheet = app as { setPosition?: (p: { height: number | string }) => void };
      const root = (el.closest(".application") ?? el) as HTMLElement;
      const content = root.querySelector<HTMLElement>(".window-content");

      // Measure unconstrained first: a fold that was just closed should give
      // its height back rather than leave the block scrolling forever.
      wrapper.style.maxHeight = "";
      wrapper.style.overflowY = "";
      if (content) content.style.overflowY = "";
      sheet.setPosition?.({ height: "auto" });

      const fit = fitToViewport(root.offsetHeight, wrapper.offsetHeight, window.innerHeight);
      if (fit.windowHeight === null) return;

      wrapper.style.maxHeight = `${fit.blockMaxHeight}px`;
      wrapper.style.overflowY = "auto";
      wrapper.style.paddingRight = "4px";

      // Belt and braces. If the sheet's own fields already fill the screen, the
      // block hits its floor and the window is still too tall — so the content
      // area is allowed to scroll as well. V2 sets it to `hidden`, which is what
      // makes an over-tall note config unscrollable in the first place.
      if (content && fit.contentMustScroll) content.style.overflowY = "auto";

      sheet.setPosition?.({ height: fit.windowHeight });
    };
    resize();

    // The sheet is measured against the viewport, so a resized browser window
    // has to be measured again — otherwise a form that fitted at full screen
    // keeps a height taller than the screen it is now on.
    //
    // Taken off again when this particular sheet closes. A listener added on
    // every render and never removed is one more on the window each time a
    // note is opened, for as long as the world stays loaded.
    const onViewportResize = (): void => resize();
    window.addEventListener("resize", onViewportResize);
    const hooks = Hooks as unknown as {
      on(hook: string, fn: (...a: any[]) => unknown): number;
      off(hook: string, id: number): void;
    };
    const closeId = hooks.on("closeNoteConfig", (closed: object) => {
      if (closed !== app) return;
      window.removeEventListener("resize", onViewportResize);
      hooks.off("closeNoteConfig", closeId);
    });

    // Toggle visibility on checkbox change. Each of these opens or closes a
    // block several fields tall, so the sheet has to be re-measured after it.
    el.querySelector("#note-is-inn")?.addEventListener("change", function (this: HTMLInputElement) {
      (el.querySelector("#note-inn-fields") as HTMLElement).style.display =
        this.checked ? "" : "none";
      resize();
    });
    el.querySelector("#note-is-shop")?.addEventListener("change", function (this: HTMLInputElement) {
      (el.querySelector("#note-shop-fields") as HTMLElement).style.display =
        this.checked ? "" : "none";
      resize();
    });
    el.querySelector("#note-is-loot")?.addEventListener("change", function (this: HTMLInputElement) {
      (el.querySelector("#note-loot-fields") as HTMLElement).style.display =
        this.checked ? "" : "none";
      resize();
    });
    el.querySelector("#note-is-market")?.addEventListener("change", function (this: HTMLInputElement) {
      (el.querySelector("#note-market-fields") as HTMLElement).style.display =
        this.checked ? "" : "none";
      resize();
    });

    // `toggle` does not bubble, so every fold is wired by hand rather than
    // through one listener on the form.
    el.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", resize));

    // Helper: read current field values from the DOM into the WeakMap cache.
    // Called on every input change so closeNoteConfig can save without the HTML.
    const readFlags = (): PendingNoteFlags => {
      const flags: PendingNoteFlags = {};

      const innChecked = (el.querySelector("#note-is-inn") as HTMLInputElement | null)?.checked ?? false;
      if (innChecked) {
        const name = ((el.querySelector("#note-inn-name") as HTMLInputElement | null)?.value ?? "").trim() || DEFAULT_INN_NAME;
        const quality = ((el.querySelector("#note-inn-quality") as HTMLSelectElement | null)?.value ?? "common") as InnQuality;
        const categories: string[] = [];
        el.querySelectorAll<HTMLInputElement>(".note-inn-cat:checked").forEach((cb) => categories.push(cb.value));
        const priceFactor = Math.max(1, parseInt((el.querySelector("#note-inn-price-factor") as HTMLInputElement | null)?.value ?? "100", 10) || 100);
        flags.inn = { name, quality, categories, priceFactor };
      } else {
        flags.inn = false; // explicitly unset
      }

      const shopChecked = (el.querySelector("#note-is-shop") as HTMLInputElement | null)?.checked ?? false;
      if (shopChecked) {
        const name = ((el.querySelector("#note-shop-name") as HTMLInputElement | null)?.value ?? "").trim() || "Shop";
        const categories: string[] = [];
        el.querySelectorAll<HTMLInputElement>(".note-shop-cat:checked").forEach((cb) => categories.push(cb.value));
        const priceFactor = Math.max(1, parseInt((el.querySelector("#note-shop-price-factor") as HTMLInputElement | null)?.value ?? "100", 10) || 100);
        const ownStockOnly = (el.querySelector("#note-shop-own-stock") as HTMLInputElement | null)?.checked ?? false;
        const buyBackRate = Math.max(0, parseInt((el.querySelector("#note-shop-buy-back") as HTMLInputElement | null)?.value ?? "0", 10) || 0);
        flags.shop = { name, categories, priceFactor, ownStockOnly, buyBackRate };
      } else {
        flags.shop = false;
      }

      const marketChecked = (el.querySelector("#note-is-market") as HTMLInputElement | null)?.checked ?? false;
      if (marketChecked) {
        const name = ((el.querySelector("#note-market-name") as HTMLInputElement | null)?.value ?? "").trim() || "Market";
        flags.market = { name };
      } else {
        flags.market = false;
      }

      const lootChecked = (el.querySelector("#note-is-loot") as HTMLInputElement | null)?.checked ?? false;
      if (lootChecked) {
        const name = ((el.querySelector("#note-loot-name") as HTMLInputElement | null)?.value ?? "").trim() || "Loot";
        flags.loot = { name };
      } else {
        flags.loot = false;
      }

      return flags;
    };

    // Seed with initial values so closeNoteConfig works even if nothing is changed
    pendingNoteFlags.set(app, readFlags());

    // Keep cache fresh on every user interaction
    el.addEventListener("change", () => pendingNoteFlags.set(app, readFlags()));
    el.addEventListener("input",  () => pendingNoteFlags.set(app, readFlags()));
  });

  // Save flags when the Note config closes.
  // closeNoteConfig fires with (app, options) in v13 — no HTML, but we have the WeakMap cache.
  Hooks.on("closeNoteConfig", async (app: object) => {
    const flags = pendingNoteFlags.get(app);
    if (!flags) return;
    const note = (app as { document?: { setFlag?: (m: string, k: string, v: unknown) => Promise<void>; unsetFlag?: (m: string, k: string) => Promise<void> } }).document;
    if (!note?.setFlag || !note?.unsetFlag) return;

    if (flags.inn) await note.setFlag(MODULE_ID, "inn", flags.inn);
    else if (flags.inn === false) await note.unsetFlag(MODULE_ID, "inn");

    if (flags.shop) await note.setFlag(MODULE_ID, "shop", flags.shop);
    else if (flags.shop === false) await note.unsetFlag(MODULE_ID, "shop");

    if (flags.market) {
      // Preserve existing entries when renaming; only name is edited in the config dialog
      const existing = (note as { getFlag?: (m: string, k: string) => unknown }).getFlag?.(MODULE_ID, "market") as { entries?: unknown[] } | undefined;
      await note.setFlag(MODULE_ID, "market", { name: flags.market.name, entries: existing?.entries ?? [] });
    } else if (flags.market === false) {
      await note.unsetFlag(MODULE_ID, "market");
    }

    // Unmarking a note never deletes the loot actor — the hoard outlives the pin.
    // The recorded actorId is preserved across a rename, the same way the market
    // keeps its entries: only the name is editable in this dialog.
    if (flags.loot) {
      const existingLoot = (note as { getFlag?: (m: string, k: string) => unknown }).getFlag?.(MODULE_ID, "loot") as { actorId?: string } | undefined;
      const lootFlag: { name: string; actorId?: string } = { name: flags.loot.name };
      if (existingLoot?.actorId) lootFlag.actorId = existingLoot.actorId;
      await note.setFlag(MODULE_ID, "loot", lootFlag);
    } else if (flags.loot === false) {
      await note.unsetFlag(MODULE_ID, "loot");
    }

    pendingNoteFlags.delete(app);
  });

  // Intercept Note click — open InnApp or ShopApp if the note is flagged.
  // In v13 the hook arg may be the NoteDocument directly OR a Note placeable —
  // we try getFlag on both to handle either case.
  // Hook name "activateNote" covers v11–v13; if it still doesn't fire, also try "clickNote".
  // Returns false to cancel the default note behaviour, true to let it continue.
  const handleNoteClick = (noteOrDoc: unknown): boolean => {
    const asDoc = noteOrDoc as { getFlag?: (m: string, k: string) => unknown; document?: { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> } };
    // Try direct getFlag first (NoteDocument), then .document.getFlag (Note placeable)
    const getFlag = (key: string) =>
      asDoc.getFlag?.(MODULE_ID, key) ?? asDoc.document?.getFlag?.(MODULE_ID, key);

    // Same gate as the _onClickLeft2 override above — this is the other door
    // into the same rooms, and a rule enforced at only one of them is no rule.
    const placeDoc = (asDoc.document ?? asDoc) as Parameters<typeof refusePlaceIfAway>[0];

    const marketData = getFlag("market") as { name?: string } | undefined;
    if (marketData) {
      if (refusePlaceIfAway(placeDoc, marketData.name ?? "That market")) return false;
      const doc = (asDoc.document ?? asDoc) as { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> };
      openMarket(doc);
      return false;
    }

    const innData = getFlag("inn") as { name?: string; quality?: InnQuality; categories?: string[]; priceFactor?: number } | undefined;
    if (innData) {
      if (refusePlaceIfAway(placeDoc, innData.name ?? "That inn")) return false;
      openInn(innData.name, innData.quality, innData.categories, innData.priceFactor); return false;
    }

    const shopData = getFlag("shop") as ShopNoteFlag | undefined;
    if (shopData) {
      if (refusePlaceIfAway(placeDoc, shopData.name ?? "That shop")) return false;
      openShop(shopData.name, shopData.categories ?? [], shopData.priceFactor, shopData.ownStockOnly, shopData.buyBackRate); return false;
    }

    const lootData = getFlag("loot") as true | { name?: string } | undefined;
    if (lootData) {
      const lootName = typeof lootData === "object" ? lootData.name : undefined;
      if (refusePlaceIfAway(placeDoc, lootName ?? "That hoard")) return false;
      const doc = (asDoc.document ?? asDoc) as Parameters<typeof openLootFromNote>[0];
      void openLootFromNote(doc);
      return false;
    }
    return true;
  };

  // Keep activateNote/clickNote as fallbacks for future Foundry versions that may fix the hook.
  // In v13, they never fire for notes without a linked journal entry (handled in "init" above).
  // clickNote is not part of the typed hook registry, hence onUntypedHook.
  Hooks.on("activateNote", handleNoteClick);
  onUntypedHook("clickNote", handleNoteClick);

  // A player's own inventory, thrown open on login — only where the table has
  // asked for it. See the setting's own note.
  const g = game as Game;
  if (
    !g.user?.isGM &&
    g.user?.character &&
    g.settings.get(MODULE_ID, SETTINGS.AUTO_OPEN_INVENTORY)
  ) {
    openPlayerInventory(g.user.character);
  }
});

// Re-render open module windows when actor flags change
Hooks.on("updateActor", (actor: Actor, diff: Record<string, unknown>) => {
  const flagDiff = (diff.flags as Record<string, unknown> | undefined)?.[MODULE_ID];
  // Releasing a loot box changes only `ownership`, not a flag — without this the
  // players' clients would never notice the hoard becoming available.
  const ownershipChanged = "ownership" in diff;

  // The attribute sheet reads the actor's **system** data as much as our own
  // flag — the six scores, HP, the saves — so it has to notice writes the rest
  // of the module has no interest in, and cannot sit behind the early return
  // below. Bounded by the number of open sheets, which is nought or one.
  CharacterSheetApp.refreshAll();

  if (!flagDiff && !ownershipChanged) return;

  // Re-render any open window that belongs to this actor or the party overview
  const instances = foundry.applications?.instances;
  if (!instances) return;

  for (const app of instances.values()) {
    const appId = (app as { id?: string }).id ?? "";
    // Inventory windows show a party-wide convoy speed, so any member's change is
    // relevant to all of them — re-render regardless of which actor was updated.
    if (appId === "dolmenwood-party-overview" || appId === "dolmenwood-player-inventory") {
      (app as { render?: () => void }).render?.();
    }
    if (appId === "dolmenwood-loot-browser" || appId === `dolmenwood-loot-${actor.id}`) {
      (app as { render?: () => void }).render?.();
    }
    // The trash lists every inventory at once, so any actor's write can change it.
    if (appId === "dolmenwood-trash") {
      (app as { render?: () => void }).render?.();
    }
    // The day bar shows the convoy's Travel Point budget, which any load change moves.
    if (appId === "dolmenwood-day-bar") {
      (app as { render?: () => void }).render?.();
    }
  }
});

/**
 * Keep open inn windows in step with the world settings behind them.
 *
 * A new day, a re-roll, or an edited table is a settings write, not an actor
 * write — so the usual refresh broadcast is the only thing telling the other
 * clients, and it races the settings update itself. Reacting to the settings
 * change directly removes the ordering question: by the time this fires, the
 * new value is already in place on this client.
 */
onUntypedHook("updateSetting", (setting: { key?: string }) => {
  const key = setting?.key ?? "";
  const watched = [
    SETTINGS.INN_DAY,
    SETTINGS.INN_DAY_LOG,
    SETTINGS.INN_CONFIGS,
    SETTINGS.DAY_STATE,
    SETTINGS.DAY_CONTEXT,
  ];
  if (!watched.some((s) => key.endsWith(`.${s}`))) return;
  getAppInstance("dolmenwood-inn")?.render();
  // "Eaten" and "slept" are read off the inn day log, and a new day clears the ticks.
  refreshDayBar();
});

/**
 * Notice when the party walks into another hex.
 *
 * The day bar's terrain and way are stated by hand and then kept, which is what
 * makes them usable — but it also means they quietly go stale the moment the
 * party moves. This does not guess the new terrain (nothing on a Foundry scene
 * says whether a hex is a bog or a meadow); it only says "you have moved, check
 * this", which is the part a Referee actually forgets.
 *
 * **Built on `moveToken`, not on diffing `updateToken`.** Foundry v13 replaced
 * token movement with a waypoint system, and `moveToken` hands over the whole
 * operation — `movement.origin` and `movement.destination` — so there is nothing
 * to stash between two hooks and nothing to infer from a partial `changed`
 * object. The two earlier attempts here both failed on exactly that inference.
 *
 * **The grid comes from the scene, not the canvas.** `Scene#grid` is a real
 * `HexagonalGrid`/`SquareGrid` instance, so this works whether or not the map in
 * question is the one currently on screen — the previous version required the
 * moved token to be on the *active* scene, which is one more way for it to
 * silently do nothing.
 *
 * **Any token counts, whoever owns it.** The first attempt asked
 * `getPartyActors()` whether the token belonged to the party, and that helper
 * requires a *non-GM* player to own the actor — so a Referee's own marker for
 * the party, which is precisely what this is for, never qualified.
 *
 * **Hex grids only.** A hex on the Dolmenwood map is exactly the unit at which
 * terrain changes, so a change of hex is the right trigger. On a square battle
 * map every step would change cell and the warning would be constant noise.
 */

// hexOf now lives in data/partyPlace.ts: the movement hint and the "is the
// party here?" test must agree on what a hex is, and two copies of that answer
// would be one too many.

/**
 * The one client that may count a step, matching the world-clock sync: two
 * connected GMs would otherwise both count the same move.
 */
function isPrimaryGMClient(): boolean {
  const g = game as Game;
  const activeGM = (g.users as unknown as { activeGM?: { id?: string } } | undefined)?.activeGM;
  return activeGM ? activeGM.id === g.user?.id : !!g.user?.isGM;
}

onUntypedHook("moveToken", (tokenDoc: unknown, movement: unknown) => {
  if (!isPrimaryGMClient()) return;

  const doc = tokenDoc as {
    parent?: { name?: string; grid?: unknown };
    getCenterPoint?: (data?: { x?: number; y?: number }) => { x?: number; y?: number };
    width?: number;
    height?: number;
  };
  const move = movement as {
    origin?: { x?: number; y?: number };
    destination?: { x?: number; y?: number };
  };

  // `origin` and `destination` are token positions — the top-left corner of the
  // base, which on a hex grid sits in a *neighbouring* hex. Both ends have to be
  // recentred or the crossing is detected at the wrong moment. Same correction
  // as the party-presence rule, which is why they share tokenPoint().
  // getCenterPoint() takes the position to centre, so it answers for a waypoint
  // the token is not standing on yet.
  const at = (p: { x?: number; y?: number } | undefined) => {
    if (!p) return undefined;
    return (
      doc.getCenterPoint?.(p) ??
      tokenPoint(doc.parent, { ...p, width: doc.width, height: doc.height })
    );
  };

  const from = hexOf(doc.parent, at(move?.origin));
  const to = hexOf(doc.parent, at(move?.destination));

  // Off a hex map, or the token merely shifted within the same hex.
  if (!from || !to || from === to) return;

  // **With the map calibrated, the move answers its own question.** The warning
  // exists because the module could not tell which hex the party had walked
  // into; once it can, saying "you have moved, go and type it" would be asking
  // for something it is holding. Setting the hex brings the terrain and the
  // region the book gives it, clears the warning by itself, and fires the
  // briefing card — all of which the bar's own Hex box already does.
  const book = followsToken() ? bookHexAt(doc.parent as { id?: string; grid?: unknown }, at(move?.destination)) : undefined;
  if (book) {
    const here = hexInfo(book);
    void setDayContext(
      here ? { hex: here.hex, terrain: here.terrain, region: here.region } : { hex: book }
    ).then(() => refreshDayBar());
    return;
  }

  // Not calibrated, off the book's map, or the reading is switched off: the
  // warning is still the honest answer.
  void noteHexStep(doc.parent?.name ?? "the map").then(() => refreshDayBar());
});

// Add a button to the sidebar (scene controls) for all users
// In Foundry v13, controls is Record<string, SceneControl> and tools is Record<string, SceneControlTool>
onUntypedHook("getSceneControlButtons", (controls: Record<string, SceneControl>) => {
  const g = game as Game;
  const isGM = g.user?.isGM ?? false;

  const tokens = controls.tokens;
  if (!tokens) return;

  const existingToolCount = Object.keys(tokens.tools as Record<string, SceneControlTool>).length;

  // Everything through one door, where the table has asked for it: the bar
  // carries the same three shortcuts, so the toolbar need not. The bar's own
  // show/hide button is never taken away — it is the way back.
  const barOnly =
    !!g.settings.get(MODULE_ID, SETTINGS.BAR_ONLY_ACCESS) &&
    (isGM || !!g.settings.get(MODULE_ID, SETTINGS.PLAYER_DAY_BAR));

  // Leander's order, 2026-08-25: inventory, trash, shop, inn, loot — the two
  // you reach for constantly first, then the three places. The day bar's own
  // toggle stays last of all, since it is the way back rather than a window.
  if (!barOnly) {
  (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-party-inventory"] = {
    name: "dolmenwood-party-inventory",
    title: isGM ? "Party Inventory" : "My Inventory",
    icon: "fas fa-backpack",
    order: existingToolCount,
    button: true,
    onChange: isGM ? () => openPartyOverview() : () => openPlayerInventory(),
  } as SceneControlTool;
  }

  // **Players only**, his call (2026-08-27), and for a good reason on both
  // sides: a player has one character and this is the fastest way into it,
  // while a Referee has none in particular and already has a door per member in
  // the party window. It also keeps the Referee's tool column — which is the
  // long one — from wrapping into a second column that Foundry then clips.
  if (!barOnly && !isGM) {
    (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-character"] = {
      name: "dolmenwood-character",
      title: "Attributes",
      icon: "fas fa-scroll",
      order: existingToolCount + 1,
      button: true,
      onChange: () => openCharacterSheet(),
    } as SceneControlTool;
  }

  if (!barOnly && (isGM || g.settings.get(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_TRASH))) {
    (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-trash"] = {
      name: "dolmenwood-trash",
      title: "Trash",
      icon: "fas fa-trash-can",
      order: existingToolCount + 2,
      button: true,
      onChange: () => openTrash(),
    } as SceneControlTool;
  }

  // The place-less shop, under the same setting as the one in an inventory —
  // it is the same shop and the same way round the map-note rule.
  if (!barOnly && (isGM || g.settings.get(MODULE_ID, SETTINGS.PLAYER_GENERIC_SHOP))) {
    (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-shop"] = {
      name: "dolmenwood-shop",
      title: "Shop",
      icon: "fas fa-store",
      order: existingToolCount + 3,
      button: true,
      onChange: () => openShop(),
    } as SceneControlTool;
  }

  // The rest are always the GM's; for players they are settings.
  if (!barOnly && (isGM || g.settings.get(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_INN))) {
    (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-inn"] = {
      name: "dolmenwood-inn",
      title: "Inn",
      icon: "fas fa-beer-mug-empty",
      order: existingToolCount + 4,
      button: true,
      onChange: () => openInn(),
    } as SceneControlTool;
  }

  if (!barOnly && (isGM || g.settings.get(MODULE_ID, SETTINGS.PLAYER_TOOLBAR_LOOT))) {
    (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-loot"] = {
      name: "dolmenwood-loot",
      title: "Loot",
      icon: "fas fa-treasure-chest",
      order: existingToolCount + 5,
      button: true,
      onChange: () => openLootBrowser(),
    } as SceneControlTool;
  }

  if (isGM || g.settings.get(MODULE_ID, SETTINGS.PLAYER_DAY_BAR)) {
    (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-day-bar"] = {
      name: "dolmenwood-day-bar",
      title: "Day Duties",
      icon: "fas fa-calendar-day",
      order: existingToolCount + 6,
      button: true,
      onChange: () => void toggleDayBar(),
    } as SceneControlTool;
  }
});

/**
 * Keep the module's own actors out of the Actors sidebar — for the GM too.
 *
 * Both the shared store and every released loot box carry
 * `ownership.default = OWNER` because that is what lets players write to them
 * without a GM — and that same ownership is what puts them in the sidebar. The
 * entries are removed from the rendered list rather than the permission being
 * lowered, since lowering it would break the writes the design depends on.
 *
 * Nothing becomes unreachable: the shared store has its own card in the Party
 * Overview, and every loot box (staged ones included) is listed in the Loot
 * window. Turning the setting off brings the sidebar entries back.
 */
function hideManagedActorsFromDirectory(element: HTMLElement): void {
  const g = game as Game;

  // The folder the map button files its actors in. Every actor in it is made
  // with ownership NONE, so a player sees an empty folder with a name that
  // tells them the Referee has been placing things — which is worse than not
  // seeing it at all. Hidden from players whatever the setting below says; the
  // Referee keeps it, because it is where the actors actually live.
  if (!g.user?.isGM) {
    const folder = (g.folders?.contents ?? []).find(
      (f: { name?: string; type?: string; id?: string }) =>
        f.type === "Actor" && f.name === ENCOUNTER_FOLDER
    ) as { id?: string } | undefined;
    if (folder?.id) {
      element
        .querySelectorAll(`[data-folder-id="${folder.id}"], [data-entry-id="${folder.id}"]`)
        .forEach((entry) => entry.closest("li")?.remove());
    }
  }

  if (!g.settings.get(MODULE_ID, SETTINGS.HIDE_MANAGED_ACTORS)) return;

  const hiddenIds = new Set<string>();
  const sharedId = getSharedActorId();
  if (sharedId) hiddenIds.add(sharedId);
  for (const actor of g.actors?.contents ?? []) {
    if (isLootActor(actor) && actor.id) hiddenIds.add(actor.id);
  }
  if (hiddenIds.size === 0) return;

  for (const id of hiddenIds) {
    element
      .querySelectorAll(`[data-entry-id="${id}"], [data-document-id="${id}"], [data-actor-id="${id}"]`)
      .forEach((entry) => entry.closest("li")?.remove());
  }
}

/**
 * A deleted loot box must take its map pin with it, or the pin stays behind
 * pointing at an actor that no longer exists. Hooked on the deletion rather than
 * done in the delete button, so a box removed straight from the sidebar is
 * cleaned up too. The deleted document still carries its id, name and flags here.
 */
Hooks.on("deleteActor", (actor: Actor) => {
  if (!isLootActor(actor)) return;
  void removeLootNotes(actor);
});

onUntypedHook("renderActorDirectory", (_app: unknown, htmlOrEl: unknown) => {
  const el =
    htmlOrEl instanceof HTMLElement
      ? htmlOrEl
      : (htmlOrEl as { get?: (n: number) => HTMLElement } | undefined)?.get?.(0);
  if (el) hideManagedActorsFromDirectory(el);
});

/**
 * The buttons on the module's chat cards.
 *
 * **Only `renderChatMessageHTML`.** The deprecated `renderChatMessage` used to
 * be registered beside it "for older cores", which was worse than useless: core
 * fires the old hook *in addition to* the new one, but only when something is
 * listening for it (`chat-message.mjs`, `if ("renderChatMessage" in Hooks.events)`),
 * and it hands over the very same element wrapped in jQuery. Registering both
 * therefore wired every button twice, and one click rolled twice. v13 is the
 * module's minimum and has `renderChatMessageHTML`, so nothing is lost.
 */
onUntypedHook("renderChatMessageHTML", (_message: unknown, element: unknown) => {
  if (element instanceof HTMLElement) activateChatButtons(element);
});

/** Both kinds of card the module posts carry buttons; both get wired here. */
function activateChatButtons(element: HTMLElement): void {
  activateLootChatButtons(element);
  activateEncounterChatButtons(element);
}

// ─── Module API Functions ─────────────────────────────────────────────────────

function openPartyOverview(): void {
  const g = game as Game;
  if (!g.user?.isGM) {
    ui.notifications?.warn("Only the GM can access the Party Overview.");
    return;
  }
  // Find existing instance or create new one
  const existing = getAppInstance("dolmenwood-party-overview");
  if (existing) {
    existing.render({ force: true });
  } else {
    new PartyOverviewApp().render(true);
  }
}

function openPlayerInventory(actorOrId?: Actor | string): void {
  const g = game as Game;
  let actor: Actor | undefined;

  if (typeof actorOrId === "string") {
    actor = g.actors?.get(actorOrId);
  } else if (actorOrId instanceof Actor) {
    actor = actorOrId;
  } else {
    actor = g.user?.character ?? undefined;
  }

  if (!actor) {
    ui.notifications?.warn("No actor found. Assign a character to your user first.");
    return;
  }

  const existing = getAppInstance("dolmenwood-player-inventory");
  if (existing) {
    existing.render({ force: true });
  } else {
    new PlayerInventoryApp(actor).render(true);
  }
}

/**
 * The attribute sheet, for whoever is meant.
 *
 * **A Referee has no one character**, so the selected token stands in for the
 * assignment a player has: click a token, press the button, read that
 * character's saves. Falling back that way rather than opening a picker keeps
 * one button doing one thing, and the party window has a door per member for
 * when nothing is selected.
 */
function openCharacterSheet(actorOrId?: Actor | string): void {
  const g = game as Game;
  let actor: Actor | undefined;

  if (typeof actorOrId === "string") actor = g.actors?.get(actorOrId);
  else if (actorOrId instanceof Actor) actor = actorOrId;
  else {
    actor =
      g.user?.character ??
      (canvas?.tokens?.controlled?.[0]?.actor as Actor | undefined) ??
      undefined;
  }

  if (!actor) {
    ui.notifications?.warn(
      "No character. Assign one to your user, or select a token, or open one from the party window."
    );
    return;
  }
  CharacterSheetApp.open(actor);
}

function openShop(
  name?: string,
  categories?: string[],
  priceFactor?: number,
  ownStockOnly?: boolean,
  buyBackRate?: number
): void {
  // Positional and growing, because this is the macro API a world may already
  // be calling. New arguments are appended and optional for that reason.
  const apply = (app: ShopApp): void =>
    app.setConfig(name!, categories ?? [], priceFactor ?? 100, ownStockOnly ?? false, buyBackRate ?? 0);
  const existing = getAppInstance("dolmenwood-shop");
  if (existing) {
    if (name !== undefined) apply(existing as unknown as ShopApp);
    existing.render({ force: true });
  } else {
    const app = new ShopApp();
    if (name !== undefined) apply(app);
    app.render(true);
  }
}

function openInn(name?: string, quality?: InnQuality, categories?: string[], priceFactor?: number): void {
  const existing = getAppInstance("dolmenwood-inn");
  if (existing) {
    if (name || quality || categories || priceFactor !== undefined) {
      (existing as unknown as InnApp).setConfig(
        name ?? DEFAULT_INN_NAME,
        quality ?? "common",
        categories,
        priceFactor ?? 100
      );
    }
    existing.render({ force: true });
  } else {
    const app = new InnApp();
    if (name || quality || categories || priceFactor !== undefined) {
      app.setConfig(name ?? DEFAULT_INN_NAME, quality ?? "common", categories, priceFactor ?? 100);
    }
    app.render(true);
  }
}

function openMarket(noteDoc: { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> }): void {
  const existing = getAppInstance("dolmenwood-market");
  if (existing) {
    (existing as unknown as MarketApp).setNote(noteDoc);
    existing.render({ force: true });
  } else {
    const app = new MarketApp();
    app.setNote(noteDoc);
    app.render(true);
  }
}

function getAppInstance(id: string): { render: (options?: unknown) => void } | undefined {
  const instances = foundry.applications?.instances;
  if (!instances) return undefined;
  for (const app of instances.values()) {
    if ((app as { id?: string }).id === id) {
      return app as { render: (options?: unknown) => void };
    }
  }
  return undefined;
}
