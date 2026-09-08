"use client";

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

/**
 * The coverage heatmap, as MapLibre style layers.
 *
 * Two layers over one source, and the second is not decoration. A heatmap
 * answers "where are these dense" and stops meaning anything once you are close
 * enough that no two points overlap — at street level a 40-shop map is four
 * orange smudges, which is worse than the pins the editor already draws. So the
 * heat fades out across `FADE_FROM`..`FADE_TO` and individual dots fade in over
 * exactly the same range: density at country scale, locations at street scale,
 * one continuous gesture between them.
 *
 * Like the editor's shapes and unlike its pins, these are style layers, so
 * `setStyle` would take them. Nothing on the Analytics page calls `setStyle` —
 * there is no theme picker on it — but `use-heat-layer.ts` still re-adds on
 * `styledata` for the case MapLibre abandons its diff and rebuilds, and
 * `lib/map/carry-style.ts` carries the source across a swap without being told
 * this id exists.
 */

export const HEAT_SOURCE = "analytics-coverage";
export const HEAT_LAYER = "analytics-coverage-heat";
export const POINT_LAYER = "analytics-coverage-points";

/** Where the heat starts giving way to individual locations, and where it is gone. */
const FADE_FROM = 9;
const FADE_TO = 11.5;

/**
 * The furthest in the page may open.
 *
 * A tight cluster — five shops a kilometre apart — frames to zoom 13, which is
 * past `FADE_TO`, so the page would open on dots and never draw the density map
 * it exists for. Capping the opening fit here means it always lands with the
 * heat at full strength, and zooming in is what reveals the locations.
 */
export const HEAT_MAX_FIT_ZOOM = FADE_FROM;

/**
 * The density ramp: one hue, lightness monotone, anchored against the ground.
 *
 * A sequential scale is one hue light-to-dark — the hue here is the app's own
 * accent (OKLCH hue 36.18), so the map reads as part of the product rather than
 * as a stock rainbow, and a single hue keeps density legible as *one* increasing
 * quantity instead of a sequence of unrelated colours.
 *
 * The anchor flips with the basemap, and that is the whole reason there are two
 * arrays. On a light basemap the dense end has to be **dark** to separate from
 * near-white land; on a dark one it has to be **light**. A single ramp cannot do
 * both, and this app ships sixteen looks of which several are dark.
 *
 * Written as hex because MapLibre's colour parser predates CSS Color 4 and does
 * not read `oklch()`. Each was computed from its OKLCH source and snapped down
 * to the sRGB gamut — clipping would bend the hue and break the ramp's
 * monotonicity, which is the one property that makes it readable.
 */
const LIGHT_GROUND_RAMP = [
  "#f9ccbf", // oklch(88% 0.055 36.18)
  "#fda38a", // oklch(80% 0.113 36.18)
  "#fd7752", // oklch(72% 0.172 36.18)
  "#ec470e", // oklch(63% 0.209 36.18)
  "#b73508", // oklch(52% 0.173 36.18)
] as const;

const DARK_GROUND_RAMP = [
  "#7e321e", // oklch(42% 0.110 36.18)
  "#be4320", // oklch(55% 0.165 36.18)
  "#f95828", // oklch(67% 0.205 36.18)
  "#fd9e84", // oklch(79% 0.120 36.18)
  "#fed3c7", // oklch(90% 0.052 36.18)
] as const;

/**
 * What a dot is ringed with, so it separates from whatever is under it.
 *
 * The ground's own colour rather than a fixed white: a white ring on a white
 * basemap is not a ring, and the job here is to hold the dot away from the map,
 * not to be visible in its own right.
 */
const LIGHT_GROUND_RING = "#ffffff";
const DARK_GROUND_RING = "#14161a";

/**
 * What `heatmap-color` accepts, derived rather than imported.
 *
 * The name MapLibre gives this type lives in `@maplibre/maplibre-gl-style-spec`,
 * which is a transitive dependency and not something to import directly for a
 * type. Reading it back off the layer union keeps `densityRamp` honestly typed
 * with nothing added to package.json and no cast.
 */
type DensityRamp = NonNullable<
  NonNullable<Extract<StyleSpecification["layers"][number], { type: "heatmap" }>["paint"]>["heatmap-color"]
>;

export type HeatPoint = {
  lng: number;
  lat: number;
  /**
   * How much this point counts for. Absent means one, which is what a coverage
   * map wants — see `heatFeatures`.
   */
  weight?: number;
};

export type HeatFeatures = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { w: number };
  }[];
};

/**
 * The points as GeoJSON, each carrying how much it counts for.
 *
 * **One flat number and nothing else.** MapLibre serialises features to its
 * worker, and a nested object does not survive the trip — so a property here can
 * only ever be a scalar. That constraint is why this was originally written with
 * no properties at all, and it still holds: `w` is a number or this breaks in a
 * way that shows up as an empty map with nothing in the console.
 *
 * Weight exists because this file now draws two different questions. Coverage —
 * where are the owner's locations — wants every point counted once, and passes
 * no weight. Visitor analytics wants a point per city weighted by how many
 * people were in it, and a per-location point weighted by how many opened it;
 * without weight those would need one duplicated feature per session, which is
 * the same picture at a hundred times the memory.
 */
export function heatFeatures(points: readonly HeatPoint[]): HeatFeatures {
  /*
   * Normalised against the busiest point, so weights land in 0–1.
   *
   * `heatmap-weight` is a multiplier on top of `heatmap-intensity`, and the ramp
   * saturates: hand it a raw session count of 500 and every blob on the map is
   * the top colour, which is a picture with no information in it. Relative is
   * also the honest reading — a density map answers "where is this concentrated",
   * which is a comparison between points and not an absolute quantity.
   *
   * A coverage map passes no weights at all, so every point is 1, divides by 1,
   * and renders exactly as it did before this existed.
   */
  const max = points.reduce((most, point) => Math.max(most, point.weight ?? 1), 1);

  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      properties: { w: (point.weight ?? 1) / max },
    })),
  };
}

