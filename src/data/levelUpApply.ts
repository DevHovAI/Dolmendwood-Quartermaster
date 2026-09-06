import { ADVANCEMENT } from "./advancement";
import { FlagManager, deductCoins } from "./FlagManager";
import { SAVES, abilityModifier, getSystemFields, setSystemFields } from "./characterSheet";
import { hpDieFor, hpGainFor, levelChange, thresholdFor } from "./levelUp";
import type { HpGain, RouteOffer } from "./levelUp";
import type { ClassKey } from "./xpAward";
import { announce, rollDice, total } from "./rollCard";
import { t } from "../helpers/i18n";
import { escapeHTML } from "../helpers/handlebars";

/**
 * Taking a Level: the paying, the rolling and the writing.
 *
 * Kept apart from `levelUp.ts` on purpose — that file is the house rules and
 * can be checked by a script; this one touches a purse, a die and an actor, and
 * cannot. The split is the same one `servicePurchase.ts` makes for the same
 * reason.
 *
 * **Everything moves in one write.** Nine or ten values change at a level-up,
 * and a character left half-advanced because the fourth of ten updates failed
 * is worse than one that did not advance at all.
 *
 * **The card is the record.** Dolmenmaster's ask, 2026-09-02: *"mach das 2. aber mit
 * dem klaren hinweis, was du genau gemacht hast."* So the card names every
 * figure that moved and every one that deliberately did not — the die rolled
 * for each Level, the Constitution Modifier applied to it, the Attack and Save
 * Targets read off the table, the coins, the XP, and the fact that Skill
 * Targets, spells and expert points were left alone.
 */

const IN_CP = { gp: 100 } as const;

export interface LevelUpResult {
  ok: boolean;
  /** Why not, when not — shown to whoever pressed the button. */
  reason?: string;
}

export async function applyLevelUp(
  actor: Actor,
  cls: ClassKey,
  offer: RouteOffer
): Promise<LevelUpResult> {
  const sys = getSystemFields(actor);

  // The window offered the route against the sheet as it stood when it was
  // drawn. Between then and now a purse can empty and XP can be spent, so the
  // requirements are asked again here rather than trusted.
  if (sys.level !== offer.fromLevel) {
    return { ok: false, reason: t("DOLMENWOOD.Sheet.LevelUp.WrongLevel") };
  }
  if (sys.xp.value < offer.needXp) {
    return {
      ok: false,
      reason: t("DOLMENWOOD.Sheet.LevelUp.ShortXp", {
        need: offer.needXp.toLocaleString(),
        has: sys.xp.value.toLocaleString(),
      }),
    };
  }

  const change = levelChange(cls, sys.level, offer.toLevel);
  if (!change) return { ok: false, reason: t("DOLMENWOOD.Sheet.LevelUp.NotOnTable") };

  // ── The purse first, because it is the one step that can refuse ─────────────
  const costCp = offer.costGp * IN_CP.gp;
  if (costCp > 0) {
    let paid = false;
    await FlagManager.updateInventory(actor, (inv) => {
      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      paid = deductCoins(inv.coinsByZone, costCp);
      return inv;
    });
    if (!paid) {
      return {
        ok: false,
        reason: t("DOLMENWOOD.Sheet.LevelUp.CannotPay", {
          name: actor.name ?? "",
          gp: offer.costGp,
        }),
      };
    }
  }

  // ── Hit Points, one roll per Level gained ──────────────────────────────────
  const conMod = abilityModifier(sys.scores.con.value);
  const gains: HpGain[] = [];
  const rolls: Roll[] = [];
  for (let level = sys.level + 1; level <= offer.toLevel; level++) {
    const printed = printedHp(cls, level);
    const die = hpDieFor(cls, level);
    let rolled = 0;
    if (die) {
      const roll = await rollDice(die);
      rolls.push(roll);
      rolled = total(roll);
    }
    gains.push(hpGainFor(printed, level, rolled, conMod));
  }
  const hpGained = gains.reduce((n, g) => n + g.gained, 0);

  // ── One write ──────────────────────────────────────────────────────────────
  const newXp = sys.xp.value - offer.costXp;
  const saveFields: Record<string, unknown> = {};
  SAVES.forEach((s, i) => {
    saveFields[`save-${s.key}`] = change.saves.to[i];
  });

  await setSystemFields(actor, {
    level: offer.toLevel,
    xp: newXp,
    xpNext: change.nextXp,
    attack: change.attack.to,
    hp: sys.hp.value + hpGained,
    hpMax: sys.hp.max + hpGained,
    ...saveFields,
  });

  await announce(card(actor.name ?? "", cls, offer, change, gains, hpGained, sys, newXp), rolls);
  return { ok: true };
}

