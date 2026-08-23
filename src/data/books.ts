import { MODULE_ID, SETTINGS } from "../constants";

/**
 * The three Dolmenwood books, and the page references that point into them.
 *
 * Nothing of the books' own text is shipped with this module and nothing ever
 * will be. What is shipped is the *reference* — "Monster Book p12" — and this
 * file is what turns that reference into a click that lands on the page in the
 * reader's own copy.
 *
 * **The file has to be one Foundry serves.** A browser cannot open
 * `C:\Users\…\Downloads\book.pdf`; it can only fetch what the Foundry server
 * hands out, which is the contents of the user data directory. So each book is
 * a world setting holding a path inside that directory — uploaded once by the
 * Referee, then available to every player at the table without anyone else
 * needing a copy of the file. A table where nobody sets a path loses nothing
 * that was there before: the reference still reads as it always did.
 *
 * **Printed page is not PDF page.** Every one of the three books carries two
 * pages of front matter that the printed numbering does not count, so the
 * printed p152 is the PDF's page 154. That offset is a setting rather than a
 * constant, because it belongs to the file rather than to the book: a different
 * scan, a different export, and it moves.
 */
export type BookId = "players" | "campaign" | "monsters";

interface BookInfo {
  /** How the reference names it in prose, which is also what the linker matches. */
  label: string;
  /** The short form the books themselves use in cross-references. */
  short: string;
  setting: string;
}

export const BOOKS: Record<BookId, BookInfo> = {
  players: { label: "Player's Book", short: "DPB", setting: SETTINGS.BOOK_PLAYERS },
  campaign: { label: "Campaign Book", short: "DCB", setting: SETTINGS.BOOK_CAMPAIGN },
  monsters: { label: "Monster Book", short: "DMB", setting: SETTINGS.BOOK_MONSTERS },
};

function setting<T>(key: string, fallback: T): T {
  try {
    // The key is one of this module's own, but it arrives here as a string
    // out of the BOOKS table, which the typed overload will not take.
    const get = game.settings?.get as unknown as ((ns: string, k: string) => T) | undefined;
    const value = get?.call(game.settings, MODULE_ID, key);
    return value === undefined || value === null ? fallback : value;
  } catch {
    // Asked before the settings are registered, which the chat linker can be.
    return fallback;
  }
}

/** The path the Referee gave for this book, or "" where none was given. */
export function bookPath(id: BookId): string {
  return String(setting(BOOKS[id].setting, "")).trim();
}

/** How many pages of front matter the printed numbering does not count. */
export function bookPageOffset(): number {
  const raw = Number(setting(SETTINGS.BOOK_PAGE_OFFSET, 2));
  return Number.isFinite(raw) ? raw : 2;
}

/**
 * May this user open this book?
 *
 * The Player's Book is the players' own and always was; the Campaign and
 * Monster Books are the Referee's, and a player holding the Monster Book open
 * knows the lair chance and the hoard of the thing standing in front of them.
 * The references stay printed for everyone either way — knowing that an answer
 * exists on page 12 gives nothing away.
 */
export function mayOpenBook(id: BookId): boolean {
  if (game.user?.isGM) return true;
  const allowed = String(setting(SETTINGS.BOOKS_FOR_PLAYERS, "players"));
  if (allowed === "all") return true;
  if (allowed === "players") return id === "players";
  return false;
}

/** Is there a copy behind the references at all? */
export function anyBookSet(): boolean {
  return (Object.keys(BOOKS) as BookId[]).some((id) => bookPath(id) !== "");
}

/**
 * A page reference, as a link.
 *
 * Always a link, even where no file is set: the setting is the Referee's and
 * may be filled in long after a card was rolled, and a card that quietly went
 * back to plain text would look like the feature had broken. Clicking one with
 * no file behind it says where to put the file.
 */
export function bookRef(id: BookId, page: number, label?: string): string {
  const text = label ?? `${BOOKS[id].label} p${page}`;
  return `<a class="dw-book-link" data-book="${id}" data-book-page="${page}" title="Open ${BOOKS[id].label} at page ${page}.">${text}</a>`;
}

/**
 * The URL of Foundry's own PDF reader, pointed at one page.
 *
 * Foundry ships pdf.js for its PDF journal pages and serves it at
 * `scripts/pdfjs/web/viewer.html`; it takes the file as a query parameter and
 * the page as the fragment. Using the one that is already there means no second
 * copy of a PDF reader, and it behaves the same in the browser and the desktop
 * app.
 */
export function bookViewerURL(id: BookId, printedPage: number): string | undefined {
  const path = bookPath(id);
  if (!path) return undefined;
  const route = foundry.utils.getRoute(path);
  const page = Math.max(1, Math.round(printedPage + bookPageOffset()));
  return `${foundry.utils.getRoute("scripts/pdfjs/web/viewer.html")}?file=${encodeURIComponent(route)}#page=${page}`;
}
