/**
 * Builds the static gazetteer the embed searches (CLAUDE.md §2).
 *
 * A store locator's core interaction is "type a postcode, get the nearest
 * branches". Geocoding that query would be a metered call in the visitor's path,
 * which §2 rules out and always will — so the answer ships as static files on a
 * CDN, fetched lazily and cached by the visitor's browser. That is the same
 * thing the snapshot already is: zero marginal cost, and nothing in the
 * visitor's path that can go down and take search off every customer's site.
 *
 * **GeoNames, deliberately not OSM.** CC BY 4.0 asks for attribution, which we
 * already render on every map, and imposes no share-alike. §12 flags ODbL
 * share-alike on database-shaped output, and a gazetteer is exactly
 * database-shaped output, so an OSM-derived one is the wrong tool for a file we
 * hand to strangers' browsers.
 *
 * Run by hand, not on `prebuild`: it downloads tens of megabytes, and the output
 * changes when GeoNames changes rather than when our code does.
 *
 *     npm run build:gazetteer            # the default country set below
 *     npm run build:gazetteer -- GB DE   # just these
 *
 * Downloads are cached under node_modules/.cache, so a re-run costs nothing.
 */

import { unzipSync, strFromU8 } from "fflate";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Where a €19–€39 flat-priced locator sells first. The script takes country
 * codes, so widening this is one command and a redeploy — and no map ever
 * fetches a country it has no locations in, so the cost of more is build time,
 * not visitor bytes.
 */
const DEFAULT_COUNTRIES = [
  "GB", "IE", "DE", "FR", "NL", "BE", "ES", "IT",
  "PT", "AT", "CH", "PL", "SE", "DK", "NO", "FI",
];

const CITIES_URL = "https://download.geonames.org/export/dump/cities5000.zip";
const POSTAL_URL = (cc) => `https://download.geonames.org/export/zip/${cc}.zip`;

const OUT_DIR = join(process.cwd(), "public", "gazetteer");
const CACHE_DIR = join(process.cwd(), "node_modules", ".cache", "gazetteer");

/**
 * Coordinates to six decimals — about 10cm, and the same rule `roundCoord`
 * applies to everything in a snapshot. Anything finer is noise gzip cannot
 * compress away, on a file measured in tens of thousands of rows.
 */
const round = (value) => Math.round(Number(value) * 1e6) / 1e6;

/**
 * How a postcode is keyed and matched: case and separators removed.
 *
 * "SW1A 1AA", "sw1a1aa" and "SW1A-1AA" are one postcode, and a visitor types
 * whichever they think of. The first two characters of this are the shard, so
 * this function decides the filenames as well as the matching — the embed has
 * the same rule, and a shard the embed cannot name is a shard nobody fetches.
 */
const postKey = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Shard name for a key. Short keys share a bucket rather than falling out. */
const shardOf = (key) => (key.length >= 2 ? key.slice(0, 2) : `${key}_`);

async function main() {
  const countries = (process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : DEFAULT_COUNTRIES
  ).map((code) => code.toUpperCase());

  await mkdir(CACHE_DIR, { recursive: true });
  // Cleared rather than merged: a country dropped from the list should stop
  // being served, and a stale shard is a file the embed will happily fetch.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Building gazetteer for ${countries.length} countries…`);

  const cities = await loadCities(new Set(countries));
  let files = 0;
  let entries = 0;

  for (const cc of countries) {
    const dir = join(OUT_DIR, cc);
    await mkdir(dir, { recursive: true });

    const rows = cities.get(cc) ?? [];
    if (rows.length > 0) {
      // Biggest first: a prefix match on "man" should offer Manchester before
      // Manningtree, and the file's order is the ranking the embed inherits.
      rows.sort((a, b) => b[4] - a[4]);
      await writeJson(join(dir, "cities.json"), rows.map((row) => row.slice(0, 4)));
      files += 1;
      entries += rows.length;
    }

    const shards = await loadPostcodes(cc);

    if (shards.size > 0) {
      await mkdir(join(dir, "post"), { recursive: true });

      for (const [shard, items] of shards) {
        await writeJson(join(dir, "post", `${shard}.json`), items);
        files += 1;
        entries += items.length;
      }
    }

    console.log(
      `  ${cc}: ${rows.length} places, ${shards.size} postcode shards`,
    );
  }

  console.log(`\nWrote ${files} files, ${entries} entries, to public/gazetteer/`);
  console.log("Attribution: GeoNames, CC BY 4.0 — already in ATTRIBUTION_HTML.");
}

