"use client";

import { ColorSwatchPicker } from "@heroui/react";

import { PALETTE_COLORS } from "@/lib/validation/palette";

/**
 * The palette, as swatches.
 *
 * A fixed palette rather than a free colour wheel: eight distinguishable colours
 * chosen once beats letting someone pick eight shades of the same blue and then
 * wonder why their legend is unreadable. `components/ui/color-picker-field.tsx`
 * is the other half — a brand colour, where a palette we chose is the wrong one.
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
  onChange: (color: string) => void;
}) {
  return (
    <ColorSwatchPicker
      aria-label={label}
      size="sm"
      value={value}
      onChange={(color) => onChange(color.toString("hex").toLowerCase())}
    >
      {PALETTE_COLORS.map((color) => (
        <ColorSwatchPicker.Item key={color} color={color}>
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker>
  );
}
