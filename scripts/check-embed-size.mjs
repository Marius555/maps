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

/** Everything in the bundle that is ours: map.js plus the CSS inlined into it. */
const OWN_BUDGET_BYTES = 40 * 1024;
/** Ours plus MapLibre. Above the 273.2KB floor with room for a minor upgrade. */
const TOTAL_CEILING_BYTES = 320 * 1024;

const isVendor = (name) => name.startsWith("maplibre-gl");

/**
 * The manual harness (embed/dev/, copied in by Vite's publicDir) shares the
 * output directory but is never deployed, so counting it would inflate the
 * number that matters.
 */
const isHarness = (name) => name === "dev.html" || name === "dev.json";

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

async function main() {
  let entries;

  try {
    entries = await readdir(OUT_DIR);
  } catch {
    console.error('No build output in public/embed. Run "npm run build:embed".');
    process.exit(1);
  }

  const files = entries
    .filter((name) => !name.endsWith(".map") && !isHarness(name))
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
