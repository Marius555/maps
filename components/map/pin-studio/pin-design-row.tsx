"use client";

import { PinPreview } from "@/components/map/pin-preview";
import { pickedTileClass } from "@/components/ui/picked-tile";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinFieldRow } from "./pin-field-row";

/**
 * One design choice, drawn as the pin that choice makes.
 *
 * Every option is a real `PinPreview` — the same drawing the marker and the embed
 * produce, which is the property this whole feature is built around — of *your
 * pin* with this row's one field swapped for the option's. Pick a fill and the
 * shape, size and ring tiles all repaint in it; pick a glyph and they all wear it.
 * So a tile is not "what a diamond looks like", it is "what your pin looks like as
 * a diamond", and choosing needs no imagining.
 *
 * The hero above still carries the current design, and it is what changes as you
 * press through a row. It is not redundant with these: the tiles show the four
 * pins you could have, and it shows the one you do — at a size where a ring
 * thickness or a logo actually reads.
 *
 * `preview` returns a *patch* rather than a whole pin, which is what keeps the
 * caller's types intact — `(shape) => ({ shape })` checks where a computed key
 * would not — while leaving the baseline this component's business.
 *
 * The draft always draws, because `pinIconSchema` refuses a pin that is neither
 * glyph nor image and `blankPin` starts one with a glyph. A pin that was neither
 * would resolve to `null` and every tile in the row would come out as the same
 * plain ball.
 *
 * Used four times: icon, shape, size and ring thickness. Colours go through
 * PinSwatchRow next door, which cannot use this — a swatch has to show the colour
 * itself, and a pin whose ring turned white, previewed on a white dialog, shows
 * nothing.
 */
export function PinDesignRow<T extends string>({
  label,
  draft,
  value,
  options,
  preview,
  onChange,
}: {
  label: string;
  /** The pin being made. Every tile is this, with one field swapped. */
  draft: CustomPinIcon;
  value: T;
  options: readonly { value: T; label: string }[];
  /** What this option changes about a pin. The tile draws the result. */
  preview: (value: T) => Partial<CustomPinIcon>;
  onChange: (value: T) => void;
}) {
  return (
    <PinFieldRow label={label} count={options.length}>
      {options.map((option) => {
        const isPicked = value === option.value;
        // The resolver takes a list and an id, so the pin is handed to it as a
        // one-entry library. The same trick the hero uses.
        const pin = { ...draft, id: "preview", ...preview(option.value) };

        return (
          <button
            key={option.value}
            type="button"
            title={option.label}
            // The row's own name is on the group, so this only has to say which
            // option it is — "Ring thickness, thick" would be said twice.
            aria-label={option.label}
            aria-pressed={isPicked}
            onClick={() => onChange(option.value)}
            // 56px tall around a 44px pin; the width comes from the track, which
            // fits three across. The padding is not spacing: the largest size
            // scales the pin past its own box by 5.5px, and 6px of padding is
            // what stops that from crossing into the tile beside it.
            className={`${pickedTileClass(isPicked)} grid h-14 place-items-center p-1.5`}
          >
            <PinPreview icon="custom:preview" pinIcons={[pin]} size="tile" />
          </button>
        );
      })}
    </PinFieldRow>
  );
}
