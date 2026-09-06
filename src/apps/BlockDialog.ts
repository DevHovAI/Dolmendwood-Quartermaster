import { escapeHTML } from "../helpers/handlebars";
import {
  ABILITIES,
  DEFAULT_SKILL_TARGET,
  SAVES,
  slugify,
  uniqueSlug,
  type BlockRoll,
  type CharacterBlock,
} from "../data/characterSheet";
import { t } from "../helpers/i18n";

/**
 * Writing a block: a trait, a class ability, a spell, a skill of its own.
 *
 * **One dialog for all of them**, because the module ships no class list, no
 * kindred list and no spell list — it ships a block that can be any of them and
 * the table writes what it plays (Dolmenmaster, 2026-08-25). So the form asks what a
 * block is rather than what kind of thing it is: a heading to file it under, a
 * name, what it says, and — optionally — a number it stands for, a number of
 * uses, and one of six ways to roll it.
 *
 * Two things here are worth stating:
 *
 * - **The roll fields appear with the kind.** Six kinds each want different
 *   questions, and showing all of them at once would ask a Referee writing a
 *   spell about missile range bands. One `change` handler on the select shows
 *   the block that belongs to the answer.
 * - **The slug is shown, not hidden.** It is how one block reaches another
 *   (`@b.<slug>`), so the writer needs to see what they have just made
 *   addressable. It is derived from the name on a new block and **frozen once
 *   saved**, because renaming a block must not silently break every formula
 *   that pointed at it.
 */

export interface BlockDialogResult {
  block: CharacterBlock;
}

/** The six kinds, in the order the book introduces them. */
/**
 * The air under the last question, in pixels.
 *
 * Foundry's own fit is exact, which puts the last field hard against the
 * buttons — *"es war vorher kaum Abstand zum 'Gewürfelt als'"* — and the
 * first answer to that, a flat 720, was *"n büschn zu hoch"* (Dolmenmaster,
 * 2026-09-06). So the window is the height of its questions plus this, which
 * is a hand's breadth at any kind rather than a guess that only suits one.
 */
const AIR = 48;

const KINDS: { value: string; labelKey: string }[] = [
  { value: "", labelKey: "DOLMENWOOD.Block.Kind.None" },
  { value: "ability", labelKey: "DOLMENWOOD.Block.Kind.Ability" },
  { value: "skill", labelKey: "DOLMENWOOD.Block.Kind.Skill" },
  { value: "save", labelKey: "DOLMENWOOD.Block.Kind.Save" },
  { value: "attack", labelKey: "DOLMENWOOD.Block.Kind.Attack" },
  { value: "xin6", labelKey: "DOLMENWOOD.Block.Kind.Xin6" },
  { value: "formula", labelKey: "DOLMENWOOD.Block.Kind.Formula" },
];

/**
 * What the heading field offers before anything is typed.
 *
 * Suggestions rather than a list: the field is free text, and the module
 * ships no class or spell list on purpose. They are keys because a German
 * table files its blocks under German headings.
 */
const GROUP_SUGGESTIONS = [
  "DOLMENWOOD.Block.Group.Suggest.Kindred",
  "DOLMENWOOD.Block.Group.Suggest.Class",
  "DOLMENWOOD.Block.Group.Suggest.Traits",
  "DOLMENWOOD.Block.Group.Suggest.Spells1",
  "DOLMENWOOD.Block.Group.Suggest.Spells2",
  "DOLMENWOOD.Block.Group.Suggest.Skills",
];

function kindOf(roll: BlockRoll | undefined): string {
  return roll?.kind ?? "";
}

function bonusOf(roll: BlockRoll | undefined): string {
  return roll && "bonus" in roll && roll.bonus ? roll.bonus : "";
}

/**
 * Ask for a block. `existing` edits one in place; leaving it out writes a new one.
 *
 * `taken` is every slug already on the character, so a second "Keen Nose" gets
 * `keen-nose-2` rather than quietly overwriting the first one's address.
 */
