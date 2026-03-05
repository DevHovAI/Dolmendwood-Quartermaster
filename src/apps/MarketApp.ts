import { MODULE_ID, TEMPLATES } from "../constants";
import { CatalogManager } from "../data/CatalogManager";
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
    _options: Partial<ApplicationV2Options>
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
      (api.openShop as (name: string, categories: string[]) => void)(entry.name, entry.categories);
    } else {
      (api.openInn as (name: string, quality: string, categories: string[]) => void)(entry.name, entry.quality, []);
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
    const savedCats = entry?.categories ?? [];
    const categoryCheckboxes = isShop
      ? CatalogManager.getCategories()
          .map((cat) => {
            const checked = savedCats.includes(cat) ? "checked" : "";
            return `<label style="display:flex;align-items:center;gap:4px;font-size:0.85em;">
              <input type="checkbox" class="entry-cat" value="${cat}" ${checked} /> ${cat}
            </label>`;
          })
          .join("")
      : "";

    const qualityOptions = (["poor", "common", "fancy"] as const)
      .map(
        (q) =>
          `<option value="${q}" ${(entry?.quality ?? "common") === q ? "selected" : ""}>${
            q.charAt(0).toUpperCase() + q.slice(1)
          }</option>`
      )
      .join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="entry-name" value="${entry?.name ?? ""}"
            placeholder="${isShop ? "e.g. The Blacksmith" : "e.g. The Silver Stag"}" />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="entry-desc" rows="2" style="width:100%;resize:vertical;">${entry?.description ?? ""}</textarea>
        </div>
        ${
          isShop
            ? `<div class="form-group">
                <label>Categories sold <small>(leave all unchecked = sell everything)</small></label>
                <div style="display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:4px;">${categoryCheckboxes}</div>
               </div>`
            : `<div class="form-group">
                <label>Quality</label>
                <select id="entry-quality">${qualityOptions}</select>
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
            html.find(".entry-cat:checked").each((_: number, el: Element) =>
              cats.push((el as HTMLInputElement).value)
            );
            const newEntry: MarketEntry = {
              id: entry?.id ?? foundry.utils.randomID(),
              type,
              name,
              description,
              categories: isShop ? cats : [],
              quality: isShop
                ? "common"
                : ((html.find("#entry-quality").val() as string) as MarketEntry["quality"]),
            };
            this.app.saveEntry(newEntry);
          },
        },
        cancel: { label: "Cancel" },
      },
      default: "save",
    });
  }
}
