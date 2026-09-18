"use client";

import { CHIP_PREVIEW_COUNTS } from "@/lib/card/preview-chips";
import { ColorPickerField } from "@/components/ui/color-picker-field";
import { PropertyChoice } from "@/components/ui/properties/property-fields";

/**
 * How many chips the sample card is drawn with — and nothing else.
 *
 * **This saves nothing.** It is the one control in the Modify tab that does not
 * write to the draft, which is exactly why it has a group of its own and says so
 * in words underneath: a panel where twelve controls change the design and one
 * changes the preview, all at the same rhythm with no label, is a panel that
 * will eventually have somebody publish a card believing they capped its tags.
 *
 * It exists because the Tags block's height depends on the *location*, not on
 * the design — and the canvas draws one real location, whichever the map happens
 * to list first. A card arranged against a shop wearing one tag is a card nobody
 * has checked against the stockist wearing six, and until now the only way to
 * find that out was to publish and look.
 *
 * The counts and the padding rule are in lib/card/preview-chips.ts, which is
 * where the tested part lives.
 */

/** "Real" is the sample's own tags. The rest are counts. */
const REAL = "real";

const COUNT_OPTIONS = [
  { value: REAL, label: "Real" },
  ...CHIP_PREVIEW_COUNTS.map((count) => ({
    value: String(count),
    label: String(count),
  })),
];

export function PreviewProperties({
  count,
  onCount,
}: {
  /** `null` is the sample location's own tags. */
  count: number | null;
  onCount: (count: number | null) => void;
}) {
  return (
    <>
      <PropertyChoice
        label="Chips shown"
        value={count === null ? REAL : String(count)}
        options={COUNT_OPTIONS}
        onChange={(value) => onCount(value === REAL ? null : Number(value))}
      />

      <p className="-mt-1 text-xs text-muted">
        Only changes this preview. A real card shows every tag its location has.
      </p>
    </>
  );
}

/**
 * What colour the sample pin is, and nothing else.
 *
 * `PreviewProperties`' sibling, in this file for its reason: it saves nothing,
 * and the fold it sits in is the one place on this panel where that is the rule
 * rather than the exception.
 *
 * **It exists because a card's colours now come from the pin and this tool has
 * no map in scope.** A Logo block draws the pin, and a Button the owner has not
 * coloured takes the pin's colour for its ground — so the same design is a blue
 * card on one group of locations and a red one on the next, and the canvas can
 * only ever draw the colour whichever location it picked happens to wear. That
 * is the same gap `chipPreview` fills for the Tags block, and the same answer:
 * let somebody put another colour under the design for as long as they are
 * looking at it.
 *
 * Clearing it goes back to the sample location's own, which is the honest
 * default — a designer that opened on an invented colour would be previewing a
 * card nobody has.
 */
export function PinColorPreview({
  color,
  sampleColor,
  onColor,
}: {
  /** What the canvas is drawing the pin in now. */
  color: string | undefined;
  /** The sample location's own answer, which clearing returns to. */
  sampleColor: string | undefined;
  /** `null` is "back to the sample's own". */
  onColor: (color: string | null) => void;
}) {
  /*
   * Whether there is anything to clear. The field shows the sample's own colour
   * when nothing has been set, which is the truth about the canvas — but an `×`
   * beside it would then be a control that changes nothing when pressed.
   */
  const isSet = color !== undefined && color !== sampleColor;

  return (
    <>
      <ColorPickerField
        label="Pin colour"
        value={color ?? ""}
        labelPlacement="outside"
        // Opens on what is on screen rather than on a literal — and with no
        // sample colour to read, on the ground an uncoloured button still draws.
        fallback={sampleColor ?? PIN_PREVIEW_START}
        onChange={(next) => onColor(next)}
        onClear={isSet ? () => onColor(null) : undefined}
      />

      <p className="-mt-1 text-xs text-muted">
        Only changes this preview. A real card takes each location&rsquo;s own pin
        colour, from its group or its first tag.
      </p>
    </>
  );
}

/**
 * What the wheel opens on when the sample location has no colour at all — the
 * light theme's accent, which is what both an unstyled button and an untagged
 * pin actually draw. It never reaches the layout; see `ColorPickerField`.
 */
const PIN_PREVIEW_START = "#f54600";
