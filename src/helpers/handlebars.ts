import { TEMPLATES } from "../constants";
import { speedColorClass } from "../data/EncumbranceCalculator";
import { qualitiesHint, describeQualities, parseQualities } from "../data/weapons";
import type { PartyConvoyMember } from "../types";
import { t, tn } from "./i18n";

/** Map Animals & Vehicles subcategory to a Font Awesome icon class. */
export function subcategoryToIcon(subcategory?: string): string {
  switch ((subcategory ?? "").toLowerCase()) {
    case "horses":          return "fa-horse";
    case "hounds":          return "fa-dog";
    case "land vehicles":   return "fa-caravan";
    case "water vehicles":  return "fa-ship";
    default:                return "fa-horse";
  }
}

/**
 * The icon for an item's category — the same mapping the `itemIcon` Handlebars
 * helper exposes to templates, exported for callers that build their rows in TS.
 */
export function iconForItemCategory(category?: string, subcategory?: string): string {
  const cat = (category ?? "").toLowerCase();
  if (cat === "animals & vehicles") return subcategoryToIcon(subcategory);
  switch (cat) {
    case "adventuring gear": return "fa-compass";
    case "ammunition":       return "fa-bullseye";
    case "armour":           return "fa-shield-halved";
    case "arrows":           return "fa-arrow-up";
    case "camping and travel": return "fa-tent";
    case "clothing":         return "fa-shirt";
    case "containers":       return "fa-box";
    case "holy items":       return "fa-cross";
    case "light":            return "fa-lightbulb";
    case "melee":            return "fa-hand-fist";
    case "missile":          return "fa-crosshairs";
    case "quarrels":         return "fa-crosshairs";
    case "stones":           return "fa-circle";
    case "tools":            return "fa-wrench";
    case "weapons":          return "fa-gavel";
    case "pipeleaf":         return "fa-leaf";
    default:                 return "fa-sack";
  }
}

// ─── Icon Picker Utilities ────────────────────────────────────────────────────

export const ITEM_ICONS: { icon: string; label: string }[] = [
  { icon: "fa-sack",         label: "Bag / Generic" },
  { icon: "fa-compass",      label: "Adventuring Gear" },
  { icon: "fa-shield-halved",label: "Armour" },
  { icon: "fa-hand-fist",    label: "Melee Weapon" },
  { icon: "fa-crosshairs",   label: "Ranged Weapon" },
  { icon: "fa-gavel",        label: "Blunt Weapon" },
  { icon: "fa-tent",         label: "Camping" },
  { icon: "fa-shirt",        label: "Clothing" },
  { icon: "fa-box",          label: "Container" },
  { icon: "fa-cross",        label: "Holy Item" },
  { icon: "fa-lightbulb",    label: "Light Source" },
  { icon: "fa-wrench",       label: "Tool" },
  { icon: "fa-scroll",       label: "Scroll" },
  { icon: "fa-flask",        label: "Potion" },
  { icon: "fa-gem",          label: "Gem / Jewel" },
  { icon: "fa-key",          label: "Key / Lock" },
  { icon: "fa-map",          label: "Map" },
  { icon: "fa-ring",         label: "Ring" },
  { icon: "fa-hat-wizard",   label: "Magic Item" },
  { icon: "fa-skull",        label: "Cursed Item" },
  { icon: "fa-leaf",         label: "Herb / Plant" },
  { icon: "fa-book",         label: "Book" },
  { icon: "fa-music",        label: "Instrument" },
  { icon: "fa-star",         label: "Special" },
];

export const LOCATION_ICONS: { icon: string; label: string }[] = [
  { icon: "fa-store",          label: "Shop (generic)" },
  { icon: "fa-beer-mug-empty", label: "Inn / Tavern" },
  { icon: "fa-horse",          label: "Stable" },
  { icon: "fa-hammer",         label: "Blacksmith" },
  { icon: "fa-flask",          label: "Alchemist" },
  { icon: "fa-scroll",         label: "Scribe / Scrolls" },
  { icon: "fa-book",           label: "Books / Library" },
  { icon: "fa-gem",            label: "Jeweller" },
  { icon: "fa-shirt",          label: "Clothier" },
  { icon: "fa-shield-halved",  label: "Armourer" },
  { icon: "fa-leaf",           label: "Herbalist" },
  { icon: "fa-wrench",         label: "Smithy / Tools" },
  { icon: "fa-hat-wizard",     label: "Wizard / Magic" },
  { icon: "fa-cross",          label: "Temple / Holy" },
  { icon: "fa-music",          label: "Instruments / Bard" },
  { icon: "fa-map",            label: "Cartographer" },
  { icon: "fa-coins",          label: "Money Changer" },
  { icon: "fa-utensils",       label: "Food / Cook" },
  { icon: "fa-fire",           label: "Forge" },
  { icon: "fa-star",           label: "Special" },
];

