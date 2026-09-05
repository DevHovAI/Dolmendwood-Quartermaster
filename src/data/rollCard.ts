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
 * **Which rolls are public is a ruling, not a default**, and Dolmenmaster made it:
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
    // **The dice are deliberately NOT attached to this document**, and that is
    // the whole trick (Dolmenmaster, 2026-09-04, after the first attempt failed).
    // `ChatMessage#visible` reads:
    //
    //     if ( this.whisper.length ) { if ( this.isRoll ) return true; ... }
    //
    // — a whispered message carrying dice is visible to *everybody*, and its
    // content is then replaced with "X rolled privately" and ??? for the
    // numbers. `isRoll` is simply `rolls.length > 0`, so leaving them off makes
    // the message invisible by Foundry's own rule: `ChatLog#postOne` returns at
    // once for an invisible message, which means no card, no notification pip,
    // no sound, and no Dice So Nice animation on a player's screen.
    //
    // The first fix tried to remove the rendered card in `renderChatMessageHTML`
    // and did nothing at all: core fires that hook on an element it has *not
    // yet inserted*, so `remove()` had no parent to remove it from.
    //
    // What this costs the Referee is the 3D dice and an inspectable roll in the
    // log for these cards alone — the numbers themselves are printed in the
    // card, which is what the card is for. Public cards (`announce`) still
    // carry their rolls.
    sound: rolls.length ? CONFIG.sounds.dice : undefined,
    whisper: gmIds,
    // The flag no longer decides anything about *this* card — leaving the dice
    // off already makes it invisible. It marks the card so that the cards from
    // the two builds that did carry dice, and are sitting in players' logs
    // right now, can be hidden there. See `hideFromPlayers` in module.ts.
    flags: { [MODULE_ID]: { gmOnly: true } },
  } as Parameters<typeof ChatMessage.create>[0]);
}

export function isGM(): boolean {
  return !!(game as Game).user?.isGM;
}

export function noteLine(note: string | undefined): string {
  return note ? `<p class="dw-day-roll-consequence">${escapeHTML(note)}</p>` : "";
}
