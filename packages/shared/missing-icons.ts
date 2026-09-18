import type { Map as MapLibreMap } from "maplibre-gl";

import { DOT_IMAGE_ID } from "./dot-line";
import { PIN_IMAGE_PREFIX } from "./pin-raster";

/**
 * Fills the basemap's sprite gaps with nothing, so MapLibre stops warning.
 *
 * OpenFreeMap's Liberty style builds a POI's `icon-image` from its class, and
 * its sprite does not have an image for every class — `ice_rink` and
 * `sports_centre` are two. MapLibre draws the label without the icon either
 * way; what it adds is `Image "ice_rink" could not be loaded` in the console,
 * on the dashboard and on every customer's site the embed runs on.
 *
 * A blank rather than a drawn icon because a blank is exactly today's picture.
 * The resolver runs only after the sprite has loaded, so it never shadows a
 * real sprite image, and it is kept on the map across `setStyle`, so the
 * editor's theme switch keeps it.
 *
 * Our own images are skipped, and that is load-bearing: `registerPinImages`
 * skips any id the map already has, so a blank sitting under a pin's id would
 * hide that pin for good. A missing pin or dot is a real bug and should keep
 * its warning. `hasImage` is there because two tiles can ask for one id, and a
 * second `addImage` is an error event.
 *
 * Shared, and so dependency-free — every map constructor calls it.
 */
export function blankMissingIcons(map: MapLibreMap): void {
  map.setMissingStyleImageResolver((id) => {
    if (
      id.startsWith(PIN_IMAGE_PREFIX) ||
      id === DOT_IMAGE_ID ||
      map.hasImage(id)
    ) {
      return;
    }

    map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}
