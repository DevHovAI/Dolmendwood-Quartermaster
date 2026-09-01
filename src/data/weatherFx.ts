import { MODULE_ID, SETTINGS } from "../constants";
import { getDayState } from "./dayDuties";
import { weatherSky, type Falling, type WeatherSky } from "./weather";

/**
 * The day's weather, painted onto the map.
 *
 * The roll already happens — one 2d6 a morning, and the whole table hears what
 * the sky is doing. This carries it one step further and puts it on the map,
 * through **FXMaster**, which most Dolmenwood tables already have installed.
 *
 * **It builds its own effects rather than playing FXMaster's presets.** The
 * presets are made to show off what the module can do: `snow` runs at the very
 * top of the density scale, `thunderstorm` at four fifths of it with a lightning
 * filter flashing over the whole canvas, everything at full opacity and drawn
 * *over* the tokens. That is a weather demo. A hex map a Referee reads for three
 * hours wants the opposite, so the numbers here are ours, they are far below
 * FXMaster's own, and the table can move the whole lot up or down with one
 * setting.
 *
 * **Everything is drawn over the tokens** (Leander, 2026-09-01). `belowTokens`
 * is not a layer but a cutout: switched on, FXMaster stamps a token-shaped hole
 * in the weather, and a party standing in a snowstorm inside a clean oval of
 * still air is a worse picture than a party you can see a little snow across.
 * Map notes are unaffected either way — FXMaster's particles live in the canvas
 * group `primary` and Foundry draws note pins in `interface`, which is always
 * above it.
 *
 * The route in is `game.modules.get("fxmaster").api.effects`, which takes plain
 * effect definitions and keeps them under ids we choose. Ours are two, one for
 * what falls and one for the haze, and **nothing else on the scene is ever
 * touched** — weather a Referee set by hand through FXMaster's own window
 * survives all of this, because it lives under different ids.
 *
 * **Off by default, and per map.** Writing effects to a scene document is not a
 * thing to do to somebody's world uninvited, and a hex map and the inn's back
 * room do not want the same sky. So there are two gates: the module setting,
 * and a map saying yes. The second is the same shape as the hex calibration —
 * kept per scene id in a world setting, because it is a property of the *map*
 * (see `hexGrid.ts`, which learned that the hard way).
 *
 * Only the Referee's client writes. Everyone else sees it arrive as a scene
 * update, which is Foundry's own business and needs nothing from us.
 */

/** What one map remembers about the weather it shows. */
interface WeatherScene {
  /** Does this map show the party's weather at all? */
  on: boolean;
  /** What was last painted here, so an unchanged day is not painted twice. */
  applied?: string;
  /** The scene's name when it was switched on, so a stale entry is recognisable. */
  scene?: string;
}

/**
 * Our four layers, under ids of our own.
 *
 * FXMaster's API only accepts ids in its `apiMacro_` namespace, ending `_p` for
 * a particle effect and `_f` for a filter. Fixed rather than generated, because
 * the point of them is that tomorrow's weather can find yesterday's and replace
 * it — and that everything *not* under these ids belongs to somebody else. A
 * Referee running their own permanent FXMaster weather keeps it, untouched.
 *
 * The haze was a *filter* for one afternoon, and the third id is what takes
 * that version's fog off a map it is still sitting on. A scene keeps what it
 * was given; nothing else would ever come back for it.
 */
const FALLS_ID = "apiMacro_dolmenwoodWeatherFalls_p";
const HAZE_ID = "apiMacro_dolmenwoodWeatherHaze_p";
const CLOUD_ID = "apiMacro_dolmenwoodWeatherCloud_p";
const GLIMMER_ID = "apiMacro_dolmenwoodWeatherGlimmer_p";
const OLD_HAZE_FILTER_ID = "apiMacro_dolmenwoodWeatherHaze_f";

/**
 * Sound is off on every layer and there is no switch for it.
 *
 * There was one for an afternoon, and it did nothing: FXMaster gates effect
 * sounds on its paid add-on `fxmaster-plus`, which the free module does not so
 * much as show the option without —
 *
 *     const plusActive = !!game?.modules?.get?.("fxmaster-plus")?.active;
 *     if (!plusActive) return false;
 *
 * — so the setting was a switch a table could turn on and hear nothing from.
 * Better no option than an option that lies (Leander, 2026-09-01). If weather
 * is ever to be heard here it will be through Foundry's own playlists, which
 * is a different job with its own audio files.
 */

/** All of ours, for taking the whole sky down in one go. */
const OURS = [FALLS_ID, HAZE_ID, CLOUD_ID, GLIMMER_ID];

/** The signature of a clear sky: ours taken down, nothing put up. */
const CLEAR = "clear";

