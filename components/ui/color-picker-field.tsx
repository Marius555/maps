"use client";

import {
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  parseColor,
  type Color,
} from "@heroui/react";
import { X } from "lucide-react";
import { useState } from "react";

import { IconButton } from "@/components/ui/icon-button";

/**
 * Any colour, behind HeroUI's own picker.
 *
 * The counterpart to `SwatchPicker`, which is eight fixed swatches and
 * is right for what it does: a category's colour is a *legend*, and eight
 * distinguishable ones beats eight shades of the same blue. This is for the
 * places where the answer is a brand colour — the words on a card, the card's
 * own ground — where a palette we chose is simply the wrong palette.
 *
 * **It is the documented v3 anatomy and not a lookalike**: a `ColorSwatch` and
 * a `Label` inside `ColorPicker.Trigger`, with the wheel, the hue slider and the
 * hex field in `ColorPicker.Popover`. The version this replaced was a hand-built
 * trigger with a hand-drawn swatch, which cost the popover animation, the focus
 * ring and the field look — and cost one real bug: a `background` shorthand
 * beside a `backgroundImage` on the same element made React warn on every render
 * of every swatch. `ColorSwatch` paints its own checkerboard for a transparent
 * colour, so there is no hand-written gradient left to conflict with anything.
 *
 * Hex in, hex out, lowercased at the boundary, exactly as the swatch picker
 * does. React Aria's `Color` object never leaves this file: everything stored in
 * this codebase is a `#rrggbb` string, and a card layout is read by an embed
 * that has never heard of React Aria.
 *
 * **`onClear` is what makes an unset colour reachable.** Absent is not white and
 * not black — on a card it means "whatever this block has always been", which is
 * theme-aware where any stored literal could not be (see `CardLayout.background`
 * in packages/shared/card-layout.ts). A picker with no way back to that would
 * make the first press permanent. It is an × on the field rather than a button
 * inside the popover, because taking a colour back off is something you do *to*
 * the field and should not need the field opened first — and because a row of
 * pickers each carrying a "Use the theme default" button was one more thing to
 * read in a panel whose every other control is one word.
 *
 * **The × sits inside the field, over its own reserved end.** It used to be a
 * sibling in a fixed slot *beside* the field, which cost every picker about 36px
 * of a 24rem column — so a row of them was visibly narrower than the sliders and
 * selects around it — and put the reset a thumb's width from the trigger that
 * opens the wheel, on a control where the two mean opposite things. It is still
 * a sibling in the DOM, because the trigger is a `<button>` and a button inside a
 * button is neither valid nor clickable; `position: absolute` is what puts it
 * over the trigger's ground without nesting it there, and the trigger's own
 * `pe-9` is the room it sits in. That padding is unconditional, so the label
 * truncates at the same point whether or not there is a colour to clear.
 */

/**
 * Zero alpha, as a string React Aria's `parseColor` can actually read.
 *
 * The `transparent` keyword throws — see the swatch below.
 */
const TRANSPARENT = "#00000000";

/**
 * What the wheel opens on when nothing is set.
 *
 * **Saturated on purpose, and that is what makes the hue slider work on first
 * use.** Hue means nothing at zero saturation — every hue of a grey is the same
 * grey — so a picker opening on `#888888` had a hue slider whose thumb moved and
 * whose colour did not, and the only way to find out it worked at all was to
 * drag the saturation area first. Mid saturation and mid brightness also put the
 * area's own thumb in the middle of the square rather than in a corner with
 * nowhere to drag from, which is what white would do.
 */
const DEFAULT_FALLBACK = "#3d7ea6";

