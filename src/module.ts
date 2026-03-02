import { MODULE_ID, SETTINGS, FLAGS, SOCKET_EVENTS } from "./constants";
import { registerHandlebarsHelpers, registerHandlebarsPartials } from "./helpers/handlebars";
import { SocketHandler } from "./socket/SocketHandler";
import { PartyOverviewApp } from "./apps/PartyOverviewApp";
import { PlayerInventoryApp } from "./apps/PlayerInventoryApp";
import { ShopApp } from "./apps/ShopApp";
import { InnApp } from "./apps/InnApp";
import { CatalogManager } from "./data/CatalogManager";
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

  // Register Handlebars helpers (synchronous)
  registerHandlebarsHelpers();
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
      openShop: (name?: string, categories?: string[]) => openShop(name, categories),
      openInn: (name?: string, quality?: InnQuality) => openInn(name, quality),
    };
  }

  // ─── Note / Map Marker Hooks ───────────────────────────────────────────────

  // Cache of pending flag values keyed on the app instance.
  // Updated on every input change; read by closeNoteConfig (which fires without HTML in v13).
  type PendingNoteFlags = { inn?: { name: string; quality: InnQuality } | false; shop?: { name: string; categories: string[] } | false };
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
    const existingInn = note?.getFlag?.(MODULE_ID, "inn") as { name?: string; quality?: InnQuality } | undefined;
    const isInn = !!existingInn;
    const innName = existingInn?.name ?? "";
    const innQuality = existingInn?.quality ?? "common";

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
        </div>
      </fieldset>`;

    // ── Shop fieldset ─────────────────────────────────────────────────────────
    const existingShop = note?.getFlag?.(MODULE_ID, "shop") as { name?: string; categories?: string[] } | undefined;
    const isShop = !!existingShop;
    const shopName = existingShop?.name ?? "";
    const savedCats = existingShop?.categories ?? [];
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
            <label>Categories sold <small>(leave all unchecked = sell everything)</small></label>
            <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;">
              ${categoryCheckboxes}
            </div>
          </div>
        </div>
      </fieldset>`;

    // Inject before footer
    const footer = el.querySelector("footer");
    if (!footer) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = innHtml + shopHtml;
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

    // Helper: read current field values from the DOM into the WeakMap cache.
    // Called on every input change so closeNoteConfig can save without the HTML.
    const readFlags = (): PendingNoteFlags => {
      const flags: PendingNoteFlags = {};

      const innChecked = (el.querySelector("#note-is-inn") as HTMLInputElement | null)?.checked ?? false;
      if (innChecked) {
        const name = ((el.querySelector("#note-inn-name") as HTMLInputElement | null)?.value ?? "").trim() || "The Wayward Boar";
        const quality = ((el.querySelector("#note-inn-quality") as HTMLSelectElement | null)?.value ?? "common") as InnQuality;
        flags.inn = { name, quality };
      } else {
        flags.inn = false; // explicitly unset
      }

      const shopChecked = (el.querySelector("#note-is-shop") as HTMLInputElement | null)?.checked ?? false;
      if (shopChecked) {
        const name = ((el.querySelector("#note-shop-name") as HTMLInputElement | null)?.value ?? "").trim() || "Shop";
        const categories: string[] = [];
        el.querySelectorAll<HTMLInputElement>(".note-shop-cat:checked").forEach((cb) => categories.push(cb.value));
        flags.shop = { name, categories };
      } else {
        flags.shop = false;
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

    pendingNoteFlags.delete(app);
  });

  // Intercept Note click — open InnApp or ShopApp if the note is flagged.
  // In v13 the hook arg may be the NoteDocument directly OR a Note placeable —
  // we try getFlag on both to handle either case.
  // Hook name "activateNote" covers v11–v13; if it still doesn't fire, also try "clickNote".
  const handleNoteClick = (noteOrDoc: unknown): boolean | void => {
    const asDoc = noteOrDoc as { getFlag?: (m: string, k: string) => unknown; document?: { getFlag?: (m: string, k: string) => unknown } };
    // Try direct getFlag first (NoteDocument), then .document.getFlag (Note placeable)
    const getFlag = (key: string) =>
      asDoc.getFlag?.(MODULE_ID, key) ?? asDoc.document?.getFlag?.(MODULE_ID, key);

    const innData = getFlag("inn") as { name?: string; quality?: InnQuality } | undefined;
    if (innData) { openInn(innData.name, innData.quality); return false; }

    const shopData = getFlag("shop") as { name?: string; categories?: string[] } | undefined;
    if (shopData) { openShop(shopData.name, shopData.categories ?? []); return false; }
  };

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

function openShop(name?: string, categories?: string[]): void {
  const existing = getAppInstance("dolmenwood-shop");
  if (existing) {
    if (name !== undefined) (existing as unknown as ShopApp).setConfig(name, categories ?? []);
    existing.render({ force: true });
  } else {
    const app = new ShopApp();
    if (name !== undefined) app.setConfig(name, categories ?? []);
    app.render(true);
  }
}

function openInn(name?: string, quality?: InnQuality): void {
  const existing = getAppInstance("dolmenwood-inn");
  if (existing) {
    if (name || quality) {
      (existing as unknown as InnApp).setConfig(
        name ?? "The Wayward Boar",
        quality ?? "common"
      );
    }
    existing.render({ force: true });
  } else {
    const app = new InnApp();
    if (name || quality) {
      app.setConfig(name ?? "The Wayward Boar", quality ?? "common");
    }
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
