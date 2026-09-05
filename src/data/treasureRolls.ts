import { escapeHTML } from "../helpers/handlebars";
import { bookRef } from "./books";
import { FlagManager } from "./FlagManager";
import { LOOT_ZONE } from "../constants";
import { createLootActor, emptyCoins, getLootActors, type CoinKey } from "./lootStore";
import { isGM, rollDice, total, whisperToGMs } from "./rollCard";
import {
  parsePossessions,
  type PossessionsPlan,
  ART_VALUE_FORMULA,
  ART_WEIGHT,
  COIN_HOARDS,
  EMBELLISHMENTS,
  GEM_TYPES,
  GEM_VALUES,
  GEM_WEIGHT,
  JEWELLERY,
  MAGIC_HOARDS,
  MAGIC_ITEM_TYPES,
  MISC_ART_OBJECTS,
  ORNAMENTAL_ARMS,
  PRECIOUS_MATERIALS,
  RICHES_HOARDS,
  bandFor,
  parseHoard,
} from "./treasure";
import type { InventoryItem, ItemDefinition, ZoneCoins } from "../types";

/**
 * Rolling a creature's hoard, and laying it out as a body to be found.
 *
 * Dolmenmaster asked for it on 2026-08-28: *"An den Kreaturen steht ja deren Hoard.
 * Daraus müsstest du eigentlich den Loot erwürfeln können. Kannst du dann auch
 * direkt eine entsprechende Leiche in dem Lootmodul erstellen, die ich dann nur
 * noch freigeben muss?"* So the button rolls the Campaign Book's three treasure
 * tables and leaves a **staged** loot box behind — visible to the Referee, and
 * one click from the party.
 *
 * **One hoard for the encounter, not one per creature.** The book's own worked
 * example rolls "a hoard for a *group* of monsters that have treasure type C5"
 * (p392), and eight goblins do not carry eight hoards.
 *
 * **The dice are whispered.** Everything about what is in a body before the
 * party has opened it belongs with getting lost and the hex's secrets, not with
 * the weather — so the card goes to the Referee alone, and the players learn
 * what is there by taking it.
 *
 * Three things this deliberately does not do, each because the alternative
 * would be the module inventing a rule:
 *
 *  1. **Magic items get a type and a page, not an item.** Each of the twelve
 *     types heads a chapter with its own tables; the row says "Magic ring, not
 *     yet identified" and the Referee's note says p410. The module ships no
 *     spell list and no monster list for the same reason.
 *  2. **Prose in a hoard line is handed back, not guessed at.** *"+ magical"*,
 *     *"+ collection"*, *"+ earths and ores (1d10 × 100gp)"* — the card prints
 *     the book's own words and leaves them to the Referee.
 *  3. **Nothing is released.** Staging is the whole point of the ask.
 */

/** What one roll of one table produced, for the Referee's card. */
interface HoardLine {
  text: string;
}

/**
 * What the lair check said, where one was made.
 *
 * **A hoard is not carried.** The Monster Book draws the line in as many words
 * (p9): *Possessions* are "items and treasures carried by the creature on its
 * person", *Hoard* is "items and treasures found in the creature's **lair**".
 * The module's own lair card has been saying "Treasure is kept in lairs, not
 * carried" since it was built — and the Loot button shipped ignoring it
 * (Dolmenmaster's catch, 2026-08-28).
 *
 * So the answer to "does the amount change in a lair" is stronger than a
 * multiplier: **outside a lair there is no hoard at all**, and what the party
 * finds on the bodies is the creature's Possessions line — which the bestiary
 * now carries for all 87 entries, transcribed from the same stat blocks the
 * hoard codes came from.
 */
export interface LairContext {
  /** `true` in its lair, `false` abroad, absent where no check was rolled. */
  inLair?: boolean;
  /** The group as the encounter table rolled it, before any lair multiplier. */
  group?: number;
  /** What that table's dice average, for the book's smaller-groups rule. */
  average?: number;
  /** The Monster Book page for this creature, for the Possessions line. */
  page?: number;
  /** What the stat block says they carry on them. `"None"` is an answer. */
  possessions?: string;
}

const ROW_ICON: Record<string, string> = {
  gem: "fa-gem",
  art: "fa-crown",
  magic: "fa-wand-sparkles",
};

/**
 * Roll a hoard and stage it as a loot box.
 *
 * Returns the box so a caller can say what became of it; `null` where there was
 * nothing to roll or the user is not the Referee.
 */
