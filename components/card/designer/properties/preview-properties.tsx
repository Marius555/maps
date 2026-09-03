"use client";

import { CHIP_PREVIEW_COUNTS } from "@/lib/card/preview-chips";
import { PropertyChoice } from "./property-fields";

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
