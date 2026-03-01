export const MODULE_ID = "dolmenwood-party-inventory" as const;

export const FLAGS = {
  INVENTORY: "inventory",
  TRANSACTION_LOG: "transactionLog",
} as const;

export const TEMPLATES = {
  PARTY_OVERVIEW: `modules/${MODULE_ID}/templates/party-overview.hbs`,
  PLAYER_INVENTORY: `modules/${MODULE_ID}/templates/player-inventory.hbs`,
  SHOP: `modules/${MODULE_ID}/templates/shop.hbs`,
  PARTIALS: {
    INVENTORY_ZONE: `modules/${MODULE_ID}/templates/partials/inventory-zone.hbs`,
    ITEM_ROW: `modules/${MODULE_ID}/templates/partials/item-row.hbs`,
    COIN_DISPLAY: `modules/${MODULE_ID}/templates/partials/coin-display.hbs`,
    ENCUMBRANCE_BAR: `modules/${MODULE_ID}/templates/partials/encumbrance-bar.hbs`,
    TRANSACTION_LOG: `modules/${MODULE_ID}/templates/partials/transaction-log.hbs`,
  },
} as const;

export const SOCKET_EVENTS = {
  UPDATE_INVENTORY: "updateInventory",
  PURCHASE_ITEM: "purchaseItem",
  GM_GRANT: "gmGrant",
  GM_REMOVE: "gmRemove",
  REQUEST_REFRESH: "requestRefresh",
} as const;

export const SETTINGS = {
  PARTY_ACTOR_IDS: "partyActorIds",
  SHOP_STATE: "shopState",
  TRANSACTION_LOG: "transactionLog",
} as const;

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
