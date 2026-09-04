import { TEMPLATES, SETTINGS, MODULE_ID } from "../constants";
import { FlagManager } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { definitionFor } from "../data/itemDefs";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { ShopApp } from "./ShopApp";
import { PlayerInventoryApp } from "./PlayerInventoryApp";
import { CharacterSheetApp } from "./CharacterSheetApp";
import { openXpAward } from "./XpAwardApp";
import { getPartyActors, getSharedActor, isSharedActor } from "../data/sharedStore";
import { displayQuantity } from "../data/consumables";
import type { PartyConvoy, PartyConvoyMember } from "../types";
import { t } from "../helpers/i18n";

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

/**
 * Slowest marching speed across the party: every member's own speed (which already
 * accounts for their own animals) plus every animal/vehicle they lead. The party can
 * only move as fast as its slowest part. Returns null if there is nobody to compare.
 *
 * **A tie names everybody in it.** Speeds come from a table of four tiers, so
 * ties are the normal case rather than a curiosity: three characters on 30 ft
 * and a mule on 30 ft are all setting the pace, and unloading any one of them
 * changes nothing. Reporting only the first one found made the rest invisible
 * and the fix look broken (Leander, 2026-08-31).
 */
export function buildPartyConvoy(
  partyActors: Actor[],
  encMode: "slots" | "weight" = "slots"
): PartyConvoy | null {
  const candidates: { speed: number; member: PartyConvoyMember }[] = [];

  for (const actor of partyActors) {
    const inv = FlagManager.getInventory(actor);
    const enc = calculateEncumbrance(inv, CatalogManager.getMap(), encMode);
    const name = actor.name ?? t("DOLMENWOOD.Common.Unknown");

    // The shared store is a container, not a marcher — only the animals and
    // vehicles parked in it affect the pace, never its own carried weight.
    if (!isSharedActor(actor)) {
      candidates.push({
        speed: enc.footSpeed,
        member: { name, kind: "character", owner: name },
      });
    }

    for (const animal of enc.animalSpeeds) {
      // A stuck animal or vehicle holds the whole party up. Leaving it behind
      // is the deliberate act of marking the zone dropped, which keeps it out
      // of animalSpeeds entirely — so anything reaching here still travels.
      candidates.push({
        speed: animal.effectiveSpeed,
        member: { name: animal.zoneName, kind: "animal", owner: name },
      });
    }
  }

  if (candidates.length === 0) return null;

  const speed = Math.min(...candidates.map((c) => c.speed));
  // In the order they were found: characters before the animals they lead, and
  // the party in the order the caller passed it. A sort would only shuffle
  // equals around from render to render.
  const slowest = candidates.filter((c) => c.speed === speed).map((c) => c.member);

  return {
    speed,
    slowest,
    slowestName: slowest[0].name,
    slowestKind: slowest[0].kind,
    slowestOwner: slowest[0].owner,
  };
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

      const def = definitionFor(item);
      // Hide animal/vehicle items — they appear as zone headers, not as inventory rows
      if (def?.grantsZone && def?.category === "Animals & Vehicles") continue;
      // In weight mode, hide container items that exist only to provide a storage zone
      if (encMode === "weight" && def?.grantsStorageZone) continue;

      allItems.push({
        name: item.name,
        // Bundles are counted in loose units, or the summary would disagree
        // with the number shown in the inventory
        quantity: displayQuantity(item, def),
        category: def?.category ?? t("DOLMENWOOD.Party.Summary.CustomCategory"),
        ownerName: actor.name ?? t("DOLMENWOOD.Common.Unknown"),
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
  if (gpWhole) parts.push(`${gpWhole} ${t("DOLMENWOOD.Currency.GP")}`);
  if (spRem) parts.push(`${spRem} ${t("DOLMENWOOD.Currency.SP")}`);
  if (cpRem || parts.length === 0) parts.push(`${cpRem} ${t("DOLMENWOOD.Currency.CP")}`);
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
      title: "DOLMENWOOD.PartyOverview.Title",
      resizable: true,
    },
    position: {
      // Capped so the window cannot open wider than the viewport on small screens
      width: Math.min(1200, window.innerWidth - 80),
      height: 780,
    },
    classes: ["dolmenwood-party-inventory", "party-overview"],
    actions: {
      openShop: PartyOverviewApp._onOpenShop,
      openSheet: PartyOverviewApp._onOpenSheet,
      openXp: PartyOverviewApp._onOpenXp,
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.PARTY_OVERVIEW,
    },
  };

  override async _prepareContext(
    _options: DeepPartial<ApplicationV2RenderOptions> & { isFirstRender: boolean }
  ): Promise<Record<string, unknown>> {
    const g = game as Game;

    // Auto-detect: all actors owned by a non-GM player, minus the shared store
    const partyActors = getPartyActors();
    const sharedActor = getSharedActor();

    const encMode = (g.settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots") as "slots" | "weight";

    const buildMember = (actor: Actor) => {
      {
        const inventory = FlagManager.getInventory(actor);
        const encumbrance = calculateEncumbrance(inventory, CatalogManager.getMap(), encMode);

        // Filter items for display: hide animals and (weight mode) container items
        const visibleItems = inventory.items
          .filter((item) => {
            const def = definitionFor(item);
            if (def?.grantsZone && def?.category === "Animals & Vehicles") return false;
            if (encMode === "weight" && def?.grantsStorageZone) return false;
            return true;
          })
          .map((item) => ({
            ...item,
            quantity: displayQuantity(item, definitionFor(item)),
          }));

        // Build zone sections for the compact column
        const extraZones = inventory.extraZones ?? [];
        const standardZones = encMode === "weight"
          ? [{ id: "equipped", name: t("DOLMENWOOD.Zone.Equipped") }]
          : [
              { id: "equipped", name: t("DOLMENWOOD.Zone.Equipped") },
              { id: "stowed",   name: t("DOLMENWOOD.Zone.Stowed") },
              { id: "tiny",     name: t("DOLMENWOOD.Zone.BeltPouch") },
            ];
        const allZoneDefs = [
          ...standardZones,
          ...extraZones.map((ez) => ({ id: ez.id, name: ez.name })),
        ];
        const knownZoneIds = new Set(allZoneDefs.map((z) => z.id));
        const extraZoneIds = new Set(extraZones.map((ez) => ez.id));
        const zoneSections = allZoneDefs
          .map((z) => ({
            id: z.id,
            name: z.name,
            items: visibleItems.filter((i) => i.zone === z.id),
          }))
          .filter((s) => s.items.length > 0 || extraZoneIds.has(s.id));

        // Items whose zone doesn't match any known zone (orphaned / unassigned)
        const unassignedItems = visibleItems.filter((i) => !knownZoneIds.has(i.zone));
        if (unassignedItems.length > 0) {
          zoneSections.push({ id: "_unassigned", name: t("DOLMENWOOD.Zone.Unassigned"), items: unassignedItems });
        }

        // **Unsorted gear is a question, not a state.** In weight mode the
        // stowed pile is what a character has picked up and not yet put into a
        // container: it counts against them, it has no home, and the table
        // should settle it before the day moves on. Leander's ask, and the
        // right place for it is the party window, where the whole party is
        // visible at once rather than one sheet at a time.
        const unsortedCount =
          encMode === "weight" ? visibleItems.filter((i) => i.zone === "stowed").length : 0;

        return {
          actor,
          actorId: actor.id,
          inventory: { ...inventory, items: visibleItems },
          zoneSections,
          encumbrance,
          isOwner: actor.isOwner,
          unsortedCount,
        };
      }
    };

    const members = partyActors.map(buildMember);
    // The shared store gets a narrower card at the end of the row: same zone
    // list, but no encumbrance bars — it carries nothing itself.
    const sharedMember = sharedActor ? buildMember(sharedActor) : null;

    // Party-wide totals — the shared purse is party money and counts
    const partyTotals = { cp: 0, sp: 0, gp: 0, pp: 0 };
    for (const member of [...members, ...(sharedMember ? [sharedMember] : [])]) {
      partyTotals.cp += member.inventory.coins.cp;
      partyTotals.sp += member.inventory.coins.sp;
      partyTotals.gp += member.inventory.coins.gp;
      partyTotals.pp += member.inventory.coins.pp;
    }

    const isGM = g.user?.isGM ?? false;
    const currentUser = g.user ?? null;
    const summaryActors = sharedActor ? [...partyActors, sharedActor] : partyActors;
    const partySummary = buildPartySummary(summaryActors, isGM, currentUser, partyTotals, encMode);
    // Marching pace of the whole group — the per-member speeds alone never say
    // how fast the party actually travels.
    const partyConvoy = buildPartyConvoy(summaryActors, encMode);

    // One line for the whole party, because "somebody has loose gear" is a
    // party-level fact: it is the thing to settle before travel, camp or a shop.
    const unsortedMembers = [...members, ...(sharedMember ? [sharedMember] : [])].filter(
      (m) => (m.unsortedCount ?? 0) > 0
    );
    const unsorted = unsortedMembers.length
      ? {
          items: unsortedMembers.reduce((sum, m) => sum + (m.unsortedCount ?? 0), 0),
          who: unsortedMembers.map((m) => m.actor.name ?? t("DOLMENWOOD.Party.Unsorted.Someone")).join(", "),
          // The verb agrees with how many people carry it, not with how many
          // items there are, so the template needs both counts.
          memberCount: unsortedMembers.length,
          several: unsortedMembers.length > 1,
        }
      : undefined;

    return {
      members,
      sharedMember,
      unsorted,
      partyConvoy,
      hasColumns: members.length > 0 || !!sharedMember,
      // minmax(…, 1fr), not a bare 1fr: `1fr` is shorthand for `minmax(auto, 1fr)`,
      // so a track still grows to fit its widest unbreakable content — which made
      // the columns come out at different widths purely because of how long the
      // characters' names are. A definite minimum takes content out of the
      // calculation entirely, so every character column is exactly equal.
      // The shared card is deliberately narrower than a character column.
      gridTemplate: [
        ...members.map(() => "minmax(160px, 1fr)"),
        ...(sharedMember ? ["minmax(112px, 0.7fr)"] : []),
      ].join(" "),
      partyTotals,
      partySummary,
      isGM,
      encMode,
      transactions: FlagManager.getTransactions().slice(-20).reverse(),
    };
  }

  override async _onRender(
    _context: DeepPartial<ApplicationV2RenderContext>,
    _options: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<void> {
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

  /** The session's XP — the party window is where every character is already listed. */
  private static _onOpenXp(this: PartyOverviewApp): void {
    openXpAward();
  }

  /** The attribute sheet for one member — the party window is where the GM is. */
  private static _onOpenSheet(this: PartyOverviewApp, _e: Event, target: HTMLElement): void {
    const actor = (game as Game).actors?.get(target.dataset.actorId ?? "");
    if (actor) CharacterSheetApp.open(actor);
  }

}

