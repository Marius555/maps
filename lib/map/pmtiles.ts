import { addProtocol } from "maplibre-gl";
import { Protocol } from "pmtiles";

/**
 * Register the pmtiles:// protocol with MapLibre exactly once (CLAUDE.md §7).
 *
 * Week 1 renders OpenFreeMap, which is a conventional vector-tile style and
 * doesn't need this. Registering now means the Week 4 switch to our own PMTiles
 * extract on R2 is a URL change and nothing else.
 */
let registered = false;

export function registerPmtilesProtocol(): void {
  if (registered) return;
  registered = true;

  addProtocol("pmtiles", new Protocol().tile);
}
