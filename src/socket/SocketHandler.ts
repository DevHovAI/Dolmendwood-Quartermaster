import { MODULE_ID, SOCKET_NAME, SOCKET_EVENTS } from "../constants";
import { FlagManager, deductCoins, addCoinsToZone } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { processInnPurchase } from "../data/innPurchase";
import { processServicePurchase } from "../data/servicePurchase";
import { processSale } from "../data/shopSale";
import { addItemWithZones, getEncumbranceMode } from "../data/zoneGrants";
import { transferZone } from "../data/zoneTransfer";
import { ensureSharedActor } from "../data/sharedStore";
import { AMMO_CONTAINER_MAP } from "../data/consumables";
import type {
  SocketPayload,
  GMGrantPayload,
  GMRemovePayload,
  GiveCoinsPayload,
  GiveZonePayload,
  ShareZonePayload,
  PurchasePayload,
  InnPurchasePayload,
  ServicePurchasePayload,
  SellItemPayload,
  Transaction,
  InventoryItem,
  ItemDefinition,
} from "../types";

export class SocketHandler {
  static initialize(): void {
    (game as Game).socket!.on(
      SOCKET_NAME,
      (payload: SocketPayload) => SocketHandler.handleIncoming(payload)
    );
  }

  /**
   * Emit a socket event to the OTHER connected clients.
   * Foundry never delivers a message back to its own sender, so this alone does
   * not run the handler on this client — use emitOrHandle for GM-authoritative
   * actions that the GM may trigger themself.
   */
  static emit(event: string, data: unknown): void {
    const payload: SocketPayload = {
      event,
      data,
      userId: (game as Game).user!.id!,
    };
    (game as Game).socket!.emit(SOCKET_NAME, payload);
  }

  /**
   * Route a GM-authoritative action to whoever is allowed to perform the write.
   * On a player client the action is emitted so the GM carries it out; on the GM
   * client it runs directly, because the GM would never receive its own message.
   */
  static emitOrHandle(event: string, data: unknown): void {
    if ((game as Game).user?.isGM) {
      // The rejection has to be caught here or it lands as an unhandled promise
      // in the console and nowhere else: the caller has already returned, and a
      // failed write looks to the table exactly like a button that does nothing.
      void SocketHandler.runGMAction(event, data)
        .then(() => SocketHandler.onRequestRefresh())
        .catch((err: unknown) => {
          console.error(`${MODULE_ID} | ${event} failed`, err);
          ui.notifications?.error(
            `${event} failed: ${err instanceof Error ? err.message : String(err)}`
          );
        });
    } else {
      SocketHandler.emit(event, data);
      // A player's write needs a GM online to carry it out. Without one the
      // message goes nowhere and nothing at all happens, which is worth saying.
      const activeGM = ((game as Game).users as unknown as { activeGM?: unknown } | undefined)
        ?.activeGM;
      if (!activeGM) {
        ui.notifications?.warn("No GM is connected, so that could not be carried out.");
      }
    }
  }

  private static handleIncoming(payload: SocketPayload): void {
    if (payload.event === SOCKET_EVENTS.REQUEST_REFRESH) {
      SocketHandler.onRequestRefresh();
      return;
    }
    // Every remaining event writes to an actor, which only the GM may do
    if (!(game as Game).user?.isGM) return;
    void SocketHandler.runGMAction(payload.event, payload.data)
      .then(() => SocketHandler.onRequestRefresh());
  }

  // Serializes GM writes. updateInventory is read-modify-write, so two actions
  // running concurrently would read the same state and the later write would
  // silently discard the earlier one.
  private static queue: Promise<unknown> = Promise.resolve();

  private static runGMAction(event: string, data: unknown): Promise<void> {
    const next = SocketHandler.queue.then(() => SocketHandler.dispatchGMAction(event, data));
    SocketHandler.queue = next.catch(() => undefined);
    return next;
  }

