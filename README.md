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
1. Create a **Journal Entry** (it will never be shown — it only exists so players can interact with the note)
2. Switch to the **Notes layer** (bookmark icon in the left toolbar) and create a Note on the canvas
3. In the Note config, select the Journal Entry you just created
4. Tick **Mark as Inn** or **Mark as Shop**, fill in the name and settings, and save
5. Open the Journal Entry's permissions and set **All Players → Observer**
6. Double-clicking that Note now opens the Inn or Shop instead of the journal

> **Why the journal entry?** Foundry only lets players double-click a note if they have at least Observer permission on its linked document. The journal is never actually displayed — the Quartermaster intercepts the click before it opens.

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
1. Create a blank Journal Entry and set its permissions to **All Players → Observer**
2. Create a Note on the canvas, link the Journal Entry, tick **Mark as Shop**
3. Enter a shop name → tick which **categories** this shop sells (leave all unticked = sell everything) → save
4. Double-clicking the Note opens the filtered shop

### Inn Notes
1. Create a blank Journal Entry and set its permissions to **All Players → Observer**
2. Create a Note on the canvas, link the Journal Entry, tick **Mark as Inn**
3. Enter a name and quality tier → optionally tick which **categories** the inn serves → save
4. Double-clicking the Note opens the Inn with those settings

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

### v1.8.0
- **The catalogue holds what the books hold** — 273 entries added: the Player's Book's Common Fungi and Herbs (20), and the whole of the Campaign Book's Treasures and Oddments (253) across thirteen categories, from Rare Herbs to Magic Weapons. Every figure was rebuilt into the book's own line and checked against its page
- **Treasures are found, not bought** — everything imported carries `notSold`, so no shop stocks it by accident. A new **From Catalogue** button puts any catalogue item on a particular shop's shelf by hand: folded categories, a search, and a tick that takes a whole category
- **The hex is the key** — type the hex number on the day bar and the terrain, its Travel Point cost, the region and the chance of losing the way all follow from the Campaign Book. 195 hexes, 53 of which grow something the foraging tables know nothing about — and a successful forage rolls that too
- **A day bar for the players** — a slimmer strip carrying only what the characters would know: what the party is doing, Travel Points walked, the weather once it has been rolled, and their own hunger and rest. Optional, and the module's windows can be reached from it instead of from the toolbar
- **Per-entry delete in the trash** — throw one row away for good without emptying the bin
- Fixed: a shop or inn name containing a quotation mark no longer breaks the map-note form
- Fixed: an inn saved before rations were added shows them without needing its Extras reset

### v1.7.0
- **The day bar** — the Player's Book's per-day procedures on screen: Day start, Travel, Camp and Settlement, each with the duties that belong to it. Travel Points read off the party's Speed, the forced march, and per-character hunger, sleep and rest-day clocks
- **The duties roll themselves** — weather, getting lost, foraging, hunting and fishing all roll on the Campaign Book's own tables and write a card
- **Encounters, in the wilds and in town** — day and night, with 87 bestiary entries behind them: traits, situations, lairs, names, AC and Hit Points, and a button that puts the creature on the battle map
- **Your own copy of the books, one click away** — point the module at your PDFs and every page reference on a card opens Foundry's reader at that page
- **A trash** — deleted items are recoverable until the bin is emptied
- Verified on Foundry v14; minimum still v13

### v1.6.0
- **The inn, rebuilt** — per-house tables, a menu rolled fresh each day, and bottles and casks to take away
- **Loot boxes** — stage a hoard privately, release it to the party in one click
- **A shared party store** — group property that everyone can reach and write to
- **Multi-select and consumable bundles**, one quiver per row showing its fill level
- Moved to Foundry v13 types, with a `typecheck` script

### v1.5.x
- Drag-and-drop reordering, subcategory icons, item qualities, zone give and drop
- Party convoy speed, double draught teams, speed 0 as a real state
- A long run of fixes: ghost containers, unreachable coins, GM grants, player performance

### v1.2.0
- **Coin zone assignment** — coins are split into 100-coin purse slots that can be moved between zones (Tiny/Equipped/Stowed/Extra); encumbrance updates accordingly
- **Coin-storing items** — containers (backpack, belt pouch, caskets, chests, sack) now show a live "X/capacity" counter for how many coins they hold
- **Animals & Vehicles as zones only** — horses, hounds, carts, wagons, and boats no longer appear as items in zone lists; they only create storage zones (players can rename zones)
- **Hounds as companion zones** — all 8 hound breeds now grant a named 0-slot companion zone
- **Water vehicles** — canoe, fishing boat, and rowing boat now grant storage zones
- **Tiny zone restriction** — normal and large items can no longer be assigned to the Tiny zone via the dropdown
- **GM-only purchase override** — players who can't afford an item get a warning; only the GM can force-purchase (override)
- **Per-location hidden items** — GMs can hide individual items from players in local Inn/Shop views (stored per location name, separate from the global shop hide list)
- **Zone renaming** — owners (not just GMs) can rename their extra storage zones

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
