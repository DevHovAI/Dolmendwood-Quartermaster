import { TEMPLATES } from "../constants";
import {
  ABILITIES,
  ALIGNMENTS,
  DEFAULT_SKILL_TARGET,
  KINDREDS,
  LANGUAGE_GROUPS,
  MOON_SIGN_GROUP,
  PERSONA_FIELDS,
  SAVES,
  abilityModifier,
  applyLanguagePicks,
  splitLanguages,
  getExtras,
  getSystemFields,
  hasSystemFields,
  setSystemField,
  uniqueSlug,
  updateExtras,
  type CharacterBlock,
  type PersonaKey,
} from "../data/characterSheet";
import { characterPenalties, planRoll } from "../data/characterRolls";
import { performRoll } from "../data/characterCards";
import {
  attackFormula,
  attackModes,
  damageFormula,
  equippedWeapons,
  type RangeBand,
} from "../data/weapons";
import { tablesFor, type KindredTables } from "../data/kindredTables";
import { MOON_SIGNS, moonSignLabel, moonSignLine, moonSignsByMoon } from "../data/moonSigns";
import { CLASSES, classFromText, readModifier, xpModifierForScore } from "../data/xpAward";
import { levelChange, routesFor, thresholdFor, xpCapFor } from "../data/levelUp";
import { escapeHTML } from "../helpers/handlebars";
import { t } from "../helpers/i18n";
import { applyLevelUp, capLine } from "../data/levelUpApply";
import { castOne, markOne, unmarkOne, chargeLabel, creditLine } from "../data/spellCharges";
import { promptBlock } from "./BlockDialog";
import { PlayerInventoryApp } from "./PlayerInventoryApp";

/**
 * The attribute sheet: page one of the printed Dolmenwood sheet, and nothing of
 * page two.
 *
 * **Scope is Dolmenmaster's and it is narrower than "a character sheet"** — *"Im
 * Prinzip keinen vollständigen Character Sheet sondern eher einen
 * Attributsbogen (denn ein Inventar haben wir ja schon mega ausgearbeitet)."*
 * So there is no equipment tab here. The Inventory button in the header opens
 * the one the module already has, because one inventory is the whole point.
 *
 * **One home per value.** Everything OSE has a field for — scores, saves, HP,
 * AC, Attack, Speed, XP, Level, class, alignment — is written straight back
 * into `actor.system`, so Foundry's token bars keep working and compendium
 * content is not orphaned. Only what OSE has nowhere to put — kindred,
 * background, affiliation, moon sign, the three skill targets, the blocks —
 * lives in the module's own flag. `setSystemField` knows the one awkward case:
 * OSE *derives* AC from armour, so an edit becomes a change to `.mod`.
 *
 * **Everything on it that can be rolled, rolls.** The scores, the five saves,
 * the three skills, every equipped weapon and every block the table wrote — all
 * through `planRoll`, so the book's rules live in one place and this window only
 * decides what was clicked.
 */
