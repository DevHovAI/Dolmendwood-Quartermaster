import { TEMPLATES } from "../constants";
import { speedColorClass } from "../data/EncumbranceCalculator";

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
  { icon: "fa-backpack",  label: "Backpack" },
  { icon: "fa-sack",      label: "Sack / Pouch" },
  { icon: "fa-box",       label: "Chest / Box" },
  { icon: "fa-horse",     label: "Horse" },
  { icon: "fa-caravan",   label: "Wagon / Cart" },
  { icon: "fa-dog",       label: "Dog" },
  { icon: "fa-ship",      label: "Boat / Ship" },
];

export const ZONE_COLORS: { key: string; label: string; bg: string; text: string }[] = [
  { key: "green",   label: "Green (default)",  bg: "linear-gradient(135deg, #1a3d1a 0%, #2e6b2e 100%)", text: "#c8e6c8" },
  { key: "brown",   label: "Brown",            bg: "linear-gradient(135deg, #3d1f0a 0%, #6b3515 100%)", text: "#e8c898" },
  { key: "navy",    label: "Navy",             bg: "linear-gradient(135deg, #0a1f3d 0%, #153565 100%)", text: "#a8c8e8" },
  { key: "purple",  label: "Purple",           bg: "linear-gradient(135deg, #2a0a3d 0%, #4a1565 100%)", text: "#d0a8e8" },
  { key: "slate",   label: "Slate",            bg: "linear-gradient(135deg, #1f2a30 0%, #2e4050 100%)", text: "#a8c8d8" },
  { key: "crimson", label: "Crimson",          bg: "linear-gradient(135deg, #3d0a0a 0%, #651515 100%)", text: "#e8a8a8" },
  { key: "teal",    label: "Teal",             bg: "linear-gradient(135deg, #0a3d30 0%, #156550 100%)", text: "#a8e0d0" },
];

export function buildColorPickerHTML(selectedColor = "green"): string {
  const buttons = ZONE_COLORS.map((c) =>
    `<button type="button" class="color-picker-btn${c.key === selectedColor ? " selected" : ""}" ` +
    `data-color="${c.key}" title="${c.label}" style="background:${c.bg};"></button>`
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

export function buildIconPickerHTML(selectedIcon = "fa-sack", icons = ITEM_ICONS): string {
  const buttons = icons.map(
    (i) =>
      `<button type="button" class="icon-picker-btn${i.icon === selectedIcon ? " selected" : ""}" ` +
      `data-icon="${i.icon}" title="${i.label}"><i class="fas ${i.icon}"></i></button>`
  ).join("");
  return (
    `<div class="icon-picker">${buttons}</div>` +
    `<input type="hidden" id="custom-icon-value" value="${selectedIcon}" />`
  );
}

export function activateIconPicker(html: JQuery): void {
  html.find(".icon-picker-btn").on("click", function (e) {
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    html.find(".icon-picker-btn").removeClass("selected");
    btn.classList.add("selected");
    html.find("#custom-icon-value").val(btn.dataset.icon ?? "fa-sack");
  });
}

export function registerHandlebarsHelpers(): void {
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
  Handlebars.registerHelper(
    "speedColor",
    (speed: 40 | 30 | 20 | 10) => speedColorClass(speed)
  );

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

  // Bottleneck label
  Handlebars.registerHelper("bottleneckLabel", (bottleneck: string) => {
    switch (bottleneck) {
      case "equipped": return "Equipped";
      case "stowed": return "Stowed";
      case "both": return "Both";
      default: return "";
    }
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

  // Size label
  Handlebars.registerHelper("sizeLabel", (size: string) => {
    switch (size) {
      case "tiny": return "Tiny";
      case "normal": return "Normal";
      case "large": return "Large";
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
    const cat = (category ?? "").toLowerCase();
    if (cat === "animals & vehicles") {
      return subcategoryToIcon(subcategory);
    }
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
  });
}

export async function registerHandlebarsPartials(): Promise<void> {
  await loadTemplates({
    "transaction-log": TEMPLATES.PARTIALS.TRANSACTION_LOG,
    "inventory-zone": TEMPLATES.PARTIALS.INVENTORY_ZONE,
    "item-row": TEMPLATES.PARTIALS.ITEM_ROW,
    "coin-display": TEMPLATES.PARTIALS.COIN_DISPLAY,
    "encumbrance-bar": TEMPLATES.PARTIALS.ENCUMBRANCE_BAR,
    "party-summary": TEMPLATES.PARTIALS.PARTY_SUMMARY,
    "extra-zone": TEMPLATES.PARTIALS.EXTRA_ZONE,
    "zone-coin-purse": TEMPLATES.PARTIALS.ZONE_COIN_PURSE,
  });
}
