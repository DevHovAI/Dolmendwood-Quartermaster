import { TEMPLATES, SOCKET_EVENTS, MODULE_ID, SETTINGS, GENERIC_INN_KEY } from "../constants";
import { FlagManager } from "../data/FlagManager";
import { getPartyActors } from "../data/sharedStore";
import { SocketHandler } from "../socket/SocketHandler";
import { requireActiveGM } from "../helpers/gm";
import { escapeHTML } from "../helpers/handlebars";
import {
  INN_SECTIONS,
  INN_QUALITIES,
  FOOD_GROUPS,
  BEVERAGE_GROUPS,
  DEFAULT_INN_NAME,
  LEGACY_INN_NAME,
  CONTAINER_SPECS,
  costToCp,
  withPriceFactor,
  qualityLabel,
  sectionLabel,
  groupLabel,
  containerLabel,
  resolveContainer,
  containerCost,
} from "../data/innData";
import type {
  InnQuality,
  InnSection,
  InnEntry,
  InnCost,
  Currency,
  DrawRange,
  ContainerKind,
  ContainerChoice,
} from "../data/innData";
import {
  getInnConfig,
  saveInnConfig,
  deleteInnConfig,
  hasStoredConfig,
  cloneConfig,
  seedSection,
  sectionQuality,
  sellsContainers,
} from "../data/innConfig";
import type { InnConfig } from "../data/innConfig";
import { dailyEntries, getInnDay, advanceInnDay, getDayLog } from "../data/innMenu";
import { CatalogManager } from "../data/CatalogManager";
import { calculateEncumbrance } from "../data/EncumbranceCalculator";
import { getEncumbranceMode, zonesAcceptingItems } from "../data/zoneGrants";
import type { InnPurchasePayload, InventoryItem, ItemDefinition, CharacterInventory } from "../types";
import { t } from "../helpers/i18n";
// Aliased: in this file a "coin unit" is what a price is written in.
import { coinLabel as coinUnit } from "../data/coins";

interface InnState {
  name: string;
  quality: InnQuality;
  /**
   * Whether the party may reach the toolbar inn at all.
   *
   * **A placed inn is not governed by this.** Its note on the map is its own
   * door, and Foundry already decides who can see a note. This is for the inn
   * that has no place: the Referee names it, sets its quality, and only then is
   * it a thing the players can walk into (Dolmenmaster, 2026-08-31).
   */
  released?: boolean;
}

/** The groups a section is divided into — and therefore what the daily roll draws against. */
function groupsFor(section: InnSection): { key: string; label: string }[] {
  if (section === "food") return FOOD_GROUPS;
  if (section === "beverages") return BEVERAGE_GROUPS;
  return [];
}

/**
 * Section keys as they came out of an older note config.
 * The menu used to be split lodgings/stabling/food/beverages; stabling has since
 * been folded into the broader "extras". Without this a note saved before the
 * rebuild would filter every section away and the inn would look empty.
 */
const LEGACY_SECTION_KEYS: Record<string, InnSection> = {
  lodgings: "lodging",
  stabling: "extras",
};

function normaliseSectionKeys(keys: string[]): InnSection[] {
  const known = new Set(INN_SECTIONS.map((s) => s.key as string));
  const out = new Set<InnSection>();
  for (const key of keys) {
    if (known.has(key)) out.add(key as InnSection);
    else if (LEGACY_SECTION_KEYS[key]) out.add(LEGACY_SECTION_KEYS[key]);
  }
  return [...out];
}