export class CharacterSheetApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /**
   * One window per actor, reused.
   *
   * A Referee opening four characters in a row wants four windows; opening the
   * same one four times wants one. Keyed by actor id rather than a single
   * static instance for exactly that reason.
   */
  static #open = new Map<string, CharacterSheetApp>();

  readonly actor: Actor;

  /**
   * Is the languages tick-list unfolded?
   *
   * Per-instance and not persisted: it is a moment during character creation
   * rather than a preference. It exists at all because ticking a language
   * writes the actor, and that re-draws the sheet from scratch — see
   * `#wirePickers`.
   */
  #langPickerOpen = false;

  /** …and the moon signs', kept for the same reason. */
  #moonPickerOpen = false;

  /**
   * …and the Appearance section, which is not a picker but is folded the same
   * way and was snapping shut on every suggestion taken inside it.
   */
  #personaOpen = false;

  /**
   * Which of the Desires/Beliefs panels are unfolded, by field key.
   *
   * A set rather than two more flags: they are the same control twice, and a
   * third wide persona field would need no new state at all.
   */
  #openPersonaPickers = new Set<string>();

  constructor(actor: Actor, options: Record<string, unknown> = {}) {
    super({ ...options, id: `dolmenwood-character-${actor.id}` });
    this.actor = actor;
  }

  static open(actor: Actor): void {
    const existing = CharacterSheetApp.#open.get(actor.id ?? "");
    if (existing) {
      void existing.render(true);
      void existing.bringToFront?.();
      return;
    }
    const app = new CharacterSheetApp(actor);
    CharacterSheetApp.#open.set(actor.id ?? "", app);
    void app.render(true);
  }

  /** Redraw every open sheet — used when the day's state moves a penalty. */
  static refreshAll(): void {
    for (const app of CharacterSheetApp.#open.values()) void app.render(false);
  }

  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    classes: ["dolmenwood-party-inventory", "dw-sheet"],
    window: { title: "Attributes", resizable: true, icon: "fas fa-scroll" },
    position: { width: Math.min(880, window.innerWidth - 80), height: 760 },
    actions: {
      rollAbility: CharacterSheetApp._onRollAbility,
      rollSave: CharacterSheetApp._onRollSave,
      rollSkill: CharacterSheetApp._onRollSkill,
      rollBlock: CharacterSheetApp._onRollBlock,
      rollAttack: CharacterSheetApp._onRollAttack,
      rollDamage: CharacterSheetApp._onRollDamage,
      addBlock: CharacterSheetApp._onAddBlock,
      pickMoonSign: CharacterSheetApp._onPickMoonSign,
      pickPersona: CharacterSheetApp._onPickPersona,
      editBlock: CharacterSheetApp._onEditBlock,
      deleteBlock: CharacterSheetApp._onDeleteBlock,
      addSkill: CharacterSheetApp._onAddSkill,
      deleteSkill: CharacterSheetApp._onDeleteSkill,
      spendUse: CharacterSheetApp._onSpendUse,
      restoreUses: CharacterSheetApp._onRestoreUses,
      togglePrepared: CharacterSheetApp._onTogglePrepared,
      levelUp: CharacterSheetApp._onLevelUp,
      resetXpMod: CharacterSheetApp._onResetXpMod,
      openInventory: CharacterSheetApp._onOpenInventory,
      showPortrait: CharacterSheetApp._onShowPortrait,
      pickPortrait: CharacterSheetApp._onPickPortrait,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.CHARACTER_SHEET },
  };

  override get title(): string {
    return `${this.actor.name ?? "Character"} — Attributes`;
  }

  override async close(options?: Record<string, unknown>): Promise<this> {
    CharacterSheetApp.#open.delete(this.actor.id ?? "");
    return super.close(options) as Promise<this>;
  }

  // ─── What the window knows ───────────────────────────────────────────────────

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const actor = this.actor;
    const sys = getSystemFields(actor);
    const extras = getExtras(actor);
    const canEdit = !!actor.isOwner;

    const abilities = ABILITIES.map((a) => {
      const { value, bonus } = sys.scores[a.key];
      const byTheBook = abilityModifier(value);
      return {
        ...a,
        value,
        bonus,
        // "+2" reads as a modifier; "2" reads as a second score.
        signed: signed(bonus),
        // Typing a score fills the modifier in from the book's table, so the two
        // only come apart when somebody says so — a ring, a curse, a Referee's
        // ruling. Worth pointing out when they have, and worth not undoing.
        houseRuled: value > 0 && bonus !== byTheBook,
        byTheBook: signed(byTheBook),
      };
    });

    // **Two columns of three** (Dolmenmaster, 2026-08-28): the book's three on the
    // left, the table's own on the right, and an empty lane on the right is the
    // button that fills it. *"Mehr als 6 wird niemand haben"* — so the section
    // has a height that never moves, which is the whole point: it can be pinned
    // to Experience beside it.
    const printed = [
      { key: "listen", label: "Listen", target: extras.skills.listen, custom: false, address: "@listen" },
      { key: "search", label: "Search", target: extras.skills.search, custom: false, address: "@search" },
      { key: "survival", label: "Survival", target: extras.skills.survival, custom: false, address: "@survival" },
    ];
    const own = extras.moreSkills.map((s) => ({
      key: s.id,
      label: s.name,
      target: s.target,
      custom: true,
      address: `@s.${s.slug}`,
    }));
    // A sheet that already carries more than three of its own keeps every one
    // of them: the grid grows a row rather than hiding a skill.
    const skillRows = Math.max(printed.length, own.length);
    const skills: object[] = [];
    for (let i = 0; i < skillRows; i++) {
      // **Woven, one row at a time**, rather than one column after the other:
      // an ordinary two-column grid fills row by row, and interleaving here is
      // what puts the printed three down the left and the table's own down the
      // right without the stylesheet having to count anything. Only the right
      // offers to add — a new skill appears there, never among the book's.
      skills.push(printed[i] ?? { empty: true }, own[i] ?? { empty: true, add: true });
    }

    const weapons = equippedWeapons(actor).map((w) => ({
      ...w,
      modes: attackModes(w),
      // Only a weapon that can be thrown or shot has bands to choose between.
      bands: w.ranges
        ? [
            { key: "short", label: `Short ${w.ranges.short}' (+1)` },
            { key: "medium", label: `Medium ${w.ranges.medium}'` },
            { key: "long", label: `Long ${w.ranges.long}' (−1)` },
          ]
        : undefined,
      notesLine: w.notes.join(" · "),
    }));

    // Whatever the Kindred field says, if the book has tables for it.
    const tables = tablesFor(extras.kindred);

    return {
      actorId: actor.id,
      name: actor.name,
      img: actor.img,
      canEdit,
      // A character of another system has no scores to read, and the window says
      // so rather than showing six zeroes as though they were true.
      hasSystem: hasSystemFields(actor),

      identity: {
        kindred: extras.kindred,
        class: sys.class,
        background: extras.background,
        alignment: sys.alignment,
        affiliation: extras.affiliation,
        moonSign: extras.moonSign,
      },

      abilities,
      saves: SAVES.map((s) => ({ ...s, value: sys.saves[s.key] })),

      hp: sys.hp,
      ac: sys.ac,
      attack: sys.attack,
      attackSigned: signed(sys.attack),
      // **Movement is not on this sheet**, Dolmenmaster's call, 2026-08-27. The
      // printed page has Speed, Exploring and Travel Points on it; the module
      // works all three out from what the character is carrying and shows them
      // in the inventory, on the party window and on the day bar. A fourth
      // copy here would be the only one that could disagree with the load.
      // Dolmenwood's Magic Resistance *is* the Wisdom modifier on the printed
      // sheet, so the derived figure is offered and the field is left free for a
      // table that rules otherwise.
      magicResistance: extras.magicResistance,
      magicResistanceDerived: signed(sys.scores.wis.bonus),

      skills,
      defaultSkillTarget: DEFAULT_SKILL_TARGET,
      languages: sys.languages,
      level: sys.level,
      xp: sys.xp,
      prepares: extras.prepares,

      // The nine Classes, offered to the Class field as a datalist. Naming one
      // is what turns the advancement tables on.
      classNames: CLASSES.map((c) => c.label),
      // The same offer, for the two other identity fields the book enumerates.
      // Background and Affiliation get none: the book prints a background table
      // per Kindred rather than one list, and names no factions to choose from.
      kindredNames: KINDREDS,
      alignmentNames: ALIGNMENTS,
      languageGroups: LANGUAGE_GROUPS,
      langPickerOpen: this.#langPickerOpen,
      advance: advanceView(actor),

      // The XP modifier follows the Class until somebody types over it. The box
      // shows whichever is in force and says which one that is.
      xpMod: (() => {
        const derived = derivedXpModifier(actor);
        const manual = extras.xpBonusManual;
        const value = manual || derived === null ? sys.xp.bonus : derived;
        return {
          value,
          manual,
          hasDerived: derived !== null,
          derived: derived ?? 0,
          // The way back is offered whenever there is a Class to go back to,
          // even if the typed number happens to match it — otherwise a sheet
          // could stay hand-set with nothing on it saying so.
          canReset: manual && derived !== null,
        };
      })(),

      weapons,
      hasWeapons: weapons.length > 0,
      // **Shown, never ticked.** Hunger and exhaustion reach an Attack Roll by
      // themselves and exhaustion alone reaches damage; there is deliberately no
      // box to apply them, because a box that can be set wrongly eventually is.
      // This line only says what the formulas are already doing.
      penalties: penaltyLine(actor),

      groups: groupBlocks(extras.blocks, extras.spellCredits),
      // The morning's preparation, waiting to be spent on the list below.
      spellCredits: extras.spellCredits,
      spellCreditLine: creditLine(extras.spellCredits),
      hasSpells: extras.blocks.some((b) => !!b.spell),
      hasBlocks: extras.blocks.length > 0,

      // Free text, every one of it, and never read by a formula. Folded away by
      // default: it is written once and read at the table, not during a round.
      // **The suggestions follow the Kindred**, because the book's tables do:
      // a breggle's backgrounds are onion farmers and standard-bearers, an
      // elf's are poets and unicorn handlers. A Kindred the book never printed
      // gets no suggestions rather than somebody else's.
      persona: PERSONA_FIELDS.map((f) => {
        const rows = tables?.persona[f.key as keyof KindredTables["persona"]] ?? [];
        const written = (extras.persona[f.key] ?? "").trim();
        return {
          ...f,
          value: extras.persona[f.key] ?? "",
          // Breggles and grimalkins have fur where the others have a body, and
          // the field takes the Kindred's own word for it.
          label: f.key === "body" ? (tables?.bodyLabel ?? f.label) : f.label,
          // **The two wide ones are textareas, and no browser puts a datalist
          // on one** — so where the other six get suggestions in the box,
          // Desires and Beliefs get a panel under it (Dolmenmaster, 2026-09-03).
          // Same table either way; only the way it is offered differs.
          options: f.wide ? [] : rows,
          picks: f.wide
            ? rows.map((text) => ({ text, chosen: written === text }))
            : [],
          pickerOpen: this.#openPersonaPickers.has(f.key),
        };
      }),
      backgroundOptions: tables?.backgrounds ?? [],
      // Grouped by moon for reading, but each row carries its place in the flat
      // table: that index is what the button hands back, and it is the one
      // identifier the book's own table already gives every sign.
      moonSigns: moonSignsByMoon().map((m) => ({
        moon: m.moon,
        signs: m.signs.map((s) => ({
          ...s,
          label: moonSignLabel(s),
          index: MOON_SIGNS.indexOf(s),
          // Which one is already this character's. Matched on the name rather
          // than the whole line, so a sign whose wording a table has edited is
          // still recognised as the one they chose.
          chosen: extras.moonSign.trim().startsWith(moonSignLabel(s)),
        })),
      })),
      // Elves and grimalkins are fairies, and the rule is for those born in the
      // mortal world. Said beside the picker, never enforced by it.
      moonSignForeign: /^(elf|grimalkin)$/i.test(extras.kindred.trim()),
      moonPickerOpen: this.#moonPickerOpen,
      personaOpen: this.#personaOpen,
      hasPersona: PERSONA_FIELDS.some((f) => !!extras.persona[f.key]),
    };
  }

  // ─── Typing in the boxes ─────────────────────────────────────────────────────

  override async _onRender(): Promise<void> {
    const el = this.element;
    this.#squarePortrait();
    this.#measurePortrait();
    // The folds remember themselves for every reader, owner or not.
    this.#wirePickers(el);

    if (!this.actor.isOwner) return;

    // One handler for every box, keyed by what the input says it is. The
    // system's own fields go back to the actor; ours go into the flag. Split by
    // attribute rather than by class so the template reads as a list of fields
    // rather than a list of wiring.
    el.querySelectorAll<HTMLInputElement>("[data-field]").forEach((input) => {
      input.addEventListener("change", async () => {
        const field = input.dataset.field!;
        const value = input.type === "number" ? Number(input.value) || 0 : input.value;
        await setSystemField(this.actor, field, value);

        // **Typing a score fills in what the book says it is worth** (p22) —
        // Dolmenmaster's ask, and it saves looking the table up six times per
        // character. The modifier stays editable afterwards, because a ring or
        // a curse moves it without moving the score; the sheet only offers the
        // book's answer, it does not insist on it.
        if (field.startsWith("score-")) {
          const key = field.slice(6);
          await setSystemField(this.actor, `mod-${key}`, abilityModifier(Number(value) || 0));
        }

        // **Typing the XP modifier is what makes it hand-set.** Until somebody
        // does, the number belongs to the Class and follows the Prime Ability
        // scores by itself; afterwards it is theirs, and the reset beside the
        // box is the way back.
        if (field === "xpBonus") {
          await updateExtras(this.actor, (x) => {
            x.xpBonusManual = true;
            return x;
          });
        }
        void this.render(false);
      });
    });

    // A textarea as well as an input, since the moon sign holds a rule rather
    // than a name. Both carry `.value` and `.type`, so one handler serves them.
    el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-extra]").forEach((input) => {
      input.addEventListener("change", async () => {
        const field = input.dataset.extra!;
        const value = input.type === "number" ? Number(input.value) || 0 : input.value;
        await updateExtras(this.actor, (x) => {
          if (field.startsWith("persona-")) {
            const key = field.slice(8) as keyof typeof x.persona;
            if (key in x.persona) x.persona[key] = String(value);
          } else if (field.startsWith("skill-")) {
            const key = field.slice(6);
            const target = Number(value) || DEFAULT_SKILL_TARGET;
            // **The table's own skills are keyed by id, the printed three by
            // name**, and the box says only "skill-<something>". Asking the
            // list first is what keeps a skill called "Climb" from writing
            // itself into a fourth printed skill nobody can see.
            const own = x.moreSkills.find((s) => s.id === key);
            if (own) own.target = target;
            else if (key in x.skills) {
              x.skills[key as "listen" | "search" | "survival"] = target;
            }
          } else {
            (x as unknown as Record<string, unknown>)[field] = value;
          }
          return x;
        });
        void this.render(false);
      });
    });

  }

  /**
   * The tick-list under the Languages field.
   *
   * **The field stays the authority.** The panel only writes into it, the
   * boxes are re-derived from whatever it says, and a language typed by hand
   * survives every tick — see `applyLanguagePicks`. That order matters because
   * the book's list is not exhaustive: two of its own tongues are left out of
   * the picker on purpose, and a table may play something it never printed.
   *
   * **Ticking writes straight through** rather than firing the field's own
   * change handler, which re-renders the whole sheet: a panel that shut itself
   * after every box would make picking three languages three journeys. Nothing
   * else on the sheet reads the languages, so there is nothing to re-draw.
   */
  #wirePickers(el: HTMLElement): void {
    // **Whether a fold is open outlives the re-render**, which is the only way
    // any of them can stay open at all: writing a language, a moon sign or a
    // persona field updates the actor, `updateActor` re-draws every open sheet
    // (module.ts), and a <details> with no `open` attribute comes back shut.
    // Kept on the instance rather than in a setting: these are moments during
    // character creation, not preferences.
    //
    // Wired before anything else here, and for every reader rather than only
    // for owners: a fold that closes itself is just as wrong on a sheet that
    // cannot be edited.
    const folds: [string, (open: boolean) => void][] = [
      [".dw-lang-picker", (open) => (this.#langPickerOpen = open)],
      [".dw-moon-picker", (open) => (this.#moonPickerOpen = open)],
      [".dw-sheet-persona", (open) => (this.#personaOpen = open)],
    ];
    for (const [selector, remember] of folds) {
      const fold = el.querySelector<HTMLDetailsElement>(selector);
      fold?.addEventListener("toggle", () => remember(fold.open));
    }

    // The Desires/Beliefs panels, which are the same control once per field.
    for (const fold of el.querySelectorAll<HTMLDetailsElement>(".dw-persona-picker")) {
      const key = fold.dataset.personaKey ?? "";
      fold.addEventListener("toggle", () => {
        if (fold.open) this.#openPersonaPickers.add(key);
        else this.#openPersonaPickers.delete(key);
      });
    }

    const field = el.querySelector<HTMLInputElement>('[data-field="languages"]');
    const boxes = [...el.querySelectorAll<HTMLInputElement>(".dw-lang-box")];
    if (!field || !boxes.length) return;

    const sync = (): void => {
      const written = new Set(splitLanguages(field.value).map((s) => s.toLowerCase()));
      for (const box of boxes) box.checked = written.has(box.value.toLowerCase());
    };
    sync();
    // Typed as it is typed, so a word finished by hand ticks its own box.
    field.addEventListener("input", sync);

    for (const box of boxes) {
      box.addEventListener("change", async () => {
        const ticked = boxes.filter((b) => b.checked).map((b) => b.value);
        field.value = applyLanguagePicks(field.value, ticked);
        await setSystemField(this.actor, "languages", field.value);
      });
    }
  }

  /**
   * What the portrait file actually is, said out loud.
   *
   * *"Die Portraits in den Attributes sind noch relativ niedrigauflösend"*
   * (Dolmenmaster, 2026-08-28) has two possible causes, and the window is the only
   * thing here that can tell them apart. The box is at least {@link
   * PORTRAIT_BOX} CSS pixels and usually more — `#squarePortrait` sizes it from
   * the identity block — which is twice that in real ones on most screens; a
   * 128-pixel token picture is therefore stretched more than three times. **No
   * stylesheet can fix that — only a bigger file can.** So the sheet measures
   * what loaded, puts the numbers in the tooltip, and tints the picker button
   * when the file is the reason.
   *
   * An SVG is skipped: it has no resolution to be short of.
   */
  /**
   * The portrait is square, and its side is the height of the identity block
   * beside it — so the picture ends exactly where the moon sign does.
   *
   * **Measured rather than typed**, because that height is the sum of however
   * many fields the block happens to hold, and a typed number would want
   * re-typing every time one joins. **Measured rather than left to CSS**,
   * because a flex row cannot carry a stretched height back into a width: the
   * main size is resolved from the flex basis before the cross size is
   * stretched, so `aspect-ratio` would leave the box as wide as it began.
   *
   * Widening the portrait narrows the identity block, which can make it taller,
   * which would widen the portrait again — so the loop is closed by hand rather
   * than left to run: three passes at most, and it stops the moment two agree
   * within a pixel, which for a block of short fields is the first one.
   */
  #squarePortrait(): void {
    const box = this.element.querySelector<HTMLElement>(".dw-sheet-portrait-box");
    const identity = this.element.querySelector<HTMLElement>(".dw-sheet-identity");
    if (!box || !identity) return;

    for (let pass = 0; pass < 3; pass++) {
      // Never more than half the head. The block beside it has a floor to stand
      // on — the sheet stops narrowing and scrolls instead — so this cap should
      // not be reachable; it is here so that a picture can never eat the fields
      // it is supposed to sit beside, whatever a future layout does.
      const half = Math.round(this.element.getBoundingClientRect().width / 2);
      const wanted = Math.round(identity.getBoundingClientRect().height);
      const side = Math.max(PORTRAIT_BOX, Math.min(wanted, half || wanted));
      if (Math.abs(side - box.getBoundingClientRect().width) <= 1) return;
      box.style.width = `${side}px`;
    }
  }

  #measurePortrait(): void {
    const box = this.element.querySelector<HTMLElement>(".dw-sheet-portrait-box");
    const img = box?.querySelector<HTMLImageElement>(".dw-sheet-portrait");
    if (!box || !img) return;
    if (/\.svg(\?|$)/i.test(img.getAttribute("src") ?? "")) return;

    const report = (): void => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      // What the screen will ask of the file, not what CSS calls it.
      // What the screen asks of the file depends on how big the box ended up,
      // which is no longer a constant — #squarePortrait sizes it from the block
      // beside it. PORTRAIT_BOX is only the floor now.
      const drawnAt = Math.round(box.getBoundingClientRect().width) || PORTRAIT_BOX;
      const wanted = Math.round(drawnAt * (window.devicePixelRatio || 1));
      const short = Math.min(w, h) < wanted;
      box.classList.toggle("is-upscaled", short);
      img.title = short
        ? `${w} × ${h} — smaller than the ${wanted} pixels this box is drawn at, so it is being stretched. Click to see the file itself; the button beside it picks a larger one.`
        : `${w} × ${h}. Click to see this picture at its own size.`;
    };

    if (img.complete) report();
    else img.addEventListener("load", report, { once: true });
  }

  /** The one-off modifier box above the rolls, read at the moment of clicking. */
  #situational(): number {
    const box = this.element.querySelector<HTMLInputElement>("#dw-sheet-situational");
    return Number(box?.value) || 0;
  }

  /** Whether the next Saving Throw is against magic, and so adds Wisdom. */
  #magical(): boolean {
    return !!this.element.querySelector<HTMLInputElement>("#dw-sheet-magical")?.checked;
  }

  #band(itemId: string): RangeBand {
    const select = this.element.querySelector<HTMLSelectElement>(
      `.dw-weapon-band[data-item-id="${itemId}"]`
    );
    return (select?.value as RangeBand) || "medium";
  }

  // ─── Rolling ─────────────────────────────────────────────────────────────────

  private static async _onRollAbility(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const key = target.dataset.ability!;
    const ability = ABILITIES.find((a) => a.key === key);
    if (!ability) return;
    const bonus = bonusFor(this.#situational());
    await performRoll(
      this.actor,
      planRoll(fauxBlock(ability.label), { kind: "ability", ability: ability.key, ...bonus }),
      { icon: "fa-dice-d6" }
    );
  }

  private static async _onRollSave(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const key = target.dataset.save!;
    const save = SAVES.find((s) => s.key === key);
    if (!save) return;
    const magical = this.#magical();
    const plan = planRoll(fauxBlock(save.label), {
      kind: "save",
      save: save.key,
      ...(magical ? { magical: true } : {}),
      ...bonusFor(this.#situational()),
    });
    // The save's own target is on the sheet, and `planRoll` deliberately does
    // not go looking for it — the window knows the number, so it says it.
    const sys = getSystemFields(this.actor);
    await performRoll(
      this.actor,
      { ...plan, target: sys.saves[save.key] || undefined },
      {
        icon: "fa-shield-halved",
        ...(magical ? { note: "Against magic, so the Wisdom modifier applies." } : {}),
      }
    );
  }

  private static async _onRollSkill(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const key = target.dataset.skill ?? "";
    const extras = getExtras(this.actor);

    // The three printed ones are keyed by name; the table's own are keyed by
    // id, because two characters may both have a "Climb" and the sheet must not
    // care. One lookup answers for both.
    const printed = (extras.skills as Record<string, number | undefined>)[key];
    const own = extras.moreSkills.find((s) => s.id === key);
    if (printed === undefined && !own) return;

    const label = own ? own.name : key.charAt(0).toUpperCase() + key.slice(1);
    await performRoll(
      this.actor,
      planRoll(fauxBlock(label), {
        kind: "skill",
        target: own ? own.target : printed ?? DEFAULT_SKILL_TARGET,
        ...bonusFor(this.#situational()),
      }),
      { icon: "fa-dice-d6" }
    );
  }

  private static async _onRollBlock(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const block = getExtras(this.actor).blocks.find((b) => b.id === target.dataset.blockId);
    if (!block?.roll) return;

    // **Casting a spell spends one of its charges** (Dolmenmaster, 2026-09-02).
    // Taken before the roll, not after: a die that lands and then finds there
    // was nothing to cast has already been seen by the table.
    if (block.spell) {
      const left = castOne(block.prepared);
      if (left === null) {
        ui.notifications?.warn(
          `${block.name} is not prepared. Mark it with a spell credit first — those are handed out when spells are prepared of a morning.`
        );
        return;
      }
      await updateExtras(this.actor, (x) => {
        const b = x.blocks.find((s) => s.id === block.id);
        if (b) b.prepared = left;
        return x;
      });
    }

    await performRoll(this.actor, planRoll(block, block.roll), {
      ...(block.text ? { note: block.text } : {}),
    });
    if (block.spell) void this.render(false);
  }

  private static async _onRollAttack(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const missile = target.dataset.missile === "true";
    const weapon = equippedWeapons(this.actor).find((w) => w.itemId === itemId);
    if (!weapon) return;
    const band = missile ? this.#band(itemId) : undefined;
    const formula = attackFormula(weapon, {
      missile,
      ...(band ? { band } : {}),
      situational: this.#situational(),
    });
    await performRoll(
      this.actor,
      {
        formula,
        faces: 20,
        label: `${weapon.name} — ${missile ? "Missile" : "Melee"} Attack`,
      },
      {
        icon: "fa-crosshairs",
        ...(band && weapon.ranges
          ? { note: `${band} range — ${weapon.ranges[band]} feet.` }
          : {}),
      }
    );
  }

  private static async _onRollDamage(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const itemId = target.dataset.itemId!;
    const missile = target.dataset.missile === "true";
    const weapon = equippedWeapons(this.actor).find((w) => w.itemId === itemId);
    if (!weapon) return;
    await performRoll(
      this.actor,
      {
        formula: damageFormula(weapon, { missile, situational: this.#situational() }),
        label: `${weapon.name} — Damage`,
      },
      { icon: "fa-burst" }
    );
  }

  /**
   * A moon sign chosen, and its effect put where the character's other rules
   * live.
   *
   * **The field alone was never enough** (Dolmenmaster, 2026-09-03: *"kannst du den
   * effekt des ausgewählten moon signs direkt in traits, abilities und spells
   * einfügen?"*). A sign is a permanent rule — "+1 Attack bonus against undead
   * monsters" is read in the middle of a fight — and a line of prose in the
   * identity block is not where anybody looks then. So the sign is written into
   * its own field *and* filed as a block, in a group of its own, where it sits
   * beside the Kindred traits and Class abilities and can be given a roll, a
   * value or a number of uses like any other.
   *
   * **Choosing again replaces**, because a character has exactly one moon sign
   * and the book calls its effects permanent — a second choice is somebody
   * correcting a mis-click, not a character acquiring a second birth. Anything
   * the table wrote into the old block goes with it, which is the one thing
   * this could take away; renaming the group is how a table keeps such a block
   * out of the picker's reach.
   */
  private static async _onPickMoonSign(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const sign = MOON_SIGNS[Number(target.dataset.moonIndex)];
    if (!sign) return;
    const name = moonSignLabel(sign);

    await updateExtras(this.actor, (x) => {
      x.moonSign = moonSignLine(sign);
      x.blocks = x.blocks.filter((b) => b.group !== MOON_SIGN_GROUP);
      x.blocks.push({
        id: foundry.utils.randomID(),
        group: MOON_SIGN_GROUP,
        name,
        slug: uniqueSlug(name, x.blocks.map((b) => b.slug)),
        text: sign.effect,
      });
      return x;
    });

    // One sign is one decision, so the panel has done its job and shuts.
    this.#moonPickerOpen = false;
    void this.render(false);
  }

  /**
   * A desire or a belief taken off the Kindred's own d12.
   *
   * **It replaces what is in the box**, exactly as choosing a moon sign does,
   * and for the same reason: this is an explicit press on one of twelve named
   * things, not a text tool. The panel marks whichever one is currently
   * written, so pressing it again is how a mis-click is undone — and the box
   * stays a box, so a table that wants to write a sentence around the roll just
   * carries on typing.
   */
  private static async _onPickPersona(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const key = target.dataset.personaKey as PersonaKey | undefined;
    const value = target.dataset.personaValue ?? "";
    if (!key || !value) return;
    await updateExtras(this.actor, (x) => {
      // Guarded rather than trusted: the key came off an attribute, and writing
      // a field the persona has never had would put a ghost in the flag.
      if (key in x.persona) x.persona[key] = value;
      return x;
    });
    void this.render(false);
  }

  // ─── Blocks ──────────────────────────────────────────────────────────────────

  private static async _onAddBlock(this: CharacterSheetApp): Promise<void> {
    const taken = getExtras(this.actor).blocks.map((b) => b.slug);
    const block = await promptBlock(undefined, taken);
    if (!block) return;
    await updateExtras(this.actor, (x) => {
      x.blocks.push(block);
      return x;
    });
    void this.render(false);
  }

  private static async _onEditBlock(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.blockId;
    const extras = getExtras(this.actor);
    const existing = extras.blocks.find((b) => b.id === id);
    if (!existing) return;
    const taken = extras.blocks.filter((b) => b.id !== id).map((b) => b.slug);
    const block = await promptBlock(existing, taken);
    if (!block) return;
    await updateExtras(this.actor, (x) => {
      const i = x.blocks.findIndex((b) => b.id === id);
      if (i >= 0) x.blocks[i] = block;
      return x;
    });
    void this.render(false);
  }

  private static async _onDeleteBlock(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.blockId;
    const block = getExtras(this.actor).blocks.find((b) => b.id === id);
    if (!block) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Delete block" },
      content: `<p>Delete <strong>${block.name}</strong>? Anything referring to
        <code>@b.${block.slug}</code> will read it as nought.</p>`,
    });
    if (!ok) return;
    await updateExtras(this.actor, (x) => {
      x.blocks = x.blocks.filter((b) => b.id !== id);
      return x;
    });
    void this.render(false);
  }

  /**
   * One more skill target than the paper has room for.
   *
   * The printed sheet prints three and a Class hands out more, so the list has
   * to grow. Asked for by name rather than picked from a list, because the
   * module ships no Class data and never will.
   */
  private static async _onAddSkill(this: CharacterSheetApp): Promise<void> {
    const name = await promptText("New skill target", "What is it called?", "Climb");
    if (!name) return;
    await updateExtras(this.actor, (x) => {
      const taken = [
        ...Object.keys(x.skills),
        ...x.moreSkills.map((s) => s.slug),
      ];
      x.moreSkills.push({
        id: foundry.utils.randomID(),
        name,
        slug: uniqueSlug(name, taken),
        target: DEFAULT_SKILL_TARGET,
      });
      return x;
    });
    void this.render(false);
  }

  private static async _onDeleteSkill(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.skillId;
    await updateExtras(this.actor, (x) => {
      x.moreSkills = x.moreSkills.filter((s) => s.id !== id);
      return x;
    });
    void this.render(false);
  }

  private static async _onSpendUse(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    await this.#changeUses(target.dataset.blockId, -1);
  }

  private static async _onRestoreUses(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    await this.#changeUses(target.dataset.blockId, undefined);
  }

  /** `delta` of nothing means "back to full", which is what a night's rest does. */
  async #changeUses(id: string | undefined, delta: number | undefined): Promise<void> {
    await updateExtras(this.actor, (x) => {
      const block = x.blocks.find((b) => b.id === id);
      if (block?.uses) {
        block.uses.value =
          delta === undefined
            ? block.uses.max
            : Math.max(0, Math.min(block.uses.max, block.uses.value + delta));
      }
      return x;
    });
    void this.render(false);
  }

  /**
   * Spend a credit on one charge of this spell, or hand one back.
   *
   * **Marking is not a one-way door.** A player who put their last credit on
   * the wrong spell can take it off again and move it, right up until they cast
   * — which is the whole difference between unmarking and casting: one returns
   * the credit, the other does not.
   */
  private static async _onTogglePrepared(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!this.actor.isOwner) return;
    const id = target.dataset.blockId;
    const back = target.dataset.unmark === "true";
    let refused = "";

    await updateExtras(this.actor, (x) => {
      const block = x.blocks.find((b) => b.id === id);
      if (!block) return x;
      const move = back
        ? unmarkOne(block.prepared, x.spellCredits)
        : markOne(block.prepared, x.spellCredits);
      if (!move) {
        refused = back
          ? `${block.name} has no charge to take back.`
          : "No spell credits left. They are handed out when spells are prepared of a morning.";
        return x;
      }
      block.prepared = move.prepared;
      x.spellCredits = move.credits;
      return x;
    });

    if (refused) ui.notifications?.warn(refused);
    void this.render(false);
  }

  /** Hand the XP modifier back to the Class, and write the Class's own figure. */
  private static async _onResetXpMod(this: CharacterSheetApp): Promise<void> {
    if (!this.actor.isOwner) return;
    const derived = derivedXpModifier(this.actor);
    if (derived === null) return;
    await updateExtras(this.actor, (x) => {
      x.xpBonusManual = false;
      return x;
    });
    // Written as well as un-flagged, so anything reading the actor rather than
    // this sheet — a macro, another module — sees the same number the sheet does.
    await setSystemField(this.actor, "xpBonus", derived);
    void this.render(false);
  }

  /**
   * Take a Level by one of the four house-rule routes.
   *
   * **Confirmed, and the confirmation is a bill rather than a question.** A
   * level-up moves ten figures, spends coins and sometimes experience, and none
   * of it comes back — so the dialog spells out every one of them before
   * anything is written, and the chat card repeats it afterwards for the table.
   *
   * The Hit Points are deliberately *not* previewed: they are rolled, and a
   * dialog that showed them would have had to roll them first, leaving a
   * character who cancelled with a die already thrown.
   */
  private static async _onLevelUp(
    this: CharacterSheetApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    if (!this.actor.isOwner) return;

    const sys = getSystemFields(this.actor);
    const key = classFromText(sys.class ?? "");
    if (!key) return;

    const routeId = target.dataset.route ?? "";
    const offer = routesFor(key, sys.level, sys.xp.value).find((r) => r.id === routeId);
    if (!offer || !offer.available) return;

    const change = levelChange(key, sys.level, offer.toLevel);
    if (!change) return;

    const bill: string[] = [];
    if (offer.costGp > 0)
      bill.push(
        `<li><strong>${offer.costGp} ${t("DOLMENWOOD.Currency.GP")}</strong> — ${offer.costNote}</li>`
      );
    if (offer.costXp > 0)
      bill.push(
        `<li><strong>${offer.costXp.toLocaleString()} XP</strong> — ${sys.xp.value.toLocaleString()} becomes ${(
          sys.xp.value - offer.costXp
        ).toLocaleString()}</li>`
      );
    if (bill.length === 0) bill.push("<li>Nothing to pay</li>");

    const confirmed = await Dialog.confirm({
      title: `Level ${sys.level} → ${offer.toLevel}`,
      content:
        `<p><strong>${escapeHTML(this.actor.name ?? "")}</strong> — ${escapeHTML(offer.label)}, ${escapeHTML(offer.duration)}.</p>` +
        `<p class="qm-hint">Paid:</p><ul>${bill.join("")}</ul>` +
        "<p class=\"qm-hint\">Written to the sheet: Level, XP, the next threshold, Attack " +
        `${signed(change.attack.from)} → ${signed(change.attack.to)}, the five Save Targets, and ` +
        "Hit Points rolled for each Level gained. Skill Targets, spells and Class traits are left alone.</p>",
    });
    if (!confirmed) return;

    const result = await applyLevelUp(this.actor, key, offer);
    if (!result.ok) {
      ui.notifications?.warn(result.reason ?? "The Level could not be taken.");
      return;
    }
    ui.notifications?.info(
      `${this.actor.name} is now Level ${offer.toLevel}. The chat card lists every figure that moved.`
    );
    void this.render(false);
  }

  private static async _onOpenInventory(this: CharacterSheetApp): Promise<void> {
    new PlayerInventoryApp(this.actor).render(true);
  }

  // ─── The portrait ────────────────────────────────────────────────────────────

  /**
   * The picture at its own size, in Foundry's own viewer.
   *
   * The box on the sheet is 200 pixels and a good portrait is rather more than
   * that; this is where the rest of it can be looked at. Passing the actor's
   * `uuid` is what lets a Referee share the image with the table from the
   * viewer's own header.
   */
  private static async _onShowPortrait(this: CharacterSheetApp): Promise<void> {
    const src = this.actor.img;
    if (!src) return;
    await new foundry.applications.apps.ImagePopout({
      src,
      window: { title: this.actor.name ?? "Portrait" },
      uuid: this.actor.uuid,
    }).render(true);
  }

  /**
   * Choose a different picture without leaving the sheet.
   *
   * It writes `actor.img`, which is the portrait Foundry itself uses — one home
   * per value, the same rule the rest of this window follows. The token art is
   * a separate field and is deliberately left alone: a 64-pixel token and a
   * 512-pixel portrait are both right for their own jobs.
   */
  private static async _onPickPortrait(this: CharacterSheetApp): Promise<void> {
    if (!this.actor.isOwner) return;
    const Picker = foundry.applications.apps.FilePicker.implementation;
    await new Picker({
      type: "image",
      current: this.actor.img ?? "",
      callback: async (path: string) => {
        await this.actor.update({ img: path });
        void this.render(false);
      },
    }).render(true);
  }
}

