# Dolmendudes Quartermaster

A party inventory manager for **Dolmenwood** campaigns in **Foundry VTT v13**.

Built for the Dolmendudes — because someone has to keep track of all that cheese, rope, and dubious loot.

---

## Features

### Party Overview (GM)
- See every party member's full inventory at a glance
- Real-time slot-based encumbrance tracking per character
- Open any player's detailed inventory from the overview
- Add or remove characters from the active party
- Launch the shop directly from the overview window

### Player Inventory
- Slot-based inventory with zones: **Readied**, **Stowed**, and **Drop** (overflow)
- Add, remove, and adjust quantities for any item
- Mark items as **secret** — hidden from other players, visible only to the GM and item owner
- **Give items** to other party members with one click
- Encumbrance bar updates live as items are added or moved
- Auto-opens for players when they join the session (if a character is assigned)

### Shop (GM)
- Browse a built-in catalog of Dolmenwood equipment, weapons, and supplies
- Filter the catalog by **tags** (e.g. weapons, tools, provisions)
- Full-text search across the catalog
- Purchase items directly into a party member's inventory, deducting coin automatically
- Grant items for free as GM gifts
- Add fully custom items not in the catalog

### Multiplayer Sync
- All inventory changes are routed through the GM via Foundry's socket system
- Ensures consistent, authoritative state for all players

---

## Installation

1. In Foundry VTT, go to **Add-on Modules → Install Module**
2. Paste the manifest URL:
   ```
   https://github.com/DevHovAI/Dolmendwood-Quartermaster/releases/latest/download/module.json
   ```
3. Click **Install**, then enable the module in your world's Module Settings

---

## Usage

### Opening the windows

**GM:**
- Click the **backpack icon** in the Token scene controls toolbar to open the Party Overview
- From the Party Overview, use the **Shop** button or click any character to open their inventory

**Players:**
- Your inventory opens automatically when you connect (if a character is assigned to your user)

### Macro API

The module exposes an API for use in macros:

```js
const qm = game.modules.get("dolmenwood-party-inventory").api;

qm.openPartyOverview();            // GM only
qm.openShop();                     // GM only
qm.openPlayerInventory();          // Opens current user's character
qm.openPlayerInventory("actorId"); // Opens a specific actor by ID
```

### Managing the Party

In the Party Overview, click **Manage Party** to add or remove actors from the tracked group. Only actors in the party list appear in the overview and can receive shop purchases.

---

## Compatibility

| Foundry VTT | Status |
|-------------|--------|
| v13         | Verified |

Designed specifically for the **Dolmenwood** game system. Encumbrance slots and item categories follow Dolmenwood rules.

---

## Development

Built with TypeScript + Vite.

```bash
npm install
npm run dev      # watch mode — outputs to dist/
npm run build    # production build
```

Symlink or copy `dist/` into your Foundry user data:
```
<foundry-data>/Data/modules/dolmenwood-party-inventory/
```

### Project Structure

```
src/
  module.ts              # Entry point, hooks, and API
  apps/
    PartyOverviewApp.ts  # GM party overview window
    PlayerInventoryApp.ts# Per-player inventory window
    ShopApp.ts           # GM shop window
  data/
    FlagManager.ts       # Persistence via actor flags
    EncumbranceCalculator.ts
    CatalogManager.ts
    catalog.ts           # Built-in Dolmenwood item catalog
  socket/
    SocketHandler.ts     # GM-authoritative socket sync
  helpers/
    handlebars.ts        # Template helpers and partials
templates/               # Handlebars templates
styles/                  # CSS
```

---

## License

MIT