/** The grey a fog is, where the book has not named a colour of its own. */
const HAZE_GREY = "#b9c0c6";

/**
 * How each kind of falling weather is drawn, apart from how much of it there is.
 *
 * The book says whether it is rain or snow and roughly how hard; these are the
 * things it has no opinion about — how big a flake is, how fast it comes down,
 * how long a streak it leaves. `drift` is what the speed is multiplied by on a
 * day the book describes by its wind.
 *
 * **These are sizes for a world map seen from a long way up, not for a battle
 * map**, and that is the whole reason they look nothing like FXMaster's own.
 * Its rain is drawn at scale 2.28; the rain here is at 0.19. The reason the
 * first cut of this looked absurd is in one line of FXMaster's own code:
 *
 *     const factor = (options.scale?.value ?? 1) * (canvas.dimensions.size / 100);
 *
 * A particle's size is multiplied by the scene's **grid size**. A battle map
 * squares 100px across draws them as designed; a hex map whose hexes are three
 * times that draws every raindrop three times too big — and a hex map is the
 * one place this module is ever going to be switched on. So the numbers have to
 * be small enough to survive that multiplication.
 *
 * **Three of the four are measured**, tuned by hand against the Dolmenwood
 * world map (Leander, 2026-09-01), and the interesting thing about them is how
 * badly both attempts to guess the rest went.
 *
 * Guessing by eye said a snowflake reads larger than a raindrop. It does not:
 * 0.16 against 0.19. Guessing by ratio — FXMaster's own default for an effect,
 * times the factor the measured row beside it needed — was worse, and not by a
 * little: it put the snowstorm's speed at **5** where the measurement says
 * **0.34**, because FXMaster's own snowstorm is built to blow a battle map
 * apart and its defaults carry that intent through any ratio you take of them.
 *
 * All four rows are measured now, and nothing in this table is reasoned from
 * anything else in it. That is the lesson worth keeping: these numbers are a
 * property of a particular map seen from a particular height, and the only
 * way to get one is to look.
 */
const FALLING: Record<
  Falling,
  { scale: number; speed: number; lifetime: number; direction: number; alpha: number; drift: number }
> = {
  rain: { scale: 0.19, speed: 0.27, lifetime: 0.46, direction: 280, alpha: 1, drift: 1.6 },
  snow: { scale: 0.16, speed: 0.19, lifetime: 1, direction: 305, alpha: 1, drift: 1.5 },
  snowstorm: { scale: 0.16, speed: 0.34, lifetime: 0.63, direction: 255, alpha: 1, drift: 1.4 },
  hail: { scale: 0.12, speed: 0.16, lifetime: 0.27, direction: 245, alpha: 0.6, drift: 1.3 },
};

/**
 * The haze, on the same footing and measured the same way.
 *
 * **Drifting fog, not a flat veil.** The first cut used FXMaster's fog *filter*,
 * a shader that hazes the whole canvas evenly; this is its particle effect,
 * which lays actual banks of fog across the map and lets them move. On a world
 * map seen from a long way up that is the more honest picture — cloud has
 * shape, and a Referee can see the hex under a gap in it.
 *
 * It carries twenty-two of the thirty-seven rows that draw anything, every
 * coloured mist of both unseasons included, so it is the single most important
 * row in this file.
 */
const HAZE = { scale: 0.27, speed: 0.38, lifetime: 1, direction: 180, alpha: 0.4, drift: 1.6 };

/**
 * The cloud overhead, which on most days is the whole of the weather.
 *
 * The layer this was nearly shipped without. FXMaster's own cloud presets look
 * ridiculous over a drawn hex map — sprites the size of a barony sliding past —
 * and the first cut concluded that clouds were the problem and cut them. At a
 * twentieth of that size they turn out to be the layer that makes everything
 * else sit in a sky rather than float on a picture.
 */
const CLOUD = { scale: 0.44, speed: 0.16, lifetime: 0.45, direction: 0, alpha: 0.7, drift: 1.5 };

/**
 * The glitter in the air. Faint always, and turned up over an unseason.
 *
 * Not weather at all, strictly — it is Dolmenwood. The wood is fairy-haunted
 * every day of the year and Fairy is nearer on some of them than others, so
 * this is on always at a twentieth of the density of anything else here, and
 * nearly six times that over Hitching and Vague. Faint enough on an ordinary
 * day to be the thing a player notices on the third look and asks about; in an
 * unseason it should not need asking about.
 *
 * Over the tokens like everything else here, which for this layer is not a
 * compromise but the point: it is not weather in front of the party, it is
 * Fairy showing through, and it shows through them.
 */
const GLIMMER = { scale: 0.21, speed: 0.27, lifetime: 0.21, alpha: 0.7 };

