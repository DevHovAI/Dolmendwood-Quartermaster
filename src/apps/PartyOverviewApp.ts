import { TEMPLATES, SETTINGS, MODULE_ID } from "../constants";
import { FlagManager } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { ShopApp } from "./ShopApp";
import { PlayerInventoryApp } from "./PlayerInventoryApp";

export interface PartySummaryCoin {
  pp: number; gp: number; sp: number; cp: number;
}

export interface PartySummaryItem {
  name: string;
  quantity: number;
  category: string;
  ownerName: string;
  isSecret: boolean;
}

export interface PartySummary {
  grouped: Record<string, PartySummaryItem[]>;
  coins: PartySummaryCoin;
  totalCp: number;
  totalGpStr: string;
  hasItems: boolean;
}

export function buildPartySummary(
  partyActors: Actor[],
  isGM: boolean,
  currentUser: User | null,
  coins?: PartySummaryCoin,
  encMode: "slots" | "weight" = "slots"
): PartySummary {
  const summaryCoins = coins ?? { pp: 0, gp: 0, sp: 0, cp: 0 };

  // If coins weren't pre-computed (e.g. from PlayerInventoryApp), sum them here
  if (!coins) {
    for (const actor of partyActors) {
      const inv = FlagManager.getInventory(actor);
      summaryCoins.pp += inv.coins.pp;
      summaryCoins.gp += inv.coins.gp;
      summaryCoins.sp += inv.coins.sp;
      summaryCoins.cp += inv.coins.cp;
    }
  }

  const allItems: PartySummaryItem[] = [];

  for (const actor of partyActors) {
    const inv = FlagManager.getInventory(actor);
    const userOwnsActor =
      currentUser !== null &&
      !currentUser.isGM &&
      actor.testUserPermission(currentUser, "OWNER");

    for (const item of inv.items) {
      // Secret items: only GM or the actor's owner can see them
      if (item.isSecret && !isGM && !userOwnsActor) continue;

      const def = CatalogManager.getDefinition(item.definitionId);
      // In weight mode, hide container items that exist only to provide a storage zone
      if (encMode === "weight" && def?.grantsStorageZone) continue;

      allItems.push({
        name: item.name,
        quantity: item.quantity,
        category: def?.category ?? "Custom",
        ownerName: actor.name ?? "Unknown",
        isSecret: item.isSecret,
      });
    }
  }

  // Group by category, items sorted alphabetically within each group
  const grouped: Record<string, PartySummaryItem[]> = {};
  for (const item of [...allItems].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const totalCp =
    summaryCoins.cp +
    summaryCoins.sp * 10 +
    summaryCoins.gp * 100 +
    summaryCoins.pp * 500;

  const gpWhole = Math.floor(totalCp / 100);
  const spRem = Math.floor((totalCp % 100) / 10);
  const cpRem = totalCp % 10;
  const parts: string[] = [];
  if (gpWhole) parts.push(`${gpWhole} gp`);
  if (spRem) parts.push(`${spRem} sp`);
  if (cpRem || parts.length === 0) parts.push(`${cpRem} cp`);
  const totalGpStr = parts.join(" ");

  return {
    grouped,
    coins: summaryCoins,
    totalCp,
    totalGpStr,
    hasItems: allItems.length > 0,
  };
}

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

    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";

    const members = partyActors
      .map((actor) => {
        const inventory = FlagManager.getInventory(actor);
        const encumbrance = calculateEncumbrance(inventory, CatalogManager.getMap(), encMode);

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
    const partyTotals = { cp: 0, sp: 0, gp: 0, pp: 0 };
    for (const member of members) {
      if (!member) continue;
      partyTotals.cp += member.inventory.coins.cp;
      partyTotals.sp += member.inventory.coins.sp;
      partyTotals.gp += member.inventory.coins.gp;
      partyTotals.pp += member.inventory.coins.pp;
    }

    const isGM = g.user?.isGM ?? false;
    const currentUser = g.user ?? null;
    const partySummary = buildPartySummary(partyActors, isGM, currentUser, partyTotals, encMode);

    return {
      members,
      partyTotals,
      partySummary,
      isGM,
      encMode,
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