export async function promptBlock(
  existing?: CharacterBlock,
  taken: string[] = []
): Promise<CharacterBlock | null> {
  const b = existing;
  const kind = kindOf(b?.roll);

  const kindOptions = KINDS.map(
    (k) =>
      `<option value="${k.value}"${k.value === kind ? " selected" : ""}>${escapeHTML(
        t(k.labelKey)
      )}</option>`
  ).join("");

  const abilityOptions = ABILITIES.map((a) => {
    const chosen = b?.roll?.kind === "ability" && b.roll.ability === a.key;
    return `<option value="${a.key}"${chosen ? " selected" : ""}>${escapeHTML(a.label)}</option>`;
  }).join("");

  const saveOptions = SAVES.map((s) => {
    const chosen = b?.roll?.kind === "save" && b.roll.save === s.key;
    return `<option value="${s.key}"${chosen ? " selected" : ""}>${escapeHTML(s.label)}</option>`;
  }).join("");

  const skillTarget = b?.roll?.kind === "skill" ? b.roll.target : DEFAULT_SKILL_TARGET;
  const chanceTarget = b?.roll?.kind === "xin6" ? b.roll.target : 3;
  const formula = b?.roll?.kind === "formula" ? b.roll.formula : "";
  const magical = b?.roll?.kind === "save" && !!b.roll.magical;
  const missile = b?.roll?.kind === "attack" && !!b.roll.missile;

  return new Promise<CharacterBlock | null>((resolve) => {
    let settled = false;
    const done = (value: CharacterBlock | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const dialog = new Dialog({
      title: existing
        ? t("DOLMENWOOD.Block.TitleEdit", { name: existing.name })
        : t("DOLMENWOOD.Block.TitleNew"),
      content: `
        <form class="dw-camp-form dw-block-form">
          <div class="dw-block-field">
            <div class="form-group">
              <label for="dw-block-group">${t("DOLMENWOOD.Block.Group.Label")}</label>
              <input type="text" id="dw-block-group" list="dw-block-groups"
                     value="${escapeHTML(b?.group ?? "")}" placeholder="${t(
                       "DOLMENWOOD.Block.Group.Placeholder"
                     )}">
              ${/* Suggestions, not a list the module enforces — they are
                    typed into a free text field and become the heading. */ ""}
              <datalist id="dw-block-groups">
                ${GROUP_SUGGESTIONS.map(
                  (key) => `<option value="${escapeHTML(t(key))}">`
                ).join("")}
              </datalist>
            </div>
            <p class="hint">${t("DOLMENWOOD.Block.Group.Hint")}</p>
          </div>

          <div class="form-group">
            <label for="dw-block-name">${t("DOLMENWOOD.Block.Name.Label")}</label>
            <input type="text" id="dw-block-name" value="${escapeHTML(b?.name ?? "")}">
          </div>

          <div class="form-group">
            <label for="dw-block-text">${t("DOLMENWOOD.Block.Text.Label")}</label>
            <textarea id="dw-block-text" rows="3">${escapeHTML(b?.text ?? "")}</textarea>
          </div>

          <div class="dw-block-field">
            <div class="form-group">
              <label for="dw-block-value">${t("DOLMENWOOD.Block.Value.Label")}</label>
              <input type="number" id="dw-block-value" value="${b?.value ?? ""}" placeholder="—">
            </div>
            <p class="hint">${t("DOLMENWOOD.Block.Value.Hint", {
              slug: `<code class="dw-block-slug">@b.${escapeHTML(b?.slug ?? "…")}</code>`,
            })}</p>
          </div>

          <div class="form-group">
            <label for="dw-block-uses">${t("DOLMENWOOD.Block.Uses.Label")}</label>
            <input type="number" id="dw-block-uses" min="0" max="99"
                   value="${b?.uses?.max ?? ""}" placeholder="—">
          </div>

          <div class="dw-block-field">
            <div class="form-group">
              <label for="dw-block-spell">${t("DOLMENWOOD.Block.Spell.Label")}</label>
              <select id="dw-block-spell">
                <option value=""${b?.spell ? "" : " selected"}>${t(
                  "DOLMENWOOD.Block.Spell.No"
                )}</option>
                <option value="arcane"${b?.spell === "arcane" ? " selected" : ""}>${t(
                  "DOLMENWOOD.Block.Spell.Arcane"
                )}</option>
                <option value="holy"${b?.spell === "holy" ? " selected" : ""}>${t(
                  "DOLMENWOOD.Block.Spell.Holy"
                )}</option>
              </select>
            </div>
            <p class="hint">${t("DOLMENWOOD.Block.Spell.Hint")}</p>
          </div>

          <hr>

          <div class="form-group">
            <label for="dw-block-kind">${t("DOLMENWOOD.Block.Kind.Label")}</label>
            <select id="dw-block-kind">${kindOptions}</select>
          </div>

          <div class="form-group dw-block-when" data-kind="ability">
            <label for="dw-block-ability">${t("DOLMENWOOD.Block.Ability.Label")}</label>
            <select id="dw-block-ability">${abilityOptions}</select>
          </div>

          <div class="form-group dw-block-when" data-kind="skill">
            <label for="dw-block-skill-target">${t(
              "DOLMENWOOD.Block.SkillTarget.Label"
            )}</label>
            <input type="number" id="dw-block-skill-target" min="2" max="6" value="${skillTarget}">
          </div>

          <div class="form-group dw-block-when" data-kind="save">
            <label for="dw-block-save">${t("DOLMENWOOD.Block.Save.Label")}</label>
            <select id="dw-block-save">${saveOptions}</select>
          </div>
          <label class="dw-camp-member dw-block-when" data-kind="save">
            <input type="checkbox" id="dw-block-magical" ${magical ? "checked" : ""}>
            <span class="dw-camp-member-name">${t("DOLMENWOOD.Block.Magical")}</span>
          </label>

          <label class="dw-camp-member dw-block-when" data-kind="attack">
            <input type="checkbox" id="dw-block-missile" ${missile ? "checked" : ""}>
            <span class="dw-camp-member-name">${t("DOLMENWOOD.Block.Missile")}</span>
          </label>

          <div class="form-group dw-block-when" data-kind="xin6">
            <label for="dw-block-chance">${t("DOLMENWOOD.Block.Chance.Label")}</label>
            <input type="number" id="dw-block-chance" min="1" max="6" value="${chanceTarget}">
          </div>

          <div class="form-group dw-block-when" data-kind="formula">
            <label for="dw-block-formula">${t("DOLMENWOOD.Block.Formula.Label")}</label>
            <input type="text" id="dw-block-formula" value="${escapeHTML(formula)}"
                   placeholder="${t("DOLMENWOOD.Block.Formula.Placeholder")}">
          </div>

          <div class="form-group dw-block-when" data-kind="ability skill save attack">
            <label for="dw-block-bonus">${t("DOLMENWOOD.Block.Bonus.Label")}</label>
            <input type="text" id="dw-block-bonus" value="${escapeHTML(bonusOf(b?.roll))}"
                   placeholder="${t("DOLMENWOOD.Block.Bonus.Placeholder")}">
          </div>
          <p class="hint dw-block-when" data-kind="ability skill save attack formula xin6">
            ${t("DOLMENWOOD.Block.Bonus.Hint")}
          </p>
        </form>`,
      buttons: {
        ok: {
          label: t(existing ? "DOLMENWOOD.Common.Save" : "DOLMENWOOD.Common.Add"),
          icon: '<i class="fas fa-check"></i>',
          callback: (html: JQuery) => {
            const val = (id: string) => String(html.find(`#${id}`).val() ?? "").trim();
            const num = (id: string) => Number(html.find(`#${id}`).val());
            const on = (id: string) => !!html.find(`#${id}`).prop("checked");

            const name = val("dw-block-name");
            if (!name) {
              ui.notifications?.warn(t("DOLMENWOOD.Block.NeedsName"));
              done(null);
              return;
            }

            const chosen = val("dw-block-kind");
            const bonus = val("dw-block-bonus");
            const withBonus = bonus ? { bonus } : {};
            let roll: BlockRoll | undefined;
            switch (chosen) {
              case "ability":
                roll = { kind: "ability", ability: val("dw-block-ability") as never, ...withBonus };
                break;
              case "skill":
                roll = { kind: "skill", target: num("dw-block-skill-target") || DEFAULT_SKILL_TARGET, ...withBonus };
                break;
              case "save":
                roll = {
                  kind: "save",
                  save: val("dw-block-save") as never,
                  ...(on("dw-block-magical") ? { magical: true } : {}),
                  ...withBonus,
                };
                break;
              case "attack":
                roll = {
                  kind: "attack",
                  ...(on("dw-block-missile") ? { missile: true } : {}),
                  ...withBonus,
                };
                break;
              case "xin6":
                roll = { kind: "xin6", target: num("dw-block-chance") || 3 };
                break;
              case "formula": {
                const f = val("dw-block-formula");
                // A formula block with no formula is a note that pretends to
                // roll. Better to file it as the note it is.
                roll = f ? { kind: "formula", formula: f } : undefined;
                break;
              }
              default:
                roll = undefined;
            }

            const rawValue = val("dw-block-value");
            const rawUses = val("dw-block-uses");
            const maxUses = rawUses === "" ? undefined : Math.max(0, num("dw-block-uses") || 0);

            done({
              id: existing?.id ?? foundry.utils.randomID(),
              group: val("dw-block-group"),
              name,
              // **Frozen once written.** A slug is an address, and an address
              // that moves when the name is edited breaks every formula
              // pointing at it without saying so.
              slug: existing?.slug ?? uniqueSlug(slugify(name), taken),
              text: val("dw-block-text"),
              ...(rawValue === "" ? {} : { value: num("dw-block-value") || 0 }),
              ...(roll ? { roll } : {}),
              ...(maxUses
                ? {
                    uses: {
                      // Editing keeps whatever is left today, clamped if the
                      // maximum was lowered under it.
                      value: Math.min(existing?.uses?.value ?? maxUses, maxUses),
                      max: maxUses,
                    },
                  }
                : {}),
              ...(() => {
                const kind = val("dw-block-spell");
                return kind === "arcane" || kind === "holy" ? { spell: kind } : {};
              })(),
              // A block that has stopped being a spell should not keep a tick
              // that only spells have.
              // Charges survive an edit, but only while it is still a spell:
              // turning a spell into a plain trait leaves nothing to prepare.
              ...(existing?.prepared && val("dw-block-spell")
                ? { prepared: existing.prepared }
                : {}),
            });
          },
        },
        cancel: { label: t("DOLMENWOOD.Common.Cancel"), callback: () => done(null) },
      },
      default: "ok",
      render: (html: JQuery) => {
        // Only the questions the chosen kind actually asks. A `data-kind` may
        // list several, so one field can serve four of them — the bonus does.
        const paint = () => {
          const chosen = String(html.find("#dw-block-kind").val() ?? "");
          html.find(".dw-block-when").each((_i, el) => {
            const kinds = (el.getAttribute("data-kind") ?? "").split(" ");
            el.style.display = chosen && kinds.includes(chosen) ? "" : "none";
          });
        };

        // **As tall as its questions, and a breath more.**
        //
        // Foundry measures a dialog exactly once, so a kind chosen afterwards
        // would push its questions into a scrolling box; and its measurement
        // is exact, which leaves the last field sitting hard against the
        // buttons. Both are answered by measuring again whenever the form
        // changes and adding `AIR` to whatever comes back.
        //
        // **Never during the `render` callback**, which is where the first
        // attempt at this sat and was wrong. `Application#setPosition` sets
        // the width in the same call, and it does so whenever
        // `el.style.width` is still empty — `tarW = width || el.offsetWidth`,
        // clamped to the viewport. The base class applies the position
        // *after* this callback, so a fit called from inside it measured an
        // unconstrained form and opened the window as wide as the screen. One
        // frame later the width is set and that branch is skipped.
        const fit = () => {
          const el = dialog.element?.[0];
          if (!el) return;
          // "auto" is Foundry's own word for "as tall as the content": it
          // clears the height, measures, and writes the number back.
          dialog.setPosition({ height: "auto" });
          dialog.setPosition({
            height: Math.min(el.offsetHeight + AIR, window.innerHeight - 40),
          });
        };

        html.find("#dw-block-kind").on("change", () => {
          paint();
          fit();
        });

        // The address, live, while a new block is still being named.
        if (!existing) {
          html.find("#dw-block-name").on("input", () => {
            const typed = String(html.find("#dw-block-name").val() ?? "");
            html
              .find(".dw-block-slug")
              .text(`@b.${typed ? uniqueSlug(slugify(typed), taken) : "…"}`);
          });
        }
        paint();
        requestAnimationFrame(fit);
      },
      close: () => done(null),
      // **A width and a height, neither of which this dialog ever had.** It
      // fell back to Foundry's 400px while every comparable dialog here asks
      // for 460 to 720 — and this one carries a text area, three explanations
      // and inline code samples (Dolmenmaster, 2026-09-05).
      //
      // The height is not asked for here. It is measured after the first
      // render and re-measured whenever the form changes — see `fit`.
    }, { width: 560 });
    dialog.render(true);
  });
}
