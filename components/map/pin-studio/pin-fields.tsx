"use client";

import { PALETTE_COLORS, PALETTE_COLOR_NAMES } from "@/lib/validation/palette";
import { PIN_ICONS, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinDesignRow } from "./pin-design-row";
import { PIN_TRIM_COLORS, PIN_TRIM_COLOR_NAMES } from "./pin-palette";
import { PinSwatchRow } from "./pin-swatch-row";

/**
 * Every decision that goes into a pin, one row each.
 *
 * This is the only part of the builder that scrolls. The pin being made sits
 * above it in the dialog's header and the buttons that finish the form below it
 * in the footer, both pinned — see PinStudio, which owns that arrangement. So a
 * customer choosing a colour eight rows down can still see what they are making
 * and still reach Use pin.
 *
 * The order is what the eye reaches for, not what the record stores. Icon and
 * fill first — they are the pin, and on most pins they are the only two anyone
 * touches. Shape and size next, because they change its silhouette. The ring last
 * but one, because it is trim on a decision already made.
 *
 * Every row draws the *draft*, with that row's own field swapped per option, so
 * a change anywhere shows up everywhere rather than only in the hero. The colour
 * rows are the exception and have to be, since a colour cannot preview itself as
 * a white pin on a white dialog (PinSwatchRow says why).
 *
 * `image` and `glyph` are exclusive — `pinIconSchema` refuses anything else — so
 * the icon and icon-colour rows disappear outright while a logo is in the pin
 * rather than dimming. There is no glyph to shape or colour, and a disabled
 * control that can never be enabled from where you are standing is furniture.
 */
export function PinFields({
  draft,
  onChange,
}: {
  draft: CustomPinIcon;
  onChange: (draft: CustomPinIcon) => void;
}) {
  const hasGlyph = !draft.image;

  return (
    // Tighter than the gaps around the hero and the footer, which is the point:
    // these are one control with seven parts, and spacing them like the sections
    // around them would read as seven sections.
    <div className="flex flex-col gap-3">
      {hasGlyph ? (
        <PinDesignRow
          label="Icon"
          draft={draft}
          value={draft.glyph}
          options={PIN_ICONS.map((icon) => ({ value: icon.id, label: icon.label }))}
          preview={(glyph) => ({ glyph })}
          onChange={(glyph) => onChange({ ...draft, glyph, image: "" })}
        />
      ) : null}

      <PinSwatchRow
        label="Fill"
        value={draft.color}
        colors={PALETTE_COLORS}
        names={PALETTE_COLOR_NAMES}
        onChange={(color) => onChange({ ...draft, color })}
      />

      <PinDesignRow
        label="Shape"
        draft={draft}
        value={draft.shape ?? "circle"}
        options={SHAPES}
        preview={(shape) => ({ shape })}
        onChange={(shape) => onChange({ ...draft, shape })}
      />

      <PinDesignRow
        label="Size"
        draft={draft}
        value={draft.size ?? "md"}
        options={SIZES}
        preview={(size) => ({ size })}
        onChange={(size) => onChange({ ...draft, size })}
      />

      <PinDesignRow
        label="Ring"
        draft={draft}
        value={draft.ringWidth ?? "regular"}
        options={RING_WIDTHS}
        preview={(ringWidth) => ({ ringWidth })}
        onChange={(ringWidth) => onChange({ ...draft, ringWidth })}
      />

      {/* Only once there is a ring to colour. At "none" this row would be a
          palette with no visible effect, which reads as a broken control. */}
      {draft.ringWidth !== "none" ? (
        <PinSwatchRow
          label="Ring colour"
          value={draft.ring ?? ""}
          colors={PIN_TRIM_COLORS}
          names={PIN_TRIM_COLOR_NAMES}
          autoLabel="Automatic"
          onChange={(ring) => onChange({ ...draft, ring })}
        />
      ) : null}

      {hasGlyph ? (
        <PinSwatchRow
          label="Icon colour"
          value={draft.iconColor ?? ""}
          colors={PIN_TRIM_COLORS}
          names={PIN_TRIM_COLOR_NAMES}
          autoLabel="Automatic"
          onChange={(iconColor) => onChange({ ...draft, iconColor })}
        />
      ) : null}
    </div>
  );
}

/**
 * The option lists, out of the render.
 *
 * The labels are the customer's words for these, not the stored token — "Thick",
 * not "thick", and "Ring" rather than "ringWidth" on the row above (§8: name
 * things by what the user controls).
 */
const SHAPES = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "diamond", label: "Diamond" },
] as const;

const SIZES = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
] as const;

const RING_WIDTHS = [
  { value: "none", label: "No ring" },
  { value: "thin", label: "Thin" },
  { value: "regular", label: "Regular" },
  { value: "thick", label: "Thick" },
] as const;
