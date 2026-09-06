/**
 * The attribute sheet, rendered without a browser.
 *
 * **Named by `CharacterSheetApp.ts` since it was written, and it did not
 * exist** — the same gap `check-supply.js` had before `rules:check` filled it.
 * It exists now, and it does the two things that file claims for it.
 *
 * **1. The template renders in both languages.** Every string on this window
 * comes out of `lang/*.json`, and a translation pass can leave exactly two
 * marks behind: a key that renders as itself, because the key in the template
 * is not the key in the file; and a `{placeholder}` nothing filled in, because
 * the template passed `name=` where the string asks for `{who}`. Neither is a
 * crash, both are visible nonsense on the sheet, and neither shows up in
 * `lang:check` — that file compares the two languages against each other and
 * cannot know what a template asks for. So the sheet is actually rendered,
 * against the real language files, in four passes: both languages, plus the
 * no-Class and no-system branches, which is where half the prose lives.
 *
 * **2. `PORTRAIT_BOX` still agrees with the stylesheet.** The window measures
 * a portrait against that constant to say whether the file is too small, and
 * the answer is only true while the number matches the width the stylesheet
 * actually draws.
 *
 * Handlebars comes from the repo's own `node_modules`, and failing that from
 * the installed Foundry — the same engine the browser will use.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FOUNDRY_HANDLEBARS =
  "C:/Program Files/Foundry Virtual Tabletop/resources/app/node_modules/handlebars";

function handlebars() {
  for (const where of ["handlebars", FOUNDRY_HANDLEBARS]) {
    try {
      return require(where);
    } catch {
      /* try the next one */
    }
  }
  console.error("No Handlebars to render with — not in node_modules, not in Foundry's.");
  process.exit(2);
}

const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

let problems = 0;
const fail = (line) => {
  console.error(`  ✗ ${line}`);
  problems++;
};

// ─── Foundry's own two rules for a string ────────────────────────────────────

/** `Localization#format`: substitute every `{field}` the data has a value for. */
function format(str, data) {
  return str.replace(/\{[^}]+\}/g, (token) => {
    const field = token.slice(1, -1);
    return field in data ? String(data[field]) : token;
  });
}

/** The `localize` helper, as `client/applications/handlebars.mjs` defines it. */
function localizer(table, lang) {
  return (key, options) => {
    if (typeof key !== "string") return "";
    if (!(key in table)) {
      fail(`${lang}: no such key — ${key}`);
      return key;
    }
    const hash = options?.hash ?? {};
    return Object.keys(hash).length ? format(table[key], hash) : table[key];
  };
}

// ─── A sheet with something in every branch ──────────────────────────────────

const ability = (key, label, governs, houseRuled = false) => ({
  key,
  label,
  short: key.toUpperCase(),
  governs,
  value: 13,
  bonus: 1,
  signed: "+1",
  houseRuled,
  byTheBook: "+0",
});

/**
 * The context the window builds, with every conditional turned on.
 *
 * Written by hand rather than taken from `_prepareContext`, which wants an
 * Actor, a Foundry and a world. What it has to stay true to is the *shape*:
 * when a field is renamed there, this file is what says so, by rendering a
 * blank where the sheet will render one.
 */
