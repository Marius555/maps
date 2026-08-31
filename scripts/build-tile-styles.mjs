/**
 * Our own copies of the five basemap style documents.
 *
 *   npm run build:tile-styles -- https://tiles.example.com
 *
 * Run by hand, like build:gazetteer and for the same reason: the output changes
 * when the tile host changes or when upstream edits a style, not when our code
 * does. Writes into /public/tiles/, which is gitignored build output — a
 * self-hoster serves it from the app itself, and the same folder is what gets
 * uploaded to the bucket. next.config.ts sends CORS headers for /tiles/, because
 * these are fetched by pages on domains that are not ours.
 *
 * The argument is the absolute origin (and optional path prefix) the files will
 * be served from. It has to be passed rather than read from the environment: the
 * styles name their own asset URLs, so a style built for one host is wrong for
 * another, and defaulting that quietly is how a bucket ends up full of documents
 * pointing at somebody else's server.
 *
 * The transform lives in ./tile-style.mjs so the tests exercise this exact code.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  BASEMAP_SOURCES,
  OPENFREEMAP,
  PLANET_ARCHIVE,
  remainingUpstream,
  retargetStyle,
  styleFile,
} from "./tile-style.mjs";

const OUT_DIR = join(process.cwd(), "public", "tiles");

const base = process.argv[2];

if (!base || !/^https?:\/\//.test(base)) {
  console.error("Usage: npm run build:tile-styles -- https://tiles.example.com");
  console.error("");
  console.error("The base must be absolute. These URLs are read by pages on");
  console.error("domains that are not ours, where a relative one resolves");
  console.error("against the customer's own site.");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

let failed = 0;

for (const source of BASEMAP_SOURCES) {
  const from = `${OPENFREEMAP}/styles/${source}`;

  try {
    const response = await fetch(from);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const upstream = await response.json();
    const style = retargetStyle(upstream, base);

    /*
     * A style that still names the old origin anywhere is worse than no style:
     * it works perfectly until that origin does not, which is the exact failure
     * this whole exercise exists to remove. Upstream may have added an asset
     * class the transform has never seen, so this fails loudly rather than
     * shipping something that half-loads.
     */
    const stragglers = remainingUpstream(style);
    if (stragglers.length > 0) {
      failed += 1;
      console.error(`  ✗ ${source} — still points upstream:`);
      for (const url of new Set(stragglers)) console.error(`      ${url}`);
      continue;
    }

    const path = join(OUT_DIR, styleFile(source));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(style));

    console.log(
      `  ✓ ${source.padEnd(9)} ${String(style.layers?.length ?? 0).padStart(3)} layers, ` +
        `sources: ${Object.keys(style.sources ?? {}).join(", ")}`,
    );
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${source} — ${error.message}`);
  }
}

console.log("");
console.log(`Wrote ${BASEMAP_SOURCES.length - failed} of ${BASEMAP_SOURCES.length} styles to public/tiles/styles/.`);
console.log("");
console.log("Still to do before these render anything:");
console.log(`  1. npm run mirror:tile-assets     — fonts, sprites and the Natural Earth raster`);
console.log(`  2. upload ${PLANET_ARCHIVE} and public/tiles/ to the bucket at ${base}`);
console.log(`  3. set NEXT_PUBLIC_TILES_URL=${base} and redeploy`);
console.log(`  4. npm run migrate:style-host     — moves maps published before the switch`);
console.log("");
console.log("See docs/self-hosting-tiles.md for the whole run.");

process.exit(failed > 0 ? 1 : 0);
