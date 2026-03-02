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
}

export interface InventoryItem {
  id: string;                          // local unique ID (UUID)
  definitionId: string;                // reference to ItemDefinition (empty if fully custom)
  name: string;
  quantity: number;
  zone: "tiny" | "equipped" | "stowed";
  isSecret: boolean;
  notes: string;
  customDefinition?: Partial<ItemDefinition>;
}

export interface CharacterInventory {
  actorId: string;
  coins: { cp: number; sp: number; gp: number; pp: number };
  items: InventoryItem[];
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