/** Plain diacritic strip — the fold a visitor's query gets in the embed. */
const plainKey = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Both spellings of a name, deduped and pipe-joined. The embed splits on the
 * same character.
 *
 * Two keys, and the pair is the whole point. GeoNames' `asciiname` is a
 * *transliteration*, not a diacritic strip: they write Köln as "koeln" and
 * München as "muenchen". A visitor who types "Köln" — or "Koln", having given up
 * on the umlaut — folds to "koln" and would match neither. The second key is a
 * plain strip of the display name, which "Köln" and "Koln" both fold to.
 *
 * The plain strip is the one rule computed both here and in the embed, and it is
 * safe *because* there are two keys: if the copies ever drift, the
 * transliterated key still matches and the failure is one spelling going quiet
 * rather than search returning nothing for a whole country. Folding only at
 * build time would have made that failure total and silent.
 */
function matchKeys(name, ascii) {
  const keys = [ascii.toLowerCase(), plainKey(name)];

  return [...new Set(keys.filter(Boolean))].join("|");
}

/**
 * Every city above 5,000 people, grouped by country.
 *
 * One download for the whole world rather than one per country, because
 * GeoNames publishes it that way and 3–5MB fetched once beats sixteen requests.
 */
async function loadCities(wanted) {
  const text = await downloadText(CITIES_URL, "cities5000.zip", "cities5000.txt");
  const byCountry = new Map();

  for (const line of text.split("\n")) {
    if (!line) continue;

    const cols = line.split("\t");
    const cc = cols[8];
    if (!wanted.has(cc)) continue;

    const name = cols[1];
    const ascii = cols[2] || cols[1];
    const lat = round(cols[4]);
    const lng = round(cols[5]);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    // Population rides along as a fifth element for the sort above and is
    // dropped before the file is written — it is ranking input, not something
    // the embed has any use for.
    const rows = byCountry.get(cc) ?? [];
    rows.push([matchKeys(name, ascii), name, lat, lng, Number(cols[14]) || 0]);
    byCountry.set(cc, rows);
  }

  return byCountry;
}

/**
 * One country's postcodes, bucketed by the first two characters of their key.
 *
 * Sharded because a national list is a fetch nobody should pay for to answer one
 * query — Great Britain alone is tens of thousands of rows. GeoNames repeats a
 * postcode once per place name it covers; the first wins, because a postcode
 * resolves to one point here and the rows for one code sit within a few hundred
 * metres of each other.
 */
async function loadPostcodes(cc) {
  const text = await downloadText(POSTAL_URL(cc), `${cc}.zip`, `${cc}.txt`, true);
  const shards = new Map();
  const seen = new Set();

  if (!text) return shards;

  for (const line of text.split("\n")) {
    if (!line) continue;

    const cols = line.split("\t");
    const key = postKey(cols[1] ?? "");
    if (!key || seen.has(key)) continue;

    const lat = round(cols[9]);
    const lng = round(cols[10]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    seen.add(key);

    const shard = shardOf(key);
    const items = shards.get(shard) ?? [];
    // The place name travels with it so the search result can say "SW1A —
    // London" rather than offering a code with no context.
    items.push([key, cols[2] ?? "", lat, lng]);
    shards.set(shard, items);
  }

  for (const items of shards.values()) items.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  return shards;
}

/**
 * Fetch a zip once, cache it, and return the named entry as text.
 *
 * `optional` is for the postcode files: GeoNames has no dump for every country,
 * and a missing one should mean "this country has no postcode search" rather
 * than failing a build of fifteen others.
 */
async function downloadText(url, cacheName, entryName, optional = false) {
  const cached = join(CACHE_DIR, cacheName);

  if (!existsSync(cached)) {
    process.stdout.write(`  fetching ${cacheName}… `);
    const response = await fetch(url);

    if (!response.ok) {
      process.stdout.write(`${response.status}\n`);
      if (optional) return null;
      throw new Error(`${url} returned ${response.status}`);
    }

    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
    process.stdout.write("ok\n");
  }

  const zip = unzipSync(new Uint8Array(await readFile(cached)), {
    filter: (file) => file.name === entryName,
  });

  const entry = zip[entryName];
  if (!entry) {
    if (optional) return null;
    throw new Error(`${cacheName} has no ${entryName}`);
  }

  return strFromU8(entry);
}

/** No pretty-printing: these are machine-read, and the whitespace is the file. */
async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value), "utf8");
}

await main();
