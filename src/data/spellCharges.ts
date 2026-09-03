/**
 * Spell credits, and the charges they buy.
 *
 * **Leander's design, 2026-09-02:** *"Wenn jemand erfolgreich spells prepared,
 * gib dem character eine entsprechende anzahl 'credits'. mit denen er seinen
 * Spells im character sheet markieren kann. ein spell sollte dabei mehrfach
 * wählbar sein. ein roll auf den spell soll dann den spell bzw. eine Ladung
 * davon aufbrauchen."*
 *
 * Three steps, and this file is all three of them:
 *
 * 1. **The morning grants credits.** A caster gets one for each spell they got
 *    through — what they attempted, less whatever a bad night cost them. A
 *    caster who slept well loses none, so their credits are simply their count.
 * 2. **The sheet spends credits on charges.** One credit marks one charge of
 *    one spell, and the same spell may be marked as often as the credits last:
 *    two charges of *magic missile* is a magician who memorised it twice, which
 *    is how the game is actually played.
 * 3. **Casting spends a charge.** Rolling a prepared spell takes one of its
 *    charges; at nought there is nothing to cast and the roll is refused.
 *
 * **Credits are reissued, not accumulated.** Preparing spells sets the number
 * rather than adding to it: yesterday's unspent credits are yesterday's, and a
 * caster who forgot to assign three of them does not wake up with six. Charges
 * left on the list are a separate question and the morning clears those too —
 * a spell held overnight is not a spell still memorised.
 *
 * Pure, and checked by `check-spells.js`.
 */

/** What a morning's preparation is worth: what got through, never below nought. */
export function creditsFrom(attempted: number, lost: number): number {
  return Math.max(0, attempted - lost);
}

/** Charges on one spell, however the field was left. */
export function chargesOf(prepared: number | undefined): number {
  return Math.max(0, Math.floor(prepared ?? 0));
}

/**
 * Mark one more charge of a spell.
 *
 * Returns the new charge count and what is left of the credits, or null when
 * there is nothing to pay with — so a caller cannot half-apply it.
 */
export function markOne(
  prepared: number | undefined,
  credits: number
): { prepared: number; credits: number } | null {
  if (credits <= 0) return null;
  return { prepared: chargesOf(prepared) + 1, credits: credits - 1 };
}

/**
 * Take a charge back off a spell, and get the credit back with it.
 *
 * **The way out of a mis-click**, and the reason marking is not a one-way door:
 * a player who put their last credit on the wrong spell can move it, right up
 * until they cast. Nothing to unmark returns null.
 */
export function unmarkOne(
  prepared: number | undefined,
  credits: number
): { prepared: number; credits: number } | null {
  const charges = chargesOf(prepared);
  if (charges <= 0) return null;
  return { prepared: charges - 1, credits: credits + 1 };
}

/**
 * Cast one charge.
 *
 * **No credit comes back** — that is the whole difference from unmarking. The
 * spell was prepared, it was cast, and it is gone until the next morning.
 */
export function castOne(prepared: number | undefined): number | null {
  const charges = chargesOf(prepared);
  if (charges <= 0) return null;
  return charges - 1;
}

/** "2 ready" / "1 ready" / nothing at all when the spell is not prepared. */
export function chargeLabel(prepared: number | undefined): string {
  const charges = chargesOf(prepared);
  return charges > 0 ? `${charges} ready` : "";
}

/** "3 spell credits left" — the line above the list, and the empty case. */
export function creditLine(credits: number): string {
  if (credits <= 0) return "No spell credits left";
  return `${credits} spell credit${credits === 1 ? "" : "s"} left`;
}
