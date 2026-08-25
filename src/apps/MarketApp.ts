import { MODULE_ID, TEMPLATES } from "../constants";
import { CatalogManager } from "../data/CatalogManager";
import { buildIconPickerHTML, activateIconPicker, LOCATION_ICONS, escapeHTML } from "../helpers/handlebars";
import type { MarketEntry, MarketFlag } from "../types";

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
    return this.getFlag()?.name ?? "Market";
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-market",
    window: {
      title: "Market",
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
      marketName: flag?.name ?? "Market",
      entries: flag?.entries ?? [],
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
      title: "Remove Entry",
      content: "<p>Remove this entry from the market?</p>",
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

    const qualityOptions = (["poor", "common", "fancy"] as const)
      .map(
        (q) =>
          `<option value="${q}" ${(entry?.quality ?? "common") === q ? "selected" : ""}>${
            q.charAt(0).toUpperCase() + q.slice(1)
          }</option>`
      )
      .join("");

    const content = `
      <form class="qm-form">
        <div class="form-group">
          <label for="entry-name">Name</label>
          <div class="qm-field">
            <input type="text" id="entry-name" value="${escapeHTML(entry?.name ?? "")}"
              placeholder="${isShop ? "e.g. The Blacksmith" : "e.g. The Silver Stag"}" />
          </div>
        </div>
        <div class="form-group qm-wide">
          <label for="entry-desc">Description</label>
          <div class="qm-field">
            <textarea id="entry-desc" rows="2">${escapeHTML(entry?.description ?? "")}</textarea>
          </div>
        </div>
        <div class="form-group qm-wide">
          <label>Icon</label>
          <div class="qm-field qm-field-icons">
            ${buildIconPickerHTML(entry?.icon ?? defaultIcon, LOCATION_ICONS)}
          </div>
        </div>
        <div class="form-group">
          <label for="entry-price-factor">Price factor</label>
          <div class="qm-field">
            <input type="number" id="entry-price-factor" value="${entry?.priceFactor ?? 100}" min="1" max="10000" step="1" />
          </div>
          <p class="qm-hint">Per cent of the book price. 100 is normal, 200 is double.</p>
        </div>
        ${
          isShop
            ? `<div class="form-group">
                <label for="entry-buy-back">Buys back at</label>
                <div class="qm-field">
                  <input type="number" id="entry-buy-back" value="${entry?.buyBackRate ?? 0}" min="0" max="200" step="5" />
                </div>
                <p class="qm-hint">Per cent of what a thing is worth, not of this stall's asking price. 50 for used gear, 80 for a jeweller's gems, 0 to buy nothing.</p>
               </div>
               <div class="form-group">
                <label for="entry-own-stock">Sells only its own stock</label>
                <div class="qm-field">
                  <input type="checkbox" id="entry-own-stock" ${entry?.ownStockOnly ? "checked" : ""} />
                </div>
                <p class="qm-hint">Nothing from the catalogue, only what you put on this stall's shelf yourself. The categories below are then ignored.</p>
               </div>
               <div class="form-group qm-wide">
                <label>Categories sold</label>
                <div class="qm-field qm-field-cats">${categoryCheckboxes}</div>
                <p class="qm-hint">Leave every box unticked to sell the whole catalogue. Treasures are never on a shelf by category — put one there with <strong>From Catalogue</strong> inside the shop.</p>
               </div>`
            : `<div class="form-group">
                <label for="entry-quality">Quality</label>
                <div class="qm-field">
                  <select id="entry-quality">${qualityOptions}</select>
                </div>
               </div>`
        }
      </form>`;

    super({
      title: entry ? `Edit ${isShop ? "Shop" : "Inn"}` : `Add ${isShop ? "Shop" : "Inn"}`,
      content,
      buttons: {
        save: {
          label: entry ? "Save" : "Add",
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
        cancel: { label: "Cancel" },
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
