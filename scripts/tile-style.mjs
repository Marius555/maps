/**
 * Repointing a basemap style document at an origin we control.
 *
 * Pure, no I/O, no `process`: scripts/build-tile-styles.mjs does the fetching and
 * writing, and lib/map/tile-style.test.ts imports this same module. That sharing
 * is the whole reason this file exists separately. The gazetteer could not manage
 * it — `fold` in packages/shared/gazetteer.ts has a hand-kept twin in
 * scripts/build-gazetteer.mjs that only a test connects, because a `.mjs` script
 * cannot import TypeScript. It can import a sibling `.mjs`, and `allowJs` lets a
 * `.ts` test import one too, so here there is exactly one copy and it is tested.
 *
 * What actually changes, and why it is not one rule:
 *
 * - **glyphs, sprite, raster tiles** swap origin and keep their path. That is
 *   deliberate: scripts/mirror-tile-assets.mjs writes them under the identical
 *   path, so the mirror and this transform share a single convention instead of
 *   two lists of filenames that must agree.
 * - **the vector source** changes shape, not host. It stops being a TileJSON
 *   endpoint and becomes one archive read by range requests, so `url` is
 *   rewritten to `pmtiles://` and any `tiles` array is dropped — the style spec
 *   treats the two as mutually exclusive, and leaving a stale one behind is a
 *   style that half-loads from an origin that no longer serves it.
 */

/** Where the five upstream documents come from, and the origin being replaced. */
export const OPENFREEMAP = "https://tiles.openfreemap.org";

/** The five real basemaps. Mirrors BASEMAP_SOURCES; the test holds them equal. */
export const BASEMAP_SOURCES = ["liberty", "bright", "positron", "dark", "fiord"];

/**
 * Where one style document lives, relative to the bucket root.
 *
 * One rule, three readers: build-tile-styles.mjs writes to this path under
 * /public/tiles, `styleUrlFor` builds the URL from it, and migrate-style-host.mjs
 * rewrites published snapshots to that URL. They cannot disagree about the
 * filename because there is only one.
 */
export function styleFile(source) {
  return `styles/${source}.json`;
}

/**
 * The URL a style is served from, for either host.
 *
 * Deliberately a second implementation of `styleUrlFor` in lib/map/style.ts — app
 * code must not import a build script, and a script cannot import TypeScript. The
 * two are held equal by lib/map/tile-style.test.ts, which is the only thing
 * connecting them; drift here republishes every map at a URL that 404s.
 */
export function styleUrlFor(source, base) {
  const root = base ? String(base).replace(/\/+$/, "") : "";

  return root ? `${root}/${styleFile(source)}` : `${OPENFREEMAP}/styles/${source}`;
}

/** Filename of the planetiler archive inside the bucket. */
export const PLANET_ARCHIVE = "planet.pmtiles";

/**
 * The credit written onto the vector source.
 *
 * A second guard, not the only one. `Protocol({ metadata: true })` already makes
 * the archive's own attribution reach MapLibre, but a style-level `attribution`
 * wins over the TileJSON — MapLibre's `loadTileJson` does
 * `pick(extend(tileJSON, options), […"attribution"…])`, and `options` is the
 * source spec. So this is the one that holds even if the archive is rebuilt
 * without its metadata. §12 makes the credit non-negotiable, and a credit that
 * disappears does so silently.
 *
 * Byte-identical to SELF_HOSTED_CREDIT.html in lib/map/style.ts, which the test
 * asserts — nothing but that assertion connects a `.mjs` constant to a `.ts` one.
 */
export const TILE_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>';

/**
 * The credit owed when the tiles come from OpenFreeMap.
 *
 * Here so migrate-style-host.mjs can move a published snapshot in *either*
 * direction. A switch you cannot reverse is one nobody dares make, and the
 * rollback is the same walk with the other constant. Byte-identical to
 * OPENFREEMAP_CREDIT.html in lib/map/style.ts; the test holds them equal.
 */
export const OPENFREEMAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · tiles by <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>';

