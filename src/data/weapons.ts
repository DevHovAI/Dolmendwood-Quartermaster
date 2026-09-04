import { definitionFor } from "./itemDefs";
import { FlagManager } from "./FlagManager";
import type { InventoryItem, ItemDefinition } from "../types";
import { t } from "../helpers/i18n";

/**
 * What the party is actually holding, read off the weapons already in their
 * inventory.
 *
 * Leander's ask, 2026-08-25: *"ist es möglich, dass die Waffen, die die
 * Charaktere in equipped haben, direkt vorgeben, wie Attack und Damage Roll
 * ausfallen? Im Inventar an den Waffen finden sich ja alle Infos."*
 *
 * They do, and more than expected. The catalogue writes a weapon's numbers as
 * plain qualities — `["1d8", "Medium", "Melee"]`, or for a bow
 * `["1d6", "Large", "Missile (70'/140'/210')", "Two-handed"]` — and all twenty
 * weapons follow it without exception. So nothing has to be typed in again: the
 * damage die, whether it is thrown or swung, and the three range bands are
 * already sitting in the row.
 *
 * **A weapon can be both.** A dagger, a hand axe and a spear are Melee *and*
 * Missile, so they offer two attacks rather than one, and the sheet has to ask
 * which.
 *
 * **What is deliberately not read:** everything else in the qualities list —
 * Brace, Charge, Reach, Reload, Splash, Armour piercing, Two-handed. They are
 * shown beside the weapon and left to the table, because each is a ruling about
 * the situation rather than a number to add. That is the same reason the roll
 * takes a modifier the player sets.
 */

export interface WeaponRanges {
  short: number;
  medium: number;
  long: number;
}

export interface Weapon {
  itemId: string;
  name: string;
  icon?: string;
  /** The damage die as the book prints it: "1d8". */
  damage: string;
  melee: boolean;
  ranges?: WeaponRanges;
  /** Everything the module read and did not act on, for the row to show. */
  notes: string[];
}

