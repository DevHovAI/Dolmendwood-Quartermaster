import { ADVANCEMENT } from "./advancement";
import { FlagManager, deductCoins } from "./FlagManager";
import { SAVES, abilityModifier, getSystemFields, setSystemFields } from "./characterSheet";
import { hpDieFor, hpGainFor, levelChange, thresholdFor } from "./levelUp";
import type { HpGain, RouteOffer } from "./levelUp";
import type { ClassKey } from "./xpAward";
import { announce, rollDice, total } from "./rollCard";
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
 * **The card is the record.** Leander's ask, 2026-09-02: *"mach das 2. aber mit
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
    return { ok: false, reason: "The Level on the sheet changed — reopen the sheet and try again." };
  }
  if (sys.xp.value < offer.needXp) {
    return {
      ok: false,
      reason: `${offer.needXp.toLocaleString()} XP are needed and the sheet has ${sys.xp.value.toLocaleString()}.`,
    };
  }

  const change = levelChange(cls, sys.level, offer.toLevel);
  if (!change) return { ok: false, reason: "That Level is not on the Class's advancement table." };

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
        reason: `${actor.name} cannot pay ${offer.costGp} gp — nothing was charged and no Level was taken.`,
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
      const parts = g.printed.includes("d")
        ? `${g.printed} rolled ${g.rolled}${g.conMod ? ` ${g.conMod > 0 ? "+" : "−"} ${Math.abs(g.conMod)} CON` : ""}`
        : `${g.printed} flat, no Constitution Modifier past Level 10`;
      return `<li>Level ${g.level}: ${parts} → <strong>+${g.gained}</strong></li>`;
    })
    .join("");

  const saveLine = SAVES.map(
    (s, i) => `${s.label} ${change.saves.from[i]}→${change.saves.to[i]}`
  ).join(", ");

  const paid: string[] = [];
  if (offer.costGp > 0) paid.push(`${offer.costGp} gp`);
  if (offer.costXp > 0) paid.push(`${offer.costXp.toLocaleString()} XP`);

  return `<div class="dw-day-roll dw-levelup-card">
      <h3><i class="fas fa-angles-up"></i> ${escapeHTML(name)} reaches Level ${change.toLevel}</h3>
      <p class="dw-day-roll-sub">${escapeHTML(offer.label)} &middot; ${escapeHTML(offer.duration)}${
        paid.length ? ` &middot; paid ${paid.join(" and ")}` : " &middot; no cost"
      }</p>
      <ul class="dw-camp-rows">
        <li>Level <strong>${change.fromLevel} → ${change.toLevel}</strong></li>
        <li>Hit Points <strong>+${hpGained}</strong> — ${before.hp.max} → ${before.hp.max + hpGained} maximum</li>
        <li>Attack ${change.attack.from >= 0 ? "+" : ""}${change.attack.from} → <strong>${
          change.attack.to >= 0 ? "+" : ""
        }${change.attack.to}</strong></li>
        <li>Save Targets ${saveLine}</li>
        <li>XP ${before.xp.value.toLocaleString()} → <strong>${newXp.toLocaleString()}</strong>, next Level at ${
          change.nextXp ? change.nextXp.toLocaleString() : "—"
        }</li>
      </ul>
      <ul class="dw-day-roll-effects">${hpLines}</ul>
      <p class="dw-day-roll-note">Skill Targets, expert points, spells and Class traits were not
        touched — those are still read out of the ${escapeHTML(cls)} entry by hand.</p>
    </div>`;
}

/** The XP ceiling a Level sits under, for the sheet's own line. */
export function capLine(cls: ClassKey, level: number, xp: number): string {
  const cap = thresholdFor(cls, level + 2);
  if (cap === undefined) return "No cap above this Level.";
  const left = cap - xp;
  return left > 0
    ? `Cap ${cap.toLocaleString()} XP — ${left.toLocaleString()} to go.`
    : `Cap ${cap.toLocaleString()} XP — reached.`;
}