/** The credit a given host is owed. Empty base means OpenFreeMap. */
export function attributionFor(base) {
  return base ? TILE_ATTRIBUTION : OPENFREEMAP_ATTRIBUTION;
}

/**
 * Which basemap a published `styleUrl` names, whichever host wrote it.
 *
 * The migration works from this rather than from a table of old URLs, which is
 * what lets it run in both directions and with no argument: it reads the source
 * out of whatever a snapshot happens to say and rewrites it to wherever the app
 * now points. An unrecognised URL returns null and is reported rather than
 * guessed at — a snapshot is live on somebody else's website.
 */
export function sourceOfStyleUrl(url) {
  const match = /\/styles\/([a-z0-9_-]+)(?:\.json)?$/i.exec(String(url ?? ""));
  const source = match?.[1];

  return source && BASEMAP_SOURCES.includes(source) ? source : null;
}


/**
 * @param {Record<string, unknown>} style An upstream style document.
 * @param {string} base Absolute origin+path we serve from, no trailing slash.
 * @returns {Record<string, unknown>} A copy; the input is not touched.
 */
export function retargetStyle(style, base) {
  const root = String(base).replace(/\/+$/, "");
  const swap = (value) =>
    typeof value === "string" && value.startsWith(OPENFREEMAP)
      ? `${root}${value.slice(OPENFREEMAP.length)}`
      : value;

  const sources = {};
  for (const [id, source] of Object.entries(style.sources ?? {})) {
    sources[id] = retargetSource(source, root, swap);
  }

  const next = { ...style, sources };
  if (typeof style.glyphs === "string") next.glyphs = swap(style.glyphs);
  if (typeof style.sprite === "string") next.sprite = swap(style.sprite);

  return next;
}

function retargetSource(source, root, swap) {
  if (!source || typeof source !== "object") return source;

  if (source.type === "vector") {
    const next = { ...source };
    delete next.tiles;
    next.url = `pmtiles://${root}/${PLANET_ARCHIVE}`;
    next.attribution = TILE_ATTRIBUTION;
    return next;
  }

  const next = { ...source };
  if (Array.isArray(source.tiles)) next.tiles = source.tiles.map(swap);
  if (typeof source.url === "string") next.url = swap(source.url);
  return next;
}

/**
 * Every string still pointing at the old origin, anywhere in the document.
 *
 * The build script fails on a non-empty result rather than shipping a style that
 * half-loads from somebody else's server. It exists because upstream may add an
 * asset class we have never seen — a terrain source, a second sprite — and the
 * failure mode of missing one is a map that works perfectly until that origin
 * does not. Walks with a JSON replacer so nothing is missed by knowing only the
 * keys we thought of.
 */
export function remainingUpstream(style) {
  const found = [];

  JSON.stringify(style, (_key, value) => {
    if (typeof value === "string" && value.includes("openfreemap.org")) {
      found.push(value);
    }
    return value;
  });

  return found;
}

/**
 * The font stacks a style actually names, so the mirror fetches what is used
 * rather than a list someone kept by hand.
 *
 * `text-font` is normally a plain array of stack names, which is the case all
 * five upstream styles use. It may also be a data-driven expression, so the walk
 * descends into nested arrays and takes any array whose elements are *all*
 * strings. That reads `["literal", ["Noto Sans Regular"]]` correctly and can also
 * pick up an operator's own arguments from a more exotic expression — harmless,
 * because a name that is not a font stack simply 404s and the mirror skips it.
 * Over-collecting costs a wasted request; under-collecting loses a font and makes
 * labels vanish at some zoom with nothing in the console.
 */
export function fontStacks(style) {
  const stacks = new Set();

  const collect = (value) => {
    if (!Array.isArray(value)) return;

    if (value.every((item) => typeof item === "string")) {
      value.forEach((item) => stacks.add(item));
      return;
    }

    value.forEach(collect);
  };

  for (const layer of style.layers ?? []) {
    collect(layer?.layout?.["text-font"]);
  }

  return [...stacks];
}
