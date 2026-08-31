import { TEMPLATES } from "../constants";
import {
  ABILITIES,
  DEFAULT_SKILL_TARGET,
  PERSONA_FIELDS,
  SAVES,
  abilityModifier,
  getExtras,
  getSystemFields,
  hasSystemFields,
  setSystemField,
  uniqueSlug,
  updateExtras,
  type CharacterBlock,
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
import { promptBlock } from "./BlockDialog";
import { PlayerInventoryApp } from "./PlayerInventoryApp";

/**
 * The attribute sheet: page one of the printed Dolmenwood sheet, and nothing of
 * page two.
 *
 * **Scope is Leander's and it is narrower than "a character sheet"** — *"Im
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
      editBlock: CharacterSheetApp._onEditBlock,
      deleteBlock: CharacterSheetApp._onDeleteBlock,
      addSkill: CharacterSheetApp._onAddSkill,
      deleteSkill: CharacterSheetApp._onDeleteSkill,
      spendUse: CharacterSheetApp._onSpendUse,
      restoreUses: CharacterSheetApp._onRestoreUses,
      togglePrepared: CharacterSheetApp._onTogglePrepared,
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

    // **Two columns of three** (Leander, 2026-08-28): the book's three on the
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
      // **Movement is not on this sheet**, Leander's call, 2026-08-27. The
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

      weapons,
      hasWeapons: weapons.length > 0,
      // **Shown, never ticked.** Hunger and exhaustion reach an Attack Roll by
      // themselves and exhaustion alone reaches damage; there is deliberately no
      // box to apply them, because a box that can be set wrongly eventually is.
      // This line only says what the formulas are already doing.
      penalties: penaltyLine(actor),

      groups: groupBlocks(extras.blocks),
      hasBlocks: extras.blocks.length > 0,

      // Free text, every one of it, and never read by a formula. Folded away by
      // default: it is written once and read at the table, not during a round.
      persona: PERSONA_FIELDS.map((f) => ({ ...f, value: extras.persona[f.key] ?? "" })),
      hasPersona: PERSONA_FIELDS.some((f) => !!extras.persona[f.key]),
    };
  }

  // ─── Typing in the boxes ─────────────────────────────────────────────────────

  override async _onRender(): Promise<void> {
    const el = this.element;
    this.#squarePortrait();
    this.#measurePortrait();
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
        // Leander's ask, and it saves looking the table up six times per
        // character. The modifier stays editable afterwards, because a ring or
        // a curse moves it without moving the score; the sheet only offers the
        // book's answer, it does not insist on it.
        if (field.startsWith("score-")) {
          const key = field.slice(6);
          await setSystemField(this.actor, `mod-${key}`, abilityModifier(Number(value) || 0));
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
   * What the portrait file actually is, said out loud.
   *
   * *"Die Portraits in den Attributes sind noch relativ niedrigauflösend"*
   * (Leander, 2026-08-28) has two possible causes, and the window is the only
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
    await performRoll(this.actor, planRoll(block, block.roll), {
      ...(block.text ? { note: block.text } : {}),
    });
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

  private static async _onTogglePrepared(
    this: CharacterSheetApp,
    _e: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.blockId;
    await updateExtras(this.actor, (x) => {
      const block = x.blocks.find((b) => b.id === id);
      if (block) block.prepared = !block.prepared;
      return x;
    });
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
function groupBlocks(
  blocks: CharacterBlock[]
): { label: string; blocks: (CharacterBlock & { rollable: boolean; isArcane: boolean })[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, (CharacterBlock & { rollable: boolean; isArcane: boolean })[]>();
  for (const b of blocks) {
    const key = b.group.trim() || "Other";
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push({ ...b, rollable: !!b.roll, isArcane: b.spell === "arcane" });
  }
  return order.map((label) => ({ label, blocks: byGroup.get(label)! }));
}
