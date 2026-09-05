import {
  BOOKS,
  bookPageOffset,
  bookPath,
  bookViewerURL,
  mayOpenBook,
  spreadModeFor,
  type BookId,
} from "../data/books";
import { t } from "../helpers/i18n";

/**
 * pdf.js reads its scroll and spread modes from its own settings, not from the
 * URL — the hash carries the page and nothing else. The viewer inside the frame
 * is same-origin, though, so the modes can simply be set on it once it has a
 * document open.
 *
 * The numbers are pdf.js's own enumerations, which have not moved in years:
 * `ScrollMode.PAGE` shows one spread at a time and turns rather than scrolls.
 * Which spread mode opens the book correctly is not a constant — it follows the
 * page offset, and `spreadModeFor` in `books.ts` works it out.
 */
const SCROLL_MODE_PAGE = 3;

interface PDFViewerApplication {
  initializedPromise?: Promise<void>;
  eventBus?: { on: (event: string, handler: () => void) => void };
  pdfViewer?: {
    scrollMode: number;
    spreadMode: number;
    currentScaleValue: string;
    currentPageNumber: number;
  };
}

/**
 * One window, holding Foundry's own PDF reader, opened at a page.
 *
 * A single reused instance rather than one window per click: a Referee follows
 * a dozen references in an evening, and a dozen stacked windows is a worse
 * outcome than the page changing under them.
 */
export class BookApp extends foundry.applications.api.ApplicationV2 {
  static #open: BookApp | undefined;

  #url = "";
  #page = 1;
  // Set the moment a book is opened; the default only ever shows for the
  // instant between construction and the first render.
  #title = "";

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-book",
    classes: ["dolmenwood-quartermaster", "dw-book"],
    // A key rather than a word: this is read at module scope, long before
    // Foundry's translation table exists, and Foundry localises it itself.
    window: { title: "DOLMENWOOD.Book.Window", resizable: true, icon: "fas fa-book-open" },
  };

  override get title(): string {
    return this.#title || t("DOLMENWOOD.Book.Window");
  }

  protected override async _renderHTML(): Promise<string> {
    return `<iframe class="dw-book-frame" src="${this.#url}"></iframe>`;
  }

  protected override _replaceHTML(result: string, content: HTMLElement): void {
    content.innerHTML = result;
    const frame = content.querySelector("iframe");
    if (frame) this.#dressViewer(frame as HTMLIFrameElement);
  }

  /**
   * Two pages at a time, turned rather than scrolled, filling the window.
   *
   * Waited for in two steps because the viewer is built in two: the application
   * object appears with the frame, but the page count — and therefore the page
   * to turn to — only exists once the document itself has loaded. Everything is
   * wrapped, since a viewer that has changed its internals should cost the
   * reader a layout, not the whole window.
   */
  #dressViewer(frame: HTMLIFrameElement): void {
    const page = this.#page;
    frame.addEventListener("load", () => {
      const app = (frame.contentWindow as unknown as { PDFViewerApplication?: PDFViewerApplication })
        ?.PDFViewerApplication;
      if (!app) return;
      void app.initializedPromise?.then(() => {
        const apply = (): void => {
          try {
            const viewer = app.pdfViewer;
            if (!viewer) return;
            // Even page on the left, odd on the right — the way it is bound.
            viewer.spreadMode = spreadModeFor(bookPageOffset());
            viewer.scrollMode = SCROLL_MODE_PAGE;
            viewer.currentScaleValue = "page-fit";
            viewer.currentPageNumber = page;
          } catch {
            // A pdf.js that no longer works this way still shows the document.
          }
        };
        app.eventBus?.on("pagesloaded", apply);
        app.eventBus?.on("pagesinit", apply);
      });
    });
  }

  /** As much of the screen as the window can decently take. */
  static #size(): { width: number; height: number; top: number; left: number } {
    const width = Math.min(1600, Math.max(800, Math.floor(window.innerWidth * 0.9)));
    const height = Math.max(600, Math.floor(window.innerHeight * 0.92));
    return {
      width,
      height,
      left: Math.max(0, Math.floor((window.innerWidth - width) / 2)),
      top: Math.max(0, Math.floor((window.innerHeight - height) / 2)),
    };
  }

  /**
   * Show a page of one of the books.
   *
   * Says what to do rather than failing silently where no file has been given:
   * the reference is printed by the module, so a click that does nothing reads
   * as the module being broken rather than as a setting being empty.
   */
  static async open(id: BookId, printedPage: number): Promise<void> {
    if (!mayOpenBook(id)) {
      ui.notifications?.warn(t("DOLMENWOOD.Book.RefereeOnly", { book: BOOKS[id].label }));
      return;
    }
    const url = bookViewerURL(id, printedPage);
    if (!url) {
      ui.notifications?.warn(t("DOLMENWOOD.Book.NoFile", { book: BOOKS[id].label }));
      return;
    }
    const app = (BookApp.#open ??= new BookApp());
    app.#url = url;
    app.#page = Number(url.split("#page=")[1] ?? 1) || 1;
    app.#title = t("DOLMENWOOD.Book.Title", {
      book: BOOKS[id].label,
      page: printedPage,
    });
    await app.render({ force: true, position: BookApp.#size() } as never);
    app.bringToFront?.();
  }

  /** Is there a copy of this book to open at all? */
  static has(id: BookId): boolean {
    return bookPath(id) !== "";
  }
}