/**
 * What the book prints in the Hit Points column for one Level.
 *
 * Taken straight off the row rather than rebuilt from the die, because past
 * Level 10 there is no die — the column reads "+1" or "+2" and the table is the
 * only place that says which.
 */
function printedHp(cls: ClassKey, level: number): string {
  return ADVANCEMENT[cls]?.find((r) => r.level === level)?.hp ?? "+1";
}

function card(
  name: string,
  cls: ClassKey,
  offer: RouteOffer,
  change: ReturnType<typeof levelChange> & object,
  gains: HpGain[],
  hpGained: number,
  before: ReturnType<typeof getSystemFields>,
  newXp: number
): string {
  const hpLines = gains
    .map((g) => {
      // The Constitution term is arithmetic rather than prose — " + 2 CON" —
      // so it rides along as a placeholder instead of splitting the sentence.
      const con = g.conMod ? ` ${g.conMod > 0 ? "+" : "−"} ${Math.abs(g.conMod)} CON` : "";
      const key = g.printed.includes("d")
        ? "DOLMENWOOD.Sheet.LevelUp.Card.HpRolled"
        : "DOLMENWOOD.Sheet.LevelUp.Card.HpFlat";
      return t(key, {
        level: g.level,
        printed: g.printed,
        rolled: g.rolled,
        con,
        gained: g.gained,
      });
    })
    .join("");

  const saveLine = SAVES.map(
    (s, i) => `${s.label} ${change.saves.from[i]}→${change.saves.to[i]}`
  ).join(", ");

  const paid: string[] = [];
  if (offer.costGp > 0) paid.push(`${offer.costGp} ${t("DOLMENWOOD.Currency.GP")}`);
  if (offer.costXp > 0) paid.push(`${offer.costXp.toLocaleString()} XP`);
  const sub =
    paid.length === 0
      ? t("DOLMENWOOD.Sheet.LevelUp.Card.SubFree", {
          route: escapeHTML(offer.label),
          duration: escapeHTML(offer.duration),
        })
      : t("DOLMENWOOD.Sheet.LevelUp.Card.Sub", {
          route: escapeHTML(offer.label),
          duration: escapeHTML(offer.duration),
          paid:
            paid.length === 1
              ? paid[0]!
              : t("DOLMENWOOD.Sheet.LevelUp.Card.And", { a: paid[0]!, b: paid[1]! }),
        });

  return `<div class="dw-day-roll dw-levelup-card">
      <h3><i class="fas fa-angles-up"></i> ${t("DOLMENWOOD.Sheet.LevelUp.Card.Head", {
        name: escapeHTML(name),
        level: change.toLevel,
      })}</h3>
      <p class="dw-day-roll-sub">${sub}</p>
      <ul class="dw-camp-rows">
        ${t("DOLMENWOOD.Sheet.LevelUp.Card.Level", {
          from: change.fromLevel,
          to: change.toLevel,
        })}
        ${t("DOLMENWOOD.Sheet.LevelUp.Card.Hp", {
          gained: hpGained,
          from: before.hp.max,
          to: before.hp.max + hpGained,
        })}
        ${t("DOLMENWOOD.Sheet.LevelUp.Card.Attack", {
          from: `${change.attack.from >= 0 ? "+" : ""}${change.attack.from}`,
          to: `${change.attack.to >= 0 ? "+" : ""}${change.attack.to}`,
        })}
        ${t("DOLMENWOOD.Sheet.LevelUp.Card.Saves", { saves: saveLine })}
        ${t("DOLMENWOOD.Sheet.LevelUp.Card.Xp", {
          from: before.xp.value.toLocaleString(),
          to: newXp.toLocaleString(),
          next: change.nextXp ? change.nextXp.toLocaleString() : "—",
        })}
      </ul>
      <ul class="dw-day-roll-effects">${hpLines}</ul>
      <p class="dw-day-roll-note">${t("DOLMENWOOD.Sheet.LevelUp.Card.Note", {
        class: escapeHTML(cls),
      })}</p>
    </div>`;
}

/** The XP ceiling a Level sits under, for the sheet's own line. */
export function capLine(cls: ClassKey, level: number, xp: number): string {
  const cap = thresholdFor(cls, level + 2);
  if (cap === undefined) return t("DOLMENWOOD.Sheet.CapLine.None");
  const left = cap - xp;
  return left > 0
    ? t("DOLMENWOOD.Sheet.CapLine.ToGo", {
        cap: cap.toLocaleString(),
        left: left.toLocaleString(),
      })
    : t("DOLMENWOOD.Sheet.CapLine.Reached", { cap: cap.toLocaleString() });
}
