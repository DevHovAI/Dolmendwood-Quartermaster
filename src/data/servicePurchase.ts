import { FlagManager, deductCoins } from "./FlagManager";
import { escapeHTML } from "../helpers/handlebars";
import { CURRENCY_IN_CP as IN_CP } from "./coins";
import type { ServicePurchasePayload } from "../types";

/**
 * Charges a service to the payer and puts a card in the chat.
 *
 * The whole difference from a purchase of goods: nothing is added to any
 * inventory. A bath, a tattoo, a night in the infirmary and a spell cast for
 * money all leave the same trace — a line of coins gone and a card saying what
 * they went on.
 *
 * The card is the *only* record, which is why it is posted publicly rather than
 * whispered: three weeks later the question is always who paid for the guide,
 * and nobody remembers.
 *
 * Extracted into its own module for the same reason `innPurchase` was: ShopApp
 * imports SocketHandler, so SocketHandler cannot import back from ShopApp.
 *
 * Returns false when the payer cannot afford it, in which case nothing is
 * deducted and no card is posted.
 */
export async function processServicePurchase(payload: ServicePurchasePayload): Promise<boolean> {
  const g = game as Game;
  const payer = g.actors?.get(payload.actorId);
  const recipient = g.actors?.get(payload.forActorId) ?? payer;
  if (!payer || !recipient) return false;

  const costCp = payload.cost.amount * IN_CP[payload.cost.currency];

  // A service the Referee waved through costs nothing and still gets a card:
  // the free tattoo at Fort Vulgar happened, and the card is where it is written
  // down. The wallet is not touched at all in that case. A price of 0 means the
  // book prints none — the alchemist charges what the potion is worth — and is
  // likewise settled away from the table.
  if (!payload.free && costCp > 0) {
    // The window clamps against the wallet as it stood when the row was clicked,
    // so by the time this runs on the GM's client the money may already be gone.
    // deductCoins leaves the purse untouched when it returns false.
    let paid = false;
    await FlagManager.updateInventory(payer, (inv) => {
      inv.coinsByZone ??= { equipped: { ...inv.coins } };
      paid = deductCoins(inv.coinsByZone, costCp);
      return inv;
    });

    if (!paid) {
      ui.notifications?.warn(
        `${payer.name} cannot afford ${payload.serviceName} — nothing was charged.`
      );
      return false;
    }
  }

  await postServiceCard(payload, payer.name ?? "", recipient.name ?? "", costCp);
  return true;
}

async function postServiceCard(
  payload: ServicePurchasePayload,
  payerName: string,
  recipientName: string,
  costCp: number
): Promise<void> {
  const priceLine = payload.free
    ? "with the shop's compliments"
    : costCp === 0
      ? "by arrangement"
      : `${payload.cost.amount} ${payload.cost.currency}`;

  // Who it was for, only where that is not who paid. "Rogbert paid for
  // Rogbert's bath" is noise; "Rogbert paid for Wilrun's bath" is the point.
  const forLine =
    recipientName && recipientName !== payerName
      ? `for <strong>${escapeHTML(recipientName)}</strong>, paid by ${escapeHTML(payerName)}`
      : escapeHTML(payerName);

  const unit = payload.unit && payload.unit !== "piece" ? payload.unit : "";

  const content = `
    <div class="dw-service-card">
      <h3><i class="fas fa-hand-holding-dollar"></i> ${escapeHTML(payload.serviceName)}</h3>
      <p class="dw-service-where">${escapeHTML(payload.shopName)}</p>
      <p class="dw-service-for">${forLine}</p>
      <p class="dw-service-price">${escapeHTML(priceLine)}${
        unit ? ` <span class="dw-service-unit">${escapeHTML(unit)}</span>` : ""
      }</p>
      ${payload.note ? `<p class="dw-service-note">${escapeHTML(payload.note)}</p>` : ""}
    </div>`;

  await ChatMessage.create({ content });
}
