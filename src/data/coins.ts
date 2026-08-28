/**
 * What the four coins are worth in each other.
 *
 * One table, imported wherever money is counted. It lived in `innData` while
 * the inn was the only place converting prices; the shop's buy-back needs the
 * conversion in both directions, and a second copy of an exchange rate is the
 * kind of duplicate that only shows up as a rounding argument at the table.
 */

export type Currency = "cp" | "sp" | "gp" | "pp";

export const CURRENCY_IN_CP: Record<Currency, number> = { cp: 1, sp: 10, gp: 100, pp: 500 };

export interface Coin {
  amount: number;
  currency: Currency;
}

export function coinToCp(cost: Coin): number {
  return cost.amount * CURRENCY_IN_CP[cost.currency];
}

/**
 * Copper back into the largest coin that divides it exactly.
 *
 * Exact on purpose: half of 5gp is 250cp, and saying "2gp" (rounded down) or
 * "3gp" (rounded up) both cheat somebody. 25sp is the same money and reads as
 * easily. Only where nothing divides does it stay in copper.
 *
 * **`largest` caps the coin it may answer in.** Pellucidium is worth five gold,
 * so a pile shown in it is a pile the table has to multiply by five in their
 * heads; everything from gold down is decimal and adds up on sight. Leander,
 * 2026-08-28: *"lass in der Wertanzeige bitte die Währung pp aus... ist leichter
 * umzurechnen mit den 10er Schritten."* The default keeps every older caller —
 * a shop's price, a hoard's cash — answering as it always did.
 */
/** Largest first — the order the conversion walks down. */
const COIN_ORDER: Currency[] = ["pp", "gp", "sp", "cp"];

export function cpToCoin(cp: number, largest: Currency = "pp"): Coin {
  if (cp <= 0) return { amount: 0, currency: "cp" };
  for (const currency of COIN_ORDER.slice(COIN_ORDER.indexOf(largest))) {
    const unit = CURRENCY_IN_CP[currency];
    if (cp % unit === 0) return { amount: cp / unit, currency };
  }
  return { amount: cp, currency: "cp" };
}

/** Apply a shop-style price factor in percent, never dropping below 1 coin. */
export function withPriceFactor(cost: Coin, factor: number): Coin {
  if (factor === 100) return cost;
  return { amount: Math.max(1, Math.round((cost.amount * factor) / 100)), currency: cost.currency };
}
