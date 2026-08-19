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
  /**
   * One object per row with its own fill level, shown as "7/10" — the way a
   * quiver behaves. Without it an item with maxUses is treated as a bundle: one
   * running total of loose units that keeps counting past a single container's
   * capacity. Quivers and quarrel cases get this from AMMO_CONTAINER_MAP by
   * their catalog id; the inn's bottles and casks set it on their own definition.
   */
  singleContainer?: boolean;
  grantsZone?: { name: string; maxSlots: number; weightCapacity: number; speed?: number };  // purchasing this item auto-adds a named storage zone
  grantsStorageZone?: {name: string; weightCapacity: number; isBeltPouch?: boolean; allowedItemTags?: string[]; };  // weight mode: purchasing creates a storage zone that counts toward character weight
  coinCapacity?: number;  // max coins this item can hold (display counter, no structural change)
  /**
   * The row gets an Eat button, and eating it feeds the character for the day.
   * Only the two ration entries carry this in the catalogue; custom items get it
   * from a checkbox, so a GM inventing a wheel of cheese need not touch code.
   */
  edible?: boolean;
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

/**
 * A row that was deleted, kept so it can be put back.
 *
 * The item is stored exactly as it stood, `zone` included, so restoring lands
 * it where it came from. `zoneName` is resolved at deletion time rather than on
 * display, because the zone itself may be gone by then — deleting a backpack
 * puts the backpack in the bin and takes its zone with it.
 */
export interface TrashedItem {
  entryId: string;      // identifies the bin entry; item.id is the row's original id
  item: InventoryItem;
  deletedAt: number;    // epoch ms
  deletedBy: string;    // user name at the time of deletion
  zoneName: string;     // label of the zone it was deleted from
}

/**
 * What one character has done today and what they owe themselves.
 *
 * Hunger and exhaustion are per character in the rules, so the counters are too.
 * `ate` and `slept` are about the day named in `day`; the counters carry across
 * days and are only ever advanced by the day roll-over.
 */
export interface CharacterDay {
  day: number;                 // the in-game day ate/sleptWell refer to
  ate: boolean;
  /** A *good* night's rest, not merely lying down — see Player's Book p159. */
  sleptWell: boolean;
  daysWithoutFood: number;     // consecutive days ending yesterday
  daysWithoutSleep: number;    // exhaustion: -1 per day until a good night's rest
  travelDaysSinceRest: number;
  /**
   * Forced marches since the last full rest day. Each one is a further -1 to
   * Attack and Damage until the party rests (Player's Book p156).
   */
  forcedMarchesSinceRest: number;
}

export interface ExtraZone {
  id: string;            // UUID, used as zone value on items
  name: string;          // display name (e.g. "Pack Horse")
  maxSlots: number;      // slot mode capacity — does NOT affect character speed
  weightCapacity: number; // weight mode capacity (in coins)
  type?: "vehicle" | "storage";  // undefined = "vehicle" for backward compat
  isBeltPouch?: boolean; // storage zone that acts as the tiny/belt-pouch zone in weight mode
  allowedItemTags?: string[];
  selfWeight?: number;   // weight of the container item itself (e.g. backpack = 50 coins wt)
  itemId?: string;       // ID of the inventory item that created this zone (for cleanup on deletion)
  speed?: number;        // base travel speed in ft (for animals/vehicles that affect convoy speed)
  isVehicle?: boolean;   // true for carts, wagons, boats
  doubleTeam?: boolean;  // land vehicle hitched to twice the draught animals — doubles cargo capacity
  isDropped?: boolean;   // zone is "left behind" — greyed out, excluded from weight and speed
  icon?: string;         // FA icon class, e.g. "fa-backpack"; falls back to type default
  color?: string;        // zone header color key: "green" | "brown" | "navy" | "purple" | "slate" | "crimson" | "teal"
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
  trash?: TrashedItem[];     // deleted rows, newest last; never counts toward encumbrance
  day?: CharacterDay;        // today's eating and sleeping, plus the hunger and rest clocks
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
  zoneIcon?: string;        // FA icon class from the zone (e.g. "fa-horse", "fa-caravan")
  baseSpeed: number;
  usedWeight: number;
  capacity: number;
  isOverloaded: boolean;    // animals only: usedWeight > capacity && <= capacity * 2
  isOverCapacity: boolean;  // animals only: usedWeight > capacity * 2
  isOverWeight: boolean;    // vehicles only: usedWeight > capacity (informational, no speed penalty)
  effectiveSpeed: number;   // baseSpeed, halved if overloaded, 0 if over capacity
}

// Derived encumbrance result — never stored, always calculated
export interface EncumbranceResult {
  mode: "slots" | "weight";
  // Speeds are plain numbers, not the tier union: a half-speed animal produces
  // 15, and 0 means the load cannot be moved at all.
  finalSpeed: number;
  // Slot mode fields
  equippedSlots: number;
  stowedSlots: number;
  equippedSpeed: number;
  stowedSpeed: number;
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
  footSpeed: number;                   // speed from carried load alone, before any animal clamp; 0 = over max load
  animalSpeeds: AnimalSpeedInfo[];
  convoySpeed: number | null;          // null = no animals with speed; otherwise min effective speed
}

// Slowest marching speed across the whole party — computed per render, never stored
export interface PartyConvoy {
  speed: number;
  slowestName: string;                 // character or animal/vehicle that sets the pace
  slowestKind: "character" | "animal";
  slowestOwner: string;                // character carrying the slow animal (= slowestName for characters)
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

export interface GiveZonePayload {
  fromActorId: string;
  toActorId: string;
  zoneId: string;
}

export interface ShareZonePayload {
  fromActorId: string;
  zoneId: string;
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
  /** Who pays. */
  actorId: string;
  /** Who it is for — the same character unless someone bought a round. */
  forActorId: string;
  itemName: string;
  /** Which part of the menu, so the day's log knows whether it was a bed or a meal. */
  section: "lodging" | "food" | "beverages" | "extras";
  totalCost: { cp: number; sp: number; gp: number; pp: number };
  /**
   * A bottle or cask to hand over — the one inn purchase that is carried away
   * rather than consumed on the spot. It goes to `forActorId`, and its `zone`
   * is where the buyer chose to put it. Absent for everything else.
   */
  item?: InventoryItem;
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
