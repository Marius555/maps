/**
 * Enforces the embed's size budget (CLAUDE.md §4).
 *
 * §4 sets the target at "under 250KB gzipped including MapLibre". Measured, that
 * is not reachable with MapLibre v6 — its own dist files are 297.4KB gzipped
 * (6.11.2) before a byte of ours:
 *
 *     maplibre-gl.mjs          146.9KB   main thread
 *     maplibre-gl-shared.mjs   144.6KB   shared by the main thread and the worker
 *     maplibre-gl-worker.mjs     6.0KB   tile parsing
 *
 * MapLibre v6 ships ESM only, with no UMD, CSP or slim build to fall back to,
 * and it is minified already. The number is a floor, not slack.
 *
 * So the check splits in two, and each half watches a different thing go wrong:
 *
 * - **Our own code has a real budget.** It is the only part a change can grow,
 *   and it is what the §4 rule is actually there to protect.
 * - **The vendor files have a ceiling**, to catch MapLibre itself ballooning on
 *   an upgrade or a second copy of a chunk sneaking back in. That second failure
 *   mode is not hypothetical: bundling MapLibre rather than sharing it with the
 *   worker cost 128KB and looked fine until measured.
 *
 * The **total** is printed and not enforced. It is the number §4 talks about and
 * the number a visitor actually downloads, so it has to be on screen every time
 * — but it is a budget plus a fixed cost, and a sum cannot say which half moved.
 * See `VENDOR_CEILING_BYTES` for why it used to be the gate and why it stopped.
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
 * *total* a visitor downloads, which was the ceiling below and was at 313.0KB of
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
 * Raised a third time, from 46KB, for the narrow-width drawer — and this is the
 * raise the note above told the next person not to make, so it owes an argument
 * rather than a sentence.
 *
 * What it bought: below 640px of the embed's own box, the results list stops
 * taking 40% of an already small map and becomes a drawer behind a button next
 * to the search field. Measured, the whole feature is about 700 bytes gzipped —
 * roughly 300 of CSS geometry and 400 of the trigger, the open/close and the
 * `ResizeObserver` that moves the toolbar out of the panel (which no stylesheet
 * can do; see `installDrawer`). It went 220 bytes over.
 *
 * Three things were checked before the number moved, and they are the checks to
 * repeat rather than the conclusion to reuse:
 *
 * - **The total had the room.** That is what §4 is actually protecting and what
 *   a visitor downloads: 319.4KB against the 320KB ceiling that used to sit
 *   below, which that raise did not touch.
 * - **The failure mode this number exists to catch was ruled out.** `ours`
 *   growing by tens of kilobytes is React or a date library finding its way in.
 *   220 bytes is not that, and the diff was audited rather than assumed.
 * - **The cheaper answers were measured, not guessed.** The drawer's own
 *   optional parts are tiny — the click-outside veil is 45 bytes and the RTL
 *   rules 21 — so trimming the feature could not pay for it. Every `lm-*` class
 *   in the stylesheet is still referenced by the source, and every module in
 *   `embed/src` is a shipped feature; the smallest one that would have paid
 *   (the town and postcode gazetteer, ~950 bytes) is a §2 feature that exists
 *   precisely so a visitor's typed query never reaches a geocoder.
 *
 * So that was a deliberate override of the rule above, taken with the numbers on
 * the table, and not a budget quietly following a diff. **The rule stands: do
 * not raise this to get past a binding budget.** Trim, or keep the addition on
 * the dashboard side of the seam.
 *
 * **The pass that could most easily have raised it did not, and that is the
 * shape to copy.** The drawer becoming a bottom sheet and the toolbar growing to
 * 36px were built against this number with 190 bytes in it, while the total
 * ceiling below was at 2 — and what moved was the ceiling, which was measuring
 * the wrong thing, not this, which was measuring the right one. Re-aim a gate
 * that is pointed at the wrong failure mode; never one that is merely in the
 * way.
 *
 * Raised a fourth time, from 47KB, so the narrow-screen switch can have two
 * implementations behind it. **This one is the owner’s call rather than a
 * conclusion reached here**, and it is recorded that way on purpose: the rule
 * above says do not raise this to get past a binding budget, the rule was put to
 * them with the numbers, and they took the override. What follows is the
 * arithmetic they took it on.
 *
 * What it bought: `panelDrawer` used to be one implementation and one fallback —
 * on was the sheet, off was the *stacked* layout, a results panel welded to the
 * bottom 40% of an already small map. Off is now the side drawer this file had
 * before the sheet, behind a hamburger in the floating toolbar. So the switch
 * chooses between two drawers instead of promising one and delivering a layout,
 * and a two-position control with one implementation behind it is a control that
 * lies.
 *
 * **Measured, carrying both axes costs 162 bytes gzipped** — not the 250–350 a
 * straight restore was estimated at, because almost none of it is duplicated:
 * `data-lm-open`, `list.inert`, Escape, the `ResizeObserver` that moves the
 * toolbar and the open rule itself are one mechanism serving both, and the axis
 * is two closed CSS rules and a `sheet` boolean. `transform: translateY(0)`
 * cancels a `translateX` as completely as a `translateY`, which is why the open
 * state needed no second rule at all.
 *
 * **Four trims were taken before the number moved, and they are worth as much as
 * the raise.** The shared drawer rule went from three selectors to one, because
 * the two weight-carriers it was written to out-weigh set nothing but
 * `transform` and it sets none; the hamburger and the strip now share one
 * `button()` call and one accessible name ("Locations" — one control named once,
 * rather than "Show the locations" beside it); `aria-label` is reflected as
 * `ariaLabel` like the `ariaExpanded` beside it; and the trigger’s two placements
 * folded into one branch. Together those paid for 162 − 144 of it, and the trim
 * route is spent rather than untried: the CSS lever this area had
 * (`build.cssTarget`, ~600 bytes) was taken in the pass before last, every
 * `lm-*` class in the stylesheet still has a reference in `embed/src`, and the
 * one `.lm-veil` that did go dead was deleted with the sheet.
 *
 * **The other two checks the raise above demanded still pass.** The total is
 * 320.3KB and is no longer the gate, MapLibre is 273.2KB against a 280KB ceiling
 * that this does not touch, and the failure mode this number exists to catch —
 * `ours` growing by tens of kilobytes, which means React or a date library has
 * found its way in — is not 144 bytes of CSS selectors. **The rule is unchanged
 * for the next person: trim, or keep the addition on the dashboard side of the
 * seam.**
 *
 * Raised a fifth time, from 48KB to 48.1KB, and again **the owner's call with
 * the numbers on the table**, not a conclusion reached here. What it bought:
 * dotted routes that share a road draw one stream of split dots instead of
 * two out-of-phase ones stacked — lib/map/dot-lanes.ts. The geometry stays on
 * the dashboard side of the seam: publish bakes it into `snapshot.dotRuns`, and
 * the embed only turns runs into features and registers the slice images.
 * The raise was granted for a first version (alternating dots, ~175 bytes
 * against 100 spare, 75 over after trimming from 288) that failed in the
 * browser; its replacement costs ~163 bytes and still needs the raise, by 63.
 * The rule is unchanged: trim, or keep the addition on the dashboard side.
 *
 * Raised a sixth time, from 48.1KB to 49.2KB (2026-09-25), and **the owner's
 * call again**, made in advance and in as many words: "you can increase budget
 * of size you dont need to trim that much". What it bought: routes that share a
 * road now *take turns*, A·B·A·B, dot by dot and dash by dash, at the density
 * one route draws alone. The split dots the fifth raise paid for are gone. They
 * kept the density right but read as a jumble of half-dots, not as two routes.
 *
 * **Why this one could not stay on the dashboard side.** MapLibre's symbol
 * layout cannot alternate dots. It clips a line to each tile before placing
 * anchors, and a line entering across a tile edge always starts half a spacing
 * in (`getAnchors`, `isLineContinued`), so any per-lane shift is reset at the
 * first tile edge. The dots on a shared stretch therefore have to be placed by
 * our own code for the zoom level on screen (packages/shared/dot-stream.ts),
 * and placing them again when the view changes is a runtime job, in the
 * visitor's browser. Dashes cost only a data-driven `line-dasharray`.
 *
 * Measured: 50,258 bytes with it, and 49,266 with the stream and the dash lanes
 * cut out, so about 990 bytes. That is more than the 200–300 estimated, and
 * the reason is worth knowing: **this bundle is not minified.** Vite's library
 * mode leaves ES output unminified, so whitespace and full local names ship
 * with every line. Turning minification on would very likely win back several
 * KB, but it changes the whole bundle and is its own decision, not part of
 * this one. 49.2KB leaves 123 bytes spare.
 *
 * **Then minification was switched on, and the budget did not move** (the
 * owner's call, 2026-09-26). `output.minify` in embed/vite.config.mts took ours
 * from 49.1KB to 45.6KB, and the embed's language table, the "Made with" badge
 * and the host-page events were paid for out of that: 46.3KB after all three.
 * The room is headroom now, not an allowance — the rule above is unchanged.
 */
