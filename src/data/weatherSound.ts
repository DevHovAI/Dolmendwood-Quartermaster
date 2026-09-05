import { MODULE_ID, SETTINGS } from "../constants";
import { getDayState } from "./dayDuties";
import { weatherSky } from "./weather";

/**
 * The day's weather, heard as well as seen.
 *
 * **Dolmenmaster's ask, 2026-09-05**, after installing Simple Weather: that module
 * ships eleven weather loops as plain `.ogg` files, and there is no reason the
 * roll on the bar should not reach them.
 *
 * **Why this is not the sound option that was cut.** A weather sound switch was
 * built once before and removed again, because FXMaster's own sound is gated
 * behind the paid `fxmaster-plus` — it was a switch a free table could not use.
 * These files are on the disk of anyone who has Simple Weather installed, and
 * the switch is dark for anyone who has not. Different thing entirely.
 *
 * ── Three decisions worth stating, because each had a plausible alternative ──
 *
 * **Our own playlist, not Simple Weather's.** Theirs exists and holds the same
 * files, and using it looked like the tidy answer for about a minute. It plays
 * exactly one sound at a time (`stopAll()` then `playSound(one)`) and it is
 * driven by *their* weather: the moment their module rolled a sky, or a player
 * pressed their button, our rain would stop. A playlist of our own in
 * SIMULTANEOUS mode can layer rain under thunder under wind, and neither module
 * ever reaches into the other's.
 *
 * **The same reading that drives the map.** `weatherSky()` already turns the
 * rolled text into what falls, how thick the air is, and whether there is
 * thunder — it is what FXMaster is handed. Reading the text a second time, by
 * its own rules, would have let the ear and the map disagree about the same
 * day. They cannot now: one reading, two outputs.
 *
 * **Every sound stays in the playlist, and only playing changes.** Rebuilding
 * the embedded documents on each roll would have worked and would have made
 * the fades stutter — a document that is deleted does not fade out, it stops.
 * The six we can use are created once, and a roll plays some and stops the rest.
 */

/** Simple Weather's own files, by the path it loads them from. */
const SW_MODULE = "simple-weather";
const SOUND_PATH = `modules/${SW_MODULE}/sounds`;

/**
 * The six of the eleven a Dolmenwood day can produce.
 *
 * Tornado and wildfire have no row on any of the six tables, and the two
 * remaining rain loops are covered by the pair below. `name` is what the
 * playlist calls the sound; it is also the handle everything here looks it up
 * by, so it must not change once a world has the playlist.
 */
const SOUNDS = {
  rain: { name: "Rain", file: "rain.ogg" },
  heavyRain: { name: "Heavy rain", file: "heavyRain.ogg" },
  snow: { name: "Snow", file: "snow.ogg" },
  blizzard: { name: "Blizzard", file: "blizzard.ogg" },
  hail: { name: "Hail", file: "hail.ogg" },
  thunder: { name: "Thunder", file: "thunder.ogg" },
  wind: { name: "Wind", file: "wind.ogg" },
  heavyWind: { name: "Heavy wind", file: "heavyWind.ogg" },
} as const;

type SoundId = keyof typeof SOUNDS;

/**
 * Wind is the one thing the sky does not already say.
 *
 * `weatherSky` answers what falls and how thick the air is, because that is
 * what FXMaster draws — and FXMaster draws no wind. A dozen rows name it
 * outright, though, and a windy day that sounds like a still one is the first
 * thing anyone would notice. Read in order, strongest first, off the same
 * English `text` the sky is read from — see the note on `WeatherEntry.text`.
 */
const WIND: [RegExp, SoundId][] = [
  [/relentless wind|blustery|winds wail|gale/, "heavyWind"],
  [/wind/, "wind"],
];

/** Rain the book words as more than rain. */
const HEAVY_RAIN = /torrential|pouring|driving rain|relentless/;

/** How long a loop takes to come up and to go down, in milliseconds. */
const FADE = 4000;

/**
 * Which loops belong to the day as it was rolled.
 *
 * Empty on a fair day, and that is a real answer: silence is what most of the
 * Dolmenwood tables describe, and a module that always plays *something* would
 * make the six rows that matter unremarkable.
 */
export function soundsForToday(): SoundId[] {
  return soundsFor(getDayState().weather);
}

/**
 * The same answer for a weather that is handed in rather than looked up.
 *
 * Split out so the mapping can be driven offline against all sixty-six rows of
 * the six tables without a Foundry to hold the day — the way every branch of
 * the encounter roll was checked before the map ever saw it.
 */
export function soundsFor(weather: { text: string; effects: unknown[] } | undefined): SoundId[] {
  const sky = weatherSky(weather as never);
  if (!weather || !sky) return [];

  const text = weather.text.toLowerCase();
  const out: SoundId[] = [];

  if (sky.falls === "rain") out.push(HEAVY_RAIN.test(text) ? "heavyRain" : "rain");
  else if (sky.falls === "snow") out.push("snow");
  else if (sky.falls === "snowstorm") out.push("blizzard");
  else if (sky.falls === "hail") out.push("hail");

  if (sky.lightning) out.push("thunder");

  // A blizzard is already a wind loop; laying another over it makes noise
  // rather than weather.
  if (sky.falls !== "snowstorm") {
    const wind = WIND.find(([re]) => re.test(text));
    if (wind) out.push(wind[1]);
  }

  return out;
}

// ─── The playlist ──────────────────────────────────────────────────────────────

const PLAYLIST_FLAG = "weatherPlaylist";
const PLAYLIST_NAME = "Dolmenwood Weather";

type SoundDoc = {
  id?: string | null;
  name?: string | null;
  playing?: boolean;
  update: (data: Record<string, unknown>) => Promise<unknown>;
};