export async function rollCreatureHoard(
  creature: string,
  hoardLine: string | undefined,
  count = 1,
  lair: LairContext = {},
  mode: "encounter" | "body" = "encounter"
): Promise<Actor | null> {
  if (!isGM()) return null;

  const { codes, rest } = parseHoard(hoardLine);
  const carried = parsePossessions(lair.possessions);

  // **One click, one creature, one body** (Dolmenmaster, 2026-08-28): *"damit man
  // die auch einzeln auf der Karte platzieren kann. Das passiert ja vermutlich
  // auf der Battlemap."* Six goblins are six corpses in six places, and a
  // single box holding all of them cannot be dropped in six of them. So this
  // mode rolls one creature's Possessions and nothing else — no hoard, which
  // belongs to the lair and to the band as a whole, and no lair question.
  if (mode === "body") {
    if (!carried) {
      ui.notifications?.warn(`The book says ${creature} carries nothing.`);
      return null;
    }
  } else if (!codes.length && !rest && !carried) {
    ui.notifications?.warn(`${creature} carries nothing and keeps no hoard the book puts a number on.`);
    return null;
  }

  // **Abroad, there is no hoard**, and the check has already said so. Asked
  // rather than refused: a Referee may be looting a lair the party walked into
  // afterwards, or ruling that this band carries its wealth with it. The point
  // is that the book's line is in front of them when they decide — and where
  // the creature has a Possessions line, taking only that is one click.
  let wanderingChoice: "carried" | "hoard" = "hoard";
  if (mode === "encounter" && lair.inLair === false) {
    const answer = await askWandering(creature, lair.page, lair.possessions, codes.length > 0);
    if (!answer) return null;
    wanderingChoice = answer;
  }

  const rolls: Roll[] = [];
  const coins = emptyCoins();
  const items: InventoryItem[] = [];
  const lines: HoardLine[] = [];

  /** A d100 that reads 100 as the book's "00". */
  const percent = async (): Promise<number> => {
    const die = await rollDice("1d100");
    rolls.push(die);
    return total(die);
  };
  const amount = async (formula: string): Promise<number> => {
    const die = await rollDice(formula);
    rolls.push(die);
    return total(die);
  };

  /**
   * Roll a list of treasure codes into the pile.
   *
   * The same three tables serve a hoard and the few Possessions lines that
   * carry codes rather than coin, so the loop is written once and told what to
   * call itself on the card.
   */
  const rollCodes = async (list: string[], tag: string): Promise<void> => {
    for (const code of list) {
      const at = `${tag}${code}`;
      if (code in COIN_HOARDS) {
        for (const [metal, spec] of Object.entries(COIN_HOARDS[code]!)) {
          const test = await percent();
          if (test > spec.chance) {
            lines.push({ text: `${at} ${metal}: d% = ${test}, over ${spec.chance}% — none.` });
            continue;
          }
          const many = await amount(spec.formula);
          coins[metal as CoinKey] += many;
          lines.push({
            text: `${at} ${metal}: d% = ${test} under ${spec.chance}% — <strong>${many.toLocaleString()}${metal}</strong> (${escapeHTML(spec.formula)}).`,
          });
        }
      } else if (code in RICHES_HOARDS) {
        const row = RICHES_HOARDS[code]!;
        if (row.gems) {
          const test = await percent();
          if (test > row.gems.chance) {
            lines.push({ text: `${at} gems: d% = ${test}, over ${row.gems.chance}% — none.` });
          } else {
            const many = await amount(row.gems.formula);
            lines.push({
              text: `${at} gems: d% = ${test} under ${row.gems.chance}% — <strong>${many}</strong> (${escapeHTML(row.gems.formula)}).`,
            });
            for (let i = 0; i < many; i++) items.push(await oneGem(percent, amount));
          }
        }
        if (row.art) {
          const test = await percent();
          if (test > row.art.chance) {
            lines.push({ text: `${at} art objects: d% = ${test}, over ${row.art.chance}% — none.` });
          } else {
            const many = await amount(row.art.formula);
            lines.push({
              text: `${at} art objects: d% = ${test} under ${row.art.chance}% — <strong>${many}</strong> (${escapeHTML(row.art.formula)}).`,
            });
            for (let i = 0; i < many; i++) items.push(await oneArtObject(percent, amount));
          }
        }
      } else if (code in MAGIC_HOARDS) {
        const row = MAGIC_HOARDS[code]!;
        const test = await percent();
        if (test > row.chance) {
          lines.push({ text: `${at} magic: d% = ${test}, over ${row.chance}% — none.` });
          continue;
        }
        lines.push({ text: `${at} magic: d% = ${test} under ${row.chance}% — the row is there.` });
        for (const part of row.parts) {
          const many = /d/.test(part.count) ? await amount(part.count) : Number(part.count);
          for (let i = 0; i < many; i++) items.push(await oneMagicItem(part.kind, percent, amount));
        }
      }
    }
  };

  /**
   * What the bodies themselves are carrying.
   *
   * **Coin is per creature, and rolled as one throw.** Eight skeletons with
   * 2d6sp each are 16d6 silver, not eight separate lines nobody reads — the
   * arithmetic is identical and the card stays legible. A line that says
   * "Carried by group" is one lot however many there are, which is exactly the
   * distinction the book bothers to draw.
   */
  const rollPossessions = async (plan: PossessionsPlan, many: number): Promise<void> => {
    if (plan.chance) {
      const die = await rollDice(`1d${plan.chance.of}`);
      rolls.push(die);
      if (total(die) > plan.chance.in) {
        lines.push({
          text: `Carried: 1d${plan.chance.of} = ${total(die)}, over ${plan.chance.in} — they have nothing on them.`,
        });
        return;
      }
      lines.push({
        text: `Carried: 1d${plan.chance.of} = ${total(die)}, within ${plan.chance.in} — they do have it.`,
      });
    }
    const each = plan.perGroup ? 1 : Math.max(1, many);
    for (const coin of plan.coins) {
      const [dice, faces] = coin.formula.split("d");
      const formula = `${Number(dice) * each}d${faces}`;
      const got = await amount(formula);
      coins[coin.metal] += got;
      lines.push({
        text: `Carried: <strong>${got.toLocaleString()}${coin.metal}</strong> — ${escapeHTML(coin.formula + coin.metal)}${
          each > 1 ? ` each, ${each} of them, so ${escapeHTML(formula)}` : ""
        }.`,
      });
    }
    // Codes on a Possessions line are rolled once per creature unless the book
    // says the band shares them.
    for (let i = 0; i < each; i++) await rollCodes(plan.codes, "Carried ");
  };

  // The hoard, unless this is one body or the Referee has just said to take
  // only what they carry.
  if (mode === "encounter" && wanderingChoice === "hoard") await rollCodes(codes, "");
  // What is on the bodies applies either way: they are dead here, wherever the
  // rest of their wealth is kept.
  if (carried) await rollPossessions(carried, mode === "body" ? 1 : count);

  const label = mode === "body" ? nextBodyName(creature) : bodyName(creature, count);
  const box = await createLootActor(label, "fa-skull");
  if (!box) return null;
  await FlagManager.updateInventory(box, (inv) => {
    inv.items.push(...items);
    // One pile, one purse — a loot box has a single zone.
    inv.coinsByZone = { [LOOT_ZONE]: coins as ZoneCoins };
    inv.coins = coins as ZoneCoins;
    return inv;
  });

  await whisperToGMs(
    `<div class="dw-day-roll">
      <h3><i class="fas fa-skull"></i> ${escapeHTML(label)}</h3>
      <p class="dw-day-roll-headline">${describeHaul(coins, items)}</p>
      <p class="dw-day-roll-sub">Possessions ${escapeHTML(lair.possessions ?? "None")}${
        mode === "body" ? "" : ` &middot; Hoard ${escapeHTML(hoardLine ?? "None")}`
      } &middot; ${bookRef("campaign", 392, "Campaign Book p392")}</p>
      <ul class="dw-camp-rows">${lines.map((l) => `<li>${l.text}</li>`).join("")}</ul>
      ${
        mode === "body"
          ? `<p class="dw-day-roll-sub"><i class="fas fa-map-pin"></i> One creature, one body — press again for the next,
              and drop each of them where it fell from the box's own window.${
                carried?.perGroup
                  ? " <strong>The book gives this band one lot between them</strong>, so this is that lot: pressing again rolls it a second time."
                  : ""
              }</p>`
          : lairNote(creature, lair)
      }
      ${
        rest && mode === "encounter"
          ? `<p class="dw-day-roll-consequence"><strong>The book also says:</strong> ${escapeHTML(
              rest
            )} — no table covers that, so it is yours to place.</p>`
          : ""
      }
      <p class="dw-day-roll-consequence">Staged, not released. Nobody can see it until you say so.</p>
      <p class="dw-day-roll-note"><i class="fas fa-map-pin"></i> It is waiting in the Loot browser.
        Put its pin on the map, and it is opened from there — by you, and by whoever walks up to it.</p>
    </div>`,
    rolls
  );

  return box;
}

