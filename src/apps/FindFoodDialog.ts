import { escapeHTML } from "../helpers/handlebars";
import { t } from "../helpers/i18n";
import { getPartyActors, getSharedActor } from "../data/sharedStore";
import { getExtras } from "../data/characterSheet";
import { getDayContext, seasonInfo, terrainInfo } from "../data/dayContext";
import { SITUATIONAL_MODIFIERS } from "../data/checks";
import {
  DEFAULT_SURVIVAL_TARGET,
  FOOD_METHODS,
  FULL_DAY_BONUS,
  type FoodMethod,
} from "../data/findingFood";

/**
 * Which way the party looks for food, and against what.
 *
 * "Finding food" is three different procedures wearing one name (PB p152), and
 * they diverge immediately: fishing needs a rod and open water, hunting ends in
 * a combat rather than a meal, and only foraging cares what season it is. So
 * the duty asks before it rolls.
 *
 * **Whose check it is, is asked** — the same rule the camp's rolls follow, and
 * this dialog was the odd one out until Dolmenmaster said so. Picking a character
 * fills the target in from their own Survival skill and prints it beside the
 * name.
 *
 * **The Skill Target, not a chance.** A Survival Check is 1d6 plus modifiers
 * against the character's Skill Target, which defaults to 6 and only comes
 * *down* through Kindred or Class (PB p144) — so a lower number here is a
 * better forager, and where several could try, the best of them goes.
 *
 * **There is no box to type the target into.** There was one, and it went the
 * moment the dialog started naming characters: two ways to say the same thing
 * is one way too many, and the character's own number is the true one. Where a
 * table wants to change it, the place to change it is the character, not the
 * roll — which is what the attribute sheet's Survival field is for.
 */

export interface FindFoodChoice {
  method: FoodMethod;
  target: number;
  fullDay: boolean;
  situational: number;
  /** Who made the attempt, for the card. */
  forager?: string;
  /** Whose pack the rations go into. Absent means nothing is written down. */
  storeToId?: string;
}

export interface FoodHolder {
  actorId: string;
  name: string;
  /** The party's own store — a pack rather than a person. */
  shared?: boolean;
}

/**
 * Everyone who could carry a haul: the party, and the shared store last.
 *
 * The store is offered because the arithmetic demands it. A fresh ration is one
 * gear slot and 20 coins (Player's Book p116, p149), and a good day's fishing is
 * 2d6 of them — twelve slots is more than a backpack holds. The party's own
 * store, usually a pack animal, is what the rules expect a party to answer with,
 * and it is one click away rather than a rummage afterwards.
 */
export function foodHolders(): FoodHolder[] {
  const holders: FoodHolder[] = getPartyActors().map((actor) => ({
    actorId: actor.id ?? "",
    name: actor.name ?? t("DOLMENWOOD.Party.Unsorted.Someone"),
  }));
  const shared = getSharedActor();
  if (shared?.id)
    holders.push({
      actorId: shared.id,
      name: shared.name ?? t("DOLMENWOOD.Shared.ActorName"),
      shared: true,
    });
  return holders;
}

