import { TEMPLATES } from "../constants";
import { FlagManager } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { ShopApp } from "./ShopApp";
import { PlayerInventoryApp } from "./PlayerInventoryApp";

export class PartyOverviewApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-party-overview",
    window: {
      title: "Party Inventory Overview",
      resizable: true,
    },
    position: {
      width: 960,
      height: 620,
    },
    classes: ["dolmenwood-party-inventory", "party-overview"],
    actions: {
      openShop: PartyOverviewApp._onOpenShop,
      openPlayerInventory: PartyOverviewApp._onOpenPlayerInventory,
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.PARTY_OVERVIEW,
    },
  };

  override async _prepareContext(
    _options: Partial<ApplicationV2Options>
  ): Promise<Record<string, unknown>> {
    const g = game as Game;

    // Auto-detect: all actors owned by a non-GM player
    const partyActors = (g.actors?.contents ?? []).filter((actor) =>
      (g.users?.contents ?? []).some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"))
    );

    const members = partyActors
      .map((actor) => {
        const inventory = FlagManager.getInventory(actor);
        const encumbrance = calculateEncumbrance(inventory, CatalogManager.getMap());

        // Compute per-category item totals visible to GM
        const itemsByCategory: Record<string, { name: string; total: number }[]> = {};
        for (const item of inventory.items) {
          if (!itemsByCategory[item.zone]) {
            itemsByCategory[item.zone] = [];
          }
        }

        return {
          actor,
          actorId: actor.id,
          inventory,
          encumbrance,
          isOwner: actor.isOwner,
        };
      })
      .filter(Boolean);

    // Party-wide totals
    const partyTotals = {
      cp: 0,
      sp: 0,
      gp: 0,
      pp: 0,
    };
    for (const member of members) {
      if (!member) continue;
      partyTotals.cp += member.inventory.coins.cp;
      partyTotals.sp += member.inventory.coins.sp;
      partyTotals.gp += member.inventory.coins.gp;
      partyTotals.pp += member.inventory.coins.pp;
    }

    return {
      members,
      partyTotals,
      isGM: g.user?.isGM ?? false,
      transactions: FlagManager.getTransactions().slice(-20).reverse(),
    };
  }

  override _onRender(
    _context: Record<string, unknown>,
    _options: Partial<ApplicationV2Options>
  ): void {
    // Column click opens player inventory
    this.element
      .querySelectorAll<HTMLElement>(".player-column[data-actor-id]")
      .forEach((col) => {
        col.addEventListener("click", (e) => {
          // Don't fire if clicking a button inside
          if ((e.target as HTMLElement).closest("button")) return;
          const actorId = col.dataset.actorId!;
          const actor = (game as Game).actors?.get(actorId);
          if (actor) new PlayerInventoryApp(actor).render(true);
        });
      });
  }

  // ─── Action Handlers ────────────────────────────────────────────────────────

  private static _onOpenShop(this: PartyOverviewApp): void {
    new ShopApp().render(true);
  }

  private static _onOpenPlayerInventory(
    this: PartyOverviewApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const actorId = target.dataset.actorId!;
    const actor = (game as Game).actors?.get(actorId);
    if (actor) new PlayerInventoryApp(actor).render(true);
  }

}

