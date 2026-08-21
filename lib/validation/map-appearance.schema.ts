import { z } from "zod";

import { DEFAULT_LABEL_LEVEL, LABEL_LEVELS } from "@/packages/shared/style-labels";
import {
  DEFAULT_LAYER_TOGGLES,
  type LayerToggles,
} from "@/packages/shared/style-layers";

/**
 * What the map owner did to the basemap, beyond picking one.
 *
 * A column of its own rather than another key in `settings`, and the reason is
 * mechanical: `settings` means "which of the embed's optional controls are on",
 * it belongs to the Publish tab's form, and `updateMap` writes it by
 * `JSON.stringify`ing the **whole** object. Two forms writing one blob is a lost
 * update, and the appearance controls are on two screens at once — the toolbar
 * and the Settings tab.
 *
 * The label level and the layer toggles live here. The *theme* does not: that is
 * still the `style` column, because it is still one choice from one list and
 * moving it would orphan every map already saved.
 */

export type MapAppearanceSettings = {
  labels: (typeof LABEL_LEVELS)[number];
  layers: Required<LayerToggles>;
};

export const DEFAULT_MAP_APPEARANCE: MapAppearanceSettings = {
  labels: DEFAULT_LABEL_LEVEL,
  layers: DEFAULT_LAYER_TOGGLES,
};

export const mapAppearanceSchema = z.object({
  labels: z.enum(LABEL_LEVELS),
  layers: z.object({
    poi: z.boolean(),
    transit: z.boolean(),
    buildings: z.boolean(),
    buildings3d: z.boolean(),
    paths: z.boolean(),
    cycling: z.boolean(),
  }),
});

export type MapAppearanceInput = z.output<typeof mapAppearanceSchema>;

/**
 * `appearance` is a free-form JSON column that may have been written by an older
 * build, left empty by every map created before this existed, or edited in the
 * console — so every field falls back to its default rather than trusting the
 * stored shape. Same rule as readEmbedSettings, for the same reason.
 */
export function readMapAppearance(
  appearance: Record<string, unknown>,
): MapAppearanceSettings {
  const stored = (
    appearance.layers && typeof appearance.layers === "object"
      ? appearance.layers
      : {}
  ) as Record<string, unknown>;

  const layers = Object.fromEntries(
    (Object.keys(DEFAULT_LAYER_TOGGLES) as (keyof LayerToggles)[]).map((key) => [
      key,
      typeof stored[key] === "boolean" ? stored[key] : DEFAULT_LAYER_TOGGLES[key],
    ]),
  ) as Required<LayerToggles>;

  return {
    labels: (LABEL_LEVELS as readonly string[]).includes(String(appearance.labels))
      ? (appearance.labels as MapAppearanceSettings["labels"])
      : DEFAULT_LABEL_LEVEL,
    layers,
  };
}