export class InnApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private selectedActorId: string | null = null;
  /** Empty for the toolbar inn — it is not a named establishment. */
  private innName: string = "";
  private quality: InnQuality = "common";
  private localCategories: string[] = [];
  private priceFactor = 100;
  /** True once a map note or market entry has configured this window. */
  private isConfigured = false;
  /** Toolbar inn only — see {@link InnState.released}. */
  private released = false;
  private _scrollTop = 0;

  constructor(options: DeepPartial<ApplicationV2Options> = {}) {
    super(options);
    // The toolbar inn has no note behind it, so its name and quality live in a
    // world setting. Restoring here rather than during _prepareContext is what
    // makes setConfig win: a map note configures the window right after this
    // runs, and a note's own settings must always beat the remembered ones.
    const saved = (game as Game).settings?.get(MODULE_ID, SETTINGS.INN_STATE) as InnState | undefined;
    // The old default is treated as no name at all, so a world that stored it
    // before the toolbar inn became nameless does not keep showing it.
    if (saved?.name && saved.name !== LEGACY_INN_NAME) this.innName = saved.name;
    if (saved?.quality) this.quality = saved.quality;
    this.released = saved?.released === true;
  }

  /**
   * Whether the toolbar inn is open to the party.
   *
   * Read from the setting rather than from an instance, because the two places
   * that have to ask — the scene toolbar and the day bar — ask before there is
   * a window to ask.
   */
  static isReleased(): boolean {
    const saved = (game as Game).settings?.get(MODULE_ID, SETTINGS.INN_STATE) as InnState | undefined;
    return saved?.released === true;
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-inn",
    window: {
      title: "DOLMENWOOD.Inn.Title",
      resizable: true,
    },
    position: {
      width: 620,
      height: 760,
    },
    classes: ["dolmenwood-party-inventory", "inn-panel"],
    actions: {
      buyForSelf: InnApp._onBuyForSelf,
      buyForOther: InnApp._onBuyForOther,
      buyContainer: InnApp._onBuyContainer,
      setQuality: InnApp._onSetQuality,
      toggleRelease: InnApp._onToggleRelease,
      newDay: InnApp._onNewDay,
      rerollMenu: InnApp._onRerollMenu,
      addEntry: InnApp._onAddEntry,
      editEntry: InnApp._onEditEntry,
      deleteEntry: InnApp._onDeleteEntry,
      editSection: InnApp._onEditSection,
      resetSection: InnApp._onResetSection,
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.INN,
    },
  };

  /** Called externally to pre-configure the inn before rendering */
  setConfig(name: string, quality: InnQuality, categories?: string[], priceFactor = 100): void {
    this.innName = name;
    this.quality = quality;
    this.localCategories = categories ?? [];
    this.priceFactor = priceFactor;
    this.isConfigured = true;
  }

  override get title(): string {
    return this.innName || DEFAULT_INN_NAME;
  }

  /**
   * Where this inn's own tables are stored. Keyed by name, exactly like a shop's
   * stock — so renaming an inn starts it over from the book defaults. The
   * nameless toolbar inn gets a reserved key so it can be edited all the same.
   */
  private get innKey(): string {
    return this.innName || GENERIC_INN_KEY;
  }

  private config(): InnConfig {
    return getInnConfig(this.innKey, this.quality);
  }

  // ─── Context ───────────────────────────────────────────────────────────────

  override async _prepareContext(
    _options: DeepPartial<ApplicationV2RenderOptions> & { isFirstRender: boolean }
  ): Promise<Record<string, unknown>> {
    const g = game as Game;
    const isGM = g.user?.isGM ?? false;
    // Re-read rather than trusted from the constructor: the Referee may have
    // opened or shut the inn since this window was built, and a refresh is the
    // only warning a player's copy gets. A placed inn has no release to read.
    if (!this.isConfigured) this.released = InnApp.isReleased();
    const config = this.config();
    const day = getInnDay();
    const key = this.innKey;

    // Who may be picked as the payer: the GM acts for anyone, a player only for
    // the characters they own.
    const party = getPartyActors();
    const actors = isGM ? party : party.filter((a) => a.isOwner);

    if (!this.selectedActorId || !actors.some((a) => a.id === this.selectedActorId)) {
      this.selectedActorId = actors[0]?.id ?? null;
    }
    const selectedActor = this.selectedActorId ? g.actors?.get(this.selectedActorId) ?? null : null;

    const inventory = selectedActor ? FlagManager.getInventory(selectedActor) : null;
    const coins = inventory?.coins ?? { pp: 0, gp: 0, sp: 0, cp: 0 };
    const walletCp = coins.cp + coins.sp * 10 + coins.gp * 100 + coins.pp * 500;

    // Only the sections this inn actually serves. A map note may restrict them
    // (a tavern with no rooms), and an empty list means everything.
    const wanted = normaliseSectionKeys(this.localCategories);
    const visible = wanted.length > 0
      ? INN_SECTIONS.filter((s) => wanted.includes(s.key))
      : INN_SECTIONS;

    const sections = visible.map(({ key: sectionKey, icon }) => {
      const label = sectionLabel(sectionKey);
      const q = sectionQuality(config, sectionKey);
      const entries = dailyEntries(key, config, sectionKey, day);

      // Bucket by group, then order: the section's declared groups first, in
      // their book order, and anything else (GM-added lines) after them.
      const housesells = sellsContainers(config, sectionKey);

      const buckets = new Map<string, Record<string, unknown>[]>();
      for (const entry of entries) {
        const cost = withPriceFactor(entry.cost, this.priceFactor);

        // Two things leave the inn in a pack rather than being consumed here:
        // drink by the bottle or cask, and goods like travel rations.
        const kind = sectionKey === "beverages" ? resolveContainer(entry, housesells) : null;
        const takeAway = this._takeAwayView(entry, kind, walletCp);

        const view = {
          id: entry.id,
          section: sectionKey,
          name: entry.name,
          description: entry.description ?? "",
          tag: entry.tag ?? "",
          unit: entry.unit ?? "",
          cost: { ...cost, currencyLabel: t(`DOLMENWOOD.Currency.${cost.currency.toUpperCase()}`) },
          canAfford: walletCp >= costToCp(cost),
          fixed: !!entry.fixed,
          canEdit: isGM,
          buyLabel: selectedActor
            ? t("DOLMENWOOD.Inn.Buy.For", { who: selectedActor.name ?? "" })
            : t("DOLMENWOOD.Inn.TakeAway.Buy"),
          takeAway,
          // Goods are bought, not consumed here, so the eat-and-drink-here
          // buttons would be meaningless on them.
          consumable: !entry.grantsItem,
        };
        const groupKey = entry.group ?? "";
        const bucket = buckets.get(groupKey);
        if (bucket) bucket.push(view);
        else buckets.set(groupKey, [view]);
      }

      const declared = groupsFor(sectionKey);
      const groups: { key: string; label: string; entries: unknown[] }[] = [];
      for (const { key: gk } of declared) {
        const gLabel = groupLabel(gk);
        const bucket = buckets.get(gk);
        if (bucket) {
          groups.push({ key: gk, label: gLabel, entries: bucket });
          buckets.delete(gk);
        }
      }
      for (const [gk, bucket] of buckets) {
        groups.push({ key: gk, label: gk === "" ? "" : groupLabel(gk), entries: bucket });
      }

      return {
        key: sectionKey,
        label,
        icon,
        quality: q,
        qualityLabel: qualityLabel(q),
        showQuality: q !== config.quality,
        text: config.sections[sectionKey].text,
        groups,
        isEmpty: entries.length === 0,
        canEdit: isGM,
      };
    });

    // The day's board. Every party member is listed, so an empty stomach is as
    // visible as a full one.
    const log = getDayLog();
    const dayLog = party.map((actor) => {
      const row = log[actor.id ?? ""] ?? {};
      return {
        name: actor.name,
        lodging: row.lodging ?? "",
        food: row.food ?? "",
        complete: !!row.lodging && !!row.food,
      };
    });

    return {
      innName: this.innName,
      // What the heading shows when the inn has no name of its own.
      displayName: this.innName || DEFAULT_INN_NAME,
      quality: config.quality,
      qualityLabel: qualityLabel(config.quality),
      // A placed inn's quality was decided when it went on the map; only the
      // ad-hoc toolbar inn may still be switched.
      canSetQuality: isGM && !this.isConfigured,
      // The same rule as the quality buttons, and deliberately so: the inn that
      // can be named and graded is exactly the inn that has no note behind it,
      // and so the only one whose door this button is.
      canRelease: isGM && !this.isConfigured,
      released: this.released,
      qualities: INN_QUALITIES.map((q) => ({ ...q, label: qualityLabel(q.key), active: q.key === config.quality })),
      isGM,
      priceFactor: this.priceFactor,
      actors,
      selectedActorId: selectedActor?.id ?? null,
      selectedActorName: selectedActor?.name ?? "",
      coins,
      // `day` is deliberately not passed to the template: it still seeds the
      // menu roll and still resets the board, but the number itself means
      // nothing at the table and only invited being read as a date.
      dayLog,
      sections,
    };
  }

  // ─── Things carried away: bottles, casks and goods ─────────────────────────

  /**
   * What the take-away button offers, or null when this line is consumed here.
   *
   * Two sources, one shape: a drink sold by the bottle or cask, and a line that
   * hands over a catalog item (`grantsItem`) such as travel rations.
   */
  private _takeAwayView(entry: InnEntry, kind: ContainerKind | null, walletCp: number) {
    if (entry.grantsItem) {
      const def = CatalogManager.getDefinition(entry.grantsItem);
      const cost = withPriceFactor(entry.cost, this.priceFactor);
      const weight = def?.weight ?? 0;
      return {
        label: entry.name,
        icon: "fa-basket-shopping",
        weight,
        cost,
        canAfford: walletCp >= costToCp(cost),
        title: weight
          ? t("DOLMENWOOD.Inn.Buy.HintWeight", {
              name: entry.name,
              cost: `${cost.amount} ${coinUnit(cost.currency)}`,
              weight,
            })
          : t("DOLMENWOOD.Inn.Buy.Hint", {
              name: entry.name,
              cost: `${cost.amount} ${coinUnit(cost.currency)}`,
            }),
      };
    }

    if (!kind) return null;

    const spec = CONTAINER_SPECS[kind];
    const cost = withPriceFactor(containerCost(entry.cost, kind), this.priceFactor);
    return {
      label: containerLabel(kind),
      icon: spec.icon,
      weight: spec.weight,
      cost,
      canAfford: walletCp >= costToCp(cost),
      title: t("DOLMENWOOD.Inn.Container.Hint", {
        container: containerLabel(kind),
        portions: spec.portions,
        cost: `${cost.amount} ${coinUnit(cost.currency)}`,
        weight: spec.weight,
      }),
    };
  }

  /**
   * The thing that actually lands in the inventory.
   *
   * A `grantsItem` line hands over the **catalog** item itself, so a ration
   * bought at an inn is the same row as one bought in a shop and the two stack.
   * A bottle or cask has no catalog entry, so it is built as a custom definition
   * with `maxUses` set to the number of portions — which makes it an ordinary
   * *bundle* to the rest of the module: the "3/5" display, the per-portion
   * weight of a part-empty one and the merging of two alike all already exist.
   */
  private _buildTakeAwayItem(
    entry: InnEntry,
    kind: ContainerKind | null,
    zone: string,
    amount: number
  ): InventoryItem {
    const quantity = Math.max(1, amount);

    if (entry.grantsItem) {
      const def = CatalogManager.getDefinition(entry.grantsItem);
      return {
        id: foundry.utils.randomID(),
        definitionId: entry.grantsItem,
        name: def?.name ?? entry.name,
        quantity,
        zone,
        isSecret: false,
        notes: "",
        ...(def?.maxUses ? { uses: def.maxUses } : {}),
      };
    }

    const spec = CONTAINER_SPECS[kind!];
    const name = t("DOLMENWOOD.Inn.TakeAway.Of", {
      container: containerLabel(kind!),
      name: entry.name,
    });
    const definition: Partial<ItemDefinition> = {
      isCustom: true,
      name,
      category: "Adventuring Gear",
      subcategory: "Camping and Travel",
      size: "normal",
      cannotBeStowed: false,
      unit: "portion",
      qualities: [],
      tags: [],
      weight: spec.weight,
      maxUses: spec.portions,
      // One bottle per row with its own fill level, like a quiver — not a
      // running total of loose portions that could climb past a cask's capacity.
      singleContainer: true,
      icon: spec.icon,
      description: entry.description ?? "",
      // The item's own list value, before this house's price factor — the factor
      // is what the innkeeper charges, not what the goods are worth elsewhere.
      cost: containerCost(entry.cost, kind!),
    };
    return {
      id: foundry.utils.randomID(),
      definitionId: "",
      name,
      quantity,
      zone,
      isSecret: false,
      notes: "",
      uses: spec.portions,
      customDefinition: definition,
    };
  }

  private static _onBuyContainer(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const section = target.dataset.section as InnSection;
    const entryId = target.dataset.entryId!;
    const config = this.config();
    const entry = config.sections[section]?.entries.find((e) => e.id === entryId);
    if (!entry) return;

    const kind = entry.grantsItem ? null : resolveContainer(entry, sellsContainers(config, section));
    if (!kind && !entry.grantsItem) return;

    const payer = this.selectedActorId ? (game as Game).actors?.get(this.selectedActorId) ?? null : null;
    if (!payer) {
      ui.notifications?.warn(t("DOLMENWOOD.Inn.NoCharacter"));
      return;
    }

    const unitCost = kind
      ? withPriceFactor(containerCost(entry.cost, kind), this.priceFactor)
      : withPriceFactor(entry.cost, this.priceFactor);

    new BuyTakeAwayDialog(
      entry,
      kind,
      unitCost,
      payer,
      getPartyActors(),
      (recipientId, zone, amount) =>
        this._purchase(section, entryId, recipientId, { kind, zone, amount })
    ).render(true);
  }

  override render(
    options?: boolean | DeepPartial<ApplicationV2RenderOptions>,
    _options?: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<this> {
    this._scrollTop = this.element?.querySelector<HTMLElement>(".window-content")?.scrollTop ?? 0;
    return super.render(options as boolean, _options);
  }

  override async _onRender(
    _context: DeepPartial<ApplicationV2RenderContext>,
    _options: DeepPartial<ApplicationV2RenderOptions>
  ): Promise<void> {
    // **A player must not be left holding a window the Referee has just shut.**
    // Taking the inn back hides its doors, but a window already open is not a
    // door — it would sit there working until it was closed by hand. The
    // refresh that follows a take-back re-renders every module window, and this
    // is where that re-render becomes a closed one.
    if (!((game as Game).user?.isGM ?? false) && !this.isConfigured && !this.released) {
      void this.close();
      return;
    }

    const el = this.element;

    const wc = el.querySelector<HTMLElement>(".window-content");
    if (wc) wc.scrollTop = this._scrollTop;

    el.querySelector<HTMLSelectElement>("#inn-actor-select")?.addEventListener("change", (e) => {
      this.selectedActorId = (e.target as HTMLSelectElement).value;
      this.render(false);
    });

    el.querySelector<HTMLInputElement>("#inn-name-input")?.addEventListener("change", async (e) => {
      // Clearing the field is allowed: an unnamed inn is simply "Inn".
      const next = (e.target as HTMLInputElement).value.trim();
      if (next === this.innName) return;
      this.innName = next;
      await this._saveState();
      this.render(false);
    });
  }

  /**
   * Remember name and quality — but only for the toolbar inn.
   *
   * A map note or market entry carries its own settings and re-applies them on
   * every open, so saving those here would do nothing for that inn and would
   * quietly overwrite what the toolbar inn is supposed to come back as.
   */
  private async _saveState(): Promise<void> {
    if (this.isConfigured) return;
    await (game as Game).settings?.set(MODULE_ID, SETTINGS.INN_STATE, {
      name: this.innName,
      quality: this.quality,
      released: this.released,
    });
  }

  /**
   * Open the inn to the party, or take it back.
   *
   * **Opening it is an announcement, not a permission change.** The inn's door
   * is the toolbar button and the day bar's shortcut, both of which ask
   * {@link InnApp.isReleased}; the chat message is how the party learns the
   * door is there at all, the same way a released loot box announces itself.
   *
   * Taking it back closes the window on anyone who has it open — the refresh
   * every client already listens for does that — so a Referee who released the
   * wrong inn is not left arguing with a window they cannot reach.
   */
  private static async _onToggleRelease(this: InnApp): Promise<void> {
    if (!((game as Game).user?.isGM ?? false)) return;
    if (this.isConfigured) return;

    this.released = !this.released;
    await this._saveState();
    if (this.released) await this._announceRelease();
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render(false);
  }

  /** How the party finds out there is an inn to walk into. */
  private async _announceRelease(): Promise<void> {
    const name = this.innName || DEFAULT_INN_NAME;
    await ChatMessage.create({
      content: `
        <div class="dw-inn-message">
          <h3><i class="fas fa-beer-mug-empty"></i> ${escapeHTML(name)}</h3>
          <p>${t("DOLMENWOOD.Inn.Chat.Open", { quality: escapeHTML(qualityLabel(this.quality)) })}</p>
        </div>`,
    } as Parameters<typeof ChatMessage.create>[0]);
  }

  /** Persist an edited config and make sure the other clients see it. */
  private async _saveConfig(config: InnConfig): Promise<void> {
    await saveInnConfig(this.innKey, config);
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render(false);
  }

  // ─── Buying ────────────────────────────────────────────────────────────────

  /**
   * Charge the selected character and put `forActorId`'s name on the board.
   * The two are only different when someone stands a round.
   */
  private async _purchase(
    section: InnSection,
    entryId: string,
    forActorId: string,
    takeAway?: { kind: ContainerKind | null; zone: string; amount: number }
  ): Promise<void> {
    const g = game as Game;
    const payerId = this.selectedActorId;
    if (!payerId) {
      ui.notifications?.warn(t("DOLMENWOOD.Inn.NoCharacter"));
      return;
    }
    const payer = g.actors?.get(payerId);
    const recipient = g.actors?.get(forActorId);
    if (!payer || !recipient) return;

    const config = this.config();
    const entry = config.sections[section]?.entries.find((e) => e.id === entryId);
    if (!entry) return;

    const item = takeAway
      ? this._buildTakeAwayItem(entry, takeAway.kind, takeAway.zone, takeAway.amount)
      : null;
    const amount = takeAway ? Math.max(1, takeAway.amount) : 1;
    const label = item ? (amount > 1 ? `${amount} × ${item.name}` : item.name) : entry.name;

    const unitCost =
      takeAway?.kind
        ? withPriceFactor(containerCost(entry.cost, takeAway.kind), this.priceFactor)
        : withPriceFactor(entry.cost, this.priceFactor);
    const cost: InnCost = { amount: unitCost.amount * amount, currency: unitCost.currency };
    const costCp = costToCp(cost);

    const inventory = FlagManager.getInventory(payer);
    const walletCp =
      inventory.coins.cp + inventory.coins.sp * 10 +
      inventory.coins.gp * 100 + inventory.coins.pp * 500;

    if (walletCp < costCp) {
      ui.notifications?.warn(
        t("DOLMENWOOD.Inn.CannotAffordNamed", { payer: payer.name ?? "", what: label })
      );
      return;
    }

    // The coins are deducted on the GM's client. Without one the message goes
    // nowhere and the guest would be told they paid while the purse stays full.
    if (!requireActiveGM(t("DOLMENWOOD.Inn.NeedsGM"))) return;

    const forSomeoneElse = recipient.id !== payer.id;

    // A take-away purchase was already confirmed in its own dialog, where the
    // recipient, the target zone and the weight were all on screen — asking
    // again here would be a second confirmation of the same decision.
    if (!takeAway) {
      const confirmed = await Dialog.confirm({
        title: t("DOLMENWOOD.Inn.Pay.Title", { what: label }),
        content: forSomeoneElse
          ? t("DOLMENWOOD.Inn.Pay.BodyFor", {
              cost: `${cost.amount} ${coinUnit(cost.currency)}`,
              what: escapeHTML(label),
              who: escapeHTML(recipient.name ?? ""),
            })
          : t("DOLMENWOOD.Inn.Pay.Body", {
              cost: `${cost.amount} ${coinUnit(cost.currency)}`,
              what: escapeHTML(label),
            }),
      });
      if (!confirmed) return;
    }

    const totalCost = { cp: 0, sp: 0, gp: 0, pp: 0 };
    totalCost[cost.currency] = cost.amount;

    const payload: InnPurchasePayload = {
      actorId: payerId,
      forActorId,
      itemName: label,
      section,
      totalCost,
      ...(item ? { item } : {}),
    };
    SocketHandler.emitOrHandle(SOCKET_EVENTS.INN_PURCHASE, payload);

    ui.notifications?.info(
      forSomeoneElse
        ? t("DOLMENWOOD.Inn.Paid.ForSomeoneElse", {
            payer: payer.name ?? "",
            who: recipient.name ?? "",
            what: label,
          })
        : t(takeAway ? "DOLMENWOOD.Inn.Paid.Self" : "DOLMENWOOD.Inn.Paid.SelfEnjoy", {
            payer: payer.name ?? "",
            what: label,
          })
    );
    this.render(false);
  }

  private static async _onBuyForSelf(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!this.selectedActorId) {
      ui.notifications?.warn(t("DOLMENWOOD.Inn.NoCharacter"));
      return;
    }
    await this._purchase(
      target.dataset.section as InnSection,
      target.dataset.entryId!,
      this.selectedActorId
    );
  }

  private static async _onBuyForOther(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const section = target.dataset.section as InnSection;
    const entryId = target.dataset.entryId!;
    const others = getPartyActors().filter((a) => a.id !== this.selectedActorId);
    if (others.length === 0) {
      ui.notifications?.warn(t("DOLMENWOOD.Inn.NobodyElse"));
      return;
    }

    const options = others
      .map((a) => `<option value="${a.id}">${escapeHTML(a.name ?? "")}</option>`)
      .join("");

    const chosen = await new Promise<string | null>((resolve) => {
      new Dialog({
        title: t("DOLMENWOOD.Inn.Treat.Title"),
        content: `
          <form class="dw-form qm-form">
            <p class="qm-hint">${t("DOLMENWOOD.Inn.Treat.Hint")}</p>
            <div class="form-group">
              <label>${t("DOLMENWOOD.Inn.Treat.Recipient")}</label>
              <select id="inn-recipient">${options}</select>
            </div>
          </form>`,
        buttons: {
          ok: {
            label: t("DOLMENWOOD.Inn.Treat.Continue"),
            icon: '<i class="fas fa-people-group"></i>',
            callback: (html: JQuery) => resolve((html.find("#inn-recipient").val() as string) ?? null),
          },
          cancel: { label: t("DOLMENWOOD.Common.Cancel"), callback: () => resolve(null) },
        },
        default: "ok",
      }).render(true);
    });

    if (!chosen) return;
    await this._purchase(section, entryId, chosen);
  }

  // ─── The day ───────────────────────────────────────────────────────────────

  private static async _onNewDay(this: InnApp): Promise<void> {
    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Inn.NewDay.Title"),
      content: t("DOLMENWOOD.Inn.NewDay.Body"),
    });
    if (!confirmed) return;
    await advanceInnDay();
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render(false);
  }

  private static async _onRerollMenu(this: InnApp): Promise<void> {
    const config = cloneConfig(this.config());
    config.reroll = (config.reroll ?? 0) + 1;
    await this._saveConfig(config);
  }

  // ─── Editing the tables ────────────────────────────────────────────────────

  private static _onAddEntry(this: InnApp, _event: Event, target: HTMLElement): void {
    const section = target.dataset.section as InnSection;
    new InnEntryDialog(section, null, async (entry) => {
      const config = cloneConfig(this.config());
      config.sections[section].entries.push(entry);
      await this._saveConfig(config);
    }).render(true);
  }

  private static _onEditEntry(this: InnApp, _event: Event, target: HTMLElement): void {
    const section = target.dataset.section as InnSection;
    const entryId = target.dataset.entryId!;
    const existing = this.config().sections[section].entries.find((e) => e.id === entryId);
    if (!existing) return;

    new InnEntryDialog(section, existing, async (entry) => {
      const config = cloneConfig(this.config());
      const list = config.sections[section].entries;
      const idx = list.findIndex((e) => e.id === entryId);
      if (idx === -1) return;
      list[idx] = entry;
      await this._saveConfig(config);
    }).render(true);
  }

  private static async _onDeleteEntry(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const section = target.dataset.section as InnSection;
    const entryId = target.dataset.entryId!;
    const entry = this.config().sections[section].entries.find((e) => e.id === entryId);
    if (!entry) return;

    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Inn.RemoveLine.Title"),
      content: t("DOLMENWOOD.Inn.RemoveLine.Body", { name: escapeHTML(entry.name) }),
    });
    if (!confirmed) return;

    const config = cloneConfig(this.config());
    config.sections[section].entries = config.sections[section].entries.filter((e) => e.id !== entryId);
    await this._saveConfig(config);
  }

  private static _onEditSection(this: InnApp, _event: Event, target: HTMLElement): void {
    const section = target.dataset.section as InnSection;
    const config = this.config();

    new InnSectionDialog(
      section,
      config,
      async ({ text, draw, quality, sellsContainers: containers }) => {
        const next = cloneConfig(this.config());
        const houseQuality = next.quality;

        // Changing the section's quality means a different table entirely, so it
        // is reseeded from the book rather than patched.
        const previous = sectionQuality(next, section);
        if (quality !== previous) {
          next.sections[section] = seedSection(section, quality);
          if (quality === houseQuality) delete next.sectionQuality[section];
          else next.sectionQuality[section] = quality;
        } else {
          next.sections[section].text = text;
          next.sections[section].draw = draw;
        }
        // Kept across a reseed: whether the house sells drink to take away is a
        // property of the establishment, not of the quality table behind it.
        if (containers !== undefined) next.sections[section].sellsContainers = containers;
        await this._saveConfig(next);
      }
    ).render(true);
  }

  private static async _onResetSection(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const section = target.dataset.section as InnSection;
    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Inn.ResetSection.Title"),
      content: t("DOLMENWOOD.Inn.ResetSection.Body"),
    });
    if (!confirmed) return;

    const config = cloneConfig(this.config());
    config.sections[section] = seedSection(section, sectionQuality(config, section));
    await this._saveConfig(config);
  }

  private static async _onSetQuality(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const next = target.dataset.quality as InnQuality;
    if (next === this.quality) return;

    // The three quality levels are different tables, not a bigger version of the
    // same one — so switching cannot preserve edits made to the old one.
    if (hasStoredConfig(this.innKey)) {
      const confirmed = await Dialog.confirm({
        title: t("DOLMENWOOD.Inn.ChangeQuality.Title"),
        content: t("DOLMENWOOD.Inn.ChangeQuality.Body"),
      });
      if (!confirmed) return;
      await deleteInnConfig(this.innKey);
    }

    this.quality = next;
    await this._saveState();
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
    this.render(false);
  }
}

