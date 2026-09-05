"use client";

import { ColorPickerField } from "@/components/ui/color-picker-field";
import { SelectControl } from "@/components/ui/select-control";
import { CARD_FONTS } from "@/packages/shared/card-fonts";
import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import {
  PropertyCheckbox,
  PropertyChecks,
} from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import { FONT_SIZES } from "./property-scales";

/**
 * The four things that can be said about a block's words.
 *
 * One group rather than four controls scattered through the panel, because they
 * are one decision: what does this text look like. It is offered by every block
 * whose content is text and by no other — see `"text"` in `CARD_BLOCKS`.
 *
 * **Every one of them is an override, and every one of them can be taken back.**
 * Absent is the block's own default — 14px semibold foreground for a name, 13px
 * muted for an address — which each renderer keeps as the fallback in its own
 * stylesheet rather than resolving to a literal here. That is what makes the
 * controls safe to add to a live product: a block nobody has touched draws
 * exactly the pixels it always drew. So "Default" is a real entry in the font
 * list, the size slider has an off position below its floor, and the colour has
 * a reset.
 */

/** The entry that means "whatever this block has always been set in". */
const INHERIT = "";

/*
 * No `description` on any of these. The option's description is drawn under its
 * label inside the trigger, which makes every closed select two lines tall for a
 * sentence nobody needs after the first read — and the names are the whole
 * answer here.
 */
const FONT_OPTIONS = [
  { id: INHERIT, label: "Default" },
  ...CARD_FONTS.map((font) => ({ id: font.stack, label: font.label })),
];

export function TextProperties({
  block,
  showBold = true,
  onChange,
}: {
  block: CardBlock;
  /**
   * Whether Bold is drawn here.
   *
   * True for every block but one. The opening hours block asks three yes-or-nos
   * about how its week reads — bold, only today, full day names — and the group
   * boundary between Text and Content was the only thing keeping them on three
   * separate lines, so that block draws Bold in its own row instead. See
   * `HoursProperties`. Nothing else moves: this is a single exception, spelled
   * as one, rather than a rearrangement of the panel.
   */
  showBold?: boolean;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <>
      {/* The label lives inside the field, which is what `SelectControl` draws
          and what every other select in the app looks like. `secondary` is the
          variant HeroUI documents for a control on a raised surface, and it is
          what makes the trigger visible at all here — see the prop's own note. */}
      <SelectControl
        label="Font"
        variant="secondary"
        options={FONT_OPTIONS}
        value={block.font ?? INHERIT}
        // The empty string is the absence, which `resizeCardBlock` reads as
        // "clear it" — one entry for the state rather than a second control.
        onChange={(font) => onChange({ font })}
      />

      {/*
       * Zero is the first tile rather than a position off the end of a track.
       *
       * The slider this replaced had to invent a number one below the schema's
       * own floor to mean "leave this block's own size alone", and print the
       * word `Default` in place of it — a sentinel that worked only because it
       * was somewhere the value could not otherwise be. A row of choices simply
       * has that as a choice, which is what `resizeCardBlock` already reads any
       * size at or below zero as.
       */}
      {/* A select rather than five tiles, because "Default" takes a fifth of
          the row against four single letters and clipped to "Defa…". The tile
          argument only holds while every option is short or drawn. */}
      <PropertyNumberSelect
        label="Size"
        value={block.fontSize ?? 0}
        options={FONT_SIZES}
        onChange={(fontSize) => onChange({ fontSize })}
      />

      <ColorPickerField
        label="Colour"
        value={block.color ?? ""}
        // Label above, so it sits on the same rhythm as the Font and Size
        // fields either side of it — see `labelPlacement`.
        labelPlacement="outside"
        onChange={(color) => onChange({ color })}
        // An empty string is the absence, and the absence is theme-aware where
        // a stored literal could not be — see `CardLayout.background`.
        onClear={() => onChange({ color: "" })}
      />

      {/* Last in the fold, and inside a `PropertyChecks` like every other
          checkbox in the panel — it was the one bare `PropertyCheckbox` left,
          so it took the fold's own `space-y-3` where the others take `gap-2`. */}
      {showBold ? (
        <PropertyChecks>
          <PropertyCheckbox
            label="Bold"
            isSelected={Boolean(block.bold)}
            onChange={(bold) => onChange({ bold })}
          />
        </PropertyChecks>
      ) : null}
    </>
  );
}
