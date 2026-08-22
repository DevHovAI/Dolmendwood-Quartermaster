import { escapeHTML } from "../helpers/handlebars";
import { getDayContext, terrainInfo } from "../data/dayContext";
import { SITUATIONAL_MODIFIERS, SKILL_TARGETS } from "../data/checks";
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
 * **The Skill Target, not a chance.** A Survival Check is 1d6 plus modifiers
 * against the character's Skill Target, which defaults to 6 and only comes
 * *down* through Kindred or Class (PB p144) — so a lower number here is a
 * better forager, and the group uses the best one among them. It is asked for
 * rather than read off a sheet because this world runs on OSE, which records no
 * Dolmenwood skills. Remembered between rolls, per client, since it is a
 * convenience and not a fact about the world.
 */

const TARGET_KEY = "dolmenwood-party-inventory.survivalTarget";

function rememberedTarget(): number {
  const raw = Number(window.localStorage?.getItem(TARGET_KEY));
  return (SKILL_TARGETS as readonly number[]).includes(raw) ? raw : DEFAULT_SURVIVAL_TARGET;
}

function rememberTarget(value: number): void {
  try {
    window.localStorage?.setItem(TARGET_KEY, String(value));
  } catch {
    // A browser refusing storage is not a reason to fail the roll.
  }
}

export interface FindFoodChoice {
  method: FoodMethod;
  target: number;
  fullDay: boolean;
  situational: number;
}

export async function promptFindFood(): Promise<FindFoodChoice | null> {
  const ctx = getDayContext();
  const terrain = terrainInfo(ctx.terrain);
  const remembered = rememberedTarget();

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

  const targets = SKILL_TARGETS.map(
    (n) =>
      `<option value="${n}" ${n === remembered ? "selected" : ""}>${n}+${
        n === DEFAULT_SURVIVAL_TARGET ? " (untrained)" : ""
      }</option>`
  ).join("");

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

          <div class="form-group">
            <label for="dw-food-target">Best Survival target</label>
            <select id="dw-food-target">${targets}</select>
          </div>
          <p class="hint dw-food-hint">
            1d6 plus modifiers, meeting or exceeding the target. Skills default to
            <strong>6</strong>; Kindred or Class bring it down, and a lower number is the
            better forager — use the best in the group. A natural 1 always fails and a
            natural 6 always succeeds, whatever the modifiers.
          </p>

          <div class="form-group">
            <label for="dw-food-mod">Situational modifier</label>
            <select id="dw-food-mod">${modifiers}</select>
          </div>

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
            const target = Number(html.find("#dw-food-target").val()) || DEFAULT_SURVIVAL_TARGET;
            const situational = Number(html.find("#dw-food-mod").val()) || 0;
            const fullDay = !!html.find("#dw-food-day").prop("checked");
            rememberTarget(target);
            resolve({ method, target, fullDay, situational });
          },
        },
        cancel: { label: "Cancel", callback: () => resolve(null) },
      },
      default: "ok",
      close: () => resolve(null),
    }).render(true);
  });
}
