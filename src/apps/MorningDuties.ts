import { escapeHTML } from "../helpers/handlebars";
import { stepper, wireSteppers } from "../helpers/steppers";
import { preparesSpells } from "../data/xpAward";
import { getExtras, updateExtras } from "../data/characterSheet";
import {
  grantMorningHealing,
  noteSpellsPreparedFreely,
  rollSpellPreparation,
  sleptBadly,
  type CasterChoice,
} from "../data/morningRolls";
import { SPELL_LOSS_IN_6 } from "../data/camping";

/**
 * Waking up, from the button to the card.
 *
 * The two morning duties are as different as duties get, and the dialogs show
 * it: healing asks nothing at all — who slept well is already written down, and
 * a dialog that asked would only be a chance to get it wrong — while spell
 * preparation asks the one thing the module cannot know, which is how many
 * spells each caster is trying to prepare.
 *
 * **Only characters who slept badly are offered.** A rested caster prepares
 * their whole list without a die, so listing them would invite a roll the book
 * does not call for.
 */

function ask<T>(
  title: string,
  content: string,
  read: (html: JQuery) => T | null,
  label = "Roll"
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const done = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    new Dialog({
      title,
      content,
      buttons: {
        ok: {
          label,
          icon: '<i class="fas fa-dice-d20"></i>',
          callback: (html: JQuery) => done(read(html)),
        },
        cancel: { label: "Cancel", callback: () => done(null) },
      },
      default: "ok",
      // Ticking a caster's box should not also mean reaching for the keyboard.
      render: (html: JQuery) => wireSteppers(html),
      close: () => done(null),
    }).render(true);
  });
}

export async function promptSpellPreparation(): Promise<{ casters: CasterChoice[] } | null> {
  // **Only the ones who cast.** A fighter has never had a spell to lose, and a
  // dialog that listed the whole party and asked the Referee to untick five of
  // them every morning was asking them to do the module's work (Leander,
  // 2026-09-03). The Class decides it, and the sheet's own spell count
  // overrules — see `preparesSpells`.
  //
  // **Two questions, and they are not the same one** — which is what the first
  // cut of the player's side got wrong (Leander, 2026-09-03: *"prepare spells
  // lässt sich vom spieler gerade nicht würfeln"*). Whether the duty needs dice
  // at all is a question about **the whole party**; which names to put on the
  // form is a question about **the person pressing**. Asking only the second
  // meant that a player whose own casters had slept well fell into the
  // "everybody prepared freely" branch — which is GM-only and therefore did
  // nothing whatsoever on their screen.
  const partyBadly = sleptBadly().filter(preparesSpells);
  if (!partyBadly.length) {
    // Not a refusal: the duty is done, it simply took no dice. An empty list is
    // that answer, and the caller writes it — on the Referee's client directly,
    // from a player's over the socket, so the card and the credits happen once.
    return { casters: [] };
  }

  // Leander's job 3: a player is only ever asked about their own characters.
  // The Referee owns every actor, so their form is the party's.
  const badly = partyBadly.filter((actor) => (actor as { isOwner?: boolean }).isOwner);
  if (!badly.length) {
    ui.notifications?.info(
      "None of your spell-casters lost sleep last night — there is nothing for you to roll."
    );
    return null;
  }

  // What each of them said last time. Zero means "not a caster", which is the
  // ordinary case for most of a party and should stay unticked without anybody
  // having to say so twice.
  const remembered = new Map(
    badly.map((actor) => [actor.id ?? "", getExtras(actor).prepares ?? 0])
  );

  const rows = badly
    .map((actor) => {
      const id = actor.id ?? "";
      const spells = remembered.get(id) ?? 0;
      // Ticked, because being on this list now means casting: the row is only
      // here at all if the Class prepares spells or the sheet's own count says
      // so. Before the filter, most rows were people who never had a spell.
      return `
      <div class="dw-spell-row" data-actor-id="${escapeHTML(id)}">
        <input type="checkbox" class="dw-spell-caster" checked>
        <span class="dw-camp-member-name">${escapeHTML(actor.name ?? "Someone")}</span>
        ${stepper(`class="dw-spell-count" min="0" max="20" value="${spells > 0 ? spells : 1}"`)}
        <span class="dw-camp-member-stat">spells attempted</span>
      </div>`;
    })
    .join("");

  const choice = await ask<{ casters: CasterChoice[]; remember: Map<string, number> }>(
    "Preparing spells",
    `<form class="dw-camp-form">
      <p class="hint">These spell-casters failed to get a good night's rest, so each spell they try
        to memorise or pray for has a <strong>${SPELL_LOSS_IN_6}-in-6</strong> chance of failing —
        the slot stays empty and unusable today. Only Classes that prepare spells are listed; the
        numbers are remembered on the characters, so this is asked properly only once.</p>
      <div class="dw-spell-rows">${rows}</div>
      <p class="hint">Everyone else in the party slept well and prepares their spells without
        rolling.</p>
    </form>`,
    (html) => {
      const remember = new Map<string, number>();
      const casters = html
        .find(".dw-spell-row")
        .toArray()
        .map((el) => {
          const row = el as HTMLElement;
          const id = row.dataset.actorId ?? "";
          const on = !!(row.querySelector(".dw-spell-caster") as HTMLInputElement)?.checked;
          const typed = Number((row.querySelector(".dw-spell-count") as HTMLInputElement)?.value);
          const spells = Number.isFinite(typed) ? typed : 0;
          // Remembered whether they cast or not: an unticked row is the answer
          // "no spells", and it is worth keeping just as much as a yes.
          remember.set(id, on ? Math.max(0, spells) : 0);
          if (!on || spells <= 0) return undefined;
          const actor = (game as Game).actors?.get(id);
          return { actorId: id, name: actor?.name ?? "Someone", spells };
        })
        .filter((c): c is CasterChoice => !!c && !!c.actorId);

      if (!casters.length) {
        ui.notifications?.warn("Nobody is preparing spells.");
        return null;
      }
      return { casters, remember };
    }
  );

  if (!choice) return null;

  // Written after the dialog closes, so a cancelled prompt changes nothing.
  for (const [actorId, spells] of choice.remember) {
    const actor = (game as Game).actors?.get(actorId);
    if (!actor) continue;
    // Remembering the number is a write on the character, so it goes only where
    // this client may write. A player opening this dialog would otherwise be
    // stopped by Foundry halfway down the list, on somebody else's caster.
    if (!actor.isOwner) continue;
    if ((getExtras(actor).prepares ?? 0) === spells) continue;
    await updateExtras(actor, (extras) => ({ ...extras, prepares: spells }));
  }

  return { casters: choice.casters };
}

/**
 * One morning duty, from the button to the card — the twin of `runCampDuty`,
 * and GM-only for the same reason.
 */
export async function runMorningDuty(dutyId: string): Promise<void> {
  if (!(game as Game).user?.isGM) return;

  if (dutyId === "healing") {
    await grantMorningHealing();
    return;
  }
  if (dutyId === "prepare-spells") {
    const choice = await promptSpellPreparation();
    if (!choice) return;
    // An empty list is an answer, not a cancellation: nobody in the party lost
    // sleep, so every caster prepares their whole list without a die.
    if (choice.casters.length) await rollSpellPreparation(choice.casters);
    else await noteSpellsPreparedFreely();
  }
}