type PlaylistDoc = {
  sounds: { getName: (n: string) => SoundDoc | undefined; contents?: SoundDoc[] } & Iterable<SoundDoc>;
  getFlag: (scope: string, key: string) => unknown;
  setFlag: (scope: string, key: string, value: unknown) => Promise<unknown>;
  update: (data: Record<string, unknown>) => Promise<unknown>;
  createEmbeddedDocuments: (name: string, data: Record<string, unknown>[]) => Promise<unknown>;
  playSound: (s: SoundDoc) => Promise<unknown>;
  stopSound: (s: SoundDoc) => Promise<unknown>;
};

/** Whether the table has the module whose files these are. */
export function simpleWeatherPresent(): boolean {
  const mod = (game as Game).modules?.get(SW_MODULE) as { active?: boolean } | undefined;
  return !!mod?.active;
}

function soundOn(): boolean {
  return !!(game as Game).settings?.get(MODULE_ID, SETTINGS.WEATHER_SOUND);
}

/**
 * The volume a loop plays at, on Foundry's own curve.
 *
 * The slider is a percentage of what the listener hears; Foundry stores gain,
 * and the two are not the same number — `inputToVolume` is the curve its own
 * volume sliders use, so 25 on this setting is as loud as 25 on the ambient
 * slider rather than four times it.
 */
function volume(): number {
  const pct = Number((game as Game).settings?.get(MODULE_ID, SETTINGS.WEATHER_SOUND_VOLUME) ?? 25);
  const clamped = Math.max(0, Math.min(50, pct)) / 100;
  const helper = (foundry as unknown as { audio?: { AudioHelper?: { inputToVolume?: (v: number) => number } } })
    .audio?.AudioHelper;
  return helper?.inputToVolume ? helper.inputToVolume(clamped) : clamped;
}

function findPlaylist(): PlaylistDoc | undefined {
  const all = (game as Game).playlists as unknown as
    | { find: (fn: (p: PlaylistDoc) => boolean) => PlaylistDoc | undefined }
    | undefined;
  return all?.find((p) => !!p.getFlag(MODULE_ID, PLAYLIST_FLAG));
}

/**
 * The playlist, made if it is not there yet.
 *
 * **SIMULTANEOUS from the moment it is created**, which is the mode Dolmenmaster
 * had to set by hand on Simple Weather's: a playlist in the default sequential
 * mode plays rain, then thunder, then wind, one after another, which is a
 * playlist of weather rather than weather. Nobody should have to know that.
 */
async function ensurePlaylist(): Promise<PlaylistDoc | undefined> {
  const existing = findPlaylist();
  if (existing) return existing;

  const cls = (foundry as unknown as { documents?: { Playlist?: unknown } }).documents?.Playlist ??
    (globalThis as unknown as { Playlist?: unknown }).Playlist;
  const create = (cls as { create?: (d: Record<string, unknown>) => Promise<PlaylistDoc | undefined> })
    ?.create;
  if (!create) return undefined;

  const modes = (CONST as unknown as { PLAYLIST_MODES?: { SIMULTANEOUS?: number } }).PLAYLIST_MODES;
  const made = await create({
    name: PLAYLIST_NAME,
    mode: modes?.SIMULTANEOUS ?? 2,
    playing: false,
    fade: FADE,
    sounds: [],
    flags: { [MODULE_ID]: { [PLAYLIST_FLAG]: true } },
  });
  return made ?? findPlaylist();
}

/** Make sure every loop this module can reach for is in the playlist. */
async function ensureSounds(playlist: PlaylistDoc): Promise<void> {
  const missing = (Object.keys(SOUNDS) as SoundId[]).filter(
    (id) => !playlist.sounds.getName(SOUNDS[id].name)
  );
  if (!missing.length) return;
  await playlist.createEmbeddedDocuments(
    "PlaylistSound",
    missing.map((id) => ({
      name: SOUNDS[id].name,
      path: `${SOUND_PATH}/${SOUNDS[id].file}`,
      repeat: true,
      volume: volume(),
      fade: FADE,
      // The environment channel, so the listener's own ambient slider still
      // governs it and weather never drowns out a voice.
      channel: "environment",
    }))
  );
}

/**
 * Bring what is playing into line with the day that was rolled.
 *
 * The Referee's client alone does this — playlist playback is world state, and
 * Foundry hands it to every connected client by itself. Five players calling
 * this would fight over the same document.
 */
export async function syncWeatherSound(): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM) return;

  const wanted = soundOn() && simpleWeatherPresent() ? soundsForToday() : [];

  // Nothing to play and no playlist yet: the common case in a world that has
  // never switched this on, and it should cost nothing at all.
  const playlist = wanted.length ? await ensurePlaylist() : findPlaylist();
  if (!playlist) return;
  if (wanted.length) await ensureSounds(playlist);

  const vol = volume();
  const names: Set<string> = new Set(wanted.map((id) => SOUNDS[id].name));
  for (const sound of playlist.sounds) {
    const name = sound.name ?? "";
    const shouldPlay = names.has(name);
    if (shouldPlay && sound.playing) {
      // Already going. Only the volume can have moved under it.
      await sound.update({ volume: vol });
      continue;
    }
    if (shouldPlay) {
      await sound.update({ volume: vol, fade: FADE });
      await playlist.playSound(sound);
    } else if (sound.playing) {
      await playlist.stopSound(sound);
    }
  }
}

/** Everything down — a new day before the weather is rolled, or the switch going off. */
export async function stopWeatherSound(): Promise<void> {
  if (!(game as Game).user?.isGM) return;
  const playlist = findPlaylist();
  if (!playlist) return;
  for (const sound of playlist.sounds) if (sound.playing) await playlist.stopSound(sound);
}
