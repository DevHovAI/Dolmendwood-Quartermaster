/**
 * Walk the arithmetic that has no dice in it.
 *
 * Some of what this module decides is not a roll — it is a sum, and a sum that
 * is wrong is wrong every night rather than one night in six. Those pieces are
 * written as pure functions with no Foundry in them precisely so they can be
 * checked here, in a terminal, without a world open.
 *
 * `partySupply.ts` promised a checker like this in a comment long before one
 * existed. This is it, and it covers the night's sleep as well, because that is
 * the newest arithmetic and the one with the most awkward corners.
 *
 *   npm run rules:check
 *
 * A failure prints the case, what was expected, and what came out.
 */

import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let failures = 0;

function eq(label, got, want) {
  const same =
    typeof want === "number" && typeof got === "number"
      ? Math.abs(got - want) < 1e-9
      : JSON.stringify(got) === JSON.stringify(want);
  if (same) return;
  failures++;
  console.error(`  ✗ ${label}\n      expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
}

/** Bundle a source file so its pure exports can be imported without Foundry. */
async function load(dir, entry) {
  const out = join(dir, entry.replace(/[\\/]/g, "_") + ".mjs");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: out,
    logLevel: "error",
  });
  return import(pathToFileURL(out).href);
}

const dir = await mkdtemp(join(tmpdir(), "dw-rules-"));
try {
  // ── The night, watch by watch ───────────────────────────────────────────────
  const camping = await load(dir, "src/data/camping.ts");
  const { nightSleepHours, unguardedFrom, watchShares } = camping;

  const night = (opts) => nightSleepHours({ nightHours: 8, watchers: 4, ...opts });

  console.log("night: an even watch");
  eq("somebody not on watch sleeps the night", night({ order: 0 }), 8);
  eq("a watcher loses their own two hours", night({ order: 1 }), 6);
  eq("the last watcher likewise", night({ order: 4 }), 6);

  console.log("night: a watcher nods off");
  eq("those before them stood theirs", night({ order: 1, asleepFrom: 2 }), 6);
  eq("the sleeper is credited nothing extra", night({ order: 2, asleepFrom: 2 }), 6);
  eq("the next in line is never woken", night({ order: 3, asleepFrom: 2 }), 8);
  eq("nor the one after", night({ order: 4, asleepFrom: 2 }), 8);
  eq("the camp is unguarded from that watch", unguardedFrom(8, 4, 2), 2);
  eq("a watch that held leaves no gap", unguardedFrom(8, 4, undefined), undefined);

  console.log("night: the camp is roused");
  eq("roused in the first watch, nobody slept", night({ order: 0, rousedInWatch: 1 }), 0);
  eq("roused in the third, a sleeper had four", night({ order: 0, rousedInWatch: 3 }), 4);
  eq("a watcher who had stood theirs, two", night({ order: 1, rousedInWatch: 3 }), 2);
  eq("one whose turn had not come, four", night({ order: 4, rousedInWatch: 3 }), 4);
  eq("one on watch when it happened", night({ order: 3, rousedInWatch: 3 }), 4);
  eq("roused after the last watch began", night({ order: 0, rousedInWatch: 4 }), 6);

  console.log("night: three watchers leave everyone short");
  const three = watchShares(3, 8);
  eq("each stands two hours and forty", Math.round(three.hoursOnWatch * 60), 160);
  eq("and sleeps five hours and twenty", Math.round(three.hoursAsleep * 60), 320);
  eq("which the book calls a short night", three.shortNight, true);
  eq("four watchers do not", watchShares(4, 8).shortNight, false);

  console.log("night: nobody stands watch at all");
  eq("everybody sleeps it through", nightSleepHours({ nightHours: 8, watchers: 0, order: 0 }), 8);

  // ── What the party can actually supply ──────────────────────────────────────
  const supply = await load(dir, "src/data/partySupply.ts");
  const { allocate, spacesLeft, mayClaim, coversPerUnit } = supply;
  const stock = (spaces) => ({ units: spaces, spaces, carriers: [] });

  console.log("supply: a tent holds two");
  eq("that is the catalogue's own number", coversPerUnit("tent"), 2);
  eq("anything else covers one", coversPerUnit("bedroll"), 1);

  console.log("supply: places are handed out carriers first");
  eq(
    "whoever bought it gets to use it",
    allocate(2, ["c"], ["a", "b", "c"]),
    ["a", "c"]
  );
  eq("and the order stays the party's", allocate(3, ["c"], ["a", "b", "c"]), ["a", "b", "c"]);
  eq("no places, nobody covered", allocate(0, ["c"], ["a", "b", "c"]), []);

  console.log("supply: a full list does not freeze itself");
  eq("never below nought", spacesLeft(stock(3), 5), 0);
  eq("somebody already on it may stay", mayClaim(stock(1), ["a"], "a"), true);
  eq("somebody else may not", mayClaim(stock(1), ["a"], "b"), false);
} finally {
  await rm(dir, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} problem${failures === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("\nrules: the arithmetic holds.");
