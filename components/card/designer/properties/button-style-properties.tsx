"use client";

import { ColorPickerField } from "@/components/ui/color-picker-field";
import type {
  CardBlock,
  CardButtonHover,
} from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import { SelectControl } from "@/components/ui/select-control";
import { ButtonPresets } from "./button-presets";
import {
  PropertyCheckbox,
  PropertyChecks,
  PropertyScale,
} from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import {
  BORDER_WIDTHS,
  BUTTON_ROOM,
  RADIUS_STOPS,
} from "./property-scales";

/**
 * The box a button is drawn as, rather than the words inside it.
 *
 * `ChipProperties`' twin, and its own group for that file's reason: Font, Size,
 * Colour and Bold are four questions about the *label*, and on a button every
 * one of them would land on the writing while the box around it stayed exactly
 * as it shipped — which reads as a panel that half works.
 *
 * **Alignment is not here**, for the reason it is not in the chips group: it is
 * a question every block answers, it already sits above with the rest of the box
 * controls, and moving it into a group two types have would hide it from the
 * eleven that do not. It works on a button with no help at all, because a button
 * is an inline-level box and `align` arrives as `text-align` — see
 * `buttonStyleOf`.
 */

/**
 * What the two colour wheels below **open on**, and nothing more.
 *
 * `ColorPickerField` uses this to seed the wheel's position when the field is
 * empty; it never reaches the layout (see components/ui/color-picker-field.tsx),
 * which is what makes a literal safe here and nowhere else — the card must not
 * store a colour it will be drawn in a theme it has not seen (CLAUDE.md §7).
 *
 * It is the light theme's accent, `oklch(64.37% 0.2195 36.18)` in
 * app/globals.css, which is the ground an unstyled button actually draws. Its
 * predecessor claimed to be that and was `#1c7ed6`, a blue belonging to no part
 * of this theme — and the Border width control used to *write* it, so one nudge
 * of the width turned an Outline button's theme-coloured line hard blue. The
 * width stores no colour at all now: see `CardBlock.buttonBorder`.
 */
const BUTTON_PICKER_START = "#f54600";

/**
 * What the button does under the pointer.
 *
 * Darken is the absence — it is the wash both stylesheets have always drawn — so
 * it is offered as a word here while storing nothing, the same shape `fit` and
 * `buttonAction` use. See `CardBlock.buttonHover`.
 */
const HOVER_OPTIONS = [
  { value: "darken", label: "Darken" },
  { value: "none", label: "None" },
  { value: "lighten", label: "Lighten" },
  { value: "lift", label: "Lift" },
] as const satisfies readonly {
  value: "darken" | "none" | "lighten" | "lift";
  label: string;
}[];

export function ButtonStyleProperties({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <>
      {/* First, because it is the first decision — see `ButtonPresets`. */}
      <ButtonPresets block={block} onChange={onChange} />

      {/*
       * "Colour", not "Background", because on three of the four treatments it
       * is not one. Outline takes its line and its label from this swatch, Soft
       * takes a wash of it and Ghost takes only the label — so the old name
       * described one state in four and, on the Outline preset an owner is most
       * likely to have picked, named something the control visibly does not do.
       * "Border colour" below keeps its name and stays unambiguous.
       */}
      <ColorPickerField
        label="Colour"
        value={block.buttonBackground ?? ""}
        // Label above, so both colours sit on the rhythm of the selects under
        // them — see `labelPlacement`.
        labelPlacement="outside"
        // The accent, which is what an unstyled button already draws, so the
        // wheel opens on roughly what is on screen rather than on a colour
        // nobody has seen.
        fallback={BUTTON_PICKER_START}
        onChange={(buttonBackground) => onChange({ buttonBackground })}
        // An empty string is the absence, and the absence is theme-aware where
        // a stored literal could not be: a button coloured against a light card
        // vanishes the moment a visitor's map is dark.
        onClear={() => onChange({ buttonBackground: "" })}
      />

      {/*
       * The outline, which is a pair and is stored as one.
       *
       * Absent here is genuinely *no border* rather than a theme's own — there
       * is nothing under a button's edge to fall back to, which is what makes
       * this different from the ground above.
       */}
      <ColorPickerField
        label="Border colour"
        value={block.buttonBorder ?? ""}
        labelPlacement="outside"
        fallback={BUTTON_PICKER_START}
        onChange={(buttonBorder) => onChange({ buttonBorder })}
        onClear={() => onChange({ buttonBorder: "" })}
      />

      {/*
       * **Always drawn, and it writes nothing but a width.**
       *
       * It used to appear only once a colour was set, which made the control
       * undiscoverable — an owner who never opened the wheel had no way to know
       * thickness was adjustable. The answer to that was to have the width
       * *seed* a colour, and that was worse: it stamped a hard-coded blue into
       * a field nobody had opened, and an Outline button — which deliberately
       * stores no colour so its line stays theme-aware — went blue on the first
       * nudge while the Outline swatch stayed lit.
       *
       * So the pair came apart instead. A width with no colour draws in the
       * button's own label colour, which is a colour the owner can already see
       * and which follows the theme; see `CardBlock.buttonBorder`.
       */}
      <PropertyNumberSelect
        label="Border width"
        value={block.buttonBorderWidth ?? 0}
        options={BORDER_WIDTHS}
        onChange={(buttonBorderWidth) => onChange({ buttonBorderWidth })}
      />

      <PropertyScale
        label="Corners"
        // Absent is the stylesheet's own `0.5rem`, so that is the tile an
        // unstyled button has to show — not a sixth "unset" state nobody chose.
        value={block.buttonRadius ?? 8}
        options={RADIUS_STOPS}
        onChange={(buttonRadius) => onChange({ buttonRadius })}
      />

      {/* Additive, like a chip's: this is the owner making the button chunkier
          than it is, not specifying a box from scratch. It is also a different
          question from the block's own Padding above — that holds the button
          off its neighbours, this holds the label off the button's edge. */}
      <PropertyNumberSelect
        label="Roominess"
        value={block.buttonPadding ?? 0}
        options={BUTTON_ROOM}
        onChange={(buttonPadding) => onChange({ buttonPadding })}
      />

      {/* A select rather than four tiles: "Lighten" is wider than the ~51px a
          quarter of this column leaves, so the row clipped the one option whose
          name is the only thing distinguishing it from "Lift". */}
      <SelectControl
        variant="secondary"
        label="Hover"
        value={block.buttonHover ?? "darken"}
        options={HOVER_OPTIONS.map((option) => ({
          id: option.value,
          label: option.label,
        }))}
        onChange={(buttonHover) =>
          onChange({ buttonHover: buttonHover as CardButtonHover })
        }
      />

      {/* Last in the fold, which is where every lone checkbox in this panel
          now sits — a boolean interrupting a run of fields is what "checkboxes
          sprinkled all over" was. */}
      <PropertyChecks>
        <PropertyCheckbox
          label="Full width"
          isSelected={Boolean(block.buttonFull)}
          onChange={(buttonFull) => onChange({ buttonFull })}
        />
      </PropertyChecks>
    </>
  );
}