/**
 * What the table has asked for, as one multiplier on **how much** there is.
 *
 * Deliberately not on how big it is drawn, which was the first version of this
 * and was wrong twice over: the size is the part that has been measured against
 * a real map, and shrinking it further to mean "less weather" produces
 * something invisible rather than something restrained. What the question
 * "how much of my map may this cover" actually asks about is quantity — how
 * many drops, how thick the air — so that is all this moves.
 *
 * Ordinary is Leander's own measured setting. Subtle halves it; strong is what
 * a table that wants the day unmistakable can reach for.
 */
const STRENGTH: Record<string, number> = { subtle: 0.5, normal: 1, strong: 1.7 };

interface EffectsApi {
  play: (args: Record<string, unknown>) => Promise<unknown>;
  stop: (args: Record<string, unknown>) => Promise<unknown>;
}

interface SceneLike {
  id?: string;
  name?: string;
}

/**
 * FXMaster's effects API, or nothing.
 *
 * Nothing is the ordinary case — most worlds do not have FXMaster — and every
 * caller here treats it as "there is no map weather", not as an error. This is
 * a nice-to-have hanging off a roll that works perfectly well on its own.
 */
function effectsApi(): EffectsApi | undefined {
  const mod = (game as Game).modules?.get?.("fxmaster") as
    | { active?: boolean; api?: { effects?: EffectsApi } }
    | undefined;
  if (!mod?.active) return undefined;
  const api = mod.api?.effects;
  return typeof api?.play === "function" && typeof api?.stop === "function" ? api : undefined;
}

/** Is there anything to talk to? */
export function weatherFxAvailable(): boolean {
  return !!effectsApi();
}

export function weatherFxOn(): boolean {
  return !!(game as Game).settings?.get(MODULE_ID, SETTINGS.WEATHER_FX);
}

function weatherFxStrength(): number {
  const asked = (game as Game).settings?.get(MODULE_ID, SETTINGS.WEATHER_FX_STRENGTH) as string;
  return STRENGTH[asked] ?? STRENGTH.normal;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/**
 * The day's sky as FXMaster effect definitions.
 *
 * Four layers. Three of them read the day — cloud overhead unless it is a fair
 * one, haze where the air is thick, something falling where the book says it
 * falls — and the glimmer does not, because Fairy is not weather.
 *
 * **What never changes is not drawn here at all.** Crows were offered and
 * turned down on exactly that test (Leander, 2026-09-01): a flight of crows
 * looks the same on every one of these sixty-six rows, so a Referee who wants
 * them can set them once in FXMaster and keep them, and this module has nothing
 * to add. It draws what the roll changes.
 */
function effectsFor(sky: WeatherSky, strength: number): Record<string, unknown>[] {
  const particles: Record<string, unknown>[] = [];
  const amount = (n: number) => clamp(n * strength, 0.02, 5);

  // Highest first, so the list reads the way the sky is built: cloud over haze,
  // and whatever is falling coming down through both of them.
  if (sky.cloud) {
    particles.push({
      id: CLOUD_ID,
      type: "clouds",
      options: {
        belowTokens: false,
        scale: CLOUD.scale,
        speed: sky.driven ? CLOUD.speed * CLOUD.drift : CLOUD.speed,
        lifetime: CLOUD.lifetime,
        direction: CLOUD.direction,
        density: amount(sky.cloud),
        alpha: CLOUD.alpha,
        soundFxEnabled: false,
      },
    });
  }

  if (sky.haze) {
    particles.push({
      id: HAZE_ID,
      type: "fog",
      options: {
        belowTokens: false,
        scale: HAZE.scale,
        speed: sky.driven ? HAZE.speed * HAZE.drift : HAZE.speed,
        lifetime: HAZE.lifetime,
        direction: HAZE.direction,
        density: amount(sky.haze),
        alpha: HAZE.alpha,
        soundFxEnabled: false,
        tint: { apply: true, value: sky.color ?? HAZE_GREY },
      },
    });
  }

  if (sky.falls) {
    const how = FALLING[sky.falls];
    particles.push({
      id: FALLS_ID,
      type: sky.falls,
      options: {
        belowTokens: false,
        scale: how.scale,
        speed: sky.driven ? how.speed * how.drift : how.speed,
        lifetime: how.lifetime,
        direction: how.direction,
        density: amount(sky.density ?? 0.5),
        alpha: how.alpha,
        soundFxEnabled: false,
        ...(sky.color ? { tint: { apply: true, value: sky.color } } : {}),
        // Rain alone has splashes, and they are the most restless thing in the
        // whole set: a hundred small marks appearing on the ground a Referee is
        // trying to read a hex grid off.
        ...(sky.falls === "rain" ? { splash: false } : {}),
      },
    });
  }

  if (sky.glimmer) {
    particles.push({
      id: GLIMMER_ID,
      type: "stars",
      options: {
        belowTokens: false,
        scale: GLIMMER.scale,
        speed: GLIMMER.speed,
        lifetime: GLIMMER.lifetime,
        density: amount(sky.glimmer),
        alpha: GLIMMER.alpha,
        soundFxEnabled: false,
        // Tinted with the day's own colour where there is one, so an unseason's
        // green fog glitters green rather than glittering white through it.
        ...(sky.color ? { tint: { apply: true, value: sky.color } } : {}),
      },
    });
  }

  return particles;
}

function allWeatherScenes(): Record<string, WeatherScene> {
  const stored = (game as Game).settings?.get(MODULE_ID, SETTINGS.WEATHER_FX_SCENES) as
    | Record<string, WeatherScene>
    | undefined;
  return stored && typeof stored === "object" ? { ...stored } : {};
}

/** Does this map show the weather? */
export function sceneShowsWeather(sceneId: string | undefined): boolean {
  return !!(sceneId && allWeatherScenes()[sceneId]?.on);
}

/**
 * Switch one map on or off, and make the map agree with the answer at once.
 *
 * Switching off paints the clear sky before it forgets the scene, because a map
 * dropped from the list with a storm still on it would keep that storm for
 * good — nothing would ever come back to take it down. Prevention beats undo,
 * which is this module's rule everywhere else too.
 */
export async function setSceneShowsWeather(
  scene: SceneLike | undefined,
  on: boolean
): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM || !scene?.id) return;
  const record = allWeatherScenes();
  if (on) record[scene.id] = { ...record[scene.id], on: true, scene: scene.name };
  else {
    await paint(scene, undefined);
    delete record[scene.id];
  }
  await g.settings?.set(MODULE_ID, SETTINGS.WEATHER_FX_SCENES, record);
  if (on) await syncWeatherFx();
}

