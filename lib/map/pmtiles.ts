import { addProtocol } from "maplibre-gl";
import { Protocol } from "pmtiles";

/**
 * Register the pmtiles:// protocol with MapLibre exactly once (CLAUDE.md §7).
 *
 * Today's basemaps are conventional vector-tile styles that need none of this.
 * Registering now means the switch to our own PMTiles extract on R2 is a URL
 * change and nothing else.
 *
 * `metadata: true` is not optional, and the reason is invisible until it bites.
 * Without it the protocol answers a TileJSON request from the archive *header*
 * alone — tiles, zooms and bounds, and no `attribution` field at all. MapLibre's
 * attribution control renders whatever the source reports, so the first map
 * pointed at a pmtiles style would lose its OpenStreetMap credit with no error
 * and no warning, and §12 makes that credit non-negotiable. Setting the flag
 * reads the archive's JSON metadata block instead, which carries the attribution
 * and `vector_layers` — one extra range request per archive, cached thereafter.
 *
 * Our own style documents also name the attribution on the source itself, which
 * wins over the TileJSON (`extend(tileJSON, options)` in MapLibre's
 * `loadTileJson`). Two independent guards, because a silent loss of credit is
 * the kind of failure nobody is looking for.
 */
let registered = false;

export function registerPmtilesProtocol(): void {
  if (registered) return;
  registered = true;

  addProtocol("pmtiles", new Protocol({ metadata: true }).tile);
}
