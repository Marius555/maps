/**
 * How nearby locations gather into one numbered bubble, and what that bubble
 * looks like.
 *
 * Here rather than in either renderer because both draw it: the embed clusters
 * its GeoJSON source (embed/src/map.ts) and the editor clusters a source of its
 * own beside its DOM markers (components/map/clusters/). The Publish tab puts the
 * real embed bundle next to the editor's canvas, so two sets of numbers that agree
 * today would be two different-looking maps the day one of them moves.
 *
 * Zero dependencies, vanilla TS — the condition for runtime in this directory
 * (CLAUDE.md §4). The MapLibre import is types only, as in ./pin-raster.ts.
 */

import type {
  FilterSpecification,
  LayerSpecification,
  Map as MapLibreMap,
} from "maplibre-gl";

import { CUSTOM_PIN_PREFIX, resolvePin, type CustomPinIcon } from "./pin-icons";

/** Past this zoom, show individual pins rather than bubbles. */
export const CLUSTER_MAX_ZOOM = 14;
export const CLUSTER_RADIUS = 50;

/** Neutral, so a bubble never looks like it belongs to one tag. */
export const CLUSTER_COLOR = "#3f4756";

/** A bubble grows in two steps, at 25 and at 100 locations. */
export const CLUSTER_BUBBLE_RADIUS: [
  "step",
  ["get", string],
  number,
  number,
  number,
  number,
  number,
] = ["step", ["get", "point_count"], 16, 25, 21, 100, 27];

/**
 * The count's font. It has to exist in the style's glyph set; Noto Sans is the
 * one every OpenFreeMap style ships, and our own style documents mirror it.
 */
export const CLUSTER_FONT = "Noto Sans Regular";

const HAS_COUNT: FilterSpecification = ["has", "point_count"];

/**
 * The bubble and its count, as both renderers add them.
 *
 * One definition rather than two copies that agree: the editor's canvas and the
 * embed beside it in the Publish tab are the same map, and a paint value changed
 * in one file is two different-looking maps on one screen. `showClusterIcon` and
 * `hideClusterIcon` below change these layers in place, so their defaults live
 * here, next to the code that has to put them back.
 */
export function clusterLayers(
  source: string,
  bubble: string,
  count: string,
): [LayerSpecification, LayerSpecification] {
  return [
    {
      id: bubble,
      type: "circle",
      source,
      filter: HAS_COUNT,
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-radius": CLUSTER_BUBBLE_RADIUS,
      },
    },
    {
      id: count,
      type: "symbol",
      source,
      filter: HAS_COUNT,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": [CLUSTER_FONT],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    },
  ];
}

/**
 * The owner's cluster icon, as something the pin rasteriser can draw.
 *
 * `clusterIcon` is a pin id or an uploaded image (lib/validation/pin-icon.schema.ts).
 * An image is dressed as a custom pin, so `registerPinImages` and
 * `registerPinImageBitmaps` in ./pin-raster.ts draw it as they draw any logo pin
 * (a ringed circle) and no second rasteriser exists. A pin id that no longer
 * resolves, such as a custom pin deleted in the studio, answers null. That draws the
 * grey bubble: a dangling id is the normal state, not an error.
 */
export function clusterIconPin(
  clusterIcon: string | undefined,
  pins: readonly CustomPinIcon[],
): { icon: string; pins: readonly CustomPinIcon[] } | null {
  if (!clusterIcon) return null;

  if (clusterIcon.startsWith("data:")) {
    return {
      icon: `${CUSTOM_PIN_PREFIX}cluster`,
      pins: [{ id: "cluster", label: "", color: CLUSTER_COLOR, glyph: "", image: clusterIcon }],
    };
  }

  return resolvePin(clusterIcon, pins) ? { icon: clusterIcon, pins } : null;
}

/** Where the count sits, in px from the cluster's centre: the icon's top-right. */
const BADGE_OFFSET: [number, number] = [15, -15];
/** The count's size inside the badge. `text-offset` is in ems of this. */
const BADGE_TEXT = 10;

/**
 * Draw the clusters as `image` with the count in a badge, not as bubbles.
 *
 * Call it only once `image` is registered. An `icon-image` naming a missing image
 * warns on every frame, so until then the bubble is what shows.
 *
 * The bubble is made transparent rather than removed. It is still the layer both
 * renderers bind clicks and the pointer cursor to, and it keeps the stepped radius
 * that makes a bigger cluster a bigger target. The icon does not step: the badge's
 * `circle-translate` cannot be data-driven, so a constant icon is what keeps the
 * badge on its corner.
 *
 * Both new layers go in under the count, which is the only thing that must stay
 * readable on top.
 */
export function showClusterIcon(
  map: MapLibreMap,
  source: string,
  bubble: string,
  count: string,
  image: string,
): void {
  map.addLayer(
    {
      id: `${bubble}-icon`,
      type: "symbol",
      source,
      filter: HAS_COUNT,
      layout: {
        "icon-image": image,
        // Pins rasterise at 36px (./pin-raster.ts); this is about 43.
        "icon-size": 1.2,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    },
    count,
  );
  map.addLayer(
    {
      id: `${bubble}-badge`,
      type: "circle",
      source,
      filter: HAS_COUNT,
      paint: {
        "circle-color": CLUSTER_COLOR,
        "circle-radius": 10,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
        "circle-translate": BADGE_OFFSET,
      },
    },
    count,
  );

  map.setPaintProperty(bubble, "circle-opacity", 0);
  map.setPaintProperty(bubble, "circle-stroke-width", 0);
  map.setLayoutProperty(count, "text-size", BADGE_TEXT);
  map.setLayoutProperty(count, "text-offset", [
    BADGE_OFFSET[0] / BADGE_TEXT,
    BADGE_OFFSET[1] / BADGE_TEXT,
  ]);
}

/**
 * Back to bubbles: `showClusterIcon` undone, to the values in `clusterLayers`.
 *
 * The editor's alone, for an icon changed or cleared while the canvas is live.
 * A published map's icon never changes under it, and the embed's build drops
 * this as unused.
 */
export function hideClusterIcon(map: MapLibreMap, bubble: string, count: string): void {
  for (const id of [`${bubble}-icon`, `${bubble}-badge`]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  if (map.getLayer(bubble)) {
    map.setPaintProperty(bubble, "circle-opacity", 0.9);
    map.setPaintProperty(bubble, "circle-stroke-width", 2);
  }

  if (map.getLayer(count)) {
    map.setLayoutProperty(count, "text-size", 12);
    map.setLayoutProperty(count, "text-offset", [0, 0]);
  }
}
