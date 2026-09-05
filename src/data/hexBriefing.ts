import { escapeHTML } from "../helpers/handlebars";
import { t } from "../helpers/i18n";
import { bookRef } from "./books";
import { whisperToGMs } from "./rollCard";
import { hexInfo, type HexInfo } from "./hexes";
import { REGIONS, TERRAINS, TERRAIN_BANDS } from "./dayContext";


/**
 * What the Referee ought to know the moment the party walks into a hex.
 *
 * Dolmenmaster, 2026-08-28: *"Ich hätte gerne, dass für den DM automatisch eine
 * kurze Beschreibung des Hexfeldes generiert wird... etwas, womit man sofort
 * einen Eindruck davon bekommt, was die Spieler alles mitbekommen, wie das Hex
 * so ist."*
 *
 * **The book's own prose is not here, and will not be.** Every hex has a
 * paragraph at the top of its page, and that paragraph is Necrotic Gnome's
 * writing — the same rule the bestiary follows: descriptions stay in the
 * reader's own copy, and the page reference on the card opens it. What this
 * builds is the *mechanical* half, which is the half a Referee is otherwise
 * looking up in four places while the players wait:
 *
 *  - what the ground is like and what it costs to cross,
 *  - which region's encounter column this reads,
 *  - how easily the way is lost here,
 *  - what the book says about encounters or ley lines in this hex,
 *  - whether anything grows here the foraging tables do not know about,
 *  - and the page, one click away, for the words.
 *
 * **Triggered by the hex being set, however it was set.** A scene's grid offset
 * says "column 14, row 9"; on its own it does not say "0608", because that
 * depends on how each table lined its own map up. It did not used to be able
 * to: the Referee typed the number and the move hook only nudged them to. Since
 * 2026-08-29 a map can be *calibrated* — one known hex measured once, in
 * `hexGrid.ts` — and then the move hook sets the hex itself. Either way the
 * card comes from `setDayContext`, so both doors lead here and neither has to
 * remember to.
 */

/** Whispered once, when the hex on the day bar changes to a new one. */
export async function briefHex(hex: string | undefined): Promise<void> {
  const here = hexInfo(hex);
  if (!hex) return;
  if (!here) {
    await whisperToGMs(
      `<div class="dw-day-roll">
        <h3><i class="fas fa-map"></i> Hex ${escapeHTML(hex)}</h3>
        <p class="dw-day-roll-headline is-bad">Not one of the hexes the book details.</p>
        <p class="dw-day-roll-sub">168 hexes carry a Terrain line in the Campaign Book; this is not
          among them, so there is nothing to read out. The bar's own terrain and region still
          govern the day's rolls.</p>
      </div>`
    );
    return;
  }
  await whisperToGMs(briefingCard(here));
}

/**
 * **Four things, and nothing else** — Dolmenmaster's edit, 2026-08-28: *"ich finde
 * die TP-Info und was alles mitkommen kann gut. Der Rest ist eigentlich
 * überflüssig, am ehesten noch Ley line und besondere Begegnungen und Link."*
 *
 * So the losing-the-way chance, the encounter column and the foraging line came
 * off: all three are already on the day bar or on the roll that uses them, and a
 * card that repeats what is on screen is a card nobody reads twice.
 */
function briefingCard(here: HexInfo): string {
  const terrain = TERRAINS.find((t) => t.id === here.terrain);
  const band = terrain ? TERRAIN_BANDS[terrain.band] : undefined;

  // **Travel first** — Dolmenmaster's order, 2026-08-28. It is the one line that
  // decides anything before the party has done a thing.
  const travel = `<p class="dw-day-roll-yield"><i class="fas fa-person-hiking"></i>
    <strong>${here.cost} Travel Point${here.cost === 1 ? "" : "s"}</strong> to cross${
      band ? ` &middot; ${escapeHTML(t(band.travelKey))}` : ""
    }</p>`;

  // **Then what it is like** — short points, not a paragraph, and in plain
  // English: *"Im Buch ist das Englisch sehr altertümlich geschrieben. Ich hätte
  // es gerne verständlicher."*
  const prose = here.flavour?.length
    ? `<ul class="dw-encounter-flavour">${here.flavour
        .map((line) => `<li>${escapeHTML(line)}</li>`)
        .join("")}</ul>`
    : "";

  // **Then what is in it**, each thing labelled with what kind of thing it is.
  // Hidden is the book's own marker and the whole point of a card only the
  // Referee sees: these are the things the party walks past.
  const entries = [
    ...(here.places ?? []).map((p) => ({
      icon: p.hidden ? "fa-eye-slash" : "fa-location-dot",
      name: p.name,
      kind: p.kind ?? "place",
      hidden: !!p.hidden,
    })),
    ...(here.folk ?? []).map((f) => ({
      icon: "fa-user",
      name: f.name,
      kind: f.what,
      hidden: false,
    })),
  ];
  const contents = entries.length
    ? `<ul class="dw-encounter-facts">${entries
        .map(
          (e) =>
            `<li><i class="fas ${e.icon}"></i> <strong>${escapeHTML(e.name)}</strong>
              <span class="dw-encounter-die">${escapeHTML(e.kind)}${e.hidden ? " · hidden" : ""}</span></li>`
        )
        .join("")}</ul>`
    : "";

  // What the book itself flags about this hex, in its own shorthand rather than
  // its prose: an encounter it makes likely, a ley line crossing.
  const note = here.note
    ? `<p class="dw-day-roll-consequence"><i class="fas fa-circle-exclamation"></i> ${escapeHTML(
        here.note
      )}</p>`
    : "";

  return `<div class="dw-day-roll">
    <h3><i class="fas fa-map"></i> ${escapeHTML(here.hex)} &mdash; ${escapeHTML(here.name)}</h3>
    ${travel}
    ${prose}
    ${contents}
    ${note}
    <p class="dw-day-roll-sub">${bookRef(
      "campaign",
      here.page,
      `Campaign Book p${here.page}`
    )}${prose ? "" : " &mdash; this hex has not been written up here yet."}</p>
  </div>`;
}