const DAMAGE = /^\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*$/i;
const MISSILE = /^\s*Missile\s*\((\d+)'\s*\/\s*(\d+)'\s*\/\s*(\d+)'\)\s*$/i;
const SIZES = /^\s*(small|medium|large)\s*$/i;

/**
 * Read one row as a weapon, or nothing if it is not one.
 *
 * **A bare damage die in the qualities is what makes a weapon**, not the
 * category. This started out the other way round and was wrong twice over:
 *
 * - **An item invented by hand has no category at all.** The custom-item
 *   dialogs build a partial definition with an icon, a size and a weight and
 *   nothing else, so a Referee's own sword — qualities perfectly typed — could
 *   never have rolled. The field would have been decoration.
 * - **The category was doing no work.** Across all 425 catalogue entries,
 *   exactly 20 carry a bare `NdM` quality and all 20 are the weapons. The die
 *   is already a perfect discriminator, which `check-weapons` asserts over the
 *   whole catalogue so that a future entry breaking it fails loudly.
 *
 * A quality of exactly "1d8" is a deliberate statement in a way a description
 * containing "1d8" would not be, which is why this reads qualities and nothing
 * else.
 */
export function weaponFromItem(
  item: InventoryItem,
  def: ItemDefinition | undefined
): Weapon | undefined {
  if (!def) return undefined;

  let damage: string | undefined;
  let melee = false;
  let ranges: WeaponRanges | undefined;
  const notes: string[] = [];

  for (const quality of def.qualities ?? []) {
    const dmg = DAMAGE.exec(quality);
    if (dmg && !damage) {
      damage = dmg[1].replace(/\s+/g, "");
      continue;
    }
    if (/^\s*melee\s*$/i.test(quality)) {
      melee = true;
      continue;
    }
    const missile = MISSILE.exec(quality);
    if (missile) {
      ranges = {
        short: Number(missile[1]),
        medium: Number(missile[2]),
        long: Number(missile[3]),
      };
      continue;
    }
    // The size class is on every weapon and says nothing about the roll.
    if (SIZES.test(quality)) continue;
    notes.push(quality);
  }

  if (!damage) return undefined;
  // A weapon that says neither is swung: the catalogue always says one, but a
  // hand-written one might not, and refusing to roll would be unhelpful.
  if (!melee && !ranges) melee = true;

  return { itemId: item.id, name: item.name, icon: def.icon, damage, melee, ranges, notes };
}

/**
 * The weapons a character has to hand.
 *
 * **Equipped only**, which is the whole point of the zone: a sword in the pack
 * is not a sword in the hand. In weight mode the equipped zone is the one the
 * sheet reads; anything stowed is deliberately left out.
 */
export function equippedWeapons(actor: Actor): Weapon[] {
  const inv = FlagManager.getInventory(actor);
  const found: Weapon[] = [];
  for (const item of inv.items) {
    if ((item.zone ?? "equipped") !== "equipped") continue;
    const weapon = weaponFromItem(item, definitionFor(item));
    if (weapon) found.push(weapon);
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── What the dice say ────────────────────────────────────────────────────────

export type RangeBand = "short" | "medium" | "long";

/**
 * Missile range modifiers, Player's Book: *"Short: +1 Attack, Medium: no
 * modifier, Long: -1 Attack. Beyond Long range: attack not possible."*
 *
 * The bands are on the weapon already, so the sheet can offer them by name and
 * in feet rather than making anyone remember which is which.
 */
export const RANGE_MODIFIER: Record<RangeBand, number> = { short: 1, medium: 0, long: -1 };

export interface AttackOptions {
  /** Thrown or shot rather than swung. */
  missile?: boolean;
  /** Which band the target is in. Missile attacks only. */
  band?: RangeBand;
  /**
   * Whatever the table decides the situation is worth.
   *
   * Leander, and he is right: *"Es muss auch die Möglichkeit geben, selbst
   * Modifier einzustellen, da auch die Distanz und andere Dinge sich auf
   * Fernkampf auswirken. Das können wir unmöglich noch reinprogrammieren."*
   * Cover, footing, firing into a melee, a Referee's ruling — none of it is
   * knowable from the sheet, so the sheet asks.
   */
  situational?: number;
}

function situationalTerm(value: number | undefined): string {
  if (!value) return "";
  return value > 0 ? ` + ${value}` : ` - ${Math.abs(value)}`;
}

/**
 * The attack formula for a weapon.
 *
 * 1d20 + the character's Attack value, plus Strength for melee or Dexterity for
 * missile (p145), plus the range band, plus whatever the table added, plus the
 * hunger and exhaustion the module is already tracking. No target: the
 * defender's Armour Class is not the sheet's to know.
 */
export function attackFormula(weapon: Weapon, options: AttackOptions = {}): string {
  const missile = !!options.missile;
  const ability = missile ? "@dexMod" : "@strMod";
  const band = missile && options.band ? RANGE_MODIFIER[options.band] : 0;
  return (
    `1d20 + @attack + ${ability}` +
    situationalTerm(band) +
    situationalTerm(options.situational) +
    " + @attackPenalty"
  );
}

/**
 * The damage formula for a weapon.
 *
 * **Strength is added to melee damage and not to missile damage.** The printed
 * sheet says so in as many words under the ability scores: Strength governs
 * "Melee attacks/damage", while Dexterity governs "AC and missile attacks" —
 * attacks, not damage. Exhaustion reaches damage rolls (p151); hunger does not.
 */
export function damageFormula(weapon: Weapon, options: AttackOptions = {}): string {
  const missile = !!options.missile;
  return (
    weapon.damage +
    (missile ? "" : " + @strMod") +
    situationalTerm(options.situational) +
    " + @damagePenalty"
  );
}

/** How a weapon may be used, given what the catalogue says about it. */
export function attackModes(weapon: Weapon): { missile: boolean; label: string }[] {
  const modes: { missile: boolean; label: string }[] = [];
  if (weapon.melee) modes.push({ missile: false, label: "Melee" });
  if (weapon.ranges) modes.push({ missile: true, label: "Missile" });
  return modes;
}

// ─── Writing qualities by hand ────────────────────────────────────────────────

/** Split a typed line into qualities. Commas, because the catalogue reads that way. */
export function parseQualities(text: string): string[] {
  return text
    .split(",")
    .map((q) => q.trim())
    .filter(Boolean);
}

/**
 * How the module reads a set of qualities, in words.
 *
 * The point of saying it back. Qualities are free text — they have to be, since
 * the whole design is that a table can invent a weapon the books never printed —
 * but free text means a typo is silent, and a weapon that quietly refuses to
 * roll is worse than one that says why. So the dialog reads the line back as it
 * understood it, and anyone can see at a glance whether `1d8` landed.
 */
export function describeQualities(qualities: string[]): string {
  const fake = { id: "preview", name: "preview", qualities } as unknown as ItemDefinition;
  const weapon = weaponFromItem({ id: "preview" } as InventoryItem, fake);

  if (!weapon) return "No damage die, so this is not rolled as a weapon.";

  const parts: string[] = [`${weapon.damage} damage`];
  if (weapon.melee) parts.push("melee");
  if (weapon.ranges) {
    parts.push(`missile ${weapon.ranges.short}'/${weapon.ranges.medium}'/${weapon.ranges.long}'`);
  }
  if (weapon.notes.length) parts.push(`kept as notes: ${weapon.notes.join(", ")}`);
  return `Read as ${parts.join(", ")}.`;
}

/**
 * What to write for a weapon, shown under the field.
 *
 * Deliberately the catalogue's own wording, so a hand-written weapon and a
 * printed one are spelled the same and nobody has to learn a second format.
 */
/**
 * What the Qualities box will accept, in words.
 *
 * **A function, not the constant it used to be** — the same reason `coinLabel`
 * is one. `game.i18n` does not exist when this module is evaluated, so a string
 * built at module scope would be the raw key for the rest of the session.
 *
 * The quality names themselves stay English in both languages, because
 * `parseQualities` matches on them: a German "Zweihändig" would be kept and
 * shown but would never make a weapon roll.
 */
export function qualitiesHint(): string {
  return t("DOLMENWOOD.ItemDialog.Qualities.Hint");
}
