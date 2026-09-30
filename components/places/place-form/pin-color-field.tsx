"use client";

import { Button, Label } from "@heroui/react";

import { SwatchButton } from "@/components/ui/swatch-button";

/**
 * This location's own pin colour, or the theme's.
 *
 * `""` is "no colour of its own": the pin then takes its custom pin's colour,
 * its first tag's, or the theme's, exactly as it did before the field existed.
 * A colour set here — or arriving from an imported file's colour column —
 * paints the pin, the pin inside its card and the card's button together, which
 * is `groupColorIndex.forPlace` doing its job rather than anything this control
 * does.
 *
 * The swatch shows the theme colour while nothing is set, so the dot always
 * answers "what colour is this pin"; the words beside it say whose colour it is.
 */
export function PinColorField({
  value,
  themeColor,
  onChange,
}: {
  value: string;
  /** What an unset pin falls back to: the map's Default pin colour. */
  themeColor: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Pin colour</Label>

      <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1">
        <SwatchButton
          label="Pin colour for this location"
          value={value || themeColor}
          onChange={onChange}
        />
        <span className="text-sm text-muted">
          {value ? value.toUpperCase() : "Theme colour"}
        </span>

        {value ? (
          <Button size="sm" variant="ghost" onPress={() => onChange("")}>
            Use theme colour
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        Colours the pin and its card. A custom pin with its own colour overrides
        it.
      </p>
    </div>
  );
}
