# Dolmendudes Quartermaster

A party inventory manager for **Dolmenwood** campaigns in **Foundry VTT v13**.

Tracks slot-based encumbrance, coins, a full Dolmenwood item catalog, and everything the party drags home from the wood — because someone has to keep count of the cheese.

---

## Features

### Party Overview (GM)
- See every party member's full inventory at a glance
- Live slot-based encumbrance per character, colour-coded by speed tier
- Click any character card to open their detailed inventory
- Party gear & wealth summary collapsed into a single panel
- Full transaction log of all purchases and transfers
- Launch the Shop directly from the overview

### Player Inventory
- Three inventory zones: **Tiny** (up to 10 free slots), **Equipped**, and **Stowed**
- **Extra Storage Zones** — GMs can add named zones such as *Pack Horse* or *Wagon*, each with its own slot counter; items move there via the zone dropdown and do **not** affect speed
- Live encumbrance bars update as items are moved or added
- **Give items** and **give coins** to other party members in one click
- Add fully custom items (players can add their own; GMs get the full catalog)
- Mark items as **secret** — hidden from other players; only the GM and item owner can see them
- Track remaining **uses** on consumable items (torches, arrows, etc.)
- Item notes field per item
- Auto-opens for players on login if a character is assigned

### Shop
- Full built-in catalog of Dolmenwood equipment (weapons, armour, camping gear, tools, clothing, and more)
- **Pipeleaf** — pipes and 20 blends with Dolmenwood-accurate prices
- **Animals & Vehicles** — horses, hounds, carts, wagons, barges, and accessories
- Filter by category tags, full-text search, and "show only affordable items" toggle
- Purchase items directly (deducts coins automatically) or grant them for free (GM)
- **Local Shops** via map Notes — configure a name and which categories a specific shop sells; clicking the Note opens the shop pre-filtered to that selection

### Inn
- Menus for **Lodgings**, **Stabling** (incl. horse feed), **Food**, and **Beverages**
- Three quality tiers: **Poor**, **Common**, **Fancy** — each with its own menu
- Paying deducts coins; nothing is added to inventory (inn services are consumed on the spot)
- Accessible via the **Inn toolbar button** or by clicking a flagged map Note

### Map Note Integration
Any Note on the canvas can be flagged as an Inn or a Shop:
1. Switch to the **Notes layer** (bookmark icon in the left toolbar)
2. Double-click a Note to open its config
3. Tick **Mark as Inn** or **Mark as Shop**, fill in the name and settings, and save
4. Clicking that Note from then on opens the Inn or Shop instead of the journal

### Multiplayer Sync
- All inventory writes are routed through the GM client via Foundry's socket system
- Ensures consistent, authoritative state for all connected players

---

## Installation

### From the Foundry module browser
1. **Add-on Modules → Install Module**
2. Paste the manifest URL:
   ```
   https://github.com/DevHovAI/Dolmendwood-Quartermaster/releases/latest/download/module.json
   ```
3. Click **Install**, then enable the module in your world's Module Settings

