/**
 * The translation files, checked without Foundry running.
 *
 * **Why this exists.** A missing key in Foundry does not throw — it renders the
 * key itself, so `DOLMENWOOD.Xp.Lane.Credited` appears in the window where a
 * word should be. That is a typo you find in play, in front of the table, and
 * only if someone happens to open that window in that language. There are
 * ~1,100 strings coming; finding them by eye is not a plan.
 *
 * Four things are checked:
 *
 * 1. **Both files parse**, and hold exactly the same keys.
 * 2. **Placeholders match per key.** `{count}` in English and `{anzahl}` in
 *    German is a string that silently prints a brace at the table.
 * 3. **Plural pairs are complete** — a `.One` without its `.Other`.
 * 4. **Every key the code asks for exists.** This is the one that matters most:
 *    it catches the typo at the call site, which no amount of reading the JSON
 *    will ever show.
 *
 * Run with `npm run lang:check`. Exits non-zero on any failure, so it can go in
 * front of a release the way `typecheck` does.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const LANGS = ["en", "de"];
const BASE = "en";

/** Every file under a directory, filtered by extension. */
function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(path);
  }
  return out;
}

const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

let failures = 0;
const fail = (msg) => {
  console.error(`  ✗ ${msg}`);
  failures++;
};

// ── 1. Load and parse ────────────────────────────────────────────────────────
const tables = {};
for (const lang of LANGS) {
  const path = `lang/${lang}.json`;
  try {
    tables[lang] = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`  ✗ ${path} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
}
console.log(`lang: ${LANGS.map((l) => `${l}=${Object.keys(tables[l]).length}`).join("  ")}`);

// ── 1b. The files survive Foundry's expandObject ─────────────────────────────
//
// Foundry does not read a flat "A.B.C" key straight out of the JSON. It runs
// the whole file through `expandObject` first, turning it into nested objects,
// and `localize` then walks that tree. So a key that is **both a leaf and a
// branch** is fatal: "Xp.Clear" holding the word "Clear" while "Xp.Clear.Hint"
// needs "Clear" to be an object.
//
// What makes it worth a check of its own is the failure mode. Foundry catches
// the throw and substitutes an **empty** table — so one bad pair costs the
// entire language file, and every string in the module renders as its own key.
// Nothing points at the real cause: the JSON is valid, the server serves it,
// the manifest is right.
//
// That shipped on 2026-09-04 and cost an evening. Seven pairs, all of the shape
// `X` + `X.Hint`. The fix is to name the leaf: `X.Label` + `X.Hint`.
for (const lang of LANGS) {
  const keys = Object.keys(tables[lang]);
  for (const key of keys) {
    const branch = keys.find((k) => k !== key && k.startsWith(`${key}.`));
    if (branch) {
      fail(
        `${lang}.json: "${key}" holds text, but "${branch}" needs it to be a branch. ` +
          `Foundry's expandObject throws on this and discards the WHOLE file — ` +
          `rename the leaf, e.g. "${key}.Label".`
      );
    }
  }
}
if (failures) {
  console.error(`\n${failures} fatal problem${failures === 1 ? "" : "s"}.`);
  process.exit(1);
}

// ── 2. Same keys, same placeholders ──────────────────────────────────────────
const baseKeys = Object.keys(tables[BASE]);
for (const lang of LANGS.filter((l) => l !== BASE)) {
  const other = tables[lang];

  for (const key of baseKeys) {
    if (!(key in other)) {
      fail(`${lang}.json is missing ${key}`);
      continue;
    }
    if (placeholders(tables[BASE][key]) !== placeholders(other[key])) {
      fail(
        `${key}: placeholders differ — ` +
          `${BASE} has {${placeholders(tables[BASE][key])}}, ` +
          `${lang} has {${placeholders(other[key])}}`
      );
    }
  }
  for (const key of Object.keys(other)) {
    if (!(key in tables[BASE])) fail(`${lang}.json has ${key}, which ${BASE}.json does not`);
  }
}

// ── 3. Plural pairs are complete ─────────────────────────────────────────────
for (const lang of LANGS) {
  for (const key of Object.keys(tables[lang])) {
    const twin = key.endsWith(".One")
      ? key.slice(0, -4) + ".Other"
      : key.endsWith(".Other")
        ? key.slice(0, -6) + ".One"
        : null;
    if (twin && !(twin in tables[lang])) fail(`${lang}.json has ${key} but not ${twin}`);
  }
}

// ── 4. Every key the code asks for exists ────────────────────────────────────
// Any "DOLMENWOOD.…" string literal counts as a key the code will look up,
// whichever door it goes through — t(), tn(), {{localize}}, {{localizeN}} or an
// ApplicationV2 window title. A plural base resolves through its .One/.Other.
//
// Comments are stripped first. The doc comment on `t()` names an example key to
// explain itself, and a checker that cannot tell an example from a call site
// reports the documentation as a bug — which is how this very check first ran.
const sources = [...walk("src", [".ts"]), ...walk("templates", [".hbs"])];
const asked = new Map();
const families = new Map();
for (const path of sources) {
  const text = readFileSync(path, "utf8")
    .replace(/\{\{!--[\s\S]*?--\}\}/g, "") // {{!-- handlebars block --}}
    .replace(/\{\{![\s\S]*?\}\}/g, "") //     {{! handlebars short }}
    .replace(/\/\*[\s\S]*?\*\//g, "") //      /* block, JSDoc included */
    .replace(/^\s*\/\/.*$/gm, ""); //         // line

  for (const m of text.matchAll(/["'`](DOLMENWOOD\.[A-Za-z0-9_.]+)["'`]/g)) {
    if (!asked.has(m[1])) asked.set(m[1], path);
  }

  // **A key the code builds rather than writes.** The weather tables ask for
  // `DOLMENWOOD.Weather.Table.${table}.R${roll}` — sixty-six real keys and not
  // one literal to match, so without this they all read as unused and a typo
  // in the pattern would never be caught. The part before the first ${ is the
  // family; every key under it counts as asked for.
  for (const m of text.matchAll(/`(DOLMENWOOD\.[A-Za-z0-9_.]*)\${/g)) {
    if (!families.has(m[1])) families.set(m[1], path);
  }
}

const table = tables[BASE];
for (const [key, path] of asked) {
  const known = key in table || `${key}.One` in table || `${key}.Other` in table;
  if (!known) fail(`${path} asks for ${key}, which ${BASE}.json does not define`);
}
console.log(`keys asked for by the code: ${asked.size}`);

const covered = (key) => [...families.keys()].some((p) => key.startsWith(p));
for (const [prefix, path] of families) {
  if (!baseKeys.some((k) => k.startsWith(prefix)))
    fail(`${path} builds keys under ${prefix}, which ${BASE}.json has none of`);
}
if (families.size)
  console.log(
    `key families built at runtime: ${families.size} (${baseKeys.filter(covered).length} keys)`
  );

// Unused keys are reported but do not fail: a key may be waiting for the window
// that will use it, and the 52 keys from v1.x are exactly that.
const unused = baseKeys.filter(
  (k) => !asked.has(k) && !asked.has(k.replace(/\.(One|Other)$/, "")) && !covered(k)
);
if (unused.length) console.log(`unused keys (not an error): ${unused.length}`);

if (failures) {
  console.error(`\n${failures} problem${failures === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("lang files agree.");
