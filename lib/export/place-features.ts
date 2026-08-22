import type { Map as MapLibreMap } from "maplibre-gl";

import {
  pinImageId,
  registerPinImageBitmaps,
  registerPinImages,
} from "@/packages/shared/pin-raster";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * Locations as style layers, for a map with no DOM.
 *
 * The editor draws a place as an HTML `Marker` sitting over the canvas. That is
 * the right thing on screen — a marker can be clicked, dragged and focused — and
 * it is exactly wrong for an export, because a marker is not *in* the canvas and
 * a canvas capture would come back with the basemap, the shapes, and no
 * locations at all.
 *
 * So the export map draws places the way the published embed does: one GeoJSON
 * source, a circle layer for a plain pin and a symbol layer for a shaped one,
 * with the pin images rasterised by the module both targets share
 * (packages/shared/pin-raster.ts). Which also means an exported pin is the same
 * pin a visitor sees, drawn by the same code, rather than a third rendering of
 * it that would drift.
 */

const SOURCE = "export-places";
const POINT_LAYER = "export-place-points";
const PIN_LAYER = "export-place-pins";

export type ExportPlace = {
  lng: number;
  lat: number;
  /** Empty for a plain dot. The caller resolves `custom:` ids the same way. */
  icon: string;
  /** Already resolved by the caller — category, group and custom pin ranked. */
  color: string;
};

/**
 * Add the layers, and register the images they need.
 *
 * Two passes, because an uploaded logo has to be decoded before it can be drawn
 * and a decode is a promise however small the image is. The synchronous pass
 * covers every glyph pin; the second widens the set and re-feeds the source. In
 * the embed that ordering is about the first frame, and here it is about not
 * capturing the map before its pins have arrived — which is why this awaits both
 * before returning, and the caller waits for `idle` after that.
 */
export async function addPlaceLayers(
  map: MapLibreMap,
  places: readonly ExportPlace[],
  pinIcons?: readonly CustomPinIcon[],
): Promise<void> {
  const pairs = places
    .filter((place) => place.icon)
    .map((place) => ({ icon: place.icon, color: place.color }));

  const custom = pinIcons ? [...pinIcons] : undefined;
  const registered = registerPinImages(map, pairs, custom);
  const decoded = await registerPinImageBitmaps(map, pairs, custom);

  for (const id of decoded) registered.add(id);

  map.addSource(SOURCE, { type: "geojson", data: featuresOf(places, registered) });

  map.addLayer({
    id: POINT_LAYER,
    type: "circle",
    source: SOURCE,
    // Places with an icon are drawn by the symbol layer below. Without this they
    // would get a dot under the pin as well.
    filter: ["!", ["has", "pin"]],
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": 8,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: PIN_LAYER,
    type: "symbol",
    source: SOURCE,
    filter: ["has", "pin"],
    layout: {
      // A ball marks its position with its middle and the image is the pin's own
      // square, so centring it needs no offset — the same reasoning, and the same
      // anchor, as the embed's own pin layer.
      "icon-image": ["get", "pin"],
      "icon-anchor": "center",
      /*
       * Collision is off, as it is in the embed and for the same reason: two
       * shops on one street would otherwise silently cost one of them its pin.
       * On screen that is a location the visitor cannot find; in an export it is
       * a location missing from something a customer is about to print.
       */
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

function featuresOf(
  places: readonly ExportPlace[],
  registered: ReadonlySet<string>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places.map((place) => {
      const id = place.icon ? pinImageId(place.icon, place.color) : "";

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [place.lng, place.lat] },
        properties: {
          color: place.color,
          // Only when the image exists. Naming one that does not makes MapLibre
          // warn once per feature per frame and draws nothing where the pin was.
          ...(registered.has(id) ? { pin: id } : {}),
        },
      };
    }),
  };
}
