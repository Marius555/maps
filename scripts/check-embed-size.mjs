/**
 * Enforces the embed's size budget (CLAUDE.md §4).
 *
 * §4 sets the target at "under 250KB gzipped including MapLibre". Measured, that
 * is not reachable with MapLibre v6 — its own dist files are 273.2KB gzipped
 * before a byte of ours:
 *
 *     maplibre-gl.mjs          136.4KB   main thread
 *     maplibre-gl-shared.mjs   131.0KB   shared by the main thread and the worker
 *     maplibre-gl-worker.mjs     5.8KB   tile parsing
 *
 * MapLibre v6 ships ESM only, with no UMD, CSP or slim build to fall back to,
 * and it is minified already. The number is a floor, not slack.
 *
 * So the check splits in two:
 *
 * - Our own code has a real budget. It is the only part a change can grow, and
 *   it is what the §4 rule is actually there to protect.
 * - The total has a hard ceiling, well above the floor, to catch MapLibre itself
 *   ballooning on an upgrade or a second copy of a chunk sneaking back in. That
 *   second failure mode is not hypothetical: bundling MapLibre rather than
 *   sharing it with the worker cost 128KB and looked fine until measured.
 *
 * Source maps are excluded — browsers fetch them only with devtools open.
 */

import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "embed");
/** Vite's `publicDir`. Whatever is in here is copied to OUT_DIR and never ships. */
const HARNESS_DIR = join(process.cwd(), "embed", "dev");

/**
 * Everything in the bundle that is ours: map.js plus the CSS inlined into it.
 *
 * Raised from 40KB when the card designer landed, deliberately and with the
 * number written down here rather than shaved out of something else: per-block
 * typography, the week's own options and a description clamp cost 1.0KB
 * gzipped, and the budget had 1.2KB of room. The rule §4 is protecting is the
 * *total* a visitor downloads, which is the ceiling below and is at 313.0KB of
 * 320KB — 1KB against that is 0.3%, for a feature that is most of what the card
 * designer is. The alternative was leaving 300 bytes of headroom, which is a
 * budget that fails on the next comment somebody writes.
 *
 * Raised again, from 42KB, for the map designer — and this time the budget was
 * genuinely at zero rather than nearly there: 43,008 of 43,008 bytes, passing
 * only because the comparison is `>`. What it bought is the whole of what a
 * customer's visitors see becoming the owner's to arrange: the results panel
 * over the map on whichever side, see-through, a pin at the head of every
 * results row, MapLibre's own controls in a corner of the owner's choosing, and
 * the embed's colour tokens.
 *
 * Two things make 46 the honest number rather than a shrug. The *total* — the
 * thing §4 is actually protecting, and the thing a visitor downloads — has the
 * headroom for it: 4.8KB spare under the ceiling below, and 46KB spends about
 * three of them. And it was paid for in part rather than borrowed whole: the
 * tag filter chips went out with this change (`embed/src/filters.ts`, its CSS,
 * and the per-row tag), because every label they offered is in the search index
 * and a chip row is a second vocabulary competing with the search box for the
 * top of the panel.
 *
 * The floor to hold the line at is roughly a kilobyte of slack. If a change
 * eats it, measure before raising this again: `ours` growing by tens of
 * kilobytes is a React or a date library that has found its way in (§4), and
 * that is exactly what this number exists to catch.
 */
const OWN_BUDGET_BYTES = 46 * 1024;
/** Ours plus MapLibre. Above the 273.2KB floor with room for a minor upgrade. */
const TOTAL_CEILING_BYTES = 320 * 1024;

const isVendor = (name) => name.startsWith("maplibre-gl");

/**
 * The manual harness (embed/dev/, copied in by Vite's publicDir) shares the
 * output directory but is never deployed, so counting it would inflate the
 * number that matters.
 *
 * **Read from the harness directory rather than matched by name**, because a
 * name pattern has now mis-classified a harness file twice. First it was two
 * hard-coded names, and adding `dev-legacy.json` — the pre-merge snapshot the §7
 * read path is checked against — failed the budget by 2.2KB of a file no visitor
 * will ever fetch. That was replaced by `/^dev[.-]/`, which failed the same way
 * the moment a harness page was added that is not called dev-something
 * (`live.html`, which points the bundle at a real published snapshot).
 *
 * Both times the failure reads as "the embed grew, cut something", which is the
 * expensive way to be wrong: the honest response to it is to shave real code
 * that was never the problem. The directory listing cannot drift from the truth,
 * because it *is* the thing Vite copies.
 */
async function harnessNames() {
  try {
    return new Set(await readdir(HARNESS_DIR));
  } catch {
    // Not a checkout of this repo's embed source — measure everything rather
    // than silently under-reporting.
    return new Set();
  }
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

async function main() {
  let entries;

  try {
    entries = await readdir(OUT_DIR);
  } catch {
    console.error('No build output in public/embed. Run "npm run build:embed".');
    process.exit(1);
  }

  const harness = await harnessNames();

  const files = entries
    .filter((name) => !name.endsWith(".map") && !harness.has(name))
    .sort();

  if (files.length === 0) {
    console.error("public/embed contains no shippable files.");
    process.exit(1);
  }

  let own = 0;
  let vendor = 0;

  console.log("Embed bundle (gzipped, as a visitor downloads it):");

  for (const name of files) {
    const size = gzipSync(await readFile(join(OUT_DIR, name))).length;

    if (isVendor(name)) vendor += size;
    else own += size;

    console.log(
      `  ${name.padEnd(26)} ${kb(size).padStart(9)}  ${isVendor(name) ? "maplibre" : "ours"}`,
    );
  }

  const total = own + vendor;

  console.log(`\n  ours    ${kb(own).padStart(9)}  budget ${kb(OWN_BUDGET_BYTES)}`);
  console.log(`  maplibre${kb(vendor).padStart(9)}  fixed cost`);
  console.log(`  total   ${kb(total).padStart(9)}  ceiling ${kb(TOTAL_CEILING_BYTES)}`);

  const failures = [];

  if (own > OWN_BUDGET_BYTES) {
    failures.push(
      `Our own code is ${kb(own - OWN_BUDGET_BYTES)} over its ${kb(OWN_BUDGET_BYTES)} budget. ` +
        "Every byte loads on a stranger's website — cut something, or raise the " +
        "budget deliberately.",
    );
  }

  if (total > TOTAL_CEILING_BYTES) {
    failures.push(
      `The whole bundle is ${kb(total - TOTAL_CEILING_BYTES)} over the ${kb(TOTAL_CEILING_BYTES)} ceiling. ` +
        "Check that MapLibre is still external and that the worker shares " +
        "maplibre-gl-shared.mjs instead of getting its own copy.",
    );
  }

  if (failures.length > 0) {
    console.error(`\n${failures.join("\n\n")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Failed to measure the embed bundle.");
  console.error(error);
  process.exit(1);
});