const full = {
  hasSystem: true,
  canEdit: true,
  name: "Someone",
  img: "portrait.webp",
  identity: {
    kindred: "Breggle",
    class: "Knight",
    alignment: "Lawful",
    background: "Onion farmer",
    affiliation: "The Watch",
    moonSign: "Grinning moon, waxing — a thing",
  },
  languages: "Woldish, Gaffe",
  abilities: [
    ability("str", "Strength", "Melee attacks and damage"),
    ability("int", "Intelligence", "Extra languages", true),
  ],
  abilityCheckTarget: 4,
  saves: [{ key: "doom", label: "Doom", value: 12 }],
  hp: { value: 7, max: 9 },
  ac: 14,
  attack: 1,
  attackSigned: "+1",
  magicResistance: "",
  magicResistanceDerived: "+1",
  level: 3,
  xp: { value: 4200, next: 6000, share: 100 },
  prepares: 2,
  classNames: ["Knight"],
  kindredNames: ["Breggle"],
  alignmentNames: ["Lawful"],
  languageGroups: [{ label: "The common tongue", languages: ["Woldish"] }],
  langPickerOpen: true,
  moonPickerOpen: true,
  personaOpen: true,
  xpMod: { value: 5, manual: true, hasDerived: true, derived: 10, canReset: true },
  weapons: [
    {
      itemId: "w1",
      name: "Bow",
      damage: "1d6",
      icon: "fa-gavel",
      bands: [
        { key: "short", label: "Short 30' (+1)" },
        { key: "medium", label: "Medium 60'" },
      ],
      modes: [
        { missile: true, label: "Missile" },
        { missile: false, label: "Melee" },
      ],
      notesLine: "Two-handed",
    },
  ],
  hasWeapons: true,
  penalties: "-1 to Attack Rolls and -1 to Damage — hunger -1.",
  groups: [
    {
      label: "Spells, 1st",
      blocks: [
        {
          id: "b1",
          name: "Bless",
          slug: "bless",
          text: "A blessing.",
          value: 2,
          uses: { value: 1, max: 2 },
          spell: "holy",
          isArcane: false,
          rollable: true,
          charges: 1,
          chargeLabel: "1 ready",
          canMark: true,
          prepared: 1,
        },
      ],
    },
  ],
  hasBlocks: true,
  hasSpells: true,
  spellCredits: 2,
  spellCreditLine: "2 spell credits left",
  skills: [
    { key: "listen", label: "Listen", target: 6, custom: false, address: "@listen" },
    { key: "climb", label: "Climb", target: 4, custom: true, address: "@s.climb" },
    { empty: true, add: true },
  ],
  persona: [
    { key: "head", label: "Head", value: "", options: ["Bald"], picks: [], pickerOpen: false },
    {
      key: "desires",
      label: "Desires",
      value: "",
      wide: true,
      pickerOpen: true,
      picks: [{ text: "Gold", chosen: false }],
    },
  ],
  backgroundOptions: ["Onion farmer"],
  moonSigns: [
    {
      moon: "Grinning",
      signs: [
        {
          moon: "Grinning",
          phase: "waxing",
          range: "01-03",
          effect: "Undead ignore them.",
          index: 0,
          chosen: true,
          label: "Grinning moon, waxing",
        },
      ],
    },
  ],
  moonSignForeign: true,
  advance: {
    classLabel: "Knight",
    nextXp: 6000,
    capXp: 12000,
    hasNext: true,
    hasCap: true,
    toCap: 7800,
    capLine: "Cap 12,000 XP — 7,800 to go.",
    atCap: false,
    routes: [
      {
        id: "trainer",
        label: "With a trainer",
        duration: "Until the end of the day",
        costNote: "100 gp × Level 3",
        available: true,
      },
      {
        id: "cap",
        label: "At the cap, without waiting",
        duration: "At once",
        costNote: "3,000 XP",
        available: false,
        blocked: "7,800 XP short — needs 12,000.",
      },
    ],
  },
};

/** The other half of the prose: no Class, no system, nothing written down. */
const bare = {
  ...full,
  hasSystem: false,
  hasWeapons: false,
  hasBlocks: false,
  hasSpells: false,
  weapons: [],
  groups: [],
  advance: null,
  penalties: "",
  xpMod: { value: 0, manual: false, hasDerived: false, derived: 0, canReset: false },
};

// ─── 1. Does it render? ──────────────────────────────────────────────────────

const H = handlebars();
H.registerHelper("eq", (a, b) => a === b);
const template = read("templates/character-sheet.hbs");

for (const lang of ["en", "de"]) {
  const table = JSON.parse(read(`lang/${lang}.json`));
  H.registerHelper("localize", localizer(table, lang));
  const render = H.compile(template);

  const cases = [
    ["a full sheet", full],
    ["a Class the book never printed", { ...bare, identity: { ...full.identity, class: "Wizard" } }],
    ["an empty sheet", { ...bare, identity: { ...full.identity, class: "" } }],
  ];

  for (const [what, context] of cases) {
    const out = render(context);
    // A key that came out as itself: the template asked for one the file has
    // not got, or a `{{localize}}` was written round a value rather than a key.
    for (const m of out.matchAll(/DOLMENWOOD\.[A-Za-z0-9.]+/g)) {
      fail(`${lang}, ${what}: key rendered as itself — ${m[0]}`);
    }
    // Braces never survive a render, so anything left in them came out of a
    // language string whose placeholder nothing filled.
    for (const m of out.matchAll(/\{[a-zA-Z][a-zA-Z0-9]*\}/g)) {
      fail(`${lang}, ${what}: placeholder never filled — ${m[0]}`);
    }
  }
  console.log(`  ${lang}: three renders`);
}

// ─── 2. Does the window still know how big the box is? ───────────────────────

const declared = Number(/const PORTRAIT_BOX = (\d+);/.exec(read("src/apps/CharacterSheetApp.ts"))?.[1]);
const drawn = Number(
  /\.dw-sheet-portrait-box \{[^}]*?width: (\d+)px;/s.exec(read("styles/module.css"))?.[1]
);
if (!declared || !drawn) fail("could not read PORTRAIT_BOX or the stylesheet's width");
else if (declared !== drawn) {
  fail(`PORTRAIT_BOX is ${declared} and the stylesheet draws ${drawn} — the "your picture is too small" tooltip is measuring against the wrong number`);
} else console.log(`  portrait box: ${declared}px both places`);

console.log(problems ? `\n${problems} problems.` : "\nthe sheet renders in both languages.");
process.exit(problems ? 1 : 0);