export const ZONE_ICONS: { icon: string; label: string }[] = [
  // Containers
  { icon: "fa-backpack",  label: "Backpack" },
  { icon: "fa-sack",      label: "Sack / Pouch" },
  { icon: "fa-box",       label: "Chest / Box" },
  // Creatures. The custom-animal dialog used to carry its own list of these in
  // a plain <select>; when the two doors were merged into one editor
  // (2026-08-30) the lists were merged with them. A zone is a zone whether it
  // is a chest or a wolf, and two icon lists would only drift apart.
  { icon: "fa-horse",     label: "Horse" },
  { icon: "fa-dog",       label: "Dog / Wolf" },
  { icon: "fa-cat",       label: "Cat" },
  { icon: "fa-crow",      label: "Bird" },
  { icon: "fa-dragon",    label: "Dragon" },
  { icon: "fa-spider",    label: "Spider" },
  { icon: "fa-paw",       label: "Paw (generic)" },
  // Vehicles
  { icon: "fa-caravan",   label: "Wagon / Cart" },
  { icon: "fa-ship",      label: "Boat / Ship" },
];

/**
 * Icons a loot box can wear. Everything here except fa-crown is already used
 * elsewhere in the module, so it is known to render in Foundry's icon set.
 */
export const LOOT_ICONS: { icon: string; label: string }[] = [
  { icon: "fa-treasure-chest", label: "Treasure chest" },
  { icon: "fa-box",            label: "Crate / Box" },
  { icon: "fa-sack",           label: "Sack" },
  { icon: "fa-coins",          label: "Coin hoard" },
  { icon: "fa-gem",            label: "Gems" },
  { icon: "fa-crown",          label: "Regalia" },
  { icon: "fa-skull",          label: "Remains / Cursed" },
  { icon: "fa-hat-wizard",     label: "Magical cache" },
  { icon: "fa-scroll",         label: "Scrolls" },
  { icon: "fa-flask",          label: "Potions" },
  { icon: "fa-book",           label: "Library" },
  { icon: "fa-star",           label: "Special" },
];

/**
 * The same twelve choices as artwork, because a map note renders an image and
 * cannot show a Font Awesome glyph. Every path is a file Foundry ships, checked
 * against the installed icon library — a wrong path shows as a broken texture on
 * the canvas, which is worse than a generic one.
 */
export const LOOT_ICON_ARTWORK: Record<string, string> = {
  "fa-treasure-chest": "icons/containers/chest/chest-oak-steel-brown.webp",
  "fa-box":            "icons/containers/boxes/crate-heavy-brown.webp",
  "fa-sack":           "icons/containers/bags/sack-cloth-brown.webp",
  "fa-coins":          "icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp",
  "fa-gem":            "icons/commodities/gems/gem-cluster-red.webp",
  "fa-crown":          "icons/equipment/head/crown-gold-red.webp",
  "fa-skull":          "icons/svg/skull.svg",
  "fa-hat-wizard":     "icons/equipment/head/hat-belted-purple.webp",
  "fa-scroll":         "icons/sundries/scrolls/scroll-bound-brown-tan.webp",
  "fa-flask":          "icons/consumables/potions/bottle-conical-corked-blue.webp",
  "fa-book":           "icons/sundries/books/book-backed-blue-gold.webp",
  "fa-star":           "icons/magic/symbols/runes-star-blue.webp",
};

