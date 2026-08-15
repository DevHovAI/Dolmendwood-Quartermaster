import { TEMPLATES, SOCKET_EVENTS, MODULE_ID, SETTINGS } from "../constants";
type LocalHiddenMap = Record<string, string[]>;
import { FlagManager } from "../data/FlagManager";
import { SocketHandler } from "../socket/SocketHandler";
import { INN_MENU, INN_CATEGORIES, filterByQuality } from "../data/innData";
import type { InnQuality } from "../data/innData";
import type { InnPurchasePayload } from "../types";

interface InnState {
  name: string;
  quality: InnQuality;
}

export class InnApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private selectedActorId: string | null = null;
  private innName: string = "The Wayward Boar";
  private quality: InnQuality = "common";
  private localCategories: string[] = [];
  private priceFactor = 100;
  private _scrollTop = 0;

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-inn",
    window: {
      title: "Inn",
      resizable: true,
    },
    position: {
      width: 540,
      height: 680,
    },
    classes: ["dolmenwood-party-inventory", "inn-panel"],
    actions: {
      purchaseInnItem: InnApp._onPurchaseInnItem,
      setQuality: InnApp._onSetQuality,
      toggleLocalHideInnItem: InnApp._onToggleLocalHideInnItem,
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
  }

  override get title(): string {
    return this.innName;
  }

  override async _prepareContext(
    _options: DeepPartial<ApplicationV2RenderOptions> & { isFirstRender: boolean }
  ): Promise<Record<string, unknown>> {
    const g = game as Game;
    const isGM = g.user?.isGM ?? false;

    // Restore persisted state
    const savedState = g.settings?.get(MODULE_ID, SETTINGS.INN_STATE) as InnState | undefined;
    if (savedState && !this.innName) {
      this.innName = savedState.name;
      this.quality = savedState.quality;
    }

    // Actor selector — pick from party members (all non-GM-owned actors if GM, own character if player)
    const actors = isGM
      ? (g.actors?.contents ?? []).filter((a) =>
          (g.users?.contents ?? []).some((u) => !u.isGM && a.testUserPermission(u, "OWNER"))
        )
      : [g.user?.character].filter(Boolean) as Actor[];

    if (!this.selectedActorId && actors.length > 0) {
      this.selectedActorId = actors[0].id ?? null;
    }

    const selectedActor = this.selectedActorId
      ? g.actors?.get(this.selectedActorId) ?? actors[0] ?? null
      : actors[0] ?? null;

    const inventory = selectedActor ? FlagManager.getInventory(selectedActor) : null;
    const coins = inventory?.coins ?? { pp: 0, gp: 0, sp: 0, cp: 0 };
    const walletCp = coins.cp + coins.sp * 10 + coins.gp * 100 + coins.pp * 500;

    const filteredMenu = filterByQuality(INN_MENU, this.quality);
    const visibleCategories = this.localCategories.length > 0 ? this.localCategories : null;

    // Local hidden items for this inn
    const localHiddenMap = (g.settings?.get(MODULE_ID, SETTINGS.LOCAL_HIDDEN) as LocalHiddenMap) ?? {};
    const innHiddenItems = this.innName ? (localHiddenMap[this.innName] ?? []) : [];
    const isLocalInn = this.localCategories.length > 0;

    const factor = this.priceFactor;
    const menuByCategory = INN_CATEGORIES
      .filter((cat) => !visibleCategories || visibleCategories.includes(cat.key))
      .map((cat) => ({
      ...cat,
      items: filteredMenu
        .filter((item) => item.category === cat.key)
        .filter((item) => !isGM ? !innHiddenItems.includes(item.id) : true)
        .map((item) => {
          const adjustedAmount = Math.max(1, Math.round(item.cost.amount * factor / 100));
          const adjustedCostCp = adjustedAmount * (item.cost.currency === "pp" ? 500
            : item.cost.currency === "gp" ? 100
            : item.cost.currency === "sp" ? 10
            : 1);
          return {
            ...item,
            cost: { amount: adjustedAmount, currency: item.cost.currency },
            canAfford: walletCp >= adjustedCostCp,
            isHidden: isGM && innHiddenItems.includes(item.id),
          };
        }),
    })).filter((cat) => cat.items.length > 0);

    return {
      innName: this.innName,
      quality: this.quality,
      isGM,
      isLocalInn,
      priceFactor: this.priceFactor,
      actors,
      selectedActorId: selectedActor?.id ?? null,
      selectedActorName: selectedActor?.name ?? "",
      coins,
      menuByCategory,
    };
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
    const el = this.element;

    const wc = el.querySelector<HTMLElement>(".window-content");
    if (wc) wc.scrollTop = this._scrollTop;

    // Actor selector
    el.querySelector<HTMLSelectElement>("#inn-actor-select")?.addEventListener("change", (e) => {
      this.selectedActorId = (e.target as HTMLSelectElement).value;
      this.render(false);
    });

    // Inn name edit (GM only)
    el.querySelector<HTMLInputElement>("#inn-name-input")?.addEventListener("change", async (e) => {
      this.innName = (e.target as HTMLInputElement).value.trim() || "The Wayward Boar";
      await this._saveState();
      this.render(false);
    });
  }

  private async _saveState(): Promise<void> {
    await (game as Game).settings?.set(MODULE_ID, SETTINGS.INN_STATE, {
      name: this.innName,
      quality: this.quality,
    });
  }

  // ─── Action Handlers ───────────────────────────────────────────────────────

  private static async _onSetQuality(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    this.quality = target.dataset.quality as InnQuality;
    await this._saveState();
    this.render(false);
  }

  private static async _onToggleLocalHideInnItem(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const g = game as Game;
    const localHiddenMap = (g.settings?.get(MODULE_ID, SETTINGS.LOCAL_HIDDEN) as LocalHiddenMap) ?? {};
    const key = this.innName;
    if (!localHiddenMap[key]) localHiddenMap[key] = [];
    const idx = localHiddenMap[key].indexOf(itemId);
    if (idx === -1) {
      localHiddenMap[key].push(itemId);
    } else {
      localHiddenMap[key].splice(idx, 1);
    }
    await g.settings?.set(MODULE_ID, SETTINGS.LOCAL_HIDDEN, localHiddenMap);
    this.render(false);
  }

  private static async _onPurchaseInnItem(
    this: InnApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const g = game as Game;
    const itemId = target.dataset.itemId!;
    const item = INN_MENU.find((i) => i.id === itemId);
    if (!item) return;

    const actorId = this.selectedActorId;
    if (!actorId) {
      ui.notifications?.warn("No character selected.");
      return;
    }

    const actor = g.actors?.get(actorId);
    if (!actor) return;

    const inventory = FlagManager.getInventory(actor);
    const walletCp = inventory.coins.cp + inventory.coins.sp * 10
      + inventory.coins.gp * 100 + inventory.coins.pp * 500;
    const adjustedAmount = Math.max(1, Math.round(item.cost.amount * this.priceFactor / 100));
    const costCp = adjustedAmount * (item.cost.currency === "pp" ? 500
      : item.cost.currency === "gp" ? 100
      : item.cost.currency === "sp" ? 10
      : 1);

    if (walletCp < costCp) {
      ui.notifications?.warn(`${actor.name} cannot afford ${item.name}.`);
      return;
    }

    const confirmed = await Dialog.confirm({
      title: `Pay for ${item.name}`,
      content: `<p>Pay <strong>${adjustedAmount} ${item.cost.currency}</strong> for <em>${item.name}</em>?</p>`,
    });
    if (!confirmed) return;

    // Determine coin breakdown for the payload
    const totalCost = {
      cp: item.cost.currency === "cp" ? adjustedAmount : 0,
      sp: item.cost.currency === "sp" ? adjustedAmount : 0,
      gp: item.cost.currency === "gp" ? adjustedAmount : 0,
      pp: item.cost.currency === "pp" ? adjustedAmount : 0,
    };
    const payload: InnPurchasePayload = { actorId, itemName: item.name, totalCost };

    SocketHandler.emitOrHandle(SOCKET_EVENTS.INN_PURCHASE, payload);

    ui.notifications?.info(`${actor.name} paid for ${item.name}. Enjoy!`);
    this.render(false);
  }
}