/**
 * The side of the portrait box, in CSS pixels, as the stylesheet draws it.
 *
 * Here as well as in the stylesheet because the window has to be able to say
 * *why* a picture looks soft, and that answer is a comparison against this
 * number. The two are checked against each other by `render-sheet.js`.
 */
const PORTRAIT_BOX = 200;

// ─── Small shared pieces ───────────────────────────────────────────────────────

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * One line of text, asked for.
 *
 * Small enough to live here rather than earn a file: the only thing on this
 * sheet that needs it is naming a new skill target, and a whole dialog module
 * for one box would be more machinery than question.
 */
async function promptText(title: string, label: string, placeholder = ""): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    let settled = false;
    const done = (v: string | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    new Dialog({
      title,
      content: `<form class="dw-camp-form">
          <div class="form-group">
            <label for="dw-text-value">${label}</label>
            <input type="text" id="dw-text-value" placeholder="${placeholder}" autofocus>
          </div>
        </form>`,
      buttons: {
        ok: {
          label: "Add",
          icon: '<i class="fas fa-check"></i>',
          callback: (html: JQuery) => done(String(html.find("#dw-text-value").val() ?? "").trim() || null),
        },
        cancel: { label: "Cancel", callback: () => done(null) },
      },
      default: "ok",
      close: () => done(null),
    }).render(true);
  });
}

