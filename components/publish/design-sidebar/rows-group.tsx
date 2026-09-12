"use client";

import { Link2, MapPin, Ruler, Signpost } from "lucide-react";

import {
  PropertyChoice,
  PropertyScale,
} from "@/components/ui/properties/property-fields";
import { PropertyToggles } from "@/components/ui/properties/property-toggles";
import { ROW_LINK_STYLES } from "@/lib/validation/embed-settings.schema";
import type { EmbedDesign } from "./use-embed-design";

/**
 * One row of the results panel: what it draws.
 *
 * Four things a row can carry, and they are one question with four parts rather
 * than four questions — so they are one line of tiles rather than four labelled
 * controls stacked down the column. See `PropertyToggles`.
 *
 * The pin is the one addition here rather than a switch over something already
 * drawn, and it replaced a coloured dot on a tag chip. A row's job is choosing
 * between places, and the question it has to answer is "which of the things on
 * the map is this?" — a picture of the marker answers that; the label of a tag it
 * happens to wear did not.
 *
 * **Both follow-up runs are gated on the tile above them**, which is the rule
 * the rest of the designer follows: a pin size with no pin, or a link treatment
 * with no links, is a live-looking control that changes nothing on the map under
 * it.
 *
 * **Every tile here draws the thing it is choosing**, which is what lets four
 * treatments and four corners fit a 20rem column at all — the argument
 * `PropertyChoice` makes about its own five. A word for each would be about 60px
 * a tile, which is "Outli…".
 */
export function RowsGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <PropertyToggles
        label="Each row shows"
        options={FIELDS}
        selected={[
          ...(settings.rowPin ? (["rowPin"] as const) : []),
          ...(settings.rowAddress ? (["rowAddress"] as const) : []),
          ...(settings.rowDistance ? (["rowDistance"] as const) : []),
          ...(settings.rowActions ? (["rowActions"] as const) : []),
        ]}
        onChange={(value, isSelected) => set(value, isSelected)}
      />

      {settings.rowPin ? (
        <PropertyScale
          label="Pin size"
          value={settings.rowPinSize}
          options={PIN_SIZES}
          onChange={(value) => set("rowPinSize", value)}
        />
      ) : null}

      {/* The two links under a row, for an owner whose own site is not made of
          outlined pills. Two controls rather than one list of eight names,
          because the ground and the corner are genuinely separate questions —
          a filled chip and an outlined one both have a corner. */}
      {settings.rowActions ? (
        <>
          <PropertyChoice
            label="Link style"
            value={settings.rowLinkStyle}
            options={LINK_STYLES}
            onChange={(value) => set("rowLinkStyle", value)}
          />

          {/* Nothing to round on a link with no box, so the corners go with the
              box — the same rule the pin size follows above. */}
          {settings.rowLinkStyle === "plain" ? null : (
            <PropertyScale
              label="Link corners"
              value={settings.rowLinkRadius}
              options={LINK_RADII}
              onChange={(value) => set("rowLinkRadius", value)}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

const FIELDS = [
  { value: "rowPin", label: "Pin", icon: MapPin },
  { value: "rowAddress", label: "Address", icon: Signpost },
  // Only ever drawn once the visitor has said where they are, so this is "when
  // there is one" rather than "always".
  { value: "rowDistance", label: "Distance", icon: Ruler },
  { value: "rowActions", label: "Directions and phone links", icon: Link2 },
] as const;

/*
 * Pixels, unlike the panel's own width, and deliberately: a pin is a picture at a
 * readable size rather than a share of the box, and 20px is 20px whether the
 * embed is 400 or 1400 wide. The floor is the dashboard's own list-row pin, which
 * is sized to stay wider than the 14px text beside it.
 *
 * Three stops rather than five. Nobody choosing a pin size is picking between
 * 24px and 28px, and a five-word row at this width is five illegible tiles —
 * `nearestStop` lights the nearer of the three for a map that stored one of the
 * two that went, and writes nothing.
 */
const PIN_SIZES = [
  { value: 20, label: "Small" },
  { value: 28, label: "Regular" },
  { value: 40, label: "Large" },
] as const;

/**
 * The four treatments, as four chips.
 *
 * Each tile is the chip it selects at about a third scale, which is the
 * `RADII`-in-panel-group argument taken to its obvious end: a picture of an
 * outlined pill beside a filled one needs no words at all, and the words are
 * exactly what a 20rem column cannot hold four of. They stay as `sr-only` text,
 * which `PropertyChoice` keeps for any option carrying an icon.
 *
 * Listed from the schema's own `ROW_LINK_STYLES` rather than spelled again, so a
 * tile can never offer a treatment the PATCH rejects as a 400 — the same reason
 * `CORNERS` is built from `CONTROL_CORNERS`.
 */
const LINK_SHAPES: Record<(typeof ROW_LINK_STYLES)[number], string> = {
  // A ring: the outlined pill the panel draws today.
  outline: "h-2.5 w-4 rounded-full border-2 border-current",
  // The same box with a quiet ground instead of a line.
  soft: "h-2.5 w-4 rounded-full bg-current opacity-40",
  solid: "h-2.5 w-4 rounded-full bg-current",
  // No box — a rule under where the words would be, which is what a plain link
  // looks like at this size.
  plain: "h-2.5 w-4 border-b-2 border-current",
};

const LINK_LABELS: Record<(typeof ROW_LINK_STYLES)[number], string> = {
  outline: "Outlined",
  soft: "Soft",
  solid: "Filled",
  plain: "Plain text",
};

const LINK_STYLES = ROW_LINK_STYLES.map((value) => ({
  value,
  label: LINK_LABELS[value],
  icon: <span aria-hidden="true" className={LINK_SHAPES[value]} />,
}));

/**
 * Four corners, as tiles drawing their own.
 *
 * 999 is the pill the panel draws today and the one stop that is not a literal
 * radius — a chip is about 22px tall, so anything past half of that is the same
 * shape. The tile draws 6px on a 14px box, which is that same half.
 */
const LINK_RADII = [
  { value: 0, radius: "0px", label: "Square" },
  { value: 4, radius: "1.5px", label: "Slight" },
  { value: 8, radius: "3px", label: "Rounded" },
  { value: 999, radius: "6px", label: "Pill" },
].map(({ value, radius, label }) => ({
  value,
  label,
  icon: (
    <span
      aria-hidden="true"
      className="h-2.5 w-4 border-2 border-current"
      style={{ borderRadius: radius }}
    />
  ),
}));
