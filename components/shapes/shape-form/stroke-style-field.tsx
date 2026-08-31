"use client";

import { useId } from "react";

import {
  SHAPE_STROKE_STYLES,
  type ShapeStrokeStyle,
} from "@/packages/shared/shapes";

/**
 * How a shape's outline is marked out.
 *
 * Each option draws itself rather than naming itself, because "dotted" and
 * "dashed" are two words for the same idea until you have seen which is which —
 * and what the map will actually draw is a line, so a line is what the control
 * should show. The word is still there beneath it: a swatch alone leaves shape
 * as the only signal, which is the same argument confidence-mark.tsx makes about
 * colour in the import wizard.
 *
 * The dash arrays are the renderers' own, scaled from line-widths to this SVG's
 * 3px stroke, so a preview cannot promise a marking the map does not draw.
 */
const STYLES: Record<ShapeStrokeStyle, { label: string; dash?: string }> = {
  solid: { label: "Solid" },
  dashed: { label: "Dashed", dash: "6 6" },
  // Zero-length dashes with round caps — dots, the way MapLibre draws them.
  dotted: { label: "Dotted", dash: "0 6" },
};

export function StrokeStyleField({
  value,
  onChange,
}: {
  value: ShapeStrokeStyle;
  onChange: (style: ShapeStrokeStyle) => void;
}) {
  const groupName = useId();

  return (
    <fieldset>
      <legend className="text-sm font-medium text-foreground">Line style</legend>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {SHAPE_STROKE_STYLES.map((style) => {
          const isSelected = style === value;
          const { label, dash } = STYLES[style];

          return (
            <label
              key={style}
              /*
               * `relative` is load-bearing, not layout.
               *
               * Tailwind's `sr-only` is `position: absolute`, so without a
               * positioned ancestor the hidden radio lays itself out against
               * whatever is positioned further up the tree. Clicking a tile
               * focuses that input, the browser scrolls it into view, and the
               * page jumps somewhere else entirely — the exact bug documented on
               * theme-gallery.tsx and labels-field.tsx.
               */
              className={`relative flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 transition-colors duration-[var(--duration-fast)] hover:bg-default ${
                isSelected ? "border-accent bg-default" : "border-border"
              }`}
            >
              <input
                type="radio"
                name={groupName}
                value={style}
                checked={isSelected}
                onChange={() => onChange(style)}
                className="peer sr-only"
              />

              <svg
                aria-hidden="true"
                viewBox="0 0 44 8"
                className="h-2 w-full peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--focus)]"
              >
                <line
                  x1="2"
                  y1="4"
                  x2="42"
                  y2="4"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                />
              </svg>

              <span
                className={`text-xs ${isSelected ? "text-foreground" : "text-muted"}`}
              >
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