export async function promptFindFood(): Promise<FindFoodChoice | null> {
  const ctx = getDayContext();
  const terrain = terrainInfo(ctx.terrain);

  // The party, with the Survival target each of them carries. Read from the
  // module's own extras rather than the system: OSE has no Dolmenwood skills,
  // and this is one of the fields the attribute sheet exists to hold.
  //
  // **A player is offered their own characters only** (Dolmenmaster's job 3,
  // 2026-09-03): finding food is one roll for the travelling group, and the
  // question this list answers is *whose* Survival is used — which is a
  // character the person pressing actually plays. The Referee owns every actor,
  // so their list is unchanged.
  const foragers = getPartyActors()
    .filter((actor) => (actor as { isOwner?: boolean }).isOwner)
    .map((actor) => ({
      actorId: actor.id ?? "",
      name: actor.name ?? t("DOLMENWOOD.Party.Unsorted.Someone"),
      survival: getExtras(actor).skills.survival,
    }));
  // The best forager is the lowest target, which is who the party would send.
  const best = foragers.reduce(
    (a, b) => (b.survival < a.survival ? b : a),
    foragers[0] ?? { actorId: "", name: "", survival: DEFAULT_SURVIVAL_TARGET }
  );

  const who = foragers
    .map(
      (f) => `
      <label class="dw-camp-member">
        <input type="radio" name="dw-food-who" value="${escapeHTML(f.actorId)}"
               data-survival="${f.survival}" ${f.actorId === best.actorId ? "checked" : ""}>
        <span class="dw-camp-member-name">${escapeHTML(f.name)}</span>
        <span class="dw-camp-member-stat">${t("DOLMENWOOD.Food.Survival", {
          n: f.survival,
        })}</span>
      </label>`
    )
    .join("");

  const methods = FOOD_METHODS.map(
    (m) => `
      <label class="dw-food-method" title="${escapeHTML(t(m.hintKey))}">
        <input type="radio" name="dw-food-method" value="${m.id}" ${m.id === "forage" ? "checked" : ""}>
        <i class="fas ${m.icon}"></i>
        <span class="dw-food-method-text">
          <strong>${escapeHTML(t(m.labelKey))}</strong>
          <span class="dw-food-method-yield">${escapeHTML(t(m.yieldKey))}</span>
          <span class="dw-food-method-needs">${escapeHTML(t(m.needsKey))}</span>
        </span>
      </label>`
  ).join("");

  // Where the haul lands. Starts on whoever is going out, since that is the
  // answer nine times in ten, and moves with them if the Referee picks another.
  const holders = foodHolders();
  const storeOptions = holders
    .map(
      (h) =>
        `<option value="${escapeHTML(h.actorId)}" ${h.actorId === best.actorId ? "selected" : ""}>${escapeHTML(
          h.name
        )}${h.shared ? ` ${t("DOLMENWOOD.Food.Store.Shared")}` : ""}</option>`
    )
    .join("");

  const modifiers = SITUATIONAL_MODIFIERS.map(
    (n) =>
      `<option value="${n}" ${n === 0 ? "selected" : ""}>${
        n === 0 ? t("DOLMENWOOD.Food.Mod.None") : n > 0 ? `+${n}` : `${n}`
      }</option>`
  ).join("");

  return new Promise<FindFoodChoice | null>((resolve) => {
    new Dialog({
      title: t("DOLMENWOOD.Food.Title"),
      content: `
        <form class="dw-form dw-food-form">
          <div class="dw-food-methods">${methods}</div>

          ${
            foragers.length
              ? `<div class="dw-food-who">
                   <p class="hint">${t("DOLMENWOOD.Food.Who.Hint")}</p>
                   <div class="dw-camp-members">${who}</div>
                 </div>`
              : ""
          }
          <p class="hint">${t("DOLMENWOOD.Food.Check.Hint")}</p>

          <div class="form-group">
            <label for="dw-food-mod">${t("DOLMENWOOD.Food.Mod.Label")}</label>
            <select id="dw-food-mod">${modifiers}</select>
          </div>

          ${
            holders.length
              ? `<div class="form-group">
                   <label for="dw-food-store">${t("DOLMENWOOD.Food.Store.Label")}</label>
                   <select id="dw-food-store">${storeOptions}</select>
                 </div>
                 <p class="hint">${t("DOLMENWOOD.Food.Store.Hint")}</p>`
              : ""
          }

          <label class="dw-food-fullday" for="dw-food-day">
            <input type="checkbox" id="dw-food-day">
            ${t("DOLMENWOOD.Food.FullDay", { bonus: FULL_DAY_BONUS })}
          </label>

          ${/* The season was printed as its own id — "autumn" reads like a word
                in English and like nothing at all in German. Both of these go
                through the tables' own labels now. */ ""}
          ${/* Neither label is lower-cased. It read well in English and turned
                "Pilzwald" into "pilzwald" in German, where a noun keeps its
                capital wherever it stands in the sentence. */ ""}
          <p class="hint">${t("DOLMENWOOD.Food.Context.Hint", {
            terrain: escapeHTML(t(terrain.labelKey)),
            season: escapeHTML(t(seasonInfo(ctx.season).labelKey)),
          })}</p>
        </form>`,
      buttons: {
        ok: {
          label: t("DOLMENWOOD.Common.Roll"),
          icon: '<i class="fas fa-dice-d20"></i>',
          callback: (html: JQuery) => {
            const method =
              (html.find('input[name="dw-food-method"]:checked').val() as FoodMethod) ?? "forage";
            const situational = Number(html.find("#dw-food-mod").val()) || 0;
            const fullDay = !!html.find("#dw-food-day").prop("checked");
            const actorId = String(html.find('input[name="dw-food-who"]:checked').val() ?? "");
            const storeToId = String(html.find("#dw-food-store").val() ?? "");
            // The target is the forager's own, off their sheet. There is no box
            // to type it in any more: picking the character *is* the answer.
            const target =
              foragers.find((f) => f.actorId === actorId)?.survival ?? DEFAULT_SURVIVAL_TARGET;
            resolve({
              method,
              target,
              fullDay,
              situational,
              ...(actorId
                ? { forager: foragers.find((f) => f.actorId === actorId)?.name }
                : {}),
              ...(storeToId ? { storeToId } : {}),
            });
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel"), callback: () => resolve(null) },
      },
      default: "ok",
      // Picking a character moves the target with them, and leaves it editable:
      // the module's own Survival skill has no window to set it in yet, so the
      // Referee is often the only one who knows a character forages well.
      render: (html: JQuery) => {
        html.on("change", 'input[name="dw-food-who"]', (event) => {
          // The pack follows the forager, and stays editable afterwards.
          html.find("#dw-food-store").val((event.currentTarget as HTMLInputElement).value);
        });
      },
      close: () => resolve(null),
    }).render(true);
  });
}
