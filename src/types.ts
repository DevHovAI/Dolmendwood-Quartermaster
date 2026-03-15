export interface ItemDefinition {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  size: "tiny" | "normal" | "large";
  cannotBeStowed: boolean;
  unit: "piece" | "meter" | "hour" | "portion" | "charge" | string;
  cost: { amount: number; currency: "cp" | "sp" | "gp" | "pp" };
  weight: number;
  description: string;
  icon?: string;
  qualities: string[];
  tags: string[];
  isCustom: boolean;
  maxUses?: number;       // if set, item instances track remaining uses (e.g. arrows, oil)
  grantsZone?: { name: string; maxSlots: number; weightCapacity: number; speed?: number };  // purchasing this item auto-adds a named storage zone
  grantsStorageZone?: { name: string; weightCapacity: number; isBeltPouch?: boolean };  // weight mode: purchasing creates a storage zone that counts toward character weight
  coinCapacity?: number;  // max coins this item can hold (display counter, no structural change)
}

export interface InventoryItem {
  id: string;                          // local unique ID (UUID)
  definitionId: string;                // reference to ItemDefinition (empty if fully custom)
  name: string;
  quantity: number;
  zone: "tiny" | "equipped" | "stowed" | (string & {});  // string & {} preserves autocomplete while allowing extra zone IDs
  isSecret: boolean;
  notes: string;
  uses?: number;                       // remaining uses (only for items where def.maxUses is set)
  customDefinition?: Partial<ItemDefinition>;
}

export interface ExtraZone {
  id: string;            // UUID, used as zone value on items
  name: string;          // display name (e.g. "Pack Horse")
  maxSlots: number;      // slot mode capacity — does NOT affect character speed
  weightCapacity: number; // weight mode capacity (in coins)
  type?: "vehicle" | "storage";  // undefined = "vehicle" for backward compat
  isBeltPouch?: boolean; // storage zone that acts as the tiny/belt-pouch zone in weight mode
  selfWeight?: number;   // weight of the container item itself (e.g. backpack = 50 coins wt)
  itemId?: string;       // ID of the inventory item that created this zone (for cleanup on deletion)
  speed?: number;        // base travel speed in ft (for animals/vehicles that affect convoy speed)
}

export interface ZoneCoins {
  cp: number;
  sp: number;
  gp: number;
  pp: number;
}

export interface CoinSlot {
  id: string;
  zone: string; // legacy — kept for backward-compat reading only
}

export interface CharacterInventory {
  actorId: string;
  coins: { cp: number; sp: number; gp: number; pp: number }; // always = sum of coinsByZone (synced on every write)
  items: InventoryItem[];
  extraZones?: ExtraZone[];
  coinSlots?: CoinSlot[];    // legacy — no longer written; kept so old saves don't lose data on first read
  coinsByZone?: Record<string, ZoneCoins>; // per-zone coin amounts; zone IDs: "tiny"|"equipped"|"stowed"|extraZoneId
}

export interface ShopState {
  activeTags: string[];
  availableItems: string[];            // if non-empty, only these item IDs are shown
  hiddenItems?: string[];              // item IDs hidden from players (GM-visible but dimmed)
}

export interface Transaction {
  id: string;
  timestamp: number;
  type: "purchase" | "trade" | "gm_grant" | "gm_remove";
  fromActorId: string | "shop";
  toActorId: string | "shop";
  items: { definitionId: string; name: string; quantity: number }[];
  coinsDelta: { actorId: string; cp: number; sp: number; gp: number; pp: number }[];
}

export interface AnimalSpeedInfo {
  zoneName: string;
  baseSpeed: number;
  usedWeight: number;
  capacity: number;
  isOverloaded: boolean;    // usedWeight > capacity && <= capacity * 2
  isOverCapacity: boolean;  // usedWeight > capacity * 2
  effectiveSpeed: number;   // baseSpeed, halved if overloaded, 0 if over capacity
}

// Derived encumbrance result — never stored, always calculated
export interface EncumbranceResult {
  mode: "slots" | "weight";
  finalSpeed: 40 | 30 | 20 | 10;
  // Slot mode fields
  equippedSlots: number;
  stowedSlots: number;
  equippedSpeed: 40 | 30 | 20 | 10;
  stowedSpeed: 40 | 30 | 20 | 10;
  bottleneck: "equipped" | "stowed" | "both" | "none";
  tinyCount: number;
  freeTinySlots: number;               // max(0, 10 - tinyCount)
  tinyOverflow: number;                // tiny items beyond 10
  coinSlots: number;
  // Weight mode fields
  totalWeight: number;
  equippedWeight: number;
  stowedWeight: number;
  tinyWeight: number;                  // weight in belt pouch (capacity: 50)
  // Animal/convoy speed
  animalSpeeds: AnimalSpeedInfo[];
  convoySpeed: number | null;          // null = no animals with speed; otherwise min effective speed
}

// Socket message payload
export interface SocketPayload<T = unknown> {
  event: string;
  data: T;
  userId: string;
}

// GM grant/remove payloads
export interface GMGrantPayload {
  actorId: string;
  item: Omit<InventoryItem, "id">;
}

export interface GMRemovePayload {
  actorId: string;
  itemId: string;
}

export interface GiveCoinsPayload {
  fromActorId: string;
  toActorId: string;
  cp: number;
  sp: number;
  gp: number;
  pp: number;
}

export interface PurchasePayload {
  actorId: string;
  definitionId: string;
  quantity: number;
  zone: InventoryItem["zone"];
  totalCost: { cp: number; sp: number; gp: number; pp: number };
  gmOverride?: boolean;
  customDef?: Partial<ItemDefinition>;  // inline definition for custom shop items not in the catalog
}

export interface InnPurchasePayload {
  actorId: string;
  itemName: string;
  totalCost: { cp: number; sp: number; gp: number; pp: number };
}

export interface MarketEntry {
  id: string;
  type: "shop" | "inn";
  name: string;
  description: string;
  icon?: string;                            // FA icon class, e.g. "fa-store"; falls back to type default
  categories: string[];                     // shop: [] = all categories; ignored for inn
  quality: "poor" | "common" | "fancy";     // inn only; ignored for shop
  priceFactor?: number;                     // percentage; 100 = normal (default)
}

export interface MarketFlag {
  name: string;
  entries: MarketEntry[];
}