  private static async dispatchGMAction(event: string, data: unknown): Promise<void> {
    switch (event) {
      case SOCKET_EVENTS.GM_GRANT:
        await SocketHandler.onGMGrant(data as GMGrantPayload);
        break;

      case SOCKET_EVENTS.GM_REMOVE:
        await SocketHandler.onGMRemove(data as GMRemovePayload);
        break;

      case SOCKET_EVENTS.GIVE_COINS:
        await SocketHandler.onGiveCoins(data as GiveCoinsPayload);
        break;

      case SOCKET_EVENTS.GIVE_ZONE:
        await SocketHandler.onGiveZone(data as GiveZonePayload);
        break;

      case SOCKET_EVENTS.SHARE_ZONE:
        await SocketHandler.onShareZone(data as ShareZonePayload);
        break;

      case SOCKET_EVENTS.PURCHASE_ITEM:
        await SocketHandler.processPurchase(data as PurchasePayload);
        SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
        break;

      case SOCKET_EVENTS.INN_PURCHASE:
        await processInnPurchase(data as InnPurchasePayload);
        SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
        break;

      case SOCKET_EVENTS.PURCHASE_SERVICE:
        await processServicePurchase(data as ServicePurchasePayload);
        SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
        break;

      case SOCKET_EVENTS.SELL_ITEM:
        await processSale(data as SellItemPayload);
        SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
        break;
    }
  }

  private static async onGMGrant(data: GMGrantPayload): Promise<void> {
    const actor = (game as Game).actors?.get(data.actorId);
    if (!actor) return;

    const ammoInfo = AMMO_CONTAINER_MAP[data.item.definitionId];
    if (ammoInfo) {
      // Single ammo grant: fill existing containers or create new ones
      await FlagManager.updateInventory(actor, (inv) => {
        let remaining = data.item.quantity;
        for (const item of inv.items) {
          if (item.definitionId !== ammoInfo.containerId) continue;
          const currentUses = item.uses ?? ammoInfo.maxUses;
          const freeSpace = ammoInfo.maxUses - currentUses;
          if (freeSpace <= 0) continue;
          const toAdd = Math.min(freeSpace, remaining);
          item.uses = currentUses + toAdd;
          remaining -= toAdd;
          if (remaining <= 0) return inv;
        }
        const containerDef = CatalogManager.getDefinition(ammoInfo.containerId);
        while (remaining > 0) {
          const toAdd = Math.min(ammoInfo.maxUses, remaining);
          inv.items.push({
            id: foundry.utils.randomID(),
            definitionId: ammoInfo.containerId,
            name: containerDef?.name ?? ammoInfo.containerId,
            quantity: 1,
            zone: data.item.zone,
            isSecret: false,
            notes: "",
            uses: toAdd,
          });
          remaining -= toAdd;
        }
        return inv;
      });
    } else {
      const grantedItem: InventoryItem = { ...data.item, id: foundry.utils.randomID() };
      const def = CatalogManager.getDefinition(grantedItem.definitionId) ?? (grantedItem.customDefinition as import("../types").ItemDefinition | undefined);

      await FlagManager.updateInventory(actor, (inv) => {
        // Creates the animal/vehicle or container zone this item grants, if any
        addItemWithZones(inv, grantedItem, getEncumbranceMode(), def);
        return inv;
      });
    }
    const tx: Transaction = {
      id: foundry.utils.randomID(),
      timestamp: Date.now(),
      type: "gm_grant",
      fromActorId: "shop",
      toActorId: data.actorId,
      items: [{ definitionId: data.item.definitionId, name: data.item.name, quantity: data.item.quantity }],
      coinsDelta: [],
    };
    await FlagManager.appendTransaction(tx);
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
  }

  private static async onGMRemove(data: GMRemovePayload): Promise<void> {
    const actor = (game as Game).actors?.get(data.actorId);
    if (!actor) return;
    let removedItem: { definitionId: string; name: string; quantity: number } | undefined;
    await FlagManager.updateInventory(actor, (inv) => {
      const idx = inv.items.findIndex((i) => i.id === data.itemId);
      if (idx !== -1) {
        const [removed] = inv.items.splice(idx, 1);
        removedItem = { definitionId: removed.definitionId, name: removed.name, quantity: removed.quantity };
      }
      return inv;
    });
    if (removedItem) {
      const tx: Transaction = {
        id: foundry.utils.randomID(),
        timestamp: Date.now(),
        type: "gm_remove",
        fromActorId: data.actorId,
        toActorId: "shop",
        items: [removedItem],
        coinsDelta: [],
      };
      await FlagManager.appendTransaction(tx);
    }
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
  }

