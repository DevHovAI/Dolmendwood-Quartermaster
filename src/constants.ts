export const MODULE_ID = "dolmenwood-party-inventory" as const;

export const FLAGS = {
  INVENTORY: "inventory",
  TRANSACTION_LOG: "transactionLog",
  // Marks an actor as a loot box. Loot boxes are many and disposable, so they
  // are found by this flag rather than tracked in a world setting the way the
  // single shared store is.
  LOOT: "loot",
} as const;

export const TEMPLATES = {
  PARTY_OVERVIEW: `modules/${MODULE_ID}/templates/party-overview.hbs`,
  PLAYER_INVENTORY: `modules/${MODULE_ID}/templates/player-inventory.hbs`,
  SHOP: `modules/${MODULE_ID}/templates/shop.hbs`,
  LOOT: `modules/${MODULE_ID}/templates/loot.hbs`,
  LOOT_BROWSER: `modules/${MODULE_ID}/templates/loot-browser.hbs`,
  INN: `modules/${MODULE_ID}/templates/inn.hbs`,
  TRASH: `modules/${MODULE_ID}/templates/trash.hbs`,
  DAY_BAR: `modules/${MODULE_ID}/templates/day-bar.hbs`,
  DAY_BAR_GROUP: `modules/${MODULE_ID}/templates/day-bar-group.hbs`,
  MARKET: `modules/${MODULE_ID}/templates/market.hbs`,
  CHARACTER_SHEET: `modules/${MODULE_ID}/templates/character-sheet.hbs`,
  PARTIALS: {
    INVENTORY_ZONE: `modules/${MODULE_ID}/templates/partials/inventory-zone.hbs`,
    ITEM_ROW: `modules/${MODULE_ID}/templates/partials/item-row.hbs`,
    COIN_DISPLAY: `modules/${MODULE_ID}/templates/partials/coin-display.hbs`,
    ENCUMBRANCE_BAR: `modules/${MODULE_ID}/templates/partials/encumbrance-bar.hbs`,
    TRANSACTION_LOG: `modules/${MODULE_ID}/templates/partials/transaction-log.hbs`,
    PARTY_SUMMARY: `modules/${MODULE_ID}/templates/partials/party-summary.hbs`,
    EXTRA_ZONE: `modules/${MODULE_ID}/templates/partials/extra-zone.hbs`,
    ZONE_COIN_PURSE: `modules/${MODULE_ID}/templates/partials/zone-coin-purse.hbs`,
    ZONE_SECTION: `modules/${MODULE_ID}/templates/partials/zone-section.hbs`,
    DAY_BAR_DUTY: `modules/${MODULE_ID}/templates/partials/day-bar-duty.hbs`,
  },
} as const;

export const SOCKET_EVENTS = {
  UPDATE_INVENTORY: "updateInventory",
  PURCHASE_ITEM: "purchaseItem",
  GM_GRANT: "gmGrant",
  GM_REMOVE: "gmRemove",
  GIVE_COINS: "giveCoins",
  GIVE_ZONE: "giveZone",
  SHARE_ZONE: "shareZone",
  REQUEST_REFRESH: "requestRefresh",
  INN_PURCHASE: "innPurchase",
  PURCHASE_SERVICE: "purchaseService",
  SELL_ITEM: "sellItem",
} as const;