/** What a sky amounts to, for telling "already painted" from "changed". */
function signatureOf(sky: WeatherSky | undefined, strength: number): string {
  if (!sky) return CLEAR;
  return [
    sky.falls ?? "",
    sky.density ?? "",
    sky.haze ?? "",
    sky.cloud ?? "",
    sky.glimmer ?? "",
    sky.color ?? "",
    sky.driven ? "driven" : "",
    strength,
  ].join("|");
}

/**
 * One scene, one sky. `undefined` means take ours down and put nothing up.
 *
 * Always a stop before a play, and always by id: what is on the map may have a
 * particle effect where today has only haze, and playing the new one would
 * leave yesterday's rain running underneath it.
 */
async function paint(scene: SceneLike, sky: WeatherSky | undefined): Promise<void> {
  const api = effectsApi();
  if (!api) return;
  await api.stop({ particles: OURS, filters: [OLD_HAZE_FILTER_ID], scene });
  if (!sky) return;
  const particles = effectsFor(sky, weatherFxStrength());
  if (particles.length) await api.play({ particles, scene });
}

/**
 * Make every map that shows the weather agree with the day's roll.
 *
 * Called on every write of the day state, which is often — a spent Travel
 * Point is a write — so **the signature check is what makes this cheap**:
 * nothing is sent to a scene whose sky is already right, and the ordinary
 * outcome is a comparison and no work at all.
 *
 * Every opted-in map is painted, not only the one on screen. The weather is the
 * party's, not the view's; a map pulled up an hour later should already have
 * the right sky rather than acquiring one as somebody looks at it.
 */
export async function syncWeatherFx(): Promise<void> {
  const g = game as Game;
  if (!g.user?.isGM || !effectsApi()) return;

  const record = allWeatherScenes();
  const on = weatherFxOn();
  // Switched off, there is only one thing left to do: take down anything this
  // module put up while it was on. With nothing painted there is nothing to do,
  // which is the default world's answer and costs it a lookup.
  if (!on && !Object.values(record).some((e) => e.applied && e.applied !== CLEAR)) return;

  const sky = on ? weatherSky(getDayState().weather) : undefined;
  const signature = signatureOf(sky, weatherFxStrength());

  let changed = false;
  for (const [sceneId, entry] of Object.entries(record)) {
    if (!entry?.on || entry.applied === signature) continue;
    const scene = (g.scenes as unknown as { get?: (id: string) => SceneLike | undefined })?.get?.(
      sceneId
    );
    // A map deleted since it was switched on. Dropped rather than kept: the
    // entry can never be right again, and nothing else in the module would ever
    // come back to clean it up.
    if (!scene) {
      delete record[sceneId];
      changed = true;
      continue;
    }
    await paint(scene, sky);
    record[sceneId] = { ...entry, applied: signature };
    changed = true;
  }

  if (changed) await g.settings?.set(MODULE_ID, SETTINGS.WEATHER_FX_SCENES, record);
}