export function addHeatLayers(
  map: MapLibreMap,
  data: HeatFeatures,
  isDarkGround: boolean,
): void {
  if (!map.getSource(HEAT_SOURCE)) {
    map.addSource(HEAT_SOURCE, { type: "geojson", data });
  }

  const ramp = isDarkGround ? DARK_GROUND_RAMP : LIGHT_GROUND_RAMP;
  const ring = isDarkGround ? DARK_GROUND_RING : LIGHT_GROUND_RING;

  /*
   * Under the labels, which is the same anchor `addShapeLayers` uses and the
   * same one `carryRuntimeLayers` puts things back at. Street and place names
   * stay readable through the heat, and the two paths cannot disagree about the
   * stacking order.
   */
  const beforeId = firstSymbolLayerId(map);

  if (!map.getLayer(HEAT_LAYER)) {
    map.addLayer(
      {
        id: HEAT_LAYER,
        type: "heatmap",
        source: HEAT_SOURCE,
        maxzoom: FADE_TO,
        paint: {
          "heatmap-color": densityRamp(ramp),
          /*
           * Read straight off the feature. A coverage map writes 1 everywhere,
           * so this is the identity it always was; a weighted map writes a count
           * and one busy city outweighs ten quiet ones, which is the whole
           * reason a density map is worth drawing.
           */
          "heatmap-weight": ["get", "w"],
          /*
           * Radius grows with zoom, because it is measured in screen pixels: held
           * constant, a blob covering a county at zoom 4 covers a street at zoom
           * 12, and the same data would appear to describe a different amount of
           * ground at every scale.
           */
          /*
           * Retuned when this stopped being a coverage map.
           *
           * The first ramp (4px at zoom 0, 14px at zoom 5) was right for its
           * original job: a customer's own shops, looked at from city scale,
           * where a tight blob per cluster is the answer. Visitor origins live
           * two or three zoom levels further out — a country each — and at that
           * scale 14px is a pinprick you have to hunt for. Measured against the
           * seeded data: six European cities read as six specks at the opening
           * frame, and as six readable blobs at these numbers.
           */
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            10,
            3,
            18,
            5,
            26,
            9,
            34,
            FADE_TO,
            46,
          ],
          /*
           * Cranked up as the blobs separate, so a lone point still registers
           * once it is no longer stacked with its neighbours — and started
           * higher than 1 for the same reason the radius did. A handful of
           * well-separated points never accumulate density, so at intensity 1
           * every one of them sits at the palest end of a ramp built to show a
           * gradient.
           */
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 2, FADE_TO, 3.5],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            FADE_FROM,
            0.9,
            FADE_TO,
            0,
          ],
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(POINT_LAYER)) {
    map.addLayer(
      {
        id: POINT_LAYER,
        type: "circle",
        source: HEAT_SOURCE,
        minzoom: FADE_FROM,
        paint: {
          "circle-color": ramp[3],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], FADE_FROM, 2.5, 16, 6],
          "circle-stroke-color": ring,
          "circle-stroke-width": 1.5,
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            FADE_FROM,
            0,
            FADE_TO,
            1,
          ],
          // Fades with the fill, or the map grows a field of bare rings on the
          // way in while the dots are still arriving.
          "circle-stroke-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            FADE_FROM,
            0,
            FADE_TO,
            1,
          ],
        },
      },
      beforeId,
    );
  }
}

/**
 * Repaint for a ground that changed under a map that is already up.
 *
 * Only Auto can do this: a pinned basemap or theme looks the same for everyone,
 * but Auto follows the dashboard's own light/dark, so toggling the theme inverts
 * the basemap beneath a heatmap that was painted for the other one. `setStyle`
 * carries the source across (lib/map/carry-style.ts), which is what makes this
 * necessary rather than academic — the layers survive, so nothing re-adds them
 * with the new ramp.
 *
 * Three `setPaintProperty` calls rather than a remove-and-re-add, which would
 * hand the whole feature collection back to the worker to re-tile for a colour
 * change.
 */
export function setHeatGround(map: MapLibreMap, isDarkGround: boolean): void {
  if (!map.getLayer(HEAT_LAYER) || !map.getLayer(POINT_LAYER)) return;

  const ramp = isDarkGround ? DARK_GROUND_RAMP : LIGHT_GROUND_RAMP;

  map.setPaintProperty(HEAT_LAYER, "heatmap-color", densityRamp(ramp));
  map.setPaintProperty(POINT_LAYER, "circle-color", ramp[3]);
  map.setPaintProperty(
    POINT_LAYER,
    "circle-stroke-color",
    isDarkGround ? DARK_GROUND_RING : LIGHT_GROUND_RING,
  );
}

/**
 * The ramp as a MapLibre expression.
 *
 * Density 0 must be fully transparent, and that first stop has to be
 * `rgba(…, 0)` rather than a colour. MapLibre interpolates this across the whole
 * canvas, so a coloured zero stop tints every pixel of the map — the ocean
 * included — rather than only where locations are. It is the ramp's own first
 * colour at zero alpha, so the fade in is alpha rather than a hue shift.
 *
 * One function because `addHeatLayers` and `setHeatGround` must not be able to
 * disagree about what the ramp is.
 */
function densityRamp(ramp: readonly string[]): DensityRamp {
  return [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(249, 204, 191, 0)",
    0.2,
    ramp[0],
    0.4,
    ramp[1],
    0.6,
    ramp[2],
    0.8,
    ramp[3],
    1,
    ramp[4],
  ];
}

function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
}