/**
 * The level-up block, or nothing at all.
 *
 * **Nothing at all is the honest answer without a Class.** The four routes are
 * measured against the Class's own XP thresholds, and there is no sensible
 * default for a character whose sheet does not say what they are — so the block
 * is replaced by a line saying exactly that, and how to fix it.
 */
function advanceView(actor: Actor): Record<string, unknown> | null {
  const sys = getSystemFields(actor);
  const key = classFromText(sys.class ?? "");
  if (!key) return null;

  const cls = CLASSES.find((c) => c.key === key)!;
  const cap = xpCapFor(key, sys.level);
  const next = thresholdFor(key, sys.level + 1);

  return {
    classLabel: cls.label,
    // **Both figures come out of the book, not out of a box.** Dolmenmaster's ask,
    // 2026-09-02 — the next threshold and the cap are printed facts about a
    // Class and a Level, so a sheet that asks somebody to type them is asking
    // them to make a mistake. The stored `xp.next` is still written when a
    // Level is taken, so anything reading the actor rather than this sheet
    // agrees with it.
    nextXp: next,
    capXp: cap,
    hasNext: next !== undefined,
    hasCap: cap !== undefined,
    toCap: cap !== undefined ? Math.max(0, cap - sys.xp.value) : 0,
    capLine: capLine(key, sys.level, sys.xp.value),
    atCap: cap !== undefined && sys.xp.value >= cap,
    routes: routesFor(key, sys.level, sys.xp.value),
  };
}

