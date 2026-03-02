import { MODULE_ID, SETTINGS, FLAGS, SOCKET_EVENTS } from "./constants";
import { registerHandlebarsHelpers, registerHandlebarsPartials } from "./helpers/handlebars";
import { SocketHandler } from "./socket/SocketHandler";
import { PartyOverviewApp } from "./apps/PartyOverviewApp";
import { PlayerInventoryApp } from "./apps/PlayerInventoryApp";
import { ShopApp } from "./apps/ShopApp";
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
      openShop: () => openShop(),
    };
  }

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

  (tokens.tools as Record<string, SceneControlTool>)["dolmenwood-party-inventory"] = {
    name: "dolmenwood-party-inventory",
    title: isGM ? "Party Inventory" : "My Inventory",
    icon: "fas fa-backpack",
    order: Object.keys(tokens.tools as Record<string, SceneControlTool>).length,
    button: true,
    onChange: isGM ? () => openPartyOverview() : () => openPlayerInventory(),
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

function openShop(): void {
  const existing = getAppInstance("dolmenwood-shop");
  if (existing) {
    existing.render({ force: true });
  } else {
    new ShopApp().render(true);
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