// ─── Buying a bottle or cask ──────────────────────────────────────────────────

/**
 * One dialog for the whole decision: who gets it, where it goes, what it costs
 * and what it does to their pace. Splitting that across a recipient picker, a
 * zone picker and a confirmation would ask three questions about one purchase.
 */
class BuyTakeAwayDialog extends Dialog {
  constructor(
    entry: InnEntry,
    kind: ContainerKind | null,
    unitCost: InnCost,
    payer: Actor,
    party: Actor[],
    onConfirm: (recipientId: string, zone: string, amount: number) => void
  ) {
    const spec = kind ? CONTAINER_SPECS[kind] : null;
    const def = entry.grantsItem ? CatalogManager.getDefinition(entry.grantsItem) : undefined;
    const title = spec
      ? t("DOLMENWOOD.Inn.TakeAway.Of", { container: containerLabel(kind!), name: entry.name })
      : (def?.name ?? entry.name);
    const unitWeight = spec ? spec.weight : (def?.weight ?? 0);

    // The payer first — buying one for yourself is the ordinary case.
    const candidates = [payer, ...party.filter((a) => a.id !== payer.id)];
    const recipientOptions = candidates
      .map((a) => `<option value="${a.id}">${escapeHTML(a.name ?? "")}</option>`)
      .join("");

    const priceText = `${unitCost.amount} ${coinUnit(unitCost.currency)}`;
    const subtitle = spec
      ? t("DOLMENWOOD.Inn.TakeAway.SubContainer", {
          portions: spec.portions,
          price: spec.pricePortions,
          cost: priceText,
          weight: spec.weight,
        })
      : unitWeight
        ? t("DOLMENWOOD.Inn.TakeAway.SubPlainWeight", { cost: priceText, weight: unitWeight })
        : t("DOLMENWOOD.Inn.TakeAway.SubPlain", { cost: priceText });

    super({
      title: spec
        ? t("DOLMENWOOD.Inn.TakeAway.TitleContainer", { container: containerLabel(kind!) })
        : t("DOLMENWOOD.Inn.TakeAway.TitlePlain"),
      content: `
        <form class="dw-form qm-form">
          <p class="qm-lead">
            <strong>${escapeHTML(title)}</strong><br />
            <span class="qm-lead-sub">${subtitle}</span>
          </p>
          <div class="form-group">
            <label>${t("DOLMENWOOD.Common.HowMany")}</label>
            <div class="qm-field">
              <input type="number" id="inn-takeaway-amount" value="1" min="1" step="1" />
            </div>
          </div>
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.TakeAway.For")}</label>
            <div class="qm-field"><select id="inn-takeaway-recipient">${recipientOptions}</select></div>
          </div>
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.TakeAway.Into")}</label>
            <div class="qm-field"><select id="inn-takeaway-zone"></select></div>
          </div>
          <p id="inn-takeaway-total" class="qm-total"></p>
          <p id="inn-takeaway-warning" class="notification warning qm-warning" hidden></p>
          <p class="qm-hint">
            ${t("DOLMENWOOD.Inn.TakeAway.Pays", { payer: escapeHTML(payer.name ?? "") })}
          </p>
        </form>`,
      buttons: {
        buy: {
          label: t("DOLMENWOOD.Inn.TakeAway.Buy"),
          icon: `<i class="fas ${spec ? spec.icon : "fa-basket-shopping"}"></i>`,
          callback: (html: JQuery) => {
            const recipientId = html.find("#inn-takeaway-recipient").val() as string;
            const zone = html.find("#inn-takeaway-zone").val() as string;
            const amount = Math.max(1, parseInt(html.find("#inn-takeaway-amount").val() as string, 10) || 1);
            if (!recipientId || !zone) {
              ui.notifications?.warn(t("DOLMENWOOD.Inn.TakeAway.Nowhere"));
              return;
            }
            onConfirm(recipientId, zone, amount);
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel") },
      },
      default: "buy",
    });

    this.entry = entry;
    this.kind = kind;
    this.candidates = candidates;
    this.unitCost = unitCost;
    this.unitWeight = unitWeight;
    this.itemName = title;
  }

  private readonly entry: InnEntry;
  private readonly kind: ContainerKind | null;
  private readonly candidates: Actor[];
  private readonly unitCost: InnCost;
  private readonly unitWeight: number;
  private readonly itemName: string;

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const refresh = () => {
      const recipientId = html.find("#inn-takeaway-recipient").val() as string;
      const recipient = this.candidates.find((a) => a.id === recipientId);
      const zoneSelect = html.find("#inn-takeaway-zone");
      const warning = html.find("#inn-takeaway-warning");
      const totalLine = html.find("#inn-takeaway-total");
      const amount = Math.max(1, parseInt(html.find("#inn-takeaway-amount").val() as string, 10) || 1);

      totalLine.text(
        `Total: ${this.unitCost.amount * amount} ${this.unitCost.currency}` +
          (this.unitWeight ? `, ${this.unitWeight * amount} wt` : "")
      );

      if (!recipient) {
        zoneSelect.html("");
        return;
      }

      const spec = this.kind ? CONTAINER_SPECS[this.kind] : null;
      const encMode = getEncumbranceMode();
      const inventory = FlagManager.getInventory(recipient);

      // Stand-ins carrying the real weight, so the zone list rejects what
      // genuinely will not fit rather than guessing — and it has to be the whole
      // amount, since seven days of rations is a very different load from one.
      const probes: InventoryItem[] = Array.from({ length: amount }, () => ({
        id: foundry.utils.randomID(),
        definitionId: this.entry.grantsItem ?? "",
        name: this.itemName,
        quantity: 1,
        zone: "stowed",
        isSecret: false,
        notes: "",
        ...(spec
          ? {
              uses: spec.portions,
              customDefinition: {
                isCustom: true,
                weight: spec.weight,
                size: "normal" as const,
                maxUses: spec.portions,
                singleContainer: true,
              },
            }
          : {}),
      }));

      const previous = zoneSelect.val() as string | undefined;
      const options = zonesAcceptingItems(inventory, probes, encMode);
      zoneSelect.html(
        options
          .map((o) => {
            const label = o.warning
              ? t("DOLMENWOOD.Inn.Zone.Warning", { name: escapeHTML(o.name), warning: o.warning })
              : o.detail
                ? t("DOLMENWOOD.Inn.Zone.Detail", { name: escapeHTML(o.name), detail: o.detail })
                : escapeHTML(o.name);
            return `<option value="${o.id}">${label}</option>`;
          })
          .join("")
      );
      if (previous && options.some((o) => o.id === previous)) zoneSelect.val(previous);

      // Weight mode only — slot mode does not derive a speed from the load.
      if (encMode === "weight") {
        // loadSpeed: the warning is about the weight, not about how hungry they are.
        const before = calculateEncumbrance(inventory, CatalogManager.getMap(), encMode).loadSpeed;
        const working = foundry.utils.deepClone(inventory) as CharacterInventory;
        working.items.push(...probes.map((p) => foundry.utils.deepClone(p)));
        const after = calculateEncumbrance(working, CatalogManager.getMap(), encMode).loadSpeed;
        if (after < before) {
          warning
            .text(
              t("DOLMENWOOD.Inn.TakeAway.Drops", {
                who: recipient.name ?? "",
                before,
                after,
              })
            )
            .show();
        } else {
          warning.hide();
        }
      } else {
        warning.hide();
      }
    };

    html.find("#inn-takeaway-recipient").on("change", refresh);
    html.find("#inn-takeaway-amount").on("input change", refresh);
    refresh();
  }
}

// ─── Add / Edit a menu line ───────────────────────────────────────────────────

class InnEntryDialog extends Dialog {
  constructor(
    section: InnSection,
    entry: InnEntry | null,
    onSave: (entry: InnEntry) => Promise<void>
  ) {
    const groups = groupsFor(section);
    const groupOptions = [{ key: "", label: t("DOLMENWOOD.Inn.Group.None") }, ...groups]
      .map(
        (g) =>
          `<option value="${g.key}" ${(entry?.group ?? "") === g.key ? "selected" : ""}>${escapeHTML(g.label)}</option>`
      )
      .join("");

    const currencyOptions = (["cp", "sp", "gp", "pp"] as Currency[])
      .map(
        (c) =>
          `<option value="${c}" ${(entry?.cost.currency ?? "sp") === c ? "selected" : ""}>${t(
            `DOLMENWOOD.Currency.${c.toUpperCase()}`
          )}</option>`
      )
      .join("");

    // Every catalog item, grouped by category — that is what lets an inn sell
    // anything at all, not just the rations that ship with it.
    const catalogOptions = [
      `<option value="">${t("DOLMENWOOD.Inn.Line.Grants.Nothing")}</option>`,
      ...CatalogManager.getCategories().map((category) => {
        const items = CatalogManager.getByCategory(category)
          .map(
            (d) =>
              `<option value="${d.id}" ${entry?.grantsItem === d.id ? "selected" : ""}>${escapeHTML(d.name)}</option>`
          )
          .join("");
        return `<optgroup label="${escapeHTML(category)}">${items}</optgroup>`;
      }),
    ].join("");

    const containerOptions = (
      [
        ["auto", t("DOLMENWOOD.Inn.Line.Container.auto")],
        ["bottle", t("DOLMENWOOD.Inn.Line.Container.bottle")],
        ["cask", t("DOLMENWOOD.Inn.Line.Container.cask")],
        ["none", t("DOLMENWOOD.Inn.Line.Container.none")],
      ] as [ContainerChoice, string][]
    )
      .map(
        ([value, text]) =>
          `<option value="${value}" ${(entry?.container ?? "auto") === value ? "selected" : ""}>${text}</option>`
      )
      .join("");

    super({
      title: t(entry ? "DOLMENWOOD.Inn.Line.Edit" : "DOLMENWOOD.Inn.Line.Add"),
      content: `
        <form class="dw-form qm-form">
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.Line.Name.Label")}</label>
            <div class="qm-field">
              <input type="text" id="inn-entry-name" value="${escapeHTML(entry?.name ?? "")}" placeholder="${escapeHTML(t("DOLMENWOOD.Inn.Line.Name.Placeholder"))}" />
            </div>
          </div>
          ${/* One row: a price is a figure and the coin it is counted in. */ ""}
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.Line.Price")}</label>
            <div class="qm-field">
              <input type="number" id="inn-entry-price" value="${entry?.cost.amount ?? 1}" min="0" />
              <select id="inn-entry-currency" title="${escapeHTML(t("DOLMENWOOD.Inn.Line.Currency"))}"
                      aria-label="${escapeHTML(t("DOLMENWOOD.Inn.Line.Currency"))}">${currencyOptions}</select>
            </div>
          </div>
          ${
            groups.length > 0
              ? `<div class="form-group">
                   <label>${t("DOLMENWOOD.Inn.Line.Group.Label")}</label>
                   <div class="qm-field"><select id="inn-entry-group">${groupOptions}</select></div>
                   <p class="qm-hint">${t("DOLMENWOOD.Inn.Line.Group.Note")}</p>
                 </div>`
              : ""
          }
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.Line.Tag.Label")}</label>
            <div class="qm-field">
              <input type="text" id="inn-entry-tag" value="${escapeHTML(entry?.tag ?? "")}" />
            </div>
            <p class="qm-hint">${escapeHTML(t("DOLMENWOOD.Inn.Line.Tag.Note"))}</p>
          </div>
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.Line.Unit.Label")}</label>
            <div class="qm-field">
              <input type="text" id="inn-entry-unit" value="${escapeHTML(entry?.unit ?? "")}" />
            </div>
            <p class="qm-hint">${escapeHTML(t("DOLMENWOOD.Inn.Line.Unit.Note"))}</p>
          </div>
          ${
            section === "beverages"
              ? `<div class="form-group">
                   <label>${t("DOLMENWOOD.Inn.Line.Container.Label")}</label>
                   <div class="qm-field"><select id="inn-entry-container">${containerOptions}</select></div>
                   <p class="qm-hint">${escapeHTML(t("DOLMENWOOD.Inn.Line.Container.Hint"))}</p>
                 </div>`
              : ""
          }
          <div class="form-group qm-wide">
            <label>${t("DOLMENWOOD.Inn.Line.Description")}</label>
            <div class="qm-field">
              <textarea id="inn-entry-desc" rows="2">${escapeHTML(entry?.description ?? "")}</textarea>
            </div>
          </div>
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.Line.Grants.Label")}</label>
            <div class="qm-field"><select id="inn-entry-grants">${catalogOptions}</select></div>
            <p class="qm-hint">${t("DOLMENWOOD.Inn.Line.Grants.Hint")}</p>
          </div>
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.Line.Fixed.Label")}</label>
            <div class="qm-field">
              <input type="checkbox" id="inn-entry-fixed" ${entry?.fixed ? "checked" : ""} />
            </div>
            <p class="qm-hint">${t("DOLMENWOOD.Inn.Line.Fixed.Hint")}</p>
          </div>
        </form>`,
      buttons: {
        save: {
          label: t(entry ? "DOLMENWOOD.Common.Save" : "DOLMENWOOD.Common.Add"),
          icon: '<i class="fas fa-check"></i>',
          callback: (html: JQuery) => {
            const name = (html.find("#inn-entry-name").val() as string).trim();
            if (!name) {
              ui.notifications?.warn(t("DOLMENWOOD.Inn.Line.NeedsName"));
              return;
            }
            const amount = Math.max(0, parseInt(html.find("#inn-entry-price").val() as string, 10) || 0);
            const currency = html.find("#inn-entry-currency").val() as Currency;
            const group = groups.length > 0 ? ((html.find("#inn-entry-group").val() as string) || "") : (entry?.group ?? "");
            const tag = (html.find("#inn-entry-tag").val() as string).trim();
            const unit = (html.find("#inn-entry-unit").val() as string).trim();
            const description = (html.find("#inn-entry-desc").val() as string).trim();
            const fixed = html.find("#inn-entry-fixed").prop("checked") as boolean;
            const grantsItem = (html.find("#inn-entry-grants").val() as string) || "";
            const containerChoice =
              section === "beverages"
                ? ((html.find("#inn-entry-container").val() as ContainerChoice) || "auto")
                : (entry?.container ?? "auto");

            const next: InnEntry = {
              id: entry?.id ?? foundry.utils.randomID(),
              name,
              cost: { amount, currency } as InnCost,
              ...(group ? { group } : {}),
              ...(tag ? { tag } : {}),
              ...(unit ? { unit } : {}),
              ...(description ? { description } : {}),
              ...(fixed ? { fixed: true } : {}),
              // "auto" is the default, so storing it would only add noise
              ...(containerChoice !== "auto" ? { container: containerChoice } : {}),
              ...(grantsItem ? { grantsItem } : {}),
            };
            void onSave(next);
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel") },
      },
      default: "save",
    });
  }
}

// ─── Section settings: text, draw counts, quality ─────────────────────────────

class InnSectionDialog extends Dialog {
  constructor(
    section: InnSection,
    config: InnConfig,
    onSave: (result: {
      text: string;
      draw: Record<string, DrawRange>;
      quality: InnQuality;
      sellsContainers?: boolean;
    }) => Promise<void>
  ) {
    const current = sectionQuality(config, section);
    const sectionConfig = config.sections[section];
    const groups = groupsFor(section);

    const qualityOptions = INN_QUALITIES.map(
      (q) =>
        `<option value="${q.key}" ${q.key === current ? "selected" : ""}>${escapeHTML(
          qualityLabel(q.key)
        )}</option>`
    ).join("");

    // Only groups that actually have drawable lines are worth a control. A group
    // with no range is served in full, which is what an empty pair of fields means.
    const drawRows = groups
      .filter((g) => sectionConfig.entries.some((e) => !e.fixed && (e.group ?? "") === g.key))
      .map((g) => {
        const range = sectionConfig.draw[g.key];
        return `<div class="form-group">
            <label>${escapeHTML(groupLabel(g.key))}</label>
            <div class="qm-field qm-range">
              <input type="number" class="inn-draw-min" data-group="${g.key}" min="0"
                     value="${range ? range[0] : ""}" placeholder="${escapeHTML(t("DOLMENWOOD.Inn.SectionDialog.Draw.All"))}" />
              <span>–</span>
              <input type="number" class="inn-draw-max" data-group="${g.key}" min="0"
                     value="${range ? range[1] : ""}" placeholder="${escapeHTML(t("DOLMENWOOD.Inn.SectionDialog.Draw.All"))}" />
            </div>
          </div>`;
      })
      .join("");

    super({
      title: t("DOLMENWOOD.Inn.SectionDialog.Title"),
      content: `
        <form class="dw-form qm-form">
          <div class="form-group">
            <label>${t("DOLMENWOOD.Inn.SectionDialog.Quality.Label")}</label>
            <div class="qm-field"><select id="inn-section-quality">${qualityOptions}</select></div>
            <p class="qm-hint">${t("DOLMENWOOD.Inn.SectionDialog.Quality.Hint")}</p>
          </div>
          <div class="form-group qm-wide">
            <label>${t("DOLMENWOOD.Inn.SectionDialog.Description")}</label>
            <div class="qm-field">
              <textarea id="inn-section-text" rows="3">${escapeHTML(sectionConfig.text ?? "")}</textarea>
            </div>
          </div>
          ${
            section === "beverages"
              ? `<div class="form-group">
                   <label>${t("DOLMENWOOD.Inn.SectionDialog.Containers.Label")}</label>
                   <div class="qm-field">
                     <input type="checkbox" id="inn-section-containers" ${sectionConfig.sellsContainers !== false ? "checked" : ""} />
                   </div>
                   <p class="qm-hint">${t("DOLMENWOOD.Inn.SectionDialog.Containers.Hint")}</p>
                 </div>`
              : ""
          }
          ${
            drawRows
              ? `<fieldset>
                   <legend>${t("DOLMENWOOD.Inn.SectionDialog.Draw.Legend")}</legend>
                   ${drawRows}
                   <p class="qm-hint">${t("DOLMENWOOD.Inn.SectionDialog.Draw.Hint")}</p>
                 </fieldset>`
              : ""
          }
        </form>`,
      buttons: {
        save: {
          label: t("DOLMENWOOD.Common.Save"),
          icon: '<i class="fas fa-check"></i>',
          callback: (html: JQuery) => {
            const text = (html.find("#inn-section-text").val() as string).trim();
            const quality = html.find("#inn-section-quality").val() as InnQuality;
            const containers =
              section === "beverages"
                ? (html.find("#inn-section-containers").prop("checked") as boolean)
                : undefined;

            const draw: Record<string, DrawRange> = {};
            html.find(".inn-draw-min").each((_: number, el: Element) => {
              const input = el as HTMLInputElement;
              const group = input.dataset.group!;
              const maxInput = html.find(`.inn-draw-max[data-group="${group}"]`).get(0) as HTMLInputElement | undefined;
              const minRaw = input.value.trim();
              const maxRaw = maxInput?.value.trim() ?? "";
              if (!minRaw && !maxRaw) return; // empty pair = serve them all
              const min = Math.max(0, parseInt(minRaw || maxRaw, 10) || 0);
              const max = Math.max(min, parseInt(maxRaw || minRaw, 10) || min);
              draw[group] = [min, max];
            });

            void onSave({ text, draw, quality, sellsContainers: containers });
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel") },
      },
      default: "save",
    });
  }
}
