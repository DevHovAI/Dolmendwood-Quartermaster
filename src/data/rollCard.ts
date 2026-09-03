import { MODULE_ID } from "../constants";
import { escapeHTML } from "../helpers/handlebars";

/**
 * How this module rolls dice and how it tells the Referee what they said.
 *
 * Lifted out of `dayRolls.ts` unchanged when the camp gained rolls of its own,
 * so both files roll the same way rather than each growing its own habits —
 * and, more practically, so `campRolls.ts` need not import `dayRolls.ts` and
 * make a cycle out of it.
 *
 * Two things here are not decoration:
 *
 * - **The `Roll` objects travel with the message.** Dice So Nice animates what
 *   it finds in `message.rolls`, so a card whose dice were rolled separately
 *   and merely described in its HTML gets no animation at all. Passing them
 *   also puts the real dice in the log, where a Referee can inspect one.
 * - **The cards are whispered to the GMs.** Half of what these tables produce
 *   is meant to be found out the hard way.
 */

export async function rollDice(formula: string): Promise<Roll> {
  return new Roll(formula).evaluate();
}

export const total = (roll: Roll): number => roll.total ?? 0;

/**
 * A card the whole table sees.
 *
 * **Which rolls are public is a ruling, not a default**, and Leander made it:
 * the weather, the morning's healing and spells, the camp's work and the night's
 * sleep are things the characters live through and would know about, so they are
 * announced. What stays whispered is what the party is *not* meant to know —
 * getting lost (the whole point is that their map goes quietly wrong), the
 * wandering-monster checks, the watch's slapstick, and anything a hex hides.
 *
 * Rolled dice still travel with the message, so Dice So Nice animates them for
 * everyone rather than for the Referee alone.
 */
export async function announce(content: string, rolls: Roll[] = []): Promise<void> {
  await ChatMessage.create({
    content,
    rolls,
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
  } as Parameters<typeof ChatMessage.create>[0]);
}

/** GM-only, and only ever seen by GMs. */
export async function whisperToGMs(content: string, rolls: Roll[] = []): Promise<void> {
  const g = game as Game;
  const gmIds = (g.users?.filter?.((u: { isGM?: boolean; id?: string }) => !!u.isGM) ?? [])
    .map((u: { id?: string }) => u.id)
    .filter((id): id is string => !!id);
  await ChatMessage.create({
    content,
    rolls,
    // Without this the card lands silently: Foundry plays the dice sound only
    // for messages it can tell are rolls.
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
    whisper: gmIds,
    // **The flag is what lets the players' clients throw this card away.**
    // Foundry deliberately shows a whispered message that carries dice to
    // everybody — `ChatMessage#visible` returns true for any `isRoll` whisper —
    // and paints it as "X rolled privately" with ??? for the numbers. Leander,
    // 2026-09-04: *"kann man die für die Spieler komplett unsichtbar machen?"*
    // Dropping the dice from the message would do it, and would cost the
    // Referee the 3D dice and an inspectable roll in the log; hiding the
    // rendered card on the other clients costs nothing. Only cards this module
    // whispered are hidden — another module's private roll is not ours to
    // suppress. See `renderChatMessageHTML` in module.ts.
    flags: { [MODULE_ID]: { gmOnly: true } },
  } as Parameters<typeof ChatMessage.create>[0]);
}

export function isGM(): boolean {
  return !!(game as Game).user?.isGM;
}

export function noteLine(note: string | undefined): string {
  return note ? `<p class="dw-day-roll-consequence">${escapeHTML(note)}</p>` : "";
}
