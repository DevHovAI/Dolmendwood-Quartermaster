import { TEMPLATES } from "../constants";
import { getPartyActors } from "../data/sharedStore";
import { getSystemFields, hasSystemFields, setSystemField } from "../data/characterSheet";
import { announce } from "../data/rollCard";
import { awardFor, classFromText, readModifier, splitEvenly } from "../data/xpAward";
import type { AwardLine, ModifierSource } from "../data/xpAward";
import { applyCap, thresholdFor, xpCapFor } from "../data/levelUp";
import { escapeHTML } from "../helpers/handlebars";
import { t, tn } from "../helpers/i18n";

/**
 * The XP window: what the party earned, and what each character actually gets.
 *
 * **Dolmenmaster's ask, 2026-09-02:** *"ich hätte gerne ein fenster, in dem ich die
 * neu hinzugekommenen XP eintragen kann, sodass sie direkt mit dem korrekten
 * Modifier pro Spieler gutgeschrieben werden."* The arithmetic is a book rule
 * with two steps most tables get wrong at the table — divide evenly, then apply
 * each character's own Prime Ability modifier — and both are easy to do right
 * once and wrong every session after.
 *
 * **The rules live in `xpAward.ts`, not here.** This file collects figures and
 * shows what that one says, which is why the arithmetic can be checked by a
 * script against the Player's Book without Foundry running.
 *
 * **Two ways in, his call (2026-09-02): a total that is divided, or a figure
 * per character.** They are the same machine — every row has a *base*, and the
 * only difference is whether the base is worked out or typed. Everything after
 * the base (the retainer's half, the modifier, the new total) is identical, so
 * the switch costs one field and no second code path.
 *
 * **The Referee's window, and only theirs.** XP is awarded, not claimed.
 */

interface XpRow {
  actorId: string;
  name: string;
  included: boolean;

  /** What the Class field says, and what this module made of it. */
  className: string;
  classLabel: string;
  primeLabel: string;
  primeTitle: string;
  source: ModifierSource;
  /** Only a row whose modifier is not derived may have one typed. */
  percentEditable: boolean;

  sharePct: number;
  isHalfShare: boolean;

  base: number;
  overridden: boolean;

  percent: number;
  percentText: string;

  award: AwardLine;
  /** XP that did not land because the house cap stopped it. */
  capLost: number;
  /** The ceiling itself, for the row's tooltip. 0 where the Class is unknown. */
  capAt: number;
  current: number;
  next: number;
  level: number;
}

const ABILITY_SHORT: Record<string, string> = {
  str: "STR",
  int: "INT",
  wis: "WIS",
  dex: "DEX",
  con: "CON",
  cha: "CHA",
};