/**
 * The zone palette, by name only.
 *
 * **The colours themselves live in `styles/module.css`** as
 * `--dw-zone-<key>-deep / -mid / -pale / -grad`, and this list no longer repeats
 * them. It used to: the same seven gradients were written out here for the
 * picker buttons and again in twenty-one CSS rules for the real headers, and the
 * two had already drifted — the file carried #c8e6c8 and #c8e6c9, one digit
 * apart, for what was meant to be one green.
 *
 * A picker button therefore paints itself with `var(--dw-zone-<key>-grad)`, so a
 * button can never show a colour the header will not use.
 */
export const ZONE_COLORS: { key: string; label: string }[] = [
  { key: "green",   label: "Green (default)" },
  { key: "brown",   label: "Brown" },
  { key: "navy",    label: "Navy" },
  { key: "purple",  label: "Purple" },
  { key: "slate",   label: "Slate" },
  { key: "crimson", label: "Crimson" },
  { key: "teal",    label: "Teal" },
];

export function buildColorPickerHTML(selectedColor = "green"): string {
  const buttons = ZONE_COLORS.map((c) =>
    `<button type="button" class="color-picker-btn${c.key === selectedColor ? " selected" : ""}" ` +
    `data-color="${c.key}" title="${c.label}" style="background:var(--dw-zone-${c.key}-grad);"></button>`
  ).join("");
  return (
    `<div class="color-picker">${buttons}</div>` +
    `<input type="hidden" id="zone-color-value" value="${selectedColor}" />`
  );
}

export function activateColorPicker(html: JQuery): void {
  html.find(".color-picker-btn").on("click", function (e) {
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    html.find(".color-picker-btn").removeClass("selected");
    btn.classList.add("selected");
    html.find("#zone-color-value").val(btn.dataset.color ?? "green");
  });
}

