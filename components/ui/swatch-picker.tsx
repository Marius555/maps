"use client";

import {
  ColorSwatchRow,
  type SwatchSource,
} from "@/components/ui/color-swatch-row/color-swatch-row";
import { PALETTE_PRESETS } from "@/components/ui/color-swatch-row/presets";
import { DEFAULT_PALETTE_COLOR } from "@/lib/validation/palette";

/**
 * A legend colour — a tag's, a group's, a shape's — as the app's one swatch row.
 *
 * The palette's first five lead, because a legend reads best in colours that
 * are far apart and those are what `nextPaletteColor` hands out first; the
 * wheel at the end is there for the owner whose brand is none of them. No
 * "default" swatch: a legend colour is required.
 *
 * It was `CategoryColorPicker` and lived under `components/categories/`, while
 * already being what shapes and groups picked their colour with. Here, under the
 * neutral name, because a tag, a shape and a group all ask the same question and
 * none of them is a category any more.
 */
export function SwatchPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (color: string, source: SwatchSource) => void;
}) {
  return (
    <ColorSwatchRow
      label={label}
      hideLabel
      value={value}
      presets={PALETTE_PRESETS}
      fallback={DEFAULT_PALETTE_COLOR}
      onChange={(color, source) => {
        if (color) onChange(color, source);
      }}
    />
  );
}
