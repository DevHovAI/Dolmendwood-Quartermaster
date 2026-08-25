/**
 * Global aliases for type names this module used under the old v9 types.
 * fvtt-types exposes the same concepts under namespaced names; aliasing them
 * here keeps the call sites unchanged.
 */
import type { DeepPartial as FvttDeepPartial } from "@league-of-foundry-developers/foundry-vtt-types/utils";
import type { ShopState, Transaction, ItemDefinition, ShopEntry, CharacterInventory } from "./types";
import type { InnQuality } from "./data/innData";
import type { InnConfig } from "./data/innConfig";
import type { InnDayLog } from "./data/innMenu";
import type { DayState } from "./data/dayDuties";
import type { DayContext } from "./data/dayContext";

declare global {
  type DeepPartial<T extends object> = FvttDeepPartial<T>;
  /** Static DEFAULT_OPTIONS / constructor options. */
  type ApplicationV2Options = foundry.applications.api.ApplicationV2.Configuration;
  /** Per-render options — what _prepareContext and _onRender actually receive. */
  type ApplicationV2RenderOptions = foundry.applications.api.ApplicationV2.RenderOptions;
  /** Context object handed to _onRender. */
  type ApplicationV2RenderContext = foundry.applications.api.ApplicationV2.RenderContext;
  type SceneControl = foundry.applications.ui.SceneControls.Control;
  type SceneControlTool = foundry.applications.ui.SceneControls.Tool;
  type ModuleData = Module;

  /**
   * Declare this module's world settings so game.settings.get/set are typed.
   * Without this, fvtt-types only accepts the "core" namespace.
   * Keys must stay in sync with SETTINGS in constants.ts.
   */
  interface SettingConfig {
    "dolmenwood-party-inventory.shopState": ShopState;
    "dolmenwood-party-inventory.transactionLog": Transaction[];
    "dolmenwood-party-inventory.innState": { name: string; quality: InnQuality };
    "dolmenwood-party-inventory.innConfigs": Record<string, InnConfig>;
    "dolmenwood-party-inventory.innDay": number;
    "dolmenwood-party-inventory.innDayLog": InnDayLog;
    "dolmenwood-party-inventory.localHidden": Record<string, string[]>;
    "dolmenwood-party-inventory.localCustomItems": Record<string, ShopEntry[]>;
    "dolmenwood-party-inventory.serviceLibrary": ShopEntry[];
    "dolmenwood-party-inventory.shopVisits": Record<string, number>;
    "dolmenwood-party-inventory.encumbranceMode": "slots" | "weight";
    "dolmenwood-party-inventory.sharedActorId": string;
    "dolmenwood-party-inventory.hideDroppedZones": boolean;
    "dolmenwood-party-inventory.hideManagedActors": boolean;
    "dolmenwood-party-inventory.playerToolbarInn": boolean;
    "dolmenwood-party-inventory.playerToolbarLoot": boolean;
    "dolmenwood-party-inventory.playerToolbarTrash": boolean;
    "dolmenwood-party-inventory.playerGenericShop": boolean;
    "dolmenwood-party-inventory.playerAddCustomItem": boolean;
    "dolmenwood-party-inventory.shopsNeedPartyPresent": boolean;
    "dolmenwood-party-inventory.partyMarkerActor": string;
    "dolmenwood-party-inventory.trashLimit": number;
    "dolmenwood-party-inventory.dayState": DayState;
    "dolmenwood-party-inventory.showDayBar": boolean;
    "dolmenwood-party-inventory.followWorldTime": boolean;
    "dolmenwood-party-inventory.dayBarCollapsed": boolean;
    "dolmenwood-party-inventory.dayContext": DayContext;
    "dolmenwood-party-inventory.bookPlayers": string;
    "dolmenwood-party-inventory.bookCampaign": string;
    "dolmenwood-party-inventory.bookMonsters": string;
    "dolmenwood-party-inventory.bookPageOffset": number;
    "dolmenwood-party-inventory.booksForPlayers": "none" | "players" | "all";
    "dolmenwood-party-inventory.playerDayBar": boolean;
    "dolmenwood-party-inventory.autoOpenInventory": boolean;
    "dolmenwood-party-inventory.barOnlyAccess": boolean;
  }

  /** Declare the flags this module writes, so getFlag/setFlag are typed. */
  interface FlagConfig {
    Actor: {
      "dolmenwood-party-inventory": {
        inventory: CharacterInventory;
        /** Present only on loot boxes. Legacy boxes carry a bare `true`. */
        loot: true | { icon?: string };
      };
    };
    JournalEntry: {
      "dolmenwood-party-inventory": {
        /**
         * Marks a journal entry the module created purely as a map note's
         * permission vehicle, so deleting the loot box may clean it up. Entries
         * the GM made themselves carry no such flag and are left alone.
         */
        lootEntry: true;
      };
    };
  }
}

export {};