export class XpAwardApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static override DEFAULT_OPTIONS: DeepPartial<ApplicationV2Options> = {
    id: "dolmenwood-xp",
    // ApplicationV2 runs the window title through game.i18n itself, so this is
    // a key rather than a t() call — the frame is drawn before _prepareContext.
    window: { title: "DOLMENWOOD.Xp.Title", resizable: true },
    // **Wide enough that the seven lanes do not have to shrink to fit.** The
    // entry boxes and the two figure lanes come to about 520px between them, and
    // a name column squeezed into what is left is how the first two attempts at
    // this window ended up cramped. Resizable, so a narrower table is still the
    // Referee's choice rather than the default.
    position: { width: 880, height: 560 },
    classes: ["dolmenwood-party-inventory", "xp-window"],
    actions: {
      setMode: XpAwardApp._onSetMode,
      resetRow: XpAwardApp._onResetRow,
      award: XpAwardApp._onAward,
      clearAll: XpAwardApp._onClearAll,
    },
  };

  static override PARTS = {
    content: { template: TEMPLATES.XP_AWARD },
  };

  /** Divide one total, or type a figure per character. */
  private mode: "split" | "each" = "split";

  /** The party's takings for the session, in the divide-a-total mode. */
  private total = 0;

  /** Who is left out — somebody who missed the session, or did not survive it. */
  private excluded = new Set<string>();

  /**
   * Hand-set figures, kept apart per mode on purpose: a base typed while
   * dividing a total is an exception to that division, and a base typed in the
   * other mode is the whole entry. Sharing one map would make switching modes
   * carry numbers that meant something else.
   */
  private overrides = new Map<string, number>();
  private amounts = new Map<string, number>();

  /** Post the result to chat when awarding. Remembered while the window is open. */
  private toChat = true;

  private rows(): XpRow[] {
    const actors = getPartyActors().filter((a) => hasSystemFields(a));
    const included = actors.filter((a) => !this.excluded.has(a.id ?? ""));
    const { each } = splitEvenly(this.total, included.length);

    return actors.map((actor) => {
      const id = actor.id ?? "";
      const sys = getSystemFields(actor);
      const mod = readModifier(actor);
      const isIn = !this.excluded.has(id);

      const overridden = this.mode === "split" && this.overrides.has(id);
      const base =
        this.mode === "split"
          ? overridden
            ? this.overrides.get(id)!
            : isIn
              ? each
              : 0
          : (this.amounts.get(id) ?? 0);

      const percent = mod.percent;

      // **The book's threshold where there is one**, and the typed field only
      // where there is not. A Class and a Level are all it takes to look the
      // figure up, and a sheet nobody has filled in should not make the row say
      // a character is nowhere near levelling when they are.
      const capKey = mod.prime?.classKey ?? classFromText(sys.class ?? "");
      const next = (capKey ? thresholdFor(capKey, sys.level + 1) : undefined) ?? sys.xp.next;

      const line = awardFor(isIn ? base : 0, sys.xp.share, percent, sys.xp.value, next);

      // **The house cap, applied where the XP is handed out.** A character may
      // bank up to the threshold two Levels above them and no further
      // (`docs/Hausregeln.pdf`), so an award that would carry them past it is
      // trimmed — and the row says how much did not land, because silently
      // eating somebody's evening is the one thing this window must not do.
      const cap = capKey ? xpCapFor(capKey, sys.level) : undefined;
      const capped = applyCap(line.newTotal, cap);
      line.award -= capped.lost;
      line.newTotal = capped.total;

      const primeLabel = mod.prime
        ? mod.prime.scores.map((s) => `${ABILITY_SHORT[s.key]} ${s.score}`).join(" / ")
        : "";

      return {
        actorId: id,
        name: actor.name ?? t("DOLMENWOOD.Xp.Unnamed"),
        included: isIn,
        className: sys.class,
        classLabel: mod.prime?.classLabel ?? "",
        primeLabel,
        primeTitle: mod.prime
          ? mod.source === "class"
            ? t("DOLMENWOOD.Xp.Prime.FromClass", {
                class: mod.prime.classLabel,
                abilities: mod.prime.scores
                  .map((s) => ABILITY_SHORT[s.key])
                  .join(` ${t("DOLMENWOOD.Xp.Prime.And")} `),
                lowest: mod.prime.lowest,
              })
            : t("DOLMENWOOD.Xp.Prime.ByHand", { class: mod.prime.classLabel })
          : sys.class
            ? t("DOLMENWOOD.Xp.Prime.UnknownClass", { class: sys.class })
            : t("DOLMENWOOD.Xp.Prime.NoClass"),
        source: mod.source,
        percentEditable: mod.source !== "class",
        sharePct: sys.xp.share,
        isHalfShare: sys.xp.share !== 100,
        base,
        overridden,
        percent,
        percentText: `${percent > 0 ? "+" : ""}${percent}%`,
        award: line,
        capLost: capped.lost,
        capAt: cap ?? 0,
        current: sys.xp.value,
        next,
        level: sys.level,
      };
    });
  }

  override async _prepareContext(): Promise<Record<string, unknown>> {
    const rows = this.rows();
    const included = rows.filter((r) => r.included);

    // **What is left of the pot, not what the division could not place.** The
    // two are the same until a row is hand-set, and then only this one is still
    // true: raise one character's share and the party is being handed more than
    // it earned, which is worth saying out loud rather than hiding behind a
    // remainder that still describes an untouched division.
    const handedOut = included.reduce((n, r) => n + r.base, 0);
    const left = this.mode === "split" ? this.total - handedOut : 0;

    const awarded = included.reduce((n, r) => n + r.award.award, 0);
    const levelUps = included.filter((r) => r.award.levelUp);

    // **What the share rule takes off the table, which is not the same as what
    // is left over.** The division hands a retainer a full share and the share
    // percentage then keeps half of it (Player's Book p25) — the other half is
    // not waiting to be handed to somebody, it is gone. The remainder is
    // reckoned from each row's base and so cannot see it: 500 XP with one
    // retainer read `0 left over` while the footer awarded 450, and the missing
    // 50 had no name anywhere in the window (Dolmenmaster, 2026-09-04).
    //
    // Only the share step counts here. The Prime Ability modifier moves a
    // character's earnings up as well as down and is already spelled out in
    // their own row, and the house cap is reported per row where it bites.
    const forfeited = included.reduce(
      (n, r) => n + Math.max(0, r.award.base - r.award.shared),
      0
    );

    return {
      isSplit: this.mode === "split",
      total: this.total,
      rows,
      hasRows: rows.length > 0,
      countIn: included.length,
      remainder: left > 0 ? left : 0,
      overspent: left < 0 ? -left : 0,
      forfeited,
      awarded,
      // Nothing to book is a state worth naming, so the button can say why it
      // is doing nothing rather than appearing broken.
      canAward: included.some((r) => r.award.award !== 0),
      levelUpNames: levelUps.map((r) => r.name),
      levelUps: levelUps.length,
      toChat: this.toChat,
    };
  }

  /**
   * Which box to hand the cursor back to after a re-render.
   *
   * Every entry re-renders the whole window — that is what keeps each row's
   * arithmetic honest — and a re-render replaces the DOM, so tabbing from one
   * character's share to the next would otherwise drop the cursor on the floor
   * halfway down the party.
   *
   * **It records where focus went, not where it was.** A `change` on an input
   * fires *before* the blur, so at that moment the browser has not yet moved on
   * and there is nothing to read; the render is therefore deferred by a tick,
   * by which time `document.activeElement` is the box the Tab was heading for.
   * Restoring the box that was just left would fight the Tab instead of
   * following it.
   */
  private focused: { field: string; actorId: string } | null = null;

  /**
   * Take up a change made somewhere else — a Class typed on the attribute
   * sheet, an XP total corrected, an XP Share set to 50.
   *
   * **The rows are read from the actors on every render**, so this window shows
   * stale figures until something asks it to look again. Nothing did: the
   * `updateActor` hook re-renders the inventories, the loot, the day bar and
   * the attribute sheet, and every one of those sits behind an early return
   * that only lets *flag* writes through. A share lives in the game system's
   * data, so it never reached even that far (Dolmenmaster, 2026-09-04: *"wenn ich 50
   * eintrage passiert nix"*).
   *
   * **A window being worked in is left alone.** The Referee sits in here typing
   * figures while play carries on around them, and every item a player picks up
   * is an actor update. Re-rendering mid-edit would rebuild the rows from
   * stored state and throw away the half-typed number — and
   * `reRenderKeepingFocus` would then *select* what was left of it, so the next
   * keystroke eats the rest. It catches up as soon as focus leaves.
   */
  static refresh(): void {
    const app = foundry.applications?.instances?.get("dolmenwood-xp") as XpAwardApp | undefined;
    if (!app?.element) return;
    if (app.element.contains(document.activeElement)) return;
    void app.render(false);
  }

  private reRenderKeepingFocus(): void {
    window.setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      const field = active?.dataset?.xpField;
      this.focused = field ? { field, actorId: active?.dataset?.actorId ?? "" } : null;
      this.render(false);
    }, 0);
  }

  override async _onRender(): Promise<void> {
    const el = this.element;

    if (this.focused) {
      const back = el.querySelector<HTMLInputElement>(
        `[data-xp-field="${this.focused.field}"][data-actor-id="${this.focused.actorId}"]`
      );
      // Refocused with its content selected: the next thing typed into a figure
      // box is a replacement, not an addition to what is already there.
      if (back) {
        back.focus();
        back.select?.();
      }
      this.focused = null;
    }

    el.querySelectorAll<HTMLInputElement>("[data-xp-field]").forEach((input) => {
      const handler = async (): Promise<void> => {
        const field = input.dataset.xpField!;
        const id = input.dataset.actorId ?? "";

        if (field === "total") {
          this.total = Math.max(0, Math.round(Number(input.value) || 0));
        } else if (field === "base") {
          const value = Math.round(Number(input.value) || 0);
          if (this.mode === "split") this.overrides.set(id, value);
          else this.amounts.set(id, value);
        } else if (field === "percent") {
          // Typing a percentage writes it where the attribute sheet reads it,
          // so it is set once rather than every session. Only rows without a
          // recognised Class offer the field at all — where a Class is known,
          // the character's own scores decide and a second number would just be
          // one that could disagree.
          const actor = (game as Game).actors?.get(id) as Actor | undefined;
          if (actor) await setSystemField(actor, "xpBonus", Math.round(Number(input.value) || 0));
        } else if (field === "include") {
          if (input.checked) this.excluded.delete(id);
          else this.excluded.add(id);
        } else if (field === "toChat") {
          this.toChat = input.checked;
        }
        this.reRenderKeepingFocus();
      };

      input.addEventListener("change", () => void handler());
    });
  }

  private static async _onSetMode(
    this: XpAwardApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    this.mode = target.dataset.mode === "each" ? "each" : "split";
    this.render(false);
  }

  /** Put one row back on the division. */
  private static async _onResetRow(
    this: XpAwardApp,
    _event: Event,
    target: HTMLElement
  ): Promise<void> {
    const id = target.dataset.actorId ?? "";
    this.overrides.delete(id);
    this.amounts.delete(id);
    this.render(false);
  }

  private static async _onClearAll(this: XpAwardApp): Promise<void> {
    this.total = 0;
    this.overrides.clear();
    this.amounts.clear();
    this.excluded.clear();
    this.render(false);
  }

  /**
   * Write it down.
   *
   * **Confirmed, because XP does not come back.** Everything else in this
   * window is a figure on a screen; this is the one press that changes six
   * characters at once, and the module's own rule is that prevention beats
   * undo.
   */
  private static async _onAward(this: XpAwardApp): Promise<void> {
    if (!(game as Game).user?.isGM) return;

    const rows = this.rows().filter((r) => r.included && r.award.award !== 0);
    if (rows.length === 0) return;

    const totalAwarded = rows.reduce((n, r) => n + r.award.award, 0);
    const confirmed = await Dialog.confirm({
      title: t("DOLMENWOOD.Xp.Award"),
      content:
        tn("DOLMENWOOD.Xp.Confirm.Body", rows.length, {
          xp: totalAwarded.toLocaleString(),
        }) + `<p class="qm-hint">${t("DOLMENWOOD.Xp.Confirm.NoUndo")}</p>`,
    });
    if (!confirmed) return;

    for (const row of rows) {
      const actor = (game as Game).actors?.get(row.actorId) as Actor | undefined;
      if (!actor) continue;
      await setSystemField(actor, "xp", row.award.newTotal);
    }

    if (this.toChat) await announce(card(rows));

    const levelUps = rows.filter((r) => r.award.levelUp);
    ui.notifications?.info(
      tn("DOLMENWOOD.Xp.Notify.Awarded", rows.length, {
        xp: totalAwarded.toLocaleString(),
      }) +
        (levelUps.length
          ? ` ${t("DOLMENWOOD.Xp.Notify.LevelUp", {
              names: levelUps.map((r) => r.name).join(", "),
            })}`
          : "")
    );

    // Cleared on the way out, so the next press of the button cannot book the
    // same session twice.
    this.total = 0;
    this.overrides.clear();
    this.amounts.clear();
    this.render(false);
  }
}

