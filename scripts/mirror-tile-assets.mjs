/**
 * The three asset classes a basemap needs besides its tiles.
 *
 *   npm run mirror:tile-assets
 *   npm run mirror:tile-assets -- --dry-run
 *   npm run mirror:tile-assets -- --only=sprites
 *
 * Switching the vector tiles to our own archive and leaving these behind has not
 * removed the dependency — it has hidden it. A style whose fonts live on someone
 * else's server renders a map with no labels the day that server stops, and
 * nothing in the console says why.
 *
 *   fonts    Glyph ranges per font stack. The stacks are read out of the styles
 *            themselves rather than listed here, so a stack added upstream comes
 *            along. `Noto Sans Regular` matters beyond the basemap: the embed's
 *            cluster-count layer names it directly (embed/src/map.ts).
 *   sprites  The POI icon sheet: .json + .png, and again at @2x.
 *   raster   Natural Earth shaded relief, z0–6, the styles' second source. ~5.4k
 *            small PNGs, which is most of the requests this script makes.
 *
 * Written to /public/tiles/ at the **same path** upstream serves them from, which
 * is what lets scripts/tile-style.mjs rewrite a URL by swapping its origin and
 * nothing else. Two scripts, one convention, no list of filenames to keep in step.
 *
 * Resumable on purpose. It skips anything already on disk, so an interrupted run
 * continues instead of replaying thousands of requests against a donation-funded
 * server. Empty glyph ranges 404 and are skipped — most of the 256 ranges have no
 * glyphs in Noto Sans — and a re-run will ask for those again, which is the price
 * of not keeping a manifest of absences.
 *
 * `--dry-run` prints the plan and fetches nothing — the only way to check the URL
 * and path derivation without making thousands of requests to find out. `--only=`
 * narrows a run to fonts, sprites or raster, for retrying one class or for proving
 * the whole thing works on the four sprite files before committing to the long
 * tail. Measured on a real run: 768 glyph ranges (102MB — Noto Sans covers far
 * more than Latin), 4 sprite files, 5,461 raster tiles (312MB). 414MB in total,
 * which is nothing in a bucket and worth knowing before you start it on a laptop.
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { BASEMAP_SOURCES, fontStacks, OPENFREEMAP } from "./tile-style.mjs";

const OUT_ROOT = join(process.cwd(), "public", "tiles");

/** Polite rather than fast. This is one long run against somebody else's box. */
const CONCURRENCY = 8;

/** Unicode, in the 256-codepoint ranges MapLibre asks for. */
const GLYPH_RANGES = Array.from({ length: 256 }, (_, i) => `${i * 256}-${i * 256 + 255}`);

console.log(`Reading the five styles to find out what they reference…\n`);

const styles = [];
for (const source of BASEMAP_SOURCES) {
  const response = await fetch(`${OPENFREEMAP}/styles/${source}`);
  if (!response.ok) {
    console.error(`Could not read the ${source} style: HTTP ${response.status}`);
    process.exit(1);
  }
  styles.push(await response.json());
}

const KINDS = { fonts: fontJobs, sprites: spriteJobs, raster: rasterJobs };

const only = (process.argv.find((arg) => arg.startsWith("--only=")) ?? "").slice(7);
const dryRun = process.argv.includes("--dry-run");

if (only && !(only in KINDS)) {
  console.error(`Unknown --only=${only}. One of: ${Object.keys(KINDS).join(", ")}`);
  process.exit(1);
}

const jobs = [];
for (const [kind, build] of Object.entries(KINDS)) {
  if (only && kind !== only) continue;

  const of = build(styles);
  jobs.push(...of);
  console.log(`  ${String(of.length).padStart(5)}  ${kind}`);
}

console.log("");
console.log(`${jobs.length} files to consider.`);
console.log("");

if (dryRun) {
  for (const job of samples(jobs)) {
    console.log(`  ${job.url}`);
    console.log(`    -> ${localPathFor(job.url)}`);
  }

  console.log("");
  console.log("Dry run: nothing fetched, nothing written.");
  process.exit(0);
}

