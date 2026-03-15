import { MODULE_ID, SETTINGS, FLAGS, SOCKET_EVENTS } from "./constants";
import { registerHandlebarsHelpers, registerHandlebarsPartials } from "./helpers/handlebars";
import { SocketHandler } from "./socket/SocketHandler";
import { PartyOverviewApp } from "./apps/PartyOverviewApp";
import { PlayerInventoryApp } from "./apps/PlayerInventoryApp";
import { ShopApp } from "./apps/ShopApp";
import { InnApp } from "./apps/InnApp";
import { MarketApp } from "./apps/MarketApp";
import { CatalogManager } from "./data/CatalogManager";
import { INN_CATEGORIES } from "./data/innData";
import type { InnQuality } from "./data/innData";
import "../styles/module.css";

// ─── Module Initialization ────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing`);

  // Register world-scoped settings
  game.settings.register(MODULE_ID, SETTINGS.SHOP_STATE, {
    name: "Shop State",
    hint: "Active tags and available items for the shop panel.",
    scope: "world",
    config: false,
    type: Object,
    default: { activeTags: [], availableItems: [] },
  });

  game.settings.register(MODULE_ID, FLAGS.TRANSACTION_LOG, {
    name: "Transaction Log",
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(MODULE_ID, SETTINGS.INN_STATE, {
    scope: "world",
    config: false,
    type: Object,
    default: { name: "The Wayward Boar", quality: "common" },
  });

  game.settings.register(MODULE_ID, SETTINGS.LOCAL_HIDDEN, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, SETTINGS.LOCAL_CUSTOM_ITEMS, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE, {
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
  } as Parameters<typeof game.settings.register>[2]);

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
      const marketFlag = getFlag("market");
      if (marketFlag) { openMarket(this.document as { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> }); return; }
      const innFlag = getFlag("inn") as { name?: string; quality?: InnQuality; categories?: string[]; priceFactor?: number } | undefined;
      if (innFlag) { openInn(innFlag.name, innFlag.quality, innFlag.categories, innFlag.priceFactor); return; }
      const shopFlag = getFlag("shop") as { name?: string; categories?: string[]; priceFactor?: number } | undefined;
      if (shopFlag) { openShop(shopFlag.name, shopFlag.categories ?? [], shopFlag.priceFactor); return; }
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

  // Expose module API on the module object for macro access
  const mod = (game as Game).modules.get(MODULE_ID);
  if (mod) {
    (mod as ModuleData & { api: unknown }).api = {
      openPartyOverview: () => openPartyOverview(),
      openPlayerInventory: (actorOrId?: Actor | string) => openPlayerInventory(actorOrId),
      openShop: (name?: string, categories?: string[], priceFactor?: number) => openShop(name, categories, priceFactor),
      openInn: (name?: string, quality?: InnQuality, categories?: string[], priceFactor?: number) => openInn(name, quality, categories, priceFactor),
      openMarket: (noteDoc: { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> }) => openMarket(noteDoc),
    };
  }

  // ─── Note / Map Marker Hooks ───────────────────────────────────────────────

  // Cache of pending flag values keyed on the app instance.
  // Updated on every input change; read by closeNoteConfig (which fires without HTML in v13).
  type PendingNoteFlags = { inn?: { name: string; quality: InnQuality; categories: string[]; priceFactor: number } | false; shop?: { name: string; categories: string[]; priceFactor: number } | false; market?: { name: string } | false };
  const pendingNoteFlags = new WeakMap<object, PendingNoteFlags>();

  // v13 ApplicationV2 passes an HTMLElement as the second arg; old Application passed jQuery.
  function toNoteEl(htmlOrEl: unknown): HTMLElement {
    if (htmlOrEl instanceof HTMLElement) return htmlOrEl;
    if (htmlOrEl && typeof (htmlOrEl as { get?: (n: number) => HTMLElement }).get === "function") {
      return (htmlOrEl as { get: (n: number) => HTMLElement }).get(0);
    }
    return htmlOrEl as HTMLElement;
  }

  Hooks.on("renderNoteConfig", (app: object & { document?: { getFlag?: (m: string, k: string) => unknown } }, htmlOrEl: unknown) => {
    const el = toNoteEl(htmlOrEl);
    const note = (app as { document?: { getFlag?: (m: string, k: string) => unknown } }).document;

    // ── Inn fieldset ──────────────────────────────────────────────────────────
    const existingInn = note?.getFlag?.(MODULE_ID, "inn") as { name?: string; quality?: InnQuality; categories?: string[]; priceFactor?: number } | undefined;
    const isInn = !!existingInn;
    const innName = existingInn?.name ?? "";
    const innQuality = existingInn?.quality ?? "common";
    const savedInnCats = existingInn?.categories ?? [];
    const innPriceFactor = existingInn?.priceFactor ?? 100;
    const innCategoryCheckboxes = INN_CATEGORIES
      .map((cat) => {
        const checked = savedInnCats.includes(cat.key) ? "checked" : "";
        return `<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;">
          <input type="checkbox" class="note-inn-cat" value="${cat.key}" ${checked} /> ${cat.label}
        </label>`;
      })
      .join("");

    const innHtml = `
      <fieldset style="margin:8px 0;padding:8px;border:1px solid #7a5030;">
        <legend style="font-weight:bold;padding:0 4px;">Quartermaster Inn</legend>
        <div class="form-group">
          <label><input type="checkbox" id="note-is-inn" ${isInn ? "checked" : ""} /> Mark as Inn</label>
        </div>
        <div id="note-inn-fields" style="${isInn ? "" : "display:none;"}">
          <div class="form-group">
            <label>Inn Name</label>
            <input type="text" id="note-inn-name" value="${innName}" placeholder="The Wayward Boar" />
          </div>
          <div class="form-group">
            <label>Quality</label>
            <select id="note-inn-quality">
              <option value="poor" ${innQuality === "poor" ? "selected" : ""}>Poor</option>
              <option value="common" ${innQuality === "common" ? "selected" : ""}>Common</option>
              <option value="fancy" ${innQuality === "fancy" ? "selected" : ""}>Fancy</option>
            </select>
          </div>
          <div class="form-group">
            <label>Price Factor <small>(%  — 100 = normal, 200 = double)</small></label>
            <input type="number" id="note-inn-price-factor" value="${innPriceFactor}" min="1" max="10000" step="1" style="width:80px;" />
          </div>
          <div class="form-group">
            <label>Categories served <small>(leave all unchecked = serve everything)</small></label>
            <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;">
              ${innCategoryCheckboxes}
            </div>
          </div>
        </div>
      </fieldset>`;

    // ── Shop fieldset ─────────────────────────────────────────────────────────
    const existingShop = note?.getFlag?.(MODULE_ID, "shop") as { name?: string; categories?: string[]; priceFactor?: number } | undefined;
    const isShop = !!existingShop;
    const shopName = existingShop?.name ?? "";
    const savedCats = existingShop?.categories ?? [];
    const shopPriceFactor = existingShop?.priceFactor ?? 100;
    const categoryCheckboxes = CatalogManager.getCategories()
      .map((cat) => {
        const checked = savedCats.includes(cat) ? "checked" : "";
        return `<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;">
          <input type="checkbox" class="note-shop-cat" value="${cat}" ${checked} /> ${cat}
        </label>`;
      })
      .join("");

    const shopHtml = `
      <fieldset style="margin:8px 0;padding:8px;border:1px solid #7a5030;">
        <legend style="font-weight:bold;padding:0 4px;">Quartermaster Shop</legend>
        <div class="form-group">
          <label><input type="checkbox" id="note-is-shop" ${isShop ? "checked" : ""} /> Mark as Shop</label>
        </div>
        <div id="note-shop-fields" style="${isShop ? "" : "display:none;"}">
          <div class="form-group">
            <label>Shop Name</label>
            <input type="text" id="note-shop-name" value="${shopName}" placeholder="e.g. The Blacksmith" />
          </div>
          <div class="form-group">
            <label>Price Factor <small>(%  — 100 = normal, 200 = double)</small></label>
            <input type="number" id="note-shop-price-factor" value="${shopPriceFactor}" min="1" max="10000" step="1" style="width:80px;" />
          </div>
          <div class="form-group">
            <label>Categories sold <small>(leave all unchecked = sell everything)</small></label>
            <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;">
              ${categoryCheckboxes}
            </div>
          </div>
        </div>
      </fieldset>`;

    // ── Market fieldset ───────────────────────────────────────────────────────
    const existingMarket = note?.getFlag?.(MODULE_ID, "market") as { name?: string } | undefined;
    const isMarket = !!existingMarket;
    const marketName = existingMarket?.name ?? "";
    const marketHtml = `
      <fieldset style="margin:8px 0;padding:8px;border:1px solid #7a5030;">
        <legend style="font-weight:bold;padding:0 4px;">Quartermaster Market</legend>
        <div class="form-group">
          <label><input type="checkbox" id="note-is-market" ${isMarket ? "checked" : ""} /> Mark as Market</label>
        </div>
        <div id="note-market-fields" style="${isMarket ? "" : "display:none;"}">
          <div class="form-group">
            <label>Market Name</label>
            <input type="text" id="note-market-name" value="${marketName}" placeholder="e.g. The Grand Bazaar" />
          </div>
          <p class="hint" style="margin:4px 0 0;font-size:0.85em;color:#666;">Add shops and inns by opening the market after saving this note.</p>
        </div>
      </fieldset>`;

    // Inject before footer
    const footer = el.querySelector("footer");
    if (!footer) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = innHtml + shopHtml + marketHtml;
    footer.before(wrapper);

    // Toggle visibility on checkbox change
    el.querySelector("#note-is-inn")?.addEventListener("change", function () {
      (el.querySelector("#note-inn-fields") as HTMLElement).style.display =
        (this as HTMLInputElement).checked ? "" : "none";
    });
    el.querySelector("#note-is-shop")?.addEventListener("change", function () {
      (el.querySelector("#note-shop-fields") as HTMLElement).style.display =
        (this as HTMLInputElement).checked ? "" : "none";
    });
    el.querySelector("#note-is-market")?.addEventListener("change", function () {
      (el.querySelector("#note-market-fields") as HTMLElement).style.display =
        (this as HTMLInputElement).checked ? "" : "none";
    });

    // Helper: read current field values from the DOM into the WeakMap cache.
    // Called on every input change so closeNoteConfig can save without the HTML.
    const readFlags = (): PendingNoteFlags => {
      const flags: PendingNoteFlags = {};

      const innChecked = (el.querySelector("#note-is-inn") as HTMLInputElement | null)?.checked ?? false;
      if (innChecked) {
        const name = ((el.querySelector("#note-inn-name") as HTMLInputElement | null)?.value ?? "").trim() || "The Wayward Boar";
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
        flags.shop = { name, categories, priceFactor };
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
  Hooks.on("closeNoteConfig", async (app: object & { document?: { setFlag?: (m: string, k: string, v: unknown) => Promise<void>; unsetFlag?: (m: string, k: string) => Promise<void> } }) => {
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

    pendingNoteFlags.delete(app);
  });

  // Intercept Note click — open InnApp or ShopApp if the note is flagged.
  // In v13 the hook arg may be the NoteDocument directly OR a Note placeable —
  // we try getFlag on both to handle either case.
  // Hook name "activateNote" covers v11–v13; if it still doesn't fire, also try "clickNote".
  const handleNoteClick = (noteOrDoc: unknown): boolean | void => {
    const asDoc = noteOrDoc as { getFlag?: (m: string, k: string) => unknown; document?: { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> } };
    // Try direct getFlag first (NoteDocument), then .document.getFlag (Note placeable)
    const getFlag = (key: string) =>
      asDoc.getFlag?.(MODULE_ID, key) ?? asDoc.document?.getFlag?.(MODULE_ID, key);

    const marketData = getFlag("market");
    if (marketData) {
      const doc = (asDoc.document ?? asDoc) as { getFlag?: (m: string, k: string) => unknown; setFlag?: (m: string, k: string, v: unknown) => Promise<void> };
      openMarket(doc);
      return false;
    }

    const innData = getFlag("inn") as { name?: string; quality?: InnQuality; categories?: string[]; priceFactor?: number } | undefined;
    if (innData) { openInn(innData.name, innData.quality, innData.categories, innData.priceFactor); return false; }

    const shopData = getFlag("shop") as { name?: string; categories?: string[]; priceFactor?: number } | undefined;
    if (shopData) { openShop(shopData.name, shopData.categories ?? [], shopData.priceFactor); return false; }
  };

  // Keep activateNote/clickNote as fallbacks for future Foundry versions that may fix the hook.
  // In v13, they never fire for notes without a linked journal entry (handled in "init" above).
  Hooks.on("activateNote", handleNoteClick);
  Hooks.on("clickNote",    handleNoteClick);

  // Auto-open player's own inventory (non-GM players)
  const g = game as Game;
  if (!g.user?.isGM && g.user?.character) {
    openPlayerInventory(g.user.character);
  }
});

// Re-render open module windows when actor flags change
Hooks.on("updateActor", (actor: Actor, diff: Record<string, unknown>) => {
  const flagDiff = (diff.flags as Record<string, unknown> | undefined)?.[MODULE_ID];
  if (!flagDiff) return;

  // Re-render any open window that belongs to this actor or the party overview
  const instances = foundry.applications?.instances;
  if (!instances) return;

  for (const app of instances.values()) {
    const appId = (app as { id?: string }).id ?? "";
    if (appId === "dolmenwood-party-overview") {
      (app as { render?: () => void }).render?.();
    } else if (appId === "dolmenwood-player-inventory") {
      const playerApp = app as PlayerInventoryApp & { actor?: Actor };
      if (playerApp.actor?.id === actor.id) {
        playerApp.render();
      }
    }
  }
});

// Add a button to the sidebar (scene controls) for all users
// In Foundry v13, controls is Record<string, SceneControl> and tools is Record<string, SceneControlTool>
Hooks.on("getSceneControlButtons", (controls: Record<string, SceneControl>) => {
  const g = game as Game;
  const isGM = g.user?.isGM ?? false;

  const tokens = controls.tokens;
  if (!tokens) return;

  const existingToolCount = Object.keys(tokens.tools as Record<string, SceneControlTool>).length;

  (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-party-inventory"] = {
    name: "dolmenwood-party-inventory",
    title: isGM ? "Party Inventory" : "My Inventory",
    icon: "fas fa-backpack",
    order: existingToolCount,
    button: true,
    onChange: isGM ? () => openPartyOverview() : () => openPlayerInventory(),
  } as SceneControlTool;

  (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-inn"] = {
    name: "dolmenwood-inn",
    title: "Inn",
    icon: "fas fa-beer-mug-empty",
    order: existingToolCount + 1,
    button: true,
    onChange: () => openInn(),
  } as SceneControlTool;
});

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

function openShop(name?: string, categories?: string[], priceFactor?: number): void {
  const existing = getAppInstance("dolmenwood-shop");
  if (existing) {
    if (name !== undefined) (existing as unknown as ShopApp).setConfig(name, categories ?? [], priceFactor ?? 100);
    existing.render({ force: true });
  } else {
    const app = new ShopApp();
    if (name !== undefined) app.setConfig(name, categories ?? [], priceFactor ?? 100);
    app.render(true);
  }
}

function openInn(name?: string, quality?: InnQuality, categories?: string[], priceFactor?: number): void {
  const existing = getAppInstance("dolmenwood-inn");
  if (existing) {
    if (name || quality || categories || priceFactor !== undefined) {
      (existing as unknown as InnApp).setConfig(
        name ?? "The Wayward Boar",
        quality ?? "common",
        categories,
        priceFactor ?? 100
      );
    }
    existing.render({ force: true });
  } else {
    const app = new InnApp();
    if (name || quality || categories || priceFactor !== undefined) {
      app.setConfig(name ?? "The Wayward Boar", quality ?? "common", categories, priceFactor ?? 100);
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
