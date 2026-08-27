import { escapeHTML } from "../helpers/handlebars";
import { getPartyActors, getSharedActor } from "../data/sharedStore";
import { getExtras } from "../data/characterSheet";
import { getDayContext, terrainInfo } from "../data/dayContext";
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
 * this dialog was the odd one out until Leander said so. Picking a character
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
    name: actor.name ?? "Someone",
  }));
  const shared = getSharedActor();
  if (shared?.id) holders.push({ actorId: shared.id, name: shared.name ?? "Party Stores", shared: true });
  return holders;
}

export async function promptFindFood(): Promise<FindFoodChoice | null> {
  const ctx = getDayContext();
  const terrain = terrainInfo(ctx.terrain);

  // The party, with the Survival target each of them carries. Read from the
  // module's own extras rather than the system: OSE has no Dolmenwood skills,
  // and this is one of the fields the attribute sheet exists to hold.
  const foragers = getPartyActors().map((actor) => ({
    actorId: actor.id ?? "",
    name: actor.name ?? "Someone",
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
        <span class="dw-camp-member-stat">(Survival ${f.survival}+)</span>
      </label>`
    )
    .join("");

  const methods = FOOD_METHODS.map(
    (m) => `
      <label class="dw-food-method" title="${escapeHTML(m.hint)}">
        <input type="radio" name="dw-food-method" value="${m.id}" ${m.id === "forage" ? "checked" : ""}>
        <i class="fas ${m.icon}"></i>
        <span class="dw-food-method-text">
          <strong>${escapeHTML(m.label)}</strong>
          <span class="dw-food-method-yield">${escapeHTML(m.yield)}</span>
          <span class="dw-food-method-needs">${escapeHTML(m.needs)}</span>
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
        )}${h.shared ? " (the party's own store)" : ""}</option>`
    )
    .join("");

  const modifiers = SITUATIONAL_MODIFIERS.map(
    (n) =>
      `<option value="${n}" ${n === 0 ? "selected" : ""}>${
        n === 0 ? "None" : n > 0 ? `+${n}` : `${n}`
      }</option>`
  ).join("");

  return new Promise<FindFoodChoice | null>((resolve) => {
    new Dialog({
      title: "Finding food in the wild",
      content: `
        <form class="dw-food-form">
          <div class="dw-food-methods">${methods}</div>

          ${
            foragers.length
              ? `<p class="hint"><strong>Who goes looking.</strong> The target follows whoever is
                   picked — the best forager is the lowest number.</p>
                 <div class="dw-camp-members">${who}</div>`
              : ""
          }
          <p class="hint dw-food-hint">
            1d6 plus modifiers, meeting or exceeding the forager's own Survival target. A natural 1
            always fails and a natural 6 always succeeds, whatever the modifiers.
          </p>

          <div class="form-group">
            <label for="dw-food-mod">Situational modifier</label>
            <select id="dw-food-mod">${modifiers}</select>
          </div>

          ${
            holders.length
              ? `<div class="form-group">
                   <label for="dw-food-store">Rations go to</label>
                   <select id="dw-food-store">${storeOptions}</select>
                 </div>
                 <p class="hint dw-food-hint">
                   A fresh ration is <strong>1 gear slot</strong> and <strong>20 coins</strong> of
                   weight (Player's Book p116, p149), so a good day's fishing is a real load — the
                   party's own store is there for exactly that. Hunting stores nothing yet: its card
                   carries a button for once the game is down.
                 </p>`
              : ""
          }

          <label class="dw-food-fullday" for="dw-food-day">
            <input type="checkbox" id="dw-food-day">
            A whole day given to it, travelling nowhere (+${FULL_DAY_BONUS})
          </label>

          <p class="hint dw-food-hint">
            Hunting rolls against <strong>${escapeHTML(terrain.label.toLowerCase())}</strong>,
            foraging against <strong>${escapeHTML(ctx.season)}</strong> — both from the
            bar's "where are we?" row.
          </p>
        </form>`,
      buttons: {
        ok: {
          label: "Roll",
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
        cancel: { label: "Cancel", callback: () => resolve(null) },
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
