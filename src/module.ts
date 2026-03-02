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

  // Inject Inn fields into Note config dialog
  Hooks.on("renderNoteConfig", (app: { document?: { getFlag?: (module: string, key: string) => unknown } }, html: JQuery) => {
    const note = app.document;
    const existing = note?.getFlag?.(MODULE_ID, "inn") as { name?: string; quality?: InnQuality } | undefined;
    const isInn = !!existing;
    const savedName = existing?.name ?? "";
    const savedQuality = existing?.quality ?? "common";

    const injection = `
      <fieldset style="margin:8px 0;padding:8px;border:1px solid #7a5030;">
        <legend style="font-weight:bold;padding:0 4px;">Quartermaster Inn</legend>
        <div class="form-group">
          <label><input type="checkbox" id="note-is-inn" ${isInn ? "checked" : ""} /> Mark as Inn</label>
        </div>
        <div id="note-inn-fields" style="${isInn ? "" : "display:none;"}">
          <div class="form-group">
            <label>Inn Name</label>
            <input type="text" id="note-inn-name" value="${savedName}" placeholder="The Wayward Boar" />
          </div>
          <div class="form-group">
            <label>Quality</label>
            <select id="note-inn-quality">
              <option value="poor" ${savedQuality === "poor" ? "selected" : ""}>Poor</option>
              <option value="common" ${savedQuality === "common" ? "selected" : ""}>Common</option>
              <option value="fancy" ${savedQuality === "fancy" ? "selected" : ""}>Fancy</option>
            </select>
          </div>
        </div>
      </fieldset>
    `;
    html.find("footer").before(injection);
    html.find("#note-is-inn").on("change", function () {
      html.find("#note-inn-fields").toggle((this as HTMLInputElement).checked);
    });
  });

  // Save inn flag when Note config closes
  Hooks.on("closeNoteConfig", async (app: { document?: { setFlag?: (m: string, k: string, v: unknown) => Promise<void>; unsetFlag?: (m: string, k: string) => Promise<void> } }, html: JQuery) => {
    const note = app.document;
    if (!note?.setFlag || !note?.unsetFlag) return;
    const isInn = (html.find("#note-is-inn")[0] as HTMLInputElement | undefined)?.checked ?? false;
    if (isInn) {
      const name = (html.find("#note-inn-name").val() as string | undefined)?.trim() || "The Wayward Boar";
      const quality = (html.find("#note-inn-quality").val() as InnQuality | undefined) ?? "common";
      await note.setFlag(MODULE_ID, "inn", { name, quality });
    } else {
      await note.unsetFlag(MODULE_ID, "inn");
    }
  });

  // Intercept Note click — open InnApp if the note is flagged as an inn,
  // or ShopApp if flagged as a shop.
  // v13 hook name is "activateNote"; if it doesn't fire, try "clickNote"
  Hooks.on("activateNote", (note: { document?: { getFlag?: (m: string, k: string) => unknown } }) => {
    const innData = note.document?.getFlag?.(MODULE_ID, "inn") as { name?: string; quality?: InnQuality } | undefined;
    if (innData) {
      openInn(innData.name, innData.quality);
      return false;
    }
    const shopData = note.document?.getFlag?.(MODULE_ID, "shop") as { name?: string; categories?: string[] } | undefined;
    if (shopData) {
      openShop(shopData.name, shopData.categories ?? []);
      return false;
    }
    return true; // normal behaviour: open journal
  });

  // ─── Shop Note Hooks ───────────────────────────────────────────────────────

  Hooks.on("renderNoteConfig", (app: { document?: { getFlag?: (module: string, key: string) => unknown } }, html: JQuery) => {
    // Skip if Inn fields already injected (same dialog can only be one type)
    if (html.find("#note-is-inn").length) return;

    const note = app.document;
    const existing = note?.getFlag?.(MODULE_ID, "shop") as { name?: string; categories?: string[] } | undefined;
    const isShop = !!existing;
    const savedName = existing?.name ?? "";
    const savedCategories = existing?.categories ?? [];
    const allCategories = CatalogManager.getCategories();

    const categoryCheckboxes = allCategories
      .map((cat) => {
        const checked = savedCategories.includes(cat) ? "checked" : "";
        return `<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;">
          <input type="checkbox" class="note-shop-cat" value="${cat}" ${checked} /> ${cat}
        </label>`;
      })
      .join("");

    const injection = `
      <fieldset style="margin:8px 0;padding:8px;border:1px solid #7a5030;">
        <legend style="font-weight:bold;padding:0 4px;">Quartermaster Shop</legend>
        <div class="form-group">
          <label><input type="checkbox" id="note-is-shop" ${isShop ? "checked" : ""} /> Mark as Shop</label>
        </div>
        <div id="note-shop-fields" style="${isShop ? "" : "display:none;"}">
          <div class="form-group">
            <label>Shop Name</label>
            <input type="text" id="note-shop-name" value="${savedName}" placeholder="e.g. The Blacksmith" />
          </div>
          <div class="form-group">
            <label>Categories sold <small>(leave all unchecked = sell everything)</small></label>
            <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;">
              ${categoryCheckboxes}
            </div>
          </div>
        </div>
      </fieldset>
    `;
    html.find("footer").before(injection);
    html.find("#note-is-shop").on("change", function () {
      html.find("#note-shop-fields").toggle((this as HTMLInputElement).checked);
    });
  });

  Hooks.on("closeNoteConfig", async (app: { document?: { setFlag?: (m: string, k: string, v: unknown) => Promise<void>; unsetFlag?: (m: string, k: string) => Promise<void> } }, html: JQuery) => {
    const note = app.document;
    if (!note?.setFlag || !note?.unsetFlag) return;
    const isShop = (html.find("#note-is-shop")[0] as HTMLInputElement | undefined)?.checked ?? false;
    if (isShop) {
      const name = (html.find("#note-shop-name").val() as string | undefined)?.trim() || "Shop";
      const categories: string[] = [];
      html.find(".note-shop-cat:checked").each(function () {
        categories.push((this as HTMLInputElement).value);
      });
      await note.setFlag(MODULE_ID, "shop", { name, categories });
    } else {
      await note.unsetFlag(MODULE_ID, "shop");
    }
  });

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