/**
 * The book's own line, put in front of the Referee before they overrule it.
 *
 * Not a refusal: the lair check is one d100 and the table is the Referee's, so
 * the module says what the Monster Book says and then does as it is told.
 */
async function askWandering(
  creature: string,
  page: number | undefined,
  possessions: string | undefined,
  hasHoard: boolean
): Promise<"carried" | "hoard" | null> {
  const plan = parsePossessions(possessions);
  return new Promise<"carried" | "hoard" | null>((resolve) => {
    const buttons: Record<string, { label: string; callback: () => void }> = {};
    if (plan) {
      buttons.carried = { label: "Only what they carry", callback: () => resolve("carried") };
    }
    if (hasHoard) {
      buttons.hoard = {
        label: plan ? "The hoard as well" : "Roll the hoard anyway",
        callback: () => resolve("hoard"),
      };
    }
    buttons.cancel = { label: "Cancel", callback: () => resolve(null) };

    new Dialog({
      title: "They are not in their lair",
      content: `<p>The lair check came up <strong>wandering abroad</strong>, and the Monster Book (p9)
          keeps a <em>Hoard</em> in the creature's lair. What a band carries on the move is its
          <em>Possessions</em> line${page ? ` — ${escapeHTML(creature)}, p${page}` : ""}:</p>
        <p style="text-align:center"><strong>${escapeHTML(possessions || "None")}</strong></p>
        ${
          plan
            ? ""
            : `<p>Which is nothing at all, so there is only the hoard to take — against the book, and your call.</p>`
        }`,
      buttons,
      default: plan ? "carried" : "cancel",
      close: () => resolve(null),
    }).render(true);
  });
}

