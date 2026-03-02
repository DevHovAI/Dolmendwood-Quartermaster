import { TEMPLATES } from "../constants";
import { speedColorClass } from "../data/EncumbranceCalculator";

export function registerHandlebarsHelpers(): void {
  // Equality check — used in templates: {{#if (eq a b)}}
  Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

  // Not-equal check
  Handlebars.registerHelper("neq", (a: unknown, b: unknown) => a !== b);

  // Greater-than check
  Handlebars.registerHelper("gt", (a: number, b: number) => a > b);

  // Less-than check
  Handlebars.registerHelper("lt", (a: number, b: number) => a < b);

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
  Handlebars.registerHelper("itemIcon", (category: string) => {
    switch ((category ?? "").toLowerCase()) {
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
  });
}
