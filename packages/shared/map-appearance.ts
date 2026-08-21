import {
  type LabelLevel,
  applyLabelLevel,
  DEFAULT_LABEL_LEVEL,
} from "./style-labels";
import {
  type LayerToggles,
  applyLayerToggles,
  DEFAULT_LAYER_TOGGLES,
} from "./style-layers";
import { type StyleLike, type StyleTint, tintStyle } from "./style-tint";

/**
 * Everything a map owner can do to the basemap itself, in one object, applied in
 * one place.
 *
 * One place matters more than it sounds. The editor may call `setStyle` — its
 * pins are DOM markers and its shapes re-add themselves on `styledata` — but the
 * embed may not: its places are a GeoJSON source with cluster layers that
 * `setStyle` silently drops. So there is exactly one moment both targets share
 * where a style can be changed, and it is before the map is constructed. That
 * moment is `loadMapStyle()`, and this is what it applies.
 *
 * Shared, and so dependency-free — see ./style-tint.ts for why the two targets
 * cannot be allowed to run two transforms that merely agree today.
 */
export type MapAppearance = {
  /** The theme's recolouring, resolved. Absent means the basemap's own colours. */
  tint?: StyleTint;
  labels?: LabelLevel;
  layers?: LayerToggles;
};

/**
 * Order is load-bearing. Layers first, because `cycling` *adds* a layer and that
 * layer should be themed like every other line rather than keeping the one
 * colour this code happened to pick. Labels next, so a hidden label is hidden
 * whatever a toggle thought about its source-layer. Tint last, over everything
 * that ended up in the style.
 */
export function applyAppearance<T extends StyleLike>(
  style: T,
  appearance: MapAppearance,
): T {
  let next = style;

  if (appearance.layers) next = applyLayerToggles(next, appearance.layers);
  if (appearance.labels) next = applyLabelLevel(next, appearance.labels);
  if (appearance.tint) next = tintStyle(next, appearance.tint);

  return next;
}

/**
 * Would applying this change nothing?
 *
 * Worth asking twice. `loadMapStyle` uses it to hand MapLibre a plain URL and
 * skip fetching the style itself, which is what keeps an unthemed map costing
 * exactly what it cost before any of this existed. And the snapshot builder uses
 * it to leave the field out of the published JSON entirely, so a map that
 * changed nothing publishes the same bytes it always did.
 */
export function isPlainAppearance(
  appearance: MapAppearance | null | undefined,
): boolean {
  if (!appearance) return true;
  if (appearance.tint) return false;
  if (appearance.labels && appearance.labels !== DEFAULT_LABEL_LEVEL) return false;

  const layers = appearance.layers;
  if (!layers) return true;

  return (Object.keys(DEFAULT_LAYER_TOGGLES) as (keyof LayerToggles)[]).every(
    (key) => layers[key] === undefined || layers[key] === DEFAULT_LAYER_TOGGLES[key],
  );
}