/** Escape a value for safe interpolation into dialog HTML. Zone names are user input. */
export function escapeHTML(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

/**
 * Build the <option> list of zones an item can be placed into: the built-in
 * zones for the active encumbrance mode, followed by every extra zone
 * (containers, animals, vehicles). Zones that have been left behind are omitted.
 */
export function buildZoneOptionsHTML(
  extraZones: { id: string; name: string; isDropped?: boolean }[],
  encMode: "slots" | "weight",
  selected = "stowed"
): string {
  const options =
    encMode === "weight"
      ? [
          { value: "stowed", label: "Unsorted" },
          { value: "equipped", label: "Equipped" },
        ]
      : [
          { value: "equipped", label: "Equipped" },
          { value: "stowed", label: "Stowed" },
          { value: "tiny", label: "Belt Pouch" },
        ];

  for (const zone of extraZones) {
    if (zone.isDropped) continue;
    options.push({ value: zone.id, label: zone.name });
  }

  return options
    .map(
      (o) =>
        `<option value="${escapeHTML(o.value)}"${o.value === selected ? " selected" : ""}>${escapeHTML(o.label)}</option>`
    )
    .join("\n              ");
}

/**
 * The tray of icons, and the hidden box that holds the answer.
 *
 * **The id is a parameter because it used to be a constant**, and a dialog that
 * read its icon out of any other box got "fa-sack" back for ever — silently,
 * because a jQuery `.val()` on nothing is `undefined` and the fallback looked
 * deliberate. That was the item editor's icon on the day it shipped (Leander:
 * *"das icon ließ sich beim bearbeiten nicht ändern"*). The default keeps every
 * older caller as it was; a new one passes its own id to **both** functions,
 * and `render-inventory.js` checks the two agree.
 */
export function buildIconPickerHTML(
  selectedIcon = "fa-sack",
  icons = ITEM_ICONS,
  id = "custom-icon-value"
): string {
  const buttons = icons.map(
    (i) =>
      `<button type="button" class="icon-picker-btn${i.icon === selectedIcon ? " selected" : ""}" ` +
      `data-icon="${i.icon}" title="${i.label}"><i class="fas ${i.icon}"></i></button>`
  ).join("");
  return (
    `<div class="icon-picker">${buttons}</div>` +
    `<input type="hidden" id="${id}" value="${selectedIcon}" />`
  );
}

export function activateIconPicker(html: JQuery, id = "custom-icon-value"): void {
  html.find(".icon-picker-btn").on("click", function (e) {
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    html.find(".icon-picker-btn").removeClass("selected");
    btn.classList.add("selected");
    html.find(`#${id}`).val(btn.dataset.icon ?? "fa-sack");
  });
}

export function registerHandlebarsHelpers(): void {
  /**
   * One string, singular or plural: `{{localizeN "DOLMENWOOD.Xp.Counted" n}}`.
   *
   * Foundry already ships `{{localize "KEY" a=1}}`, which covers every string
   * that does not count something. This covers the ones that do — see `tn()` in
   * `helpers/i18n.ts` for why the choice cannot be left in the markup.
   *
   * Extra placeholders ride along as hash arguments:
   * `{{localizeN "KEY" n awarded=total}}`.
   */
  Handlebars.registerHelper(
    "localizeN",
    (key: string, count: number, options?: { hash?: Record<string, string | number> }) =>
      tn(key, Number(count) || 0, options?.hash)
  );

  // Equality check — used in templates: {{#if (eq a b)}}
  Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

  // Logical NOT — used in templates: {{#if (not a)}}
  Handlebars.registerHelper("not", (a: unknown) => !a);

  // Logical OR — used in templates: {{#if (or a b)}}
  Handlebars.registerHelper("or", (a: unknown, b: unknown) => Boolean(a) || Boolean(b));

  // Logical AND — used in templates: {{#if (and a b)}}
  Handlebars.registerHelper("and", (a: unknown, b: unknown) => Boolean(a) && Boolean(b));

  // Returns true if the effective size of an item is "tiny"
  Handlebars.registerHelper("isTinyItem", (item: { def?: { size?: string }; customDefinition?: { size?: string } }) => {
    const size = (item as { customDefinition?: { size?: string }; def?: { size?: string } }).customDefinition?.size
      ?? (item as { def?: { size?: string } }).def?.size
      ?? "normal";
    return size === "tiny";
  });

  // Returns true if item can go in the tiny (belt pouch) zone.
  // In slot mode: item must have size "tiny".
  // In weight mode: item weight must be ≤ 10.
  Handlebars.registerHelper("canUseTinyZone", (item: { def?: { size?: string; weight?: number }; customDefinition?: { size?: string; weight?: number } }, encMode: string) => {
    if (encMode === "weight") {
      const w = (item as { customDefinition?: { weight?: number }; def?: { weight?: number } }).customDefinition?.weight
        ?? (item as { def?: { weight?: number } }).def?.weight
        ?? 0;
      return w <= 10;
    }
    const size = (item as { customDefinition?: { size?: string }; def?: { size?: string } }).customDefinition?.size
      ?? (item as { def?: { size?: string } }).def?.size
      ?? "normal";
    return size === "tiny";
  });

  // Not-equal check
  Handlebars.registerHelper("neq", (a: unknown, b: unknown) => a !== b);

  // Array includes check (e.g. for tag filter active state)
  Handlebars.registerHelper("includes", (arr: unknown, val: unknown) => Array.isArray(arr) && arr.includes(val));

  // Greater-than check
  Handlebars.registerHelper("gt", (a: number, b: number) => a > b);
  Handlebars.registerHelper("gte", (a: number, b: number) => a >= b);

  // Less-than check
  Handlebars.registerHelper("lt", (a: number, b: number) => a < b);
  Handlebars.registerHelper("lte", (a: number, b: number) => a <= b);

  // Format currency as "X gp" / "X sp" etc.
  Handlebars.registerHelper(
    "formatCost",
    (amount: number, currency: string) => `${amount} ${currency}`
  );

  // Speed value → CSS class for color coding
  Handlebars.registerHelper("speedColor", (speed: number) => speedColorClass(speed));

  /**
   * Everything tied at the party's marching pace, as one line.
   *
   * `{{convoySlowest members}}` is the badge's line and **names as many as fit
   * a fixed budget of characters, then counts the rest**: `Alaric, Mule +2`.
   * Listing all of them was the honest thing and the unreadable thing at once
   * (Leander, 2026-08-31: *"wenn wirklich alle drin stehen ist das schon
   * doof"*), and a flat cap of two names is no better — three short names fit
   * where one long one does not.
   *
   * A budget in characters rather than in names is also what keeps the line
   * still: it does not depend on how wide the window happens to be, so the
   * text does not reflow as the window is dragged. The CSS ellipsis stays
   * behind it for the one case this cannot help, a single name longer than the
   * whole badge.
   *
   * The first name is always printed, even over budget: "+4 more" on its own
   * would name nobody at all. Order is the order they were found — the party in
   * the order the window lists it, each character before the animals they lead.
   *
   * `{{convoySlowest members true}}` is the tooltip's line: every one of them,
   * no budget, with the character leading each animal.
   */
  Handlebars.registerHelper("convoySlowest", (members: unknown, withOwners?: unknown) => {
    if (!Array.isArray(members)) return "";
    const all = members as PartyConvoyMember[];

    if (withOwners === true) {
      return all
        .map((m) => (m.kind === "animal" && m.owner !== m.name ? `${m.name} (${m.owner})` : m.name))
        .join(", ");
    }

    // Roughly the room the badge has beside the figure before it starts pushing
    // on the row it sits in.
    const BUDGET = 30;
    const named: string[] = [];
    let used = 0;
    for (const m of all) {
      const cost = named.length === 0 ? m.name.length : used + 2 + m.name.length;
      if (named.length > 0 && cost > BUDGET) break;
      named.push(m.name);
      used = cost;
    }

    const rest = all.length - named.length;
    return rest > 0 ? `${named.join(", ")} +${rest} more` : named.join(", ");
  });

  // Speed value → label. The gap is a non-breaking space: without it "0ft"
  // reads as the word "oft", and a plain space would let the unit wrap onto
  // its own line in the narrow party columns.
  Handlebars.registerHelper("speedLabel", (speed: number) => `${speed}\u00A0ft`);

  // Slot bar width as percentage for equipped (max 10 slots)
  Handlebars.registerHelper("equippedBarWidth", (slots: number) =>
    Math.min(100, (slots / 10) * 100).toFixed(1) + "%"
  );

  // Slot bar width as percentage for stowed (max 16 slots)
  Handlebars.registerHelper("stowedBarWidth", (slots: number) =>
    Math.min(100, (slots / 16) * 100).toFixed(1) + "%"
  );

  // Weight bar width as percentage (max 1600 coins)
  Handlebars.registerHelper("weightBarWidth", (weight: number) =>
    Math.min(100, (weight / 1600) * 100).toFixed(1) + "%"
  );

  // Bottleneck label — the short word for the tooltip, not the full sentence
  // `Encumbrance.Bottleneck.*` carries.
  Handlebars.registerHelper("bottleneckLabel", (bottleneck: string) => {
    switch (bottleneck) {
      case "equipped": return t("DOLMENWOOD.Encumbrance.BottleneckShort.Equipped");
      case "stowed": return t("DOLMENWOOD.Encumbrance.BottleneckShort.Stowed");
      case "both": return t("DOLMENWOOD.Encumbrance.BottleneckShort.Both");
      default: return "";
    }
  });

  /**
   * A transaction's kind, in words: `{{txTypeLabel this.type}}`.
   *
   * The log used to print the stored key — "purchase", "gmGrant" — straight
   * into the row. The four `DOLMENWOOD.Transaction.Type.*` keys for this have
   * shipped since v1.x with nothing reading them.
   */
  Handlebars.registerHelper("txTypeLabel", (type: string) => {
    // Spelled out rather than computed from the stored key: the keys are
    // `GMGrant` and `GMRemove`, which no capitalisation rule produces from
    // `gmGrant`. An unknown type falls back to itself rather than to a key.
    const KEYS: Record<string, string> = {
      purchase: "DOLMENWOOD.Transaction.Type.Purchase",
      trade: "DOLMENWOOD.Transaction.Type.Trade",
      gmGrant: "DOLMENWOOD.Transaction.Type.GMGrant",
      gmRemove: "DOLMENWOOD.Transaction.Type.GMRemove",
    };
    return KEYS[type] ? t(KEYS[type]) : type;
  });

  // Total coins converted to a human-readable string
  Handlebars.registerHelper(
    "coinTotal",
    (cp: number, sp: number, gp: number, pp: number) => {
      const parts: string[] = [];
      if (pp > 0) parts.push(`${pp} pp`);
      if (gp > 0) parts.push(`${gp} gp`);
      if (sp > 0) parts.push(`${sp} sp`);
      if (cp > 0) parts.push(`${cp} cp`);
      return parts.length > 0 ? parts.join(", ") : "0 gp";
    }
  );

  // Size label. The three keys have been in `lang/*.json` since v1.x with
  // nothing reading them.
  Handlebars.registerHelper("sizeLabel", (size: string) => {
    switch (size) {
      case "tiny": return t("DOLMENWOOD.Item.Size.Tiny");
      case "normal": return t("DOLMENWOOD.Item.Size.Normal");
      case "large": return t("DOLMENWOOD.Item.Size.Large");
      default: return size;
    }
  });

  // Slot cost label for a size
  Handlebars.registerHelper("slotCost", (size: string) => {
    switch (size) {
      case "tiny": return "0 slots";
      case "normal": return "1 slot";
      case "large": return "2 slots";
      default: return "-";
    }
  });

  // Category → Font Awesome icon class for inventory items
  // Accepts optional subcategory for finer-grained icons (Animals & Vehicles)
  Handlebars.registerHelper("itemIcon", (category: string, subcategoryOrOptions?: string | { hash?: unknown }) => {
    const subcategory = typeof subcategoryOrOptions === "string" ? subcategoryOrOptions : undefined;
    return iconForItemCategory(category, subcategory);
  });
}

export async function registerHandlebarsPartials(): Promise<void> {
  await foundry.applications.handlebars.loadTemplates({
    "transaction-log": TEMPLATES.PARTIALS.TRANSACTION_LOG,
    "inventory-zone": TEMPLATES.PARTIALS.INVENTORY_ZONE,
    "item-row": TEMPLATES.PARTIALS.ITEM_ROW,
    "coin-display": TEMPLATES.PARTIALS.COIN_DISPLAY,
    "encumbrance-bar": TEMPLATES.PARTIALS.ENCUMBRANCE_BAR,
    "speed-readout": TEMPLATES.PARTIALS.SPEED_READOUT,
    "party-summary": TEMPLATES.PARTIALS.PARTY_SUMMARY,
    "extra-zone": TEMPLATES.PARTIALS.EXTRA_ZONE,
    "zone-coin-purse": TEMPLATES.PARTIALS.ZONE_COIN_PURSE,
    "zone-section": TEMPLATES.PARTIALS.ZONE_SECTION,
    dayBarDuty: TEMPLATES.PARTIALS.DAY_BAR_DUTY,
  });
}

/**
 * The qualities field, for every dialog that invents an item.
 *
 * **Qualities are what make a weapon roll.** The catalogue writes them as plain
 * text — `1d8`, `Melee`, `Missile (10'/20'/30')` — and the character sheet reads
 * the equipped weapons straight out of that. An item invented by hand or put on
 * a shop's shelf had no way to say any of it, so a Referee's own sword could be
 * carried but never swung. This is that way.
 *
 * It goes in **four** dialogs, not one: the GM's Add Item, the player's Add
 * Custom Item, the shop's grant-an-item, and the shop's own shelf. That lesson
 * is already written in this repo's history — the edible flag was put in one of
 * them and missed the three that mattered — so the four are listed here as a
 * reminder rather than rediscovered.
 */
export function buildQualitiesFieldHTML(current: string[] = [], id = "item-qualities"): string {
  return `<div class="form-group qm-qualities">
      <label for="${id}">Qualities</label>
      <div class="form-fields">
        <input type="text" id="${id}" value="${escapeHTML(current.join(", "))}"
               placeholder="e.g. 1d8, Melee, Two-handed" />
      </div>
      <p class="hint qm-qualities-hint" data-for="${id}">${escapeHTML(qualitiesHint())}</p>
      <p class="hint qm-qualities-read" data-read-for="${id}"></p>
    </div>`;
}

/**
 * Say back how the qualities were understood, as they are typed.
 *
 * Free text has to stay free — the whole point is that a table can invent a
 * weapon the books never printed — but free text makes a typo silent, and a
 * sword that quietly refuses to roll is worse than one that says why.
 */
export function activateQualitiesPreview(root: HTMLElement, id = "item-qualities"): void {
  const input = root.querySelector<HTMLInputElement>(`#${id}`);
  const readout = root.querySelector<HTMLElement>(`[data-read-for="${id}"]`);
  if (!input || !readout) return;

  const update = (): void => {
    const qualities = parseQualities(input.value);
    readout.textContent = qualities.length ? describeQualities(qualities) : "";
  };
  input.addEventListener("input", update);
  update();
}