export const SETTINGS = {
  PARTY_ACTOR_IDS: "partyActorIds",
  SHOP_STATE: "shopState",
  TRANSACTION_LOG: "transactionLog",
  INN_STATE: "innState",
  INN_CONFIGS: "innConfigs", // Record<innName, InnConfig> — each inn's own editable tables
  INN_DAY: "innDay", // in-game day counter; bumping it re-rolls every inn's menu
  INN_DAY_LOG: "innDayLog", // Record<actorId, {lodging?, food?}> — who has eaten and slept today
  LOCAL_HIDDEN: "localHidden", // Record<locationName, itemId[]> — per-location hidden items
  ENCUMBRANCE_MODE: "encumbranceMode", // "slots" | "weight"
  LOCAL_CUSTOM_ITEMS: "localCustomItems", // Record<shopName, ShopEntry[]> — a shop's own shelf, goods and services alike
  SERVICE_LIBRARY: "serviceLibrary", // ShopEntry[] — services the Referee can put in any shop
  SHOP_VISITS: "shopVisits", // Record<shopName, number> — bumping one re-rolls that shop's X-in-6 stock
  SHARED_ACTOR_ID: "sharedActorId", // Actor holding the party's shared containers ("" = not created yet)
  HIDE_DROPPED_ZONES: "hideDroppedZones", // per-user: collapse zones left behind
  HIDE_MANAGED_ACTORS: "hideManagedActors", // hide the shared store and loot boxes from players' Actors tab
  PLAYER_TOOLBAR_INN: "playerToolbarInn", // may players open the generic inn from the toolbar?
  PLAYER_TOOLBAR_LOOT: "playerToolbarLoot", // may players open the loot browser from the toolbar?
  PLAYER_TOOLBAR_TRASH: "playerToolbarTrash", // may players open the trash from the toolbar? (read-only for them)
  PLAYER_GENERIC_SHOP: "playerGenericShop", // may players open the place-less shop from the toolbar/day bar?
  PLAYER_ADD_CUSTOM_ITEM: "playerAddCustomItem", // may players invent items in their own inventory?
  SHOPS_NEED_PARTY_PRESENT: "shopsNeedPartyPresent", // must the party marker be where a shop/market/inn/loot note is?
  PARTY_MARKER_ACTOR: "partyMarkerActor", // name or id of the actor whose token stands for the party
  TRASH_LIMIT: "trashLimit", // how many deleted rows each actor's bin keeps before the oldest fall out
  DAY_STATE: "dayState", // the day's mode, which duties are ticked, and the rest-day counter
  SHOW_DAY_BAR: "showDayBar", // per-user: is the day bar on screen at all?
  FOLLOW_WORLD_TIME: "followWorldTime", // let a calendar module's midnight advance the day counter
  DAY_BAR_COLLAPSED: "dayBarCollapsed", // per-user: is the day bar folded down to its handle?
  DAY_CONTEXT: "dayContext", // where the party is and what season it is — sticky, survives the day roll-over
  BOOK_PLAYERS: "bookPlayers", // path, inside Foundry's data folder, to the reader's own Player's Book PDF
  BOOK_CAMPAIGN: "bookCampaign", // …the Campaign Book
  BOOK_MONSTERS: "bookMonsters", // …the Monster Book
  AUTO_OPEN_INVENTORY: "autoOpenInventory", // throw a player's inventory open when they log in
  PLAYER_DAY_BAR: "playerDayBar", // may players have a day bar of their own?
  BAR_ONLY_ACCESS: "barOnlyAccess", // reach the module's windows from the bar instead of the toolbar
  BOOKS_FOR_PLAYERS: "booksForPlayers", // which of the three books players may open: "none" | "players" | "all"
  BOOK_PAGE_OFFSET: "bookPageOffset", // PDF page = printed page + this; two pages of front matter in all three books
  HEX_FROM_TOKEN: "hexFromToken", // read the hex off the party's token, on maps that have been calibrated
  HEX_CALIBRATION: "hexCalibration", // Record<sceneId, {i, j, hex}> — one measured hex per map
} as const;

// Key under which the generic (non-map-note) shop stores its GM-added stock in
// SETTINGS.LOCAL_CUSTOM_ITEMS, which is otherwise keyed by shop name.
export const GENERIC_SHOP_KEY = "__generic_shop__" as const;

// Same idea for the toolbar inn, which has no name to key its tables by.
export const GENERIC_INN_KEY = "__generic_inn__" as const;

// Name and portrait of the auto-created actor that holds shared containers
export const SHARED_ACTOR_NAME = "Party Stores" as const;
export const SHARED_ACTOR_IMG = "icons/containers/bags/pack-leather-brown.webp" as const;

// Loot boxes: portrait and the zone every item and coin in a box lives in.
// One zone, because a hoard is a pile — nothing about it is worn or stowed.
export const LOOT_ACTOR_IMG = "icons/containers/chest/chest-worn-oak-tan.webp" as const;
export const LOOT_ZONE = "equipped" as const;

// How many deleted rows a single actor's bin holds. Old entries fall out the
// bottom rather than the bin growing without limit — it is an undo buffer, not
// an archive. The transaction log caps itself the same way.
export const TRASH_LIMIT_DEFAULT = 30 as const;

// A week of travel is six days on the move and one of rest (Player's Book
// p157), so six travel days between rests are owed nothing — it is the seventh
// that means the rest day was skipped, and that is where exhaustion starts.
export const TRAVEL_DAYS_PER_REST = 7 as const;

export const SOCKET_NAME = `module.${MODULE_ID}` as const;

// Encumbrance speed tiers: [minSlots, maxSlots, speed]
export const EQUIPPED_SPEED_TIERS: [number, number, 40 | 30 | 20 | 10][] = [
  [0, 3, 40],
  [4, 5, 30],
  [6, 7, 20],
  [8, 10, 10],
];

export const STOWED_SPEED_TIERS: [number, number, 40 | 30 | 20 | 10][] = [
  [0, 10, 40],
  [11, 12, 30],
  [13, 14, 20],
  [15, 16, 10],
];

// Weight encumbrance: [maxWeight (coins), speed]
export const WEIGHT_SPEED_TIERS: [number, 40 | 30 | 20 | 10][] = [
  [400, 40],
  [600, 30],
  [800, 20],
  [1600, 10],
];

export const TINY_ZONE_WEIGHT_CAPACITY = 50; // belt pouch coin capacity