/**
 * Where the treasure came from, and the one adjustment the book offers.
 *
 * *"Smaller groups: If the number of creatures in a lair is below average, the
 * Referee may proportionally reduce the amount of treasure present"* (Monster
 * Book p9). **May** — so the proportion is worked out and offered, never
 * applied. A module that quietly halved a hoard would be making the ruling.
 */
function lairNote(creature: string, lair: LairContext): string {
  const where =
    lair.inLair === true
      ? "In the lair, so both: what they carry and what is kept here."
      : lair.inLair === false
        ? "Abroad, by the lair check — so what came off the bodies, and whatever else you called for."
        : "No lair check was rolled, so both were taken. The book keeps a hoard in the lair and Possessions on the creature.";
  const small =
    lair.inLair === true && lair.group && lair.average && lair.group < lair.average
      ? `<p class="dw-day-roll-note">Only <strong>${lair.group}</strong> of them, where the table averages
          ${Math.round(lair.average * 10) / 10}. The book lets you cut the hoard to about
          <strong>${Math.round((lair.group / lair.average) * 100)}%</strong> for a group that small — your call,
          and nothing here has been reduced.</p>`
      : "";
  return `<p class="dw-day-roll-sub"><i class="fas fa-house-crack"></i> ${escapeHTML(where)}</p>${small}`;
}

/** "Remains of a Boggin" / "Remains of 6 Boggins" — a body, not a chest. */
function bodyName(creature: string, count: number): string {
  return count > 1 ? `Remains of ${count} ${creature}` : `Remains of ${creature}`;
}

/**
 * "Boggin 1", "Boggin 2", "Boggin 3" — one name per corpse.
 *
 * Numbered by counting the boxes already standing rather than by remembering
 * anything: the Referee may roll three tonight, delete one, and roll two more
 * next week, and a counter kept somewhere would be wrong by then. Reading the
 * world is always right, and a gap in the numbering is not a bug — the body
 * that had it was looted and cleared away.
 */
function nextBodyName(creature: string): string {
  const taken = new Set(
    getLootActors()
      .map((actor) => actor.name ?? "")
      .filter((name) => name.startsWith(`${creature} `))
      .map((name) => Number(name.slice(creature.length + 1)))
      .filter((n) => Number.isFinite(n))
  );
  let n = 1;
  while (taken.has(n)) n++;
  return `${creature} ${n}`;
}

function describeHaul(coins: ZoneCoins, items: InventoryItem[]): string {
  const cash = (["pp", "gp", "sp", "cp"] as CoinKey[])
    .filter((k) => coins[k] > 0)
    .map((k) => `${coins[k].toLocaleString()}${k}`)
    .join(", ");
  const bits = [cash, items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : ""]
    .filter(Boolean);
  return bits.length ? bits.join(" and ") : "Nothing at all — the dice said so.";
}

/**
 * One gem: a value band, then a name from that band's own d12.
 *
 * The name is the book's optional flavour and is rolled anyway, because "gem,
 * 100gp" is a number and "jade, 100gp" is a thing somebody picks up.
 */
