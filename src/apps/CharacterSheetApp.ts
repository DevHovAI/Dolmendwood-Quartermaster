import { TEMPLATES } from "../constants";
import {
  ABILITIES,
  DEFAULT_SKILL_TARGET,
  SAVES,
  getExtras,
  getSystemFields,
  hasSystemFields,
  setSystemField,
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
      spendUse: CharacterSheetApp._onSpendUse,
      restoreUses: CharacterSheetApp._onRestoreUses,
      togglePrepared: CharacterSheetApp._onTogglePrepared,
      openInventory: CharacterSheetApp._onOpenInventory,
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

    const abilities = ABILITIES.map((a) => ({
      ...a,
      value: sys.scores[a.key].value,
      bonus: sys.scores[a.key].bonus,
      // "+2" reads as a modifier; "2" reads as a second score.
      signed: signed(sys.scores[a.key].bonus),
    }));

    const skills = [
      { key: "listen", label: "Listen", target: extras.skills.listen },
      { key: "search", label: "Search", target: extras.skills.search },
      { key: "survival", label: "Survival", target: extras.skills.survival },
    ];

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
      speed: sys.speed,
      exploring: extras.exploring,
      // The printed sheet has an Overland box reading "Travel Points / day", and
      // it is the same division the day bar makes: Speed / 5.
      travelPoints: sys.speed ? Math.floor(sys.speed / 5) : 0,
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
    };
  }

  // ─── Typing in the boxes ─────────────────────────────────────────────────────

  override async _onRender(): Promise<void> {
    const el = this.element;
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
        void this.render(false);
      });
    });

    el.querySelectorAll<HTMLInputElement>("[data-extra]").forEach((input) => {
      input.addEventListener("change", async () => {
        const field = input.dataset.extra!;
        const value = input.type === "number" ? Number(input.value) || 0 : input.value;
        await updateExtras(this.actor, (x) => {
          if (field.startsWith("skill-")) {
            const key = field.slice(6) as "listen" | "search" | "survival";
            x.skills[key] = Number(value) || DEFAULT_SKILL_TARGET;
          } else {
            (x as unknown as Record<string, unknown>)[field] = value;
          }
          return x;
        });
        void this.render(false);
      });
    });
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
    const key = target.dataset.skill as "listen" | "search" | "survival";
    const extras = getExtras(this.actor);
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    await performRoll(
      this.actor,
      planRoll(fauxBlock(label), {
        kind: "skill",
        target: extras.skills[key] ?? DEFAULT_SKILL_TARGET,
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
}

// ─── Small shared pieces ───────────────────────────────────────────────────────

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
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
): { label: string; blocks: (CharacterBlock & { rollable: boolean })[] }[] {
  const order: string[] = [];
  const byGroup = new Map<string, (CharacterBlock & { rollable: boolean })[]>();
  for (const b of blocks) {
    const key = b.group.trim() || "Other";
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      order.push(key);
    }
    byGroup.get(key)!.push({ ...b, rollable: !!b.roll });
  }
  return order.map((label) => ({ label, blocks: byGroup.get(label)! }));
}
