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
  id: string;       // UUID, used as zone value on items
  name: string;     // display name (e.g. "Pack Horse")
  maxSlots: number; // informational — does NOT affect speed
}

export interface CharacterInventory {
  actorId: string;
  coins: { cp: number; sp: number; gp: number; pp: number };
  items: InventoryItem[];
  extraZones?: ExtraZone[];
}

export interface ShopState {
  activeTags: string[];
  availableItems: string[];            // if non-empty, only these item IDs are shown
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

// Derived encumbrance result — never stored, always calculated
export interface EncumbranceResult {
  equippedSlots: number;
  stowedSlots: number;
  equippedSpeed: 40 | 30 | 20 | 10;
  stowedSpeed: 40 | 30 | 20 | 10;
  finalSpeed: 40 | 30 | 20 | 10;
  bottleneck: "equipped" | "stowed" | "both" | "none";
  tinyCount: number;
  freeTinySlots: number;               // max(0, 10 - tinyCount)
  tinyOverflow: number;                // tiny items beyond 10
  coinSlots: number;
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
}

export interface InnPurchasePayload {
  actorId: string;
  itemName: string;
  totalCost: { cp: number; sp: number; gp: number; pp: number };
}
