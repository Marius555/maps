"use client";

import { ColorSwatchPicker } from "@heroui/react";

import { CATEGORY_COLORS } from "@/lib/validation/category.schema";

/**
 * The palette, as swatches.
 *
 * A fixed palette rather than a free colour wheel: eight distinguishable colours
 * chosen once beats letting someone pick eight shades of the same blue and then
 * wonder why their legend is unreadable.
 */
export function CategoryColorPicker({
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
      {CATEGORY_COLORS.map((color) => (
        <ColorSwatchPicker.Item key={color} color={color}>
          <ColorSwatchPicker.Swatch />
          <ColorSwatchPicker.Indicator />
        </ColorSwatchPicker.Item>
      ))}
    </ColorSwatchPicker>
  );
}