const stats = { written: 0, skipped: 0, absent: 0, failed: 0 };
await runPool(jobs, CONCURRENCY, fetchOne);

console.log("");
console.log(
  `${stats.written} written, ${stats.skipped} already present, ` +
    `${stats.absent} not published upstream, ${stats.failed} failed.`,
);

if (stats.failed > 0) {
  console.error("");
  console.error("Re-run to retry the failures — anything already on disk is skipped.");
}

process.exit(stats.failed > 0 ? 1 : 0);

/**
 * A font stack's name has to be percent-encoded in the URL and left alone on
 * disk, so the two are built separately rather than derived from each other.
 */
function fontJobs(styles) {
  const template = firstString(styles, (style) => style.glyphs);
  if (!template) return [];

  const stacks = new Set(styles.flatMap(fontStacks));
  const jobs = [];

  for (const stack of stacks) {
    for (const range of GLYPH_RANGES) {
      jobs.push({
        url: template
          .replace("{fontstack}", encodeURIComponent(stack))
          .replace("{range}", range),
        // A missing glyph range is the normal case, not a problem to report.
        optional: true,
      });
    }
  }

  return jobs;
}

function spriteJobs(styles) {
  const bases = new Set(styles.map((style) => style.sprite).filter(Boolean));

  return [...bases].flatMap((base) =>
    ["", "@2x"].flatMap((density) =>
      [".json", ".png"].map((extension) => ({ url: `${base}${density}${extension}` })),
    ),
  );
}

/**
 * Every tile of every raster source, from z0 to whatever the source stops at.
 * Bounded and small: the shaded-relief source stops at z6, which is 5,461 tiles.
 */
function rasterJobs(styles) {
  const templates = new Map();

  for (const style of styles) {
    for (const source of Object.values(style.sources ?? {})) {
      if (source?.type !== "raster" || !Array.isArray(source.tiles)) continue;

      for (const template of source.tiles) {
        templates.set(template, Number(source.maxzoom ?? 0));
      }
    }
  }

  const jobs = [];

  for (const [template, maxzoom] of templates) {
    for (let z = 0; z <= maxzoom; z += 1) {
      const side = 2 ** z;

      for (let x = 0; x < side; x += 1) {
        for (let y = 0; y < side; y += 1) {
          jobs.push({
            url: template
              .replace("{z}", String(z))
              .replace("{x}", String(x))
              .replace("{y}", String(y)),
          });
        }
      }
    }
  }

  return jobs;
}

/**
 * A spread of jobs rather than the first few, which would all be range 0-255 of
 * one font and prove nothing about the rest of the plan.
 */
function samples(jobs) {
  const step = Math.max(1, Math.floor(jobs.length / 12));

  return jobs.filter((_job, index) => index % step === 0).slice(0, 12);
}

async function fetchOne({ url, optional = false }) {
  const path = localPathFor(url);

  if (await exists(path)) {
    stats.skipped += 1;
    return;
  }

  try {
    const response = await fetch(url);

    if (response.status === 404) {
      stats.absent += 1;
      if (!optional) console.warn(`  ? ${url} — 404`);
      return;
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const body = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);

    stats.written += 1;
    if (stats.written % 250 === 0) console.log(`  … ${stats.written} written`);
  } catch (error) {
    stats.failed += 1;
    console.error(`  ✗ ${url} — ${error.message}`);
  }
}

/** Decoded, so `Noto%20Sans%20Regular` becomes one directory with spaces in it. */
function localPathFor(url) {
  const { pathname } = new URL(url);

  return join(
    OUT_ROOT,
    ...decodeURIComponent(pathname)
      .split("/")
      .filter(Boolean),
  );
}

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

function firstString(styles, read) {
  for (const style of styles) {
    const value = read(style);
    if (typeof value === "string") return value;
  }
  return null;
}

/** A fixed number of workers pulling from one queue. No dependency for this. */
async function runPool(items, limit, worker) {
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;

      await worker(items[index]);
    }
  });

  await Promise.all(runners);
}
