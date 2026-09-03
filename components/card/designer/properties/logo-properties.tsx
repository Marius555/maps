"use client";

import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import { PropertyChoice } from "./property-fields";

/**
 * Which of its two drawings the mark is.
 *
 * The Logo block has always drawn the location's whole pin — body, ring, and
 * whichever of a glyph or an uploaded image sits inside it. That is the right
 * default and stays the default, but it is not always what somebody who has
 * uploaded a brand mark wants on a card: a pin says "this is a place on a map",
 * and on a card the place is already named directly above it.
 *
 * **Absent is the pin**, which is what every card drawn before this control
 * existed draws, so nothing published moves (CLAUDE.md §7).
 *
 * `hasImage` is what keeps this honest. A location whose pin carries a glyph has
 * no logo to draw, and `logoImageOf` gives it the pin whatever this says — so on
 * a card designed against such a location the Logo button is a control that
 * visibly does nothing, and this panel's own rule is that a control shown is a
 * control that takes effect. The button stays rather than disappearing, because
 * the design is saved for every map in the account and the *other* four hundred
 * locations may well have logos; the line under it says which case this is.
 */
const LOGO_OPTIONS = [
  { value: "pin", label: "Pin" },
  { value: "image", label: "Logo" },
] as const satisfies readonly { value: "pin" | "image"; label: string }[];

export function LogoProperties({
  block,
  hasImage,
  onChange,
}: {
  block: CardBlock;
  /** Whether the *sample* location's pin carries an uploaded image. */
  hasImage: boolean;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <>
      <PropertyChoice
        label="Show"
        // The pin is what an untouched block draws, so that is what the control
        // has to show — not a third "unset" state nobody chose.
        value={block.logoMode ?? "pin"}
        options={LOGO_OPTIONS}
        onChange={(logoMode) => onChange({ logoMode })}
      />

      {/* Said only while it is true, and said as a fact about this location
          rather than as a fault (§8). */}
      {block.logoMode === "image" && !hasImage ? (
        <p className="-mt-1 text-xs text-muted">
          This location&rsquo;s pin has no logo on it, so the pin is drawn
          instead. Add one in Pin studio.
        </p>
      ) : null}
    </>
  );
}