/**
 * The card the table sees.
 *
 * **Public, not whispered.** The module whispers what the party is not meant to
 * know — getting lost, the wandering-monster checks, what a hex hides. XP is
 * the opposite: it is the reward being announced, and every player wants to see
 * their own line and the arithmetic behind it.
 */
function card(rows: XpRow[]): string {
  const lines = rows
    .map((r) => {
      const parts: string[] = [];
      // The share is printed as the percentage it actually is. It was "half
      // share of …" at any share other than 100, so 75% read as half (Dolmenmaster,
      // 2026-09-04: *"muss ja nicht die hälfte sein"*).
      if (r.isHalfShare)
        parts.push(t("DOLMENWOOD.Xp.Card.Share", { pct: r.sharePct, base: r.award.base }));
      if (r.percent !== 0) parts.push(t("DOLMENWOOD.Xp.Card.Prime", { pct: r.percentText }));
      const detail = parts.length ? ` <span class="xp-card-detail">(${parts.join(", ")})</span>` : "";
      const up = r.award.levelUp
        ? ` <span class="xp-card-up">${t("DOLMENWOOD.Xp.Card.NextLevel")}</span>`
        : "";
      return `<li><strong>${escapeHTML(r.name)}</strong> +${r.award.award.toLocaleString()} XP${detail} → ${r.award.newTotal.toLocaleString()}${up}</li>`;
    })
    .join("");

  const total = rows.reduce((n, r) => n + r.award.award, 0);
  return `<div class="dw-day-roll">
      <h3><i class="fas fa-star"></i> ${t("DOLMENWOOD.Xp.Title")}</h3>
      <p class="dw-day-roll-sub">${tn("DOLMENWOOD.Xp.Card.Sub", rows.length, {
        xp: total.toLocaleString(),
      })}</p>
      <ul class="dw-camp-rows">${lines}</ul>
    </div>`;
}

export function openXpAward(): void {
  const existing = foundry.applications?.instances?.get("dolmenwood-xp") as
    | { render: (force?: boolean) => void }
    | undefined;
  if (existing) existing.render(true);
  else new XpAwardApp().render(true);
}
