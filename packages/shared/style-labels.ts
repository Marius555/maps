import { setLayerVisibility } from "./style-layers";
import type { StyleLike } from "./style-tint";

/**
 * How much of the basemap's own text to show.
 *
 * A store locator is a map with something on it. The basemap's job is to say
 * where, not to compete — and Liberty at full detail draws every shop, café and
 * street name in the frame, under the pins the customer is actually paying to
 * show. So this is three settings rather than a switch, matching what the
 * competition offers.
 *
 * The middle setting is the interesting one. "Fewer" keeps the labels that
 * orient you — countries, states, cities, towns, airports — and drops the ones
 * that fill space: street names, water names and every POI. That is expressed as
 * a rule about `source-layer`, not about layer ids, so it works unchanged
 * against all five OpenFreeMap style documents.
 */

export const LABEL_LEVELS = ["all", "some", "none"] as const;
export type LabelLevel = (typeof LABEL_LEVELS)[number];

export const DEFAULT_LABEL_LEVEL: LabelLevel = "all";

/**
 * The source-layers "fewer" keeps: place names and airports. Everything else a
 * symbol layer can be drawn from — `poi`, `transportation_name`, `water_name`,
 * `waterway` — is detail.
 */
const ORIENTING_SOURCE_LAYERS = new Set(["place", "aerodrome_label"]);

export function applyLabelLevel<T extends StyleLike>(style: T, level: LabelLevel): T {
  if (level === "all") return style;

  const layers = Array.isArray(style.layers) ? style.layers : [];

  return {
    ...style,
    layers: layers.map((layer) => {
      if (layer.type !== "symbol") return layer;

      const keep =
        level === "some" &&
        ORIENTING_SOURCE_LAYERS.has(String(layer["source-layer"] ?? ""));

      return keep ? layer : setLayerVisibility(layer, false);
    }),
  };
}
