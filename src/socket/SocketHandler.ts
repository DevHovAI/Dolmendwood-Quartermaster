import { MODULE_ID, SOCKET_NAME, SOCKET_EVENTS, SETTINGS } from "../constants";
import { FlagManager, deductCoins, addCoinsToZone } from "../data/FlagManager";
import { CatalogManager } from "../data/CatalogManager";
import { processInnPurchase } from "../data/innPurchase";
import type {
  SocketPayload,
  GMGrantPayload,
  GMRemovePayload,
  GiveCoinsPayload,
  PurchasePayload,
  InnPurchasePayload,
  Transaction,
} from "../types";

export class SocketHandler {
  static initialize(): void {
    (game as Game).socket!.on(
      SOCKET_NAME,
      (payload: SocketPayload) => SocketHandler.handleIncoming(payload)
    );
  }

  /**
   * Emit a socket event to all clients (including ourselves, handled locally too).
   */
  static emit(event: string, data: unknown): void {
    const payload: SocketPayload = {
      event,
      data,
      userId: (game as Game).user!.id!,
    };
    (game as Game).socket!.emit(SOCKET_NAME, payload);
  }

  private static handleIncoming(payload: SocketPayload): void {
    const g = game as Game;
    switch (payload.event) {
      case SOCKET_EVENTS.GM_GRANT:
        // Only the GM actually writes to the actor — this runs on the GM client
        if (g.user?.isGM) {
          SocketHandler.onGMGrant(payload.data as GMGrantPayload);
        }
        break;

      case SOCKET_EVENTS.GM_REMOVE:
        if (g.user?.isGM) {
          SocketHandler.onGMRemove(payload.data as GMRemovePayload);
        }
        break;

      case SOCKET_EVENTS.PURCHASE_ITEM:
        // Purchase is processed by the GM to ensure authoritative write
        if (g.user?.isGM) {
          void SocketHandler.processPurchase(payload.data as PurchasePayload).then(() => {
            SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
          });
        }
        break;

      case SOCKET_EVENTS.GIVE_COINS:
        if (g.user?.isGM) {
          SocketHandler.onGiveCoins(payload.data as GiveCoinsPayload);
        }
        break;

      case SOCKET_EVENTS.REQUEST_REFRESH:
        SocketHandler.onRequestRefresh();
        break;

      case SOCKET_EVENTS.INN_PURCHASE:
        if (g.user?.isGM) {
          void processInnPurchase(payload.data as InnPurchasePayload).then(() => {
            SocketHandler.emit(SOCKET_EVENTS.REQUEST_REFRESH, {});
          });
        }
        break;
    }
  }

  private static async onGMGrant(data: GMGrantPayload): Promise<void> {
    const actor = (game as Game).actors?.get(data.actorId);
    if (!actor) return;
    const item = {
      ...data.item,
      id: foundry.utils.randomID(),
    };
    await FlagManager.updateInventory(actor, (inv) => {
      inv.items.push(item);
      return inv;
    });
    const tx: Transaction = {
      id: foundry.utils.randomID(),
      timestamp: Date.now(),
      type: "gm_grant",
      fromActorId: "shop",
      toActorId: data.actorId,
      items: [{ definitionId: item.definitionId, name: item.name, quantity: item.quantity }],
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

    const def = CatalogManager.getDefinition(data.definitionId);

    await FlagManager.updateInventory(actor, (inv) => {
      const costCp =
        (data.totalCost.cp ?? 0) +
        (data.totalCost.sp ?? 0) * 10 +
        (data.totalCost.gp ?? 0) * 100 +
        (data.totalCost.pp ?? 0) * 500;

      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      const canAfford = deductCoins(inv.coinsByZone, costCp);
      if (!canAfford && !data.gmOverride) return inv;

      inv.items.push({
        id: foundry.utils.randomID(),
        definitionId: data.definitionId,
        name: def?.name ?? data.definitionId,
        quantity: data.quantity,
        zone: data.zone,
        isSecret: false,
        notes: "",
      });

      if (def?.grantsZone) {
        inv.extraZones ??= [];
        inv.extraZones.push({
          id: foundry.utils.randomID(),
          name: def.grantsZone.name,
          maxSlots: def.grantsZone.maxSlots,
          weightCapacity: def.grantsZone.weightCapacity ?? 0,
        });
      }

      if (def?.grantsStorageZone) {
        const encMode = (game as Game).settings.get(MODULE_ID, SETTINGS.ENCUMBRANCE_MODE) ?? "slots";
        if (encMode === "weight") {
          // Override the container item's zone to "equipped" — it lives on the character
          const pushed = inv.items[inv.items.length - 1];
          if (pushed) pushed.zone = "equipped";
          inv.extraZones ??= [];
          inv.extraZones.push({
            id: foundry.utils.randomID(),
            name: def.grantsStorageZone.name,
            maxSlots: 0,
            weightCapacity: def.grantsStorageZone.weightCapacity,
            type: "storage" as const,
            selfWeight: def.weight ?? 0,
            itemId: pushed?.id,
            ...(def.grantsStorageZone.isBeltPouch ? { isBeltPouch: true } : {}),
          });
        }
      }

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
    await FlagManager.updateInventory(fromActor, (inv) => {
      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      deductCoins(inv.coinsByZone, costCp);
      return inv;
    });

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

  private static onRequestRefresh(): void {
    // Re-render any open module application windows
    for (const app of Object.values(foundry.applications?.instances ?? {})) {
      const id = (app as { id?: string }).id ?? "";
      if (id.startsWith("dolmenwood-")) {
        (app as { render?: () => void }).render?.();
      }
    }
  }
}