  static async processPurchase(data: PurchasePayload): Promise<void> {
    const actor = (game as Game).actors?.get(data.actorId);
    if (!actor) return;

    const def: ItemDefinition | undefined =
      CatalogManager.getDefinition(data.definitionId) ?? (data.customDef as ItemDefinition | undefined);

    await FlagManager.updateInventory(actor, (inv) => {
      const costCp =
        (data.totalCost.cp ?? 0) +
        (data.totalCost.sp ?? 0) * 10 +
        (data.totalCost.gp ?? 0) * 100 +
        (data.totalCost.pp ?? 0) * 500;

      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      const canAfford = deductCoins(inv.coinsByZone, costCp);
      if (!canAfford && !data.gmOverride) return inv;

      // Single ammo purchase: add to existing container or create a new one
      const ammoInfo = AMMO_CONTAINER_MAP[data.definitionId];
      if (ammoInfo) {
        let remaining = data.quantity;
        // Fill existing containers that have space
        for (const item of inv.items) {
          if (item.definitionId !== ammoInfo.containerId) continue;
          const currentUses = item.uses ?? ammoInfo.maxUses;
          const freeSpace = ammoInfo.maxUses - currentUses;
          if (freeSpace <= 0) continue;
          const toAdd = Math.min(freeSpace, remaining);
          item.uses = currentUses + toAdd;
          remaining -= toAdd;
          if (remaining <= 0) return inv;
        }
        // Create new containers for remaining ammo
        const containerDef = CatalogManager.getDefinition(ammoInfo.containerId);
        while (remaining > 0) {
          const toAdd = Math.min(ammoInfo.maxUses, remaining);
          inv.items.push({
            id: foundry.utils.randomID(),
            definitionId: ammoInfo.containerId,
            name: containerDef?.name ?? ammoInfo.containerId,
            quantity: 1,
            zone: data.zone,
            isSecret: false,
            notes: "",
            uses: toAdd,
          });
          remaining -= toAdd;
        }
        return inv;
      }

      const isCustomShopItem = !CatalogManager.getDefinition(data.definitionId) && !!data.customDef;
      // Creates the animal/vehicle or container zone this item grants, if any
      addItemWithZones(
        inv,
        {
          id: foundry.utils.randomID(),
          definitionId: data.definitionId,
          name: def?.name ?? data.definitionId,
          quantity: data.quantity,
          zone: data.zone,
          isSecret: false,
          notes: "",
          ...(isCustomShopItem ? { customDefinition: data.customDef } : {}),
        },
        getEncumbranceMode(),
        def
      );

      return inv;
    });

    const tx: Transaction = {
      id: foundry.utils.randomID(),
      timestamp: Date.now(),
      type: "purchase",
      fromActorId: "shop",
      toActorId: data.actorId,
      items: [{ definitionId: data.definitionId, name: def?.name ?? data.definitionId, quantity: data.quantity }],
      coinsDelta: [
        {
          actorId: data.actorId,
          cp: -data.totalCost.cp,
          sp: -data.totalCost.sp,
          gp: -data.totalCost.gp,
          pp: -data.totalCost.pp,
        },
      ],
    };
    await FlagManager.appendTransaction(tx);
  }