const OWN_BUDGET_BYTES = Math.round(49.2 * 1024);

/**
 * MapLibre's own dist files, with room for a minor upgrade.
 *
 * **This replaces a 320KB ceiling on the total, and the reason is that the total
 * had stopped being able to say anything.** Ours had grown to 47.9KB and
 * MapLibre sits at 273.2KB, which put the sum at 327,678 bytes of a 327,680
 * ceiling: **2 bytes**. At that point every change to the embed failed the gate
 * — including ones that made our own code *smaller*, since a saving of one byte
 * still leaves a total over the line — and the failure message said "check that
 * MapLibre is still external" about diffs that had not been near it.
 *
 * The ceiling's own docblock said what it was for, and it was never this: "to
 * catch MapLibre itself ballooning on an upgrade or a second copy of a chunk
 * sneaking back in". It became a cap on our own code by arithmetic accident —
 * ours grew until the sum happened to land on a round number — and a gate that
 * fires for a reason it does not name is a gate people learn to raise.
 *
 * So it is pointed at the thing it was always describing. 280KB is 6.8KB above
 * today's 273.2KB, which is room for a MapLibre point release and not much else;
 * the duplication regression it exists to catch is +131KB of
 * `maplibre-gl-shared.mjs` and goes straight through it. Both failure modes it
 * was written for are still caught, and neither of them can be caused by a
 * stylesheet edit any more.
 *
 * **What did not change is the number that binds our own code** —
 * `OWN_BUDGET_BYTES` above, untouched at 47KB. If the embed has to grow, that is
 * still the budget to argue with, and §4's rule about not raising it to get past
 * it is still the rule. And if *this* ceiling is ever what binds, that is a §3
 * conversation about the map library, because it means MapLibre grew.
 *
 * **It bound once, and was raised 280 → 305KB on purpose (2026-09-24).** The
 * upgrade from MapLibre 6.2.0 to 6.11.2 grew its own dist files from 273.2KB to
 * 297.4KB, 24.2KB more for every visitor. It was measured against
 * `node_modules/maplibre-gl/dist` directly, so it is MapLibre growing, not a
 * duplicated chunk. Staying on 6.2 was offered; the owner chose the newer
 * library. 305KB keeps the same shape of headroom as before (7.6KB, room for a
 * point release), and the +131KB duplication regression still goes straight
 * through it.
 */
const VENDOR_CEILING_BYTES = 305 * 1024;

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

  console.log(`\n  ours    ${kb(own).padStart(9)}  budget  ${kb(OWN_BUDGET_BYTES)}`);
  console.log(`  maplibre${kb(vendor).padStart(9)}  ceiling ${kb(VENDOR_CEILING_BYTES)}`);
  console.log(`  total   ${kb(total).padStart(9)}  reported, not enforced`);

  const failures = [];

  if (own > OWN_BUDGET_BYTES) {
    failures.push(
      `Our own code is ${kb(own - OWN_BUDGET_BYTES)} over its ${kb(OWN_BUDGET_BYTES)} budget. ` +
        "Every byte loads on a stranger's website — cut something, or raise the " +
        "budget deliberately.",
    );
  }

  if (vendor > VENDOR_CEILING_BYTES) {
    failures.push(
      `MapLibre is ${kb(vendor - VENDOR_CEILING_BYTES)} over the ${kb(VENDOR_CEILING_BYTES)} ceiling. ` +
        "Check that it is still external in embed/vite.config.mts and that the " +
        "worker shares maplibre-gl-shared.mjs instead of getting its own copy. " +
        "If it really did grow, that is a §3 conversation about the map library.",
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
