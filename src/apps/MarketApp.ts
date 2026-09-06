import { MODULE_ID, TEMPLATES } from "../constants";
import { CatalogManager } from "../data/CatalogManager";
import { buildIconPickerHTML, activateIconPicker, LOCATION_ICONS, escapeHTML } from "../helpers/handlebars";
import type { MarketEntry, MarketFlag } from "../types";
import { t } from "../helpers/i18n";

type NoteDoc = {
  getFlag?: (moduleId: string, key: string) => unknown;
  setFlag?: (moduleId: string, key: string, value: unknown) => Promise<void>;
};

export class MarketApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  private noteDoc: NoteDoc | null = null;

  setNote(doc: NoteDoc): void {
    this.noteDoc = doc;
  }

  private getFlag(): MarketFlag | null {
    return (this.noteDoc?.getFlag?.(MODULE_ID, "market") as MarketFlag | null) ?? null;
  }

  override get title(): string {
    return this.getFlag()?.name ?? t("DOLMENWOOD.Market.Title");
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-market",
    window: {
      title: "DOLMENWOOD.Market.Title",
      resizable: true,
    },
    position: {
      width: 480,
      height: 520,
    },
    classes: ["dolmenwood-party-inventory", "market"],
    actions: {
      openEntry: MarketApp._onOpenEntry,
      addEntry: MarketApp._onAddEntry,
      editEntry: MarketApp._onEditEntry,
      removeEntry: MarketApp._onRemoveEntry,
    },
  };

  static override PARTS = {
    content: {
      template: TEMPLATES.MARKET,
    },
  };

  override async _prepareContext(
    _options: DeepPartial<ApplicationV2RenderOptions> & { isFirstRender: boolean }
  ): Promise<Record<string, unknown>> {
    const flag = this.getFlag();
    return {
      marketName: flag?.name ?? t("DOLMENWOOD.Market.Title"),
      // The quality is stored as its key — "poor" / "common" / "fancy" — and
      // the badge used to print that key straight out of the flag. The label
      // belongs to the language file, so it is looked up here rather than in
      // the template, where a lookup by a value is awkward.
      entries: (flag?.entries ?? []).map((e) => ({
        ...e,
        qualityLabel: t(`DOLMENWOOD.Market.Quality.${e.quality ?? "common"}`),
      })),
      isGM: (game as Game).user?.isGM ?? false,
    };
  }

  async saveEntry(entry: MarketEntry): Promise<void> {
    if (!this.noteDoc) return;
    const flag = this.getFlag() ?? { name: "Market", entries: [] };
    const idx = flag.entries.findIndex((e) => e.id === entry.id);
    if (idx === -1) {
      flag.entries.push(entry);
    } else {
      flag.entries[idx] = entry;
    }
    await this.noteDoc.setFlag?.(MODULE_ID, "market", flag);
    this.render();
  }

  // ─── Action Handlers ─────────────────────────────────────────────────────────

  private static _onOpenEntry(
    this: MarketApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const entryId = target.dataset.entryId!;
    const flag = this.getFlag();
    const entry = flag?.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const api = ((game as Game).modules.get(MODULE_ID) as { api?: Record<string, unknown> } | undefined)?.api;
    if (!api) return;
    if (entry.type === "shop") {
      // Every shop setting travels, not just the three that existed first: a
      // stall configured here and a shop on its own note must behave alike.
      (
        api.openShop as (
          name: string,
          categories: string[],
          priceFactor: number,
          ownStockOnly?: boolean,
          buyBackRate?: number
        ) => void
      )(entry.name, entry.categories, entry.priceFactor ?? 100, entry.ownStockOnly, entry.buyBackRate);
    } else {
      (api.openInn as (name: string, quality: string, categories: string[], priceFactor: number) => void)(entry.name, entry.quality, [], entry.priceFactor ?? 100);
    }
  }

  private static _onAddEntry(
    this: MarketApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const type = (target.dataset.type ?? "shop") as "shop" | "inn";
    new MarketEntryDialog(null, type, this).render(true);
  }

  private static _onEditEntry(
    this: MarketApp,
    _event: Event,
    target: HTMLElement
  ): void {
    const entryId = target.dataset.entryId!;
    const flag = this.getFlag();
    const entry = flag?.entries.find((e) => e.id === entryId) ?? null;
    if (!entry) return;
    new MarketEntryDialog(entry, entry.type, this).render(true);
  }

  private static async _onRemoveEntry(
    this: MarketApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const entryId = target.dataset.entryId!;
    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Market.Remove.Title"),
      content: t("DOLMENWOOD.Market.Remove.Body"),
    });
    if (!confirmed || !this.noteDoc) return;
    const flag = this.getFlag();
    if (!flag) return;
    flag.entries = flag.entries.filter((e) => e.id !== entryId);
    await this.noteDoc.setFlag?.(MODULE_ID, "market", flag);
    this.render();
  }
}