  private static async onGiveCoins(data: GiveCoinsPayload): Promise<void> {
    const g = game as Game;
    const fromActor = g.actors?.get(data.fromActorId);
    const toActor = g.actors?.get(data.toActorId);
    if (!fromActor || !toActor) return;

    const costCp = data.cp + data.sp * 10 + data.gp * 100 + data.pp * 500;
    // The dialog clamps against what the giver had when it was opened, so by the
    // time Give is clicked the money may be gone. Without this check the target
    // would still be credited and the coins would be minted out of nothing.
    let paid = false;
    await FlagManager.updateInventory(fromActor, (inv) => {
      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      paid = deductCoins(inv.coinsByZone, costCp);
      return inv;
    });
    if (!paid) {
      ui.notifications?.warn(`${fromActor.name} no longer has that much money.`);
      return;
    }

    await FlagManager.updateInventory(toActor, (inv) => {
      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      addCoinsToZone(inv.coinsByZone, { cp: data.cp, sp: data.sp, gp: data.gp, pp: data.pp });
      return inv;
    });

    const tx: Transaction = {
      id: foundry.utils.randomID(),
      timestamp: Date.now(),
      type: "trade",
      fromActorId: data.fromActorId,
      toActorId: data.toActorId,
      items: [],
      coinsDelta: [
        { actorId: data.fromActorId, cp: -data.cp, sp: -data.sp, gp: -data.gp, pp: -data.pp },
        { actorId: data.toActorId, cp: data.cp, sp: data.sp, gp: data.gp, pp: data.pp },
      ],
    };
    await FlagManager.appendTransaction(tx);
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
  }

  private static async onGiveZone(data: GiveZonePayload): Promise<void> {
    const g = game as Game;
    const fromActor = g.actors?.get(data.fromActorId);
    const toActor = g.actors?.get(data.toActorId);
    if (!fromActor || !toActor) return;
    await SocketHandler.moveZoneAndLog(fromActor, toActor, data.zoneId);
  }

  /**
   * Share a zone with the whole party. Reaches the GM only when the shared actor
   * does not exist yet — creating an actor is a GM-only operation. Once it
   * exists, players write to it themselves (they are OWNER) and never get here.
   */
  private static async onShareZone(data: ShareZonePayload): Promise<void> {
    const g = game as Game;
    const fromActor = g.actors?.get(data.fromActorId);
    if (!fromActor) return;
    const shared = await ensureSharedActor();
    if (!shared) return;
    await SocketHandler.moveZoneAndLog(fromActor, shared, data.zoneId, { clearSecret: true });
  }

  /** transferZone plus the transaction-log entry both callers need. */
  static async moveZoneAndLog(
    fromActor: Actor,
    toActor: Actor,
    zoneId: string,
    options: { clearSecret?: boolean } = {}
  ): Promise<void> {
    const result = await transferZone(fromActor, toActor, zoneId, options);
    if (!result) return;

    const { items: movedItems, coins: movedCoins } = result;
    const hasCoins = movedCoins.cp + movedCoins.sp + movedCoins.gp + movedCoins.pp > 0;
    const tx: Transaction = {
      id: foundry.utils.randomID(),
      timestamp: Date.now(),
      type: "trade",
      fromActorId: fromActor.id ?? "",
      toActorId: toActor.id ?? "",
      items: movedItems.map((i) => ({ definitionId: i.definitionId, name: i.name, quantity: i.quantity })),
      coinsDelta: hasCoins
        ? [
            { actorId: fromActor.id ?? "", cp: -movedCoins.cp, sp: -movedCoins.sp, gp: -movedCoins.gp, pp: -movedCoins.pp },
            { actorId: toActor.id ?? "", cp: movedCoins.cp, sp: movedCoins.sp, gp: movedCoins.gp, pp: movedCoins.pp },
          ]
        : [],
    };
    // The log lives in a world setting, which only a GM may write. Players can
    // reach this directly when sharing into the shared actor they own.
    if ((game as Game).user?.isGM) await FlagManager.appendTransaction(tx);
    SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
  }

  static onRequestRefresh(): void {
    // Re-render any open module application windows.
    // instances is a Map — Object.values() on it always yields an empty array.
    const instances = foundry.applications?.instances;
    if (!instances) return;
    for (const app of instances.values()) {
      const id = (app as { id?: string }).id ?? "";
      if (id.startsWith("dolmenwood-")) {
        (app as { render?: () => void }).render?.();
      }
    }
  }
}
