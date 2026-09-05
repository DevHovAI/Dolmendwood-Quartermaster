/**
 * The one door to Foundry's translation table.
 *
 * **Dolmenmaster's ask, 2026-09-04:** the module should speak German — the interface
 * first, the book's own text after. Every string in this module was written
 * inline in English, and `lang/de.json` has shipped since v1.x without a single
 * caller, so the wiring is what has to come first.
 *
 * **Why a wrapper and not `game.i18n.localize` at the call site.** Three
 * reasons, in the order they will bite:
 *
 * 1. `game.i18n` does not exist until Foundry's `i18nInit` hook. Anything this
 *    module evaluates at module scope — and `constants.ts` and the data tables
 *    do plenty — would throw on a bare call. `t()` hands back the key instead,
 *    which renders as visible nonsense rather than a white screen, and says in
 *    the string itself which key was read too early.
 * 2. A missing key in Foundry returns the key. That is the right fallback and
 *    the wrong report: it looks like a typo in the template. `t()` is the one
 *    place a check for that can go when the German pass makes it worth having.
 * 3. It is shorter, and there are ~1,100 of these to write.
 *
 * **Keys are `DOLMENWOOD.<Area>.<Thing>`,** the shape the 52 keys already in
 * `lang/en.json` use. Do not invent a second scheme.
 */

/**
 * One string out of the table.
 *
 * `data` turns it into a `format` call, so a key may carry `{placeholders}`:
 * `t("DOLMENWOOD.Xp.LeftOver", { n: 3 })` against `"{n} left over"`.
 *
 * **Placeholders, not concatenation.** German puts its words in a different
 * order than English, and a sentence glued together from three translated
 * fragments cannot be reordered by a translator — it can only be reordered by
 * changing this file. One key per sentence keeps the word order where it
 * belongs, in `lang/*.json`.
 */
export function t(key: string, data?: Record<string, string | number>): string {
  const i18n = (game as Game).i18n;
  if (!i18n) return key;
  if (!data) return i18n.localize(key);

  // `format` substitutes by string replacement and takes only strings. Numbers
  // are the common case here — counts, XP totals, thresholds — so they are
  // turned at this boundary rather than at each of the call sites.
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) fields[k] = String(v);
  return i18n.format(key, fields);
}

/**
 * One string, in the singular or the plural.
 *
 * Reads `<keyBase>.One` or `<keyBase>.Other`, and always passes `count` as a
 * placeholder so the key may print the figure it counted.
 *
 * **Two forms is enough for these two languages** — English and German both
 * take one form for exactly 1 and one for everything else — and the choice is
 * made here rather than in a template, because `character{{#unless (eq n 1)}}s{{/unless}}`
 * is an English plural rule written into markup where no translator can reach
 * it. German does not form its plural by appending a letter.
 */
export function tn(
  key: string,
  count: number,
  data?: Record<string, string | number>
): string {
  return t(`${key}.${count === 1 ? "One" : "Other"}`, { count, ...data });
}