// ─── Market Entry Dialog ──────────────────────────────────────────────────────

class MarketEntryDialog extends Dialog {
  constructor(
    private readonly entry: MarketEntry | null,
    private readonly type: "shop" | "inn",
    private readonly app: MarketApp
  ) {
    const isShop = type === "shop";
    const defaultIcon = isShop ? "fa-store" : "fa-beer-mug-empty";
    const savedCats = entry?.categories ?? [];
    // Only what a shop can actually sell from. The Campaign Book's thirteen
    // treasure categories are left out entirely: a shop drops not-for-sale
    // items *before* it reads this list, so ticking one showed nothing at all.
    // Those reach a shelf through **From Catalogue**, which ignores the flag on
    // purpose. See CatalogManager.getCategoriesBySale.
    const { sold: soldCats } = CatalogManager.getCategoriesBySale();
    const catBox = (cat: string): string => {
      const checked = savedCats.includes(cat) ? "checked" : "";
      return `<label class="qm-note-cat">
        <input type="checkbox" class="entry-cat" value="${escapeHTML(cat)}" ${checked} /> ${escapeHTML(cat)}
      </label>`;
    };
    const categoryCheckboxes = isShop ? soldCats.map(catBox).join("") : "";

    // The option's text used to be the stored key with its first letter raised,
    // which is a way of writing English that only works in English.
    const qualityOptions = (["poor", "common", "fancy"] as const)
      .map(
        (q) =>
          `<option value="${q}" ${(entry?.quality ?? "common") === q ? "selected" : ""}>${escapeHTML(
            t(`DOLMENWOOD.Market.Quality.${q}`)
          )}</option>`
      )
      .join("");

    const content = `
      <form class="dw-form qm-form">
        <div class="form-group">
          <label for="entry-name">${t("DOLMENWOOD.Market.Dialog.Name.Label")}</label>
          <div class="qm-field">
            <input type="text" id="entry-name" value="${escapeHTML(entry?.name ?? "")}"
              placeholder="${escapeHTML(
                t(
                  isShop
                    ? "DOLMENWOOD.Market.Dialog.Name.ShopPlaceholder"
                    : "DOLMENWOOD.Market.Dialog.Name.InnPlaceholder"
                )
              )}" />
          </div>
        </div>
        <div class="form-group qm-wide">
          <label for="entry-desc">${t("DOLMENWOOD.Market.Dialog.Description")}</label>
          <div class="qm-field">
            <textarea id="entry-desc" rows="2">${escapeHTML(entry?.description ?? "")}</textarea>
          </div>
        </div>
        <div class="form-group qm-wide">
          <label>${t("DOLMENWOOD.Market.Dialog.Icon")}</label>
          <div class="qm-field qm-field-icons">
            ${buildIconPickerHTML(entry?.icon ?? defaultIcon, LOCATION_ICONS)}
          </div>
        </div>
        <div class="form-group">
          <label for="entry-price-factor">${t("DOLMENWOOD.Market.Dialog.PriceFactor.Label")}</label>
          <div class="qm-field">
            <input type="number" id="entry-price-factor" value="${entry?.priceFactor ?? 100}" min="1" max="10000" step="1" />
          </div>
          <p class="qm-hint">${t("DOLMENWOOD.Market.Dialog.PriceFactor.Hint")}</p>
        </div>
        ${
          isShop
            ? `<div class="form-group">
                <label for="entry-buy-back">${t("DOLMENWOOD.Market.Dialog.BuyBack.Label")}</label>
                <div class="qm-field">
                  <input type="number" id="entry-buy-back" value="${entry?.buyBackRate ?? 0}" min="0" max="200" step="5" />
                </div>
                <p class="qm-hint">${t("DOLMENWOOD.Market.Dialog.BuyBack.Hint")}</p>
               </div>
               <div class="form-group">
                <label for="entry-own-stock">${t("DOLMENWOOD.Market.Dialog.OwnStock.Label")}</label>
                <div class="qm-field">
                  <input type="checkbox" id="entry-own-stock" ${entry?.ownStockOnly ? "checked" : ""} />
                </div>
                <p class="qm-hint">${t("DOLMENWOOD.Market.Dialog.OwnStock.Hint")}</p>
               </div>
               <div class="form-group qm-wide">
                <label>${t("DOLMENWOOD.Market.Dialog.Categories.Label")}</label>
                <div class="qm-field qm-field-cats">${categoryCheckboxes}</div>
                <p class="qm-hint">${t("DOLMENWOOD.Market.Dialog.Categories.Hint")}</p>
               </div>`
            : `<div class="form-group">
                <label for="entry-quality">${t("DOLMENWOOD.Market.Dialog.Quality")}</label>
                <div class="qm-field">
                  <select id="entry-quality">${qualityOptions}</select>
                </div>
               </div>`
        }
      </form>`;

    super({
      // Four whole titles rather than a verb glued to a noun: German inflects
      // both halves, and "Edit" + "Shop" cannot be reassembled into
      // "Laden bearbeiten" by a translator who only sees the pieces.
      title: t(
        entry
          ? isShop
            ? "DOLMENWOOD.Market.Dialog.EditShop"
            : "DOLMENWOOD.Market.Dialog.EditInn"
          : isShop
            ? "DOLMENWOOD.Market.Dialog.AddShop"
            : "DOLMENWOOD.Market.Dialog.AddInn"
      ),
      content,
      buttons: {
        save: {
          label: t(entry ? "DOLMENWOOD.Common.Save" : "DOLMENWOOD.Common.Add"),
          icon: `<i class="fas fa-check"></i>`,
          callback: (html: JQuery) => {
            const name = (html.find("#entry-name").val() as string).trim();
            if (!name) return;
            const description = (html.find("#entry-desc").val() as string).trim();
            const cats: string[] = [];
            html.find(".entry-cat:checked").each((_: number, el: Element) => {
              cats.push((el as HTMLInputElement).value);
            });
            const icon = (html.find("#custom-icon-value").val() as string) || defaultIcon;
            const priceFactor = Math.max(1, parseInt(html.find("#entry-price-factor").val() as string, 10) || 100);
            const newEntry: MarketEntry = {
              id: entry?.id ?? foundry.utils.randomID(),
              type,
              name,
              description,
              icon,
              categories: isShop ? cats : [],
              quality: isShop
                ? "common"
                : ((html.find("#entry-quality").val() as string) as MarketEntry["quality"]),
              priceFactor,
              ...(isShop
                ? {
                    ownStockOnly: html.find("#entry-own-stock").is(":checked") as boolean,
                    buyBackRate: Math.max(
                      0,
                      parseInt(html.find("#entry-buy-back").val() as string, 10) || 0
                    ),
                  }
                : {}),
            };
            this.app.saveEntry(newEntry);
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel") },
      },
      default: "save",
    });
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    activateIconPicker(html);
    // A v1 Dialog is sized once, at render, and `.window-content` scrolls — so
    // a fold opened afterwards is trapped in a scrollbox instead of growing the
    // window. The same fix AddItemDialog needed. `toggle` does not bubble, but
    // jQuery binds it directly, so `.on()` reaches it.
    html.find("details").on("toggle", () => this.setPosition({ height: "auto" }));
  }
}
