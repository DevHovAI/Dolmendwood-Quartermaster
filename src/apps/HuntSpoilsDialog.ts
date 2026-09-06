import { escapeHTML } from "../helpers/handlebars";
import { t, tn } from "../helpers/i18n";
import { KILL_YIELD, rationWeight } from "../data/rations";
import { gameAnimalStats } from "../data/findingFood";
import { foodHolders } from "./FindFoodDialog";

/**
 * What the kill was worth, asked once the game is down.
 *
 * Two questions the module cannot answer for itself — how many Hit Points fell,
 * and how big the animal was — and one it can only offer: whose pack the meat
 * goes into. The multiplier is printed beside each band so the arithmetic is
 * visible rather than trusted, and the running total says what it will cost to
 * carry, because a Large kill can easily be forty rations and nobody has forty
 * slots.
 */
export interface HuntSpoilsChoice {
  hitPoints: number;
  size: "small" | "medium" | "large";
  holderId: string;
  /** What the meat is called in the packs. The quarry's name, unless changed. */
  name: string;
}

/**
 * The book's size for a quarry is an id — `small`, `medium`, `large` — and it
 * was being printed straight into the hint, which read well enough in English
 * to hide that it was never a label at all. It needs the short form from the
 * table, not the identifier.
 */
function sizeShortKey(size: "small" | "medium" | "large"): string {
  return `DOLMENWOOD.Hunt.Size.${size.charAt(0).toUpperCase()}${size.slice(1)}.Short`;
}

export async function promptHuntSpoils(
  beast?: string,
  storeToId?: string
): Promise<HuntSpoilsChoice | null> {
  const holders = foodHolders();
  if (!holders.length) {
    ui.notifications?.warn(t("DOLMENWOOD.Hunt.NoHolders"));
    return null;
  }

  // **Two of the three questions are already answered**, and asking them again
  // was the complaint (Dolmenmaster, 2026-08-27): the quarry's size is in its stat
  // block, and whose pack the food goes into was settled when the hunt was
  // rolled. Both come in pre-set and both stay changeable — the size because a
  // Referee may be butchering something they named themselves, the pack because
  // a Large kill is forty rations and the hunter has not got forty slots.
  //
  // Hit Points are deliberately **not** guessed. The book's average is one
  // animal's, and a hunt puts a herd in front of the party; only the table knows
  // how many of them fell.
  const book = gameAnimalStats(beast);
  const preset = book?.size ?? "medium";

  const bands = KILL_YIELD.map(
    (k) => `
      <label class="dw-camp-member">
        <input type="radio" name="dw-spoils-size" value="${k.size}" ${
          k.size === preset ? "checked" : ""
        }>
        <span class="dw-camp-member-name">${escapeHTML(t(k.labelKey))}</span>
      </label>`
  ).join("");

  // A holder that has since left the party is no longer in the list, so the
  // preselection simply does not take and the first name stands — which is the
  // old behaviour, in the one case where it is the right one.
  const known = holders.some((h) => h.actorId === storeToId);
  const targets = holders
    .map(
      (h) =>
        `<option value="${escapeHTML(h.actorId)}"${
          known && h.actorId === storeToId ? " selected" : ""
        }>${escapeHTML(h.name)}${
          h.shared ? ` ${t("DOLMENWOOD.Food.Store.Shared")}` : ""
        }</option>`
    )
    .join("");

  return new Promise<HuntSpoilsChoice | null>((resolve) => {
    let settled = false;
    const done = (value: HuntSpoilsChoice | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    new Dialog({
      title: t("DOLMENWOOD.Hunt.Title"),
      content: `
        <form class="dw-form dw-camp-form">
          <p class="hint">${
            beast
              ? t("DOLMENWOOD.Hunt.IntroNamed", { beast: escapeHTML(beast) })
              : t("DOLMENWOOD.Hunt.Intro")
          }</p>
          <div class="form-group">
            <label for="dw-spoils-hp">${t("DOLMENWOOD.Hunt.HitPoints.Label")}</label>
            <input type="number" id="dw-spoils-hp" min="0" max="500" value="0">
          </div>
          ${
            book
              ? `<p class="hint">${t("DOLMENWOOD.Hunt.Book.Hint", {
                  beast: escapeHTML(beast ?? ""),
                  hp: book.hp,
                  average: book.average,
                  page: book.page,
                })}</p>`
              : ""
          }
          <div class="form-group">
            <label for="dw-spoils-name">${t("DOLMENWOOD.Hunt.Name.Label")}</label>
            <input type="text" id="dw-spoils-name" value="${escapeHTML(
              beast ?? t("DOLMENWOOD.Hunt.FreshMeat")
            )}">
          </div>
          <p class="hint">${t("DOLMENWOOD.Hunt.Name.Hint")}</p>
          <div class="dw-camp-members">${bands}</div>
          ${
            book
              ? `<p class="hint">${t("DOLMENWOOD.Hunt.Size.FromBook", {
                  beast: escapeHTML(beast ?? ""),
                  size: escapeHTML(t(sizeShortKey(book.size))),
                })}</p>`
              : ""
          }
          <p class="dw-spoils-count"></p>
          <div class="form-group">
            <label for="dw-spoils-holder">${t("DOLMENWOOD.Hunt.Holder.Label")}</label>
            <select id="dw-spoils-holder">${targets}</select>
          </div>
          ${
            known
              ? `<p class="hint">${t("DOLMENWOOD.Hunt.Holder.Preset")}</p>`
              : ""
          }
        </form>`,
      buttons: {
        ok: {
          label: t("DOLMENWOOD.Hunt.Butcher"),
          icon: '<i class="fas fa-drumstick-bite"></i>',
          callback: (html: JQuery) => {
            const hitPoints = Number(html.find("#dw-spoils-hp").val()) || 0;
            const size =
              (html.find('input[name="dw-spoils-size"]:checked').val() as HuntSpoilsChoice["size"]) ??
              "medium";
            const holderId = String(html.find("#dw-spoils-holder").val() ?? "");
            const name =
              String(html.find("#dw-spoils-name").val() ?? "").trim() ||
              t("DOLMENWOOD.Hunt.FreshMeat");
            if (hitPoints <= 0) {
              ui.notifications?.warn(t("DOLMENWOOD.Hunt.NothingFell"));
              done(null);
              return;
            }
            done({ hitPoints, size, holderId, name });
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel"), callback: () => done(null) },
      },
      default: "ok",
      render: (html: JQuery) => {
        const paint = () => {
          const hp = Number(html.find("#dw-spoils-hp").val()) || 0;
          const size = String(html.find('input[name="dw-spoils-size"]:checked').val() ?? "medium");
          const per = KILL_YIELD.find((k) => k.size === size)?.per ?? 1;
          const count = Math.max(0, Math.floor(hp)) * per;
          html
            .find(".dw-spoils-count")
            .text(
              count
                ? tn("DOLMENWOOD.Hunt.Count", count, { weight: count * rationWeight() })
                : t("DOLMENWOOD.Hunt.CountNone")
            )
            .toggleClass("is-short", count > 10);
        };
        html.on("change input", paint);
        paint();
      },
      close: () => done(null),
    }).render(true);
  });
}