async function oneGem(
  percent: () => Promise<number>,
  amount: (formula: string) => Promise<number>
): Promise<InventoryItem> {
  const { category, value } = bandFor(GEM_VALUES, await percent());
  const names = GEM_TYPES[category] ?? [];
  const which = names.length ? names[(await amount("1d12")) - 1] ?? names[0]! : category;
  return row(`${which}`, {
    icon: ROW_ICON.gem,
    weight: GEM_WEIGHT,
    size: "tiny",
    unit: "piece",
    cost: { amount: value, currency: "gp" },
    description: `A ${category.toLowerCase()} gem.`,
    category: "Treasure",
    subcategory: "Gems",
  });
}

/**
 * One art object: 3d6 × 100gp, and three optional tables that turn the number
 * into something a character can describe.
 */
async function oneArtObject(
  percent: () => Promise<number>,
  amount: (formula: string) => Promise<number>
): Promise<InventoryItem> {
  const value = await amount(ART_VALUE_FORMULA);
  // **Which table** is the Referee's choice in the book — "roll on the
  // Jewellery table *or* the Miscellaneous Art Objects table" — so the die is
  // this module's, and the card says so. Half the hoard being brooches was the
  // reason to bother: a tapestry and a comb are not the same to carry.
  const jewellery = (await amount("1d2")) === 1;
  const material = PRECIOUS_MATERIALS[(await amount("1d20")) - 1] ?? "gold";
  const embellishment = EMBELLISHMENTS[(await amount("1d20")) - 1] ?? "engraved";

  const kind = jewellery
    ? { name: bandFor(JEWELLERY, await percent()), weight: ART_WEIGHT, size: "tiny" as const }
    : bandFor(MISC_ART_OBJECTS, await percent());

  const item = row(`${capitalise(material)} ${kind.name.toLowerCase()}, ${embellishment}`, {
    icon: ROW_ICON.art,
    weight: kind.weight,
    size: kind.size,
    unit: "piece",
    cost: { amount: value, currency: "gp" },
    description: ORNAMENTAL_ARMS.includes(kind.name)
      ? "An art object. Ornamental arms: worth having, worthless in battle, and destroyed if used in it."
      : "An art object.",
    category: "Treasure",
    subcategory: "Art Objects",
  });
  // The weight of anything bigger than a brooch is the Referee's to judge — the
  // book says so outright — so the row says whose number it is carrying.
  if (!jewellery) {
    item.gmNote = `${kind.name} — ${kind.weight} coins is this module's estimate, not the book's. The book leaves the weight of larger art objects to you; edit the row if it is wrong for this one.`;
  }
  return item;
}

/**
 * One magic item — its **type**, and the page that says what types of that kind
 * there are.
 *
 * The row goes into the pack unidentified, the same shape a rare herb from a hex
 * uses: a cover name the players can read and the truth in a note only the
 * Referee sees. Here the "truth" is a page number, because the choosing is the
 * Referee's and the book is the list.
 */
async function oneMagicItem(
  kind: "roll" | "potion" | "scroll" | "armourOrWeapon",
  percent: () => Promise<number>,
  amount: (formula: string) => Promise<number>
): Promise<InventoryItem> {
  let name: string;
  let page: number;
  if (kind === "potion") {
    name = "Potion";
    page = 414;
  } else if (kind === "scroll") {
    name = "Scroll / book";
    page = 418;
  } else if (kind === "armourOrWeapon") {
    // "1 armour or weapon (equal chance of either)" — M1, and the only row that
    // says which two rather than sending you to the type table.
    const coin = await amount("1d2");
    name = coin === 1 ? "Magic armour" : "Magic weapon";
    page = coin === 1 ? 400 : 412;
  } else {
    const type = bandFor(MAGIC_ITEM_TYPES, await percent());
    name = type.name;
    page = type.page;
  }
  const item = row(`${name}, not yet identified`, {
    icon: ROW_ICON.magic,
    weight: 10,
    size: "normal",
    unit: "piece",
    description: "Plainly enchanted, and nobody here can say what it does.",
    category: "Treasure",
    subcategory: "Magic Items",
  });
  item.gmNote = `${name} — roll or choose it on Campaign Book p${page}. Rename the row once somebody identifies it.`;
  return item;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A loot row with a definition of its own — nothing here is in the catalogue. */
function row(name: string, def: Partial<ItemDefinition>): InventoryItem {
  return {
    id: foundry.utils.randomID(),
    definitionId: "",
    name,
    quantity: 1,
    zone: LOOT_ZONE,
    isSecret: false,
    notes: "",
    customDefinition: { isCustom: true, qualities: [], tags: [], ...def },
  };
}
