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

/**
 * Writing a block: a trait, a class ability, a spell, a skill of its own.
 *
 * **One dialog for all of them**, because the module ships no class list, no
 * kindred list and no spell list — it ships a block that can be any of them and
 * the table writes what it plays (Leander, 2026-08-25). So the form asks what a
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
const KINDS: { value: string; label: string }[] = [
  { value: "", label: "Not rolled — a note" },
  { value: "ability", label: "Ability Check (1d6 + mod, at or over 4)" },
  { value: "skill", label: "Skill Check (1d6, at or over a target)" },
  { value: "save", label: "Saving Throw (1d20, at or over the target)" },
  { value: "attack", label: "Attack Roll (1d20 + Attack + ability)" },
  { value: "xin6", label: "X-in-6 chance (1d6, at or under)" },
  { value: "formula", label: "Plain formula (damage, a duration, anything)" },
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
    (k) => `<option value="${k.value}"${k.value === kind ? " selected" : ""}>${escapeHTML(k.label)}</option>`
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

    new Dialog({
      title: existing ? `Edit “${existing.name}”` : "New block",
      content: `
        <form class="dw-camp-form dw-block-form">
          <div class="form-group">
            <label for="dw-block-group">Heading</label>
            <input type="text" id="dw-block-group" list="dw-block-groups"
                   value="${escapeHTML(b?.group ?? "")}" placeholder="Kindred, Class, Spells 1st…">
            <datalist id="dw-block-groups">
              <option value="Kindred"><option value="Class"><option value="Traits">
              <option value="Spells, 1st"><option value="Spells, 2nd"><option value="Skills">
            </datalist>
          </div>
          <p class="hint">Blocks are grouped under whatever heading you type. The module ships no
            class or spell lists on purpose — write what you play.</p>

          <div class="form-group">
            <label for="dw-block-name">Name</label>
            <input type="text" id="dw-block-name" value="${escapeHTML(b?.name ?? "")}">
          </div>

          <div class="form-group">
            <label for="dw-block-text">What it says</label>
            <textarea id="dw-block-text" rows="3">${escapeHTML(b?.text ?? "")}</textarea>
          </div>

          <div class="form-group">
            <label for="dw-block-value">Stands for</label>
            <input type="number" id="dw-block-value" value="${b?.value ?? ""}" placeholder="—">
          </div>
          <p class="hint">Optional. A block with a number can be referred to from any other
            formula as <code class="dw-block-slug">@b.${escapeHTML(b?.slug ?? "…")}</code> — which is
            how one thing on this sheet leans on another.</p>

          <div class="form-group">
            <label for="dw-block-uses">Uses per day</label>
            <input type="number" id="dw-block-uses" min="0" max="99"
                   value="${b?.uses?.max ?? ""}" placeholder="—">
          </div>

          <hr>

          <div class="form-group">
            <label for="dw-block-kind">Rolled as</label>
            <select id="dw-block-kind">${kindOptions}</select>
          </div>

          <div class="form-group dw-block-when" data-kind="ability">
            <label for="dw-block-ability">Ability</label>
            <select id="dw-block-ability">${abilityOptions}</select>
          </div>

          <div class="form-group dw-block-when" data-kind="skill">
            <label for="dw-block-skill-target">Target (at or over)</label>
            <input type="number" id="dw-block-skill-target" min="2" max="6" value="${skillTarget}">
          </div>

          <div class="form-group dw-block-when" data-kind="save">
            <label for="dw-block-save">Save</label>
            <select id="dw-block-save">${saveOptions}</select>
          </div>
          <label class="dw-camp-member dw-block-when" data-kind="save">
            <input type="checkbox" id="dw-block-magical" ${magical ? "checked" : ""}>
            <span class="dw-camp-member-name">Against magic — adds the Wisdom modifier</span>
          </label>

          <label class="dw-camp-member dw-block-when" data-kind="attack">
            <input type="checkbox" id="dw-block-missile" ${missile ? "checked" : ""}>
            <span class="dw-camp-member-name">Missile — Dexterity rather than Strength</span>
          </label>

          <div class="form-group dw-block-when" data-kind="xin6">
            <label for="dw-block-chance">Chance in 6 (at or under)</label>
            <input type="number" id="dw-block-chance" min="1" max="6" value="${chanceTarget}">
          </div>

          <div class="form-group dw-block-when" data-kind="formula">
            <label for="dw-block-formula">Formula</label>
            <input type="text" id="dw-block-formula" value="${escapeHTML(formula)}"
                   placeholder="2d6 + @b.keen-nose">
          </div>

          <div class="form-group dw-block-when" data-kind="ability skill save attack">
            <label for="dw-block-bonus">Added to the roll</label>
            <input type="text" id="dw-block-bonus" value="${escapeHTML(bonusOf(b?.roll))}"
                   placeholder="+2, @b.blade, @level">
          </div>
          <p class="hint dw-block-when" data-kind="ability skill save attack formula xin6">
            Anything Foundry can roll works here, and every score, save, skill and block on this
            sheet is available as <code>@str</code>, <code>@doom</code>, <code>@b.slug</code> and so
            on. <code>@attackPenalty</code> and <code>@damagePenalty</code> carry what hunger and
            exhaustion already cost — an Attack Roll applies its own without being asked.
          </p>
        </form>`,
      buttons: {
        ok: {
          label: existing ? "Save" : "Add",
          icon: '<i class="fas fa-check"></i>',
          callback: (html: JQuery) => {
            const val = (id: string) => String(html.find(`#${id}`).val() ?? "").trim();
            const num = (id: string) => Number(html.find(`#${id}`).val());
            const on = (id: string) => !!html.find(`#${id}`).prop("checked");

            const name = val("dw-block-name");
            if (!name) {
              ui.notifications?.warn("A block needs a name.");
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
              ...(existing?.prepared ? { prepared: true } : {}),
            });
          },
        },
        cancel: { label: "Cancel", callback: () => done(null) },
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
        html.find("#dw-block-kind").on("change", paint);

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
      },
      close: () => done(null),
    }).render(true);
  });
}
