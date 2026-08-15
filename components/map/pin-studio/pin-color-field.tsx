"use client";

import { Carousel } from "@/components/ui/carousel";
import { PickedCheck, pickedTileClass } from "@/components/ui/picked-tile";
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_NAMES,
} from "@/lib/validation/category.schema";

/**
 * The pin's colour, four at a time.
 *
 * Plain buttons rather than the `CategoryColorPicker` next door, for one
 * structural reason: HeroUI's ColorSwatchPicker sizes its items itself, so a
 * swatch handed a quarter of the dialog stretches into a pill instead of
 * centring a circle in it. The swatches carry their names from
 * `CATEGORY_COLOR_NAMES` to make up for the accessible name React Aria would
 * otherwise have derived.
 *
 * Same palette as categories and the same selected treatment as the icon
 * carousel above it, so the two rows read as one control with two rows rather
 * than as two widgets that happen to be adjacent.
 */
export function PinColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Carousel title="Colour" count={CATEGORY_COLORS.length}>
      {CATEGORY_COLORS.map((color) => {
        const name = CATEGORY_COLOR_NAMES[color];
        const isPicked = value === color;

        return (
          <li key={color}>
            <button
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={isPicked}
              onClick={() => onChange(color)}
              className={`${pickedTileClass(isPicked)} flex w-full items-center justify-center p-2`}
            >
              {isPicked ? <PickedCheck /> : null}

              {/* Fluid to a cap, like `.pin-preview--lg` above it: the slot is
                  whatever the arrows beside the track leave, and a fixed 40px
                  swatch overflows it on a narrow sheet. */}
              <span
                aria-hidden="true"
                className="aspect-square w-full max-w-10 rounded-full border border-border"
                style={{ background: color }}
              />
            </button>
          </li>
        );
      })}
    </Carousel>
  );
}
