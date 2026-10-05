/**
 * The embed's release channel, and where MapLibre's files sit inside it.
 *
 * Plain JS with no imports, because three different things read it: the Vite
 * config, `scripts/copy-maplibre-worker.mjs` and `scripts/upload-cdn.mjs`.
 * docs/notes/versioning.md has the reasoning.
 *
 * **The channel is the major version in the URL a customer pastes**, as in
 * `https://cdn.pinglide.com/embed/v1/map.js`. Every release inside a channel
 * reaches every site that pasted it, with no action from the customer, so a
 * release inside `v1` must keep reading every snapshot `v1` was ever pointed at.
 * A change that cannot do that does not edit `v1`. It starts `v2` beside it,
 * and `v1` stays deployed and frozen. Because a pasted URL is permanent, this
 * constant only ever moves forward, and moving it is a decision rather than a
 * refactor.
 *
 * **MapLibre lives in a folder named after its own version** (for example
 * `maplibre-6.11.2/`). It is never overwritten in place, because a visitor may
 * still hold a cached `map.js` or `map-[hash].js` from the previous release, and
 * those import MapLibre by relative URL. With a fixed name, an upgrade would hand
 * old code a new MapLibre. With a versioned folder, the old build keeps finding
 * the files it was built against. Inside the folder the three files keep their
 * own names, because they import each other as siblings.
 */

export const EMBED_CHANNEL = "v1";

/** The folder, relative to map.js, that one MapLibre version's files live in. */
export function maplibreDir(version) {
  return `maplibre-${version}`;
}