### Manual
Download the zip from the [latest release](https://github.com/DevHovAI/Dolmendwood-Quartermaster/releases/latest) and extract it into:
```
<foundry-data>/Data/modules/dolmenwood-party-inventory/
```

---

## Usage

### Opening windows

| Who | Action | Opens |
|-----|--------|-------|
| GM | Backpack toolbar button | Party Overview |
| GM | Inn toolbar button | Inn |
| GM | Shop button inside Party Overview | Shop |
| Player | Backpack toolbar button | Own Inventory |
| Player | Inn toolbar button | Inn |
| Anyone | Click a flagged map Note | Inn or Shop (per Note config) |

Players' inventories open automatically on login if a character is assigned to their user account.

### Extra Storage Zones (GM)
Open any player's inventory → click **Add Storage Zone** at the bottom → enter a name (e.g. *Pack Horse*) and slot count. The zone appears as a new section. Items can be moved there by selecting it in the zone dropdown on each item row. Deleting a zone moves its contents back to Stowed.

### Local Shop Notes
Open a Note config → tick **Mark as Shop** → enter a shop name → tick which **categories** this shop sells (leave all unticked to sell everything) → save. Clicking the Note opens the filtered shop.

### Inn Notes
Open a Note config → tick **Mark as Inn** → enter a name and quality tier → save. Clicking the Note opens the Inn with those settings.

### Macro API

```js
const qm = game.modules.get("dolmenwood-party-inventory").api;

qm.openPartyOverview();                          // GM only
qm.openPlayerInventory();                        // Current user's character
qm.openPlayerInventory("actorId");               // Specific actor by ID
qm.openShop();                                   // Global shop (all items)
qm.openShop("The Blacksmith", ["Weapons"]);      // Pre-configured local shop
qm.openInn();                                    // Inn (common quality)
qm.openInn("The Rusty Flagon", "poor");          // Pre-configured inn
```

---

## Compatibility

| Foundry VTT | Status |
|-------------|--------|
| v13 | ✅ Verified |

Designed specifically for the **Dolmenwood** game system. Encumbrance slots, item categories, and coin denominations (cp / sp / gp / pp) follow Dolmenwood Player's Book rules.

---

## Development

Built with **TypeScript + Vite**.

```bash
npm install
npm run dev      # watch mode — rebuilds to dist/ on save
npm run build    # production build
```

Symlink or copy `dist/` into your Foundry user data folder:
```
<foundry-data>/Data/modules/dolmenwood-party-inventory/ → dist/
```

### Project Structure

```
src/
  module.ts                  # Entry point, hooks, toolbar buttons, Note hooks, API
  constants.ts               # Template paths, socket events, setting keys
  types.ts                   # Shared TypeScript interfaces
  apps/
    PartyOverviewApp.ts      # GM party overview window
    PlayerInventoryApp.ts    # Per-player inventory window (incl. extra zones)
    ShopApp.ts               # Shop window with local-shop config support
    InnApp.ts                # Inn window
  data/
    FlagManager.ts           # Persistence via actor flags
    EncumbranceCalculator.ts # Slot + speed calculation
    CatalogManager.ts        # Catalog queries and filtering
    catalog.ts               # Full Dolmenwood item catalog (~150 items)
    innData.ts               # Inn menu data (lodgings, food, beverages)
    innPurchase.ts           # Inn coin-deduction handler (avoids circular deps)
  socket/
    SocketHandler.ts         # GM-authoritative socket sync
  helpers/
    handlebars.ts            # Handlebars helpers, partials registration, icon picker
templates/
  party-overview.hbs
  player-inventory.hbs
  shop.hbs
  inn.hbs
  partials/
    item-row.hbs
    inventory-zone.hbs
    extra-zone.hbs
    coin-display.hbs
    encumbrance-bar.hbs
    party-summary.hbs
    transaction-log.hbs
styles/
  module.css
```

---

## Changelog

### v1.1.2
- Fixed: Inn/Shop map Notes not opening the app when clicked (flag saving and hook parameter handling for Foundry v13)

### v1.1.1
- Fixed: `renderNoteConfig` crash (`a.find is not a function`) in Foundry v13

### v1.1.0
- New catalog categories: **Pipeleaf** (pipes + 20 blends) and **Animals & Vehicles**
- **Extra Storage Zones** — GM-created named zones per character that don't affect speed
- **Inn App** — lodgings, food, beverages, stabling; Poor/Common/Fancy quality tiers
- **Local Shops** — Note/map-marker integration with per-category item filtering

### v1.0.7
- Player self-service inventory, custom item icons & descriptions

### v1.0.6
- Party summary panel, RPG UI redesign, shop affordability filter, coin deduction fix

### v1.0.5
- Speed threshold markers on encumbrance bars

### v1.0.4
- Fix player permissions, coin slots, contrast; item restrictions

### v1.0.3
- Player shop access, coin gifting, toolbar button for all users

---

## License

MIT