/**
 * What the Class says this character's XP modifier is, or null.
 *
 * Null covers both "no Class the module knows" and "the scores are not filled
 * in yet" — in either case there is nothing to derive and the box stands on its
 * own.
 */
function derivedXpModifier(actor: Actor): number | null {
  const mod = readModifier(actor);
  if (!mod.prime) return null;
  if (mod.prime.scores.some((s) => s.score <= 0)) return null;
  return xpModifierForScore(mod.prime.lowest);
}

/**
 * What the day is already costing this character, in words.
 *
 * Nothing at all when they are fed and rested, which is the common case and
 * deserves no line of its own.
 */
function penaltyLine(actor: Actor): string {
  const p = characterPenalties(actor);
  if (!p.attack && !p.damage) return "";
  const why = [
    p.hunger ? `hunger ${p.hunger}` : "",
    p.exhaustion ? `exhaustion ${p.exhaustion}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `${signed(p.attack)} to Attack Rolls and ${signed(p.damage)} to Damage — ${why}. Already in every formula below.`;
}

/**
 * A block that is not one.
 *
 * The scores, saves and skills printed on the sheet roll by exactly the same
 * rules as a block does, so they go through `planRoll` too rather than growing
 * a second, nearly-identical set of formulas here. All it wants is a name to
 * put on the card.
 */
function fauxBlock(name: string): CharacterBlock {
  return { id: "", group: "", name, slug: "", text: "" };
}

/** The one-off modifier, as a bonus term — nothing at all when it is zero. */
function bonusFor(situational: number): { bonus?: string } {
  return situational ? { bonus: signed(situational) } : {};
}

/**
 * Blocks under their headings, in the order they were written.
 *
 * Deliberately not sorted: the table wrote them in an order, and a spell list
 * that reshuffles itself alphabetically is harder to read down than one that
 * stays where it was put. Blocks with no heading gather at the end under one.
 */
type BlockView = CharacterBlock & {
  rollable: boolean;
  isArcane: boolean;
  /** How many charges are ready, and the word for it. Empty when none. */
  charges: number;
  chargeLabel: string;
  /** May another credit be spent on this one? */
  canMark: boolean;
};

function groupBlocks(
  blocks: CharacterBlock[],
  credits = 0
): { label: string; blocks: BlockView[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, BlockView[]>();
  for (const b of blocks) {
    const key = b.group.trim() || "Other";
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push({
      ...b,
      rollable: !!b.roll,
      isArcane: b.spell === "arcane",
      charges: b.spell ? (b.prepared ?? 0) : 0,
      chargeLabel: b.spell ? chargeLabel(b.prepared) : "",
      canMark: !!b.spell && credits > 0,
    });
  }
  return order.map((label) => ({ label, blocks: byGroup.get(label)! }));
}
