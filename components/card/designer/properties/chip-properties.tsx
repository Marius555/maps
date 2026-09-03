"use client";

import { ColorPickerField } from "@/components/ui/color-picker-field";
import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import { PropertyScale } from "./property-fields";
import { CHIP_BORDER_WIDTHS, CHIP_ROOM } from "./property-scales";

/**
 * The four things that can be said about the pills a block draws, rather than
 * about the words inside them.
 *
 * Its own group beside `TextProperties` for the reason that one is a group at
 * all: Font, Size, Colour and Bold are four questions about a block's *words*,
 * and on the Tags block every one of them landed on the label while the pill
 * around it stayed exactly as it shipped. So the panel offered a Colour that
 * changed the writing and nothing that changed the chip — which reads as a
 * colour control that half works.
 *
 * **Alignment is not here even though this is what fixed it.** It is a question
 * every block answers, it already sits above with the rest of the box controls,
 * and moving it into a group that only two types have would hide it from the
 * eleven that do not. What changed is `chipStyleOf`, which hands the same answer
 * back as a `justify-content` a flex row of chips can actually use — see
 * packages/shared/card-layout.ts.
 */
export function ChipProperties({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <>
      <ColorPickerField
        label="Chip colour"
        value={block.chipBackground ?? ""}
        // The soft neutral both renderers already draw, so the wheel opens on
        // roughly what is on screen rather than on a colour nobody has seen.
        fallback="#e9ecef"
        onChange={(chipBackground) => onChange({ chipBackground })}
        // An empty string is the absence, and the absence is theme-aware where a
        // stored literal could not be: a pale pill picked against a light card
        // vanishes the moment a visitor's map is dark.
        onClear={() => onChange({ chipBackground: "" })}
      />

      {/*
       * The outline, which is a pair and is stored as one.
       *
       * Absent here is genuinely *no border* rather than a theme's own — there
       * is nothing under a chip's edge to fall back to, which is what makes this
       * different from the ground above and what makes it free to add: every
       * card published so far draws an unoutlined pill and keeps drawing one.
       */}
      <ColorPickerField
        label="Chip border"
        value={block.chipBorder ?? ""}
        // A shade of the neutral ground, so the wheel opens on something that
        // looks like an outline rather than on an accent nobody would pick.
        fallback="#c8ced6"
        onChange={(chipBorder) => onChange({ chipBorder })}
        // Which takes the width with it — see `resizeCardBlock`. Half an
        // outline is not a thing a chip can draw.
        onClear={() => onChange({ chipBorder: "" })}
      />

      {/* Only once there is a colour for it to be a width of, exactly as the
          card's own Border width waits for the card's border
          (card-properties.tsx). A width control over a chip with no outline is
          the one thing this panel does not do.

          A button's Border width is *not* gated this way any more, and that is
          the deliberate difference rather than drift: a button's outline falls
          back to its own label colour, so a width alone draws something there.
          A chip has nothing under its edge to fall back to. */}
      {block.chipBorder ? (
        <PropertyScale
          label="Border width"
          value={block.chipBorderWidth ?? 0}
          options={CHIP_BORDER_WIDTHS}
          onChange={(chipBorderWidth) => onChange({ chipBorderWidth })}
        />
      ) : null}

      <PropertyScale
        label="Chip padding"
        value={block.chipPadding ?? 0}
        options={CHIP_ROOM}
        onChange={(chipPadding) => onChange({ chipPadding })}
      />
    </>
  );
}