export function ColorPickerField({
  label,
  value,
  fallback = DEFAULT_FALLBACK,
  onChange,
  onClear,
}: {
  label: string;
  /** A `#rrggbb`, or empty for "not set". */
  value: string;
  /** What the wheel opens on when nothing is set. See `DEFAULT_FALLBACK`. */
  fallback?: string;
  onChange: (hex: string) => void;
  /** Offered only when there is something to clear — see above. */
  onClear?: () => void;
}) {
  /*
   * The wheel's own colour, held here in HSB rather than re-derived from the
   * stored hex on every render.
   *
   * Hex is RGB, and the round trip through it **loses the hue** of anything
   * grey: `parseColor("#888888")` comes back at hue 0 whatever hue the slider
   * was just dragged to, so the next render put the thumb back at red and the
   * control could not be moved off a grey at all. Keeping the picker's own
   * `Color` means the hue someone chose survives until they raise the saturation
   * that makes it visible.
   *
   * Re-seeded only when `value` changes to something that is *not* what we just
   * emitted — an outside edit, or a clear. Adjusting state during render rather
   * than in an effect, which is React's own documented answer here and the one
   * that does not repaint the wheel a frame late.
   */
  const [draft, setDraft] = useState<Color>(() => toHsb(value, fallback));
  const [seen, setSeen] = useState(value);

  if (value !== seen) {
    setSeen(value);
    if (hexOf(draft) !== value.toLowerCase()) setDraft(toHsb(value, fallback));
  }

  return (
    /*
     * The positioning context for the reset — see the docblock. The × is a
     * sibling of the picker and drawn over it, not a child of the trigger.
     */
    <div className="relative w-full">
      <ColorPicker
        // `.color-picker` is `inline-flex`, so the root shrinks to the trigger's
        // content and `w-full` on the trigger alone measures against that. The
        // root has to take the width for the field to fill the column like its
        // neighbours; `min-w-0` is what lets the label truncate inside it.
        className="w-full min-w-0"
        value={draft}
        onChange={(next) => {
          setDraft(next);
          onChange(hexOf(next));
        }}
      >
        {/*
         * Full width and shaped like the fields around it. HeroUI's own trigger is
         * `inline-flex` with no ground of its own — right beside a heading, wrong
         * in a column of form controls, so it takes `bg-default`: the same token
         * `.select--secondary` and `.checkbox--secondary` paint themselves with,
         * which is the one thing on this panel that is reliably not the surface
         * colour. Utilities beat HeroUI's BEM because that sits in
         * `@layer components` and Tailwind's utilities come later — the cascade
         * trick `components/ui/inline-select.tsx` documents at length.
         */}
        {/* `pe-9` is the room the reset sits in, kept whether or not there is
            one — see the docblock. */}
        <ColorPicker.Trigger className="w-full gap-2 rounded-lg bg-default py-2 pe-9 ps-2.5">
          {/*
           * The stored colour, not the fallback the wheel opens on — a swatch
           * showing grey for "not set" would be a colour nobody picked
           * pretending to be one they did. Nothing stored means transparent,
           * which is what `ColorSwatch` draws its checkerboard for.
           *
           * `#00000000` and *not* the `transparent` keyword: React Aria parses
           * this string with `parseColor`, which knows hex, `rgb()`, `hsl()` and
           * `hsb()` and throws `Invalid color value` on a CSS keyword — and the
           * throw is during render, so it takes the whole properties panel down
           * to an error boundary rather than drawing a wrong swatch.
           *
           * It is the whole readout now. The hex used to sit at the far end of
           * the trigger, which is six characters of machine notation on a
           * control whose entire subject is what the colour *looks* like — and a
           * column of fields that each jumped from "Theme default" to a code as
           * they were answered. The swatch says it in the language the question
           * was asked in (§8), and the × beside it says the other half.
           */}
          {/*
           * Wrapped rather than given `aria-hidden` of its own: React Aria's
           * `ColorSwatch` is a `role="img"` that names itself after the colour,
           * and it spreads its own props last — so the trigger announced itself
           * as "transparent Colour Theme default". A hidden wrapper takes the
           * whole subtree out, and the trigger's name is the label again.
           */}
          <span aria-hidden="true" className="flex">
            <ColorSwatch color={value || TRANSPARENT} size="xs" />
          </span>
          <Label className="cursor-[inherit] truncate">{label}</Label>
        </ColorPicker.Trigger>

        <ColorPicker.Popover>
          <ColorArea
            aria-label={`${label} saturation and brightness`}
            className="h-32 max-w-full"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness"
          >
            <ColorArea.Thumb />
          </ColorArea>

          {/* Hue on its own axis. The area covers saturation and brightness,
              which is two of the three — a wheel without this is a picker that
              can only reach one family of colours. */}
          <ColorSlider
            aria-label={`${label} hue`}
            channel="hue"
            className="px-1"
            colorSpace="hsb"
          >
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>

          {/* And the number, because a brand colour arrives as a hex string from a
              style guide rather than as a place on a wheel. */}
          <ColorField aria-label={`${label} hex`} fullWidth>
            <ColorField.Group variant="secondary">
              <ColorField.Prefix>
                <ColorSwatch size="xs" />
              </ColorField.Prefix>
              <ColorField.Input className="tabular-nums" />
            </ColorField.Group>
          </ColorField>
        </ColorPicker.Popover>
      </ColorPicker>

      {/*
       * Over the trigger's own end, inside its `pe-9`. The row is only rendered
       * when there is something to clear — the *room* is what is always there,
       * so nothing resizes the first time a field is given a colour.
       */}
      {value && onClear ? (
        <span className="absolute inset-y-0 end-1 z-10 flex items-center">
          <IconButton
            label={`Clear ${label.toLowerCase()}`}
            icon={X}
            iconClassName="size-3.5"
            onPress={onClear}
          />
        </span>
      ) : null}
    </div>
  );
}

/** The picker's own value: HSB, so a hue survives a colour that cannot show it. */
function toHsb(value: string, fallback: string): Color {
  const color =
    safeColor(value) ?? safeColor(fallback) ?? parseColor(DEFAULT_FALLBACK);

  return color.toFormat("hsb");
}

/** What leaves this file: a `#rrggbb`, lowercased at the boundary. */
function hexOf(color: Color): string {
  return color.toString("hex").toLowerCase();
}

/**
 * `parseColor`, without the throw.
 *
 * What reaches here is a stored value that may predate this control, so falling
 * back rather than throwing is the same contract `resolveCardLayout` holds
 * itself to: a card must degrade, never take a page down.
 */
function safeColor(value: string) {
  if (!value) return null;

  try {
    return parseColor(value);
  } catch {
    return null;
  }
}
