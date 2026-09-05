"use client";

import { Link2, MapPin, Ruler, Signpost } from "lucide-react";

import { PropertyScale } from "@/components/ui/properties/property-fields";
import { PropertyToggles } from "@/components/ui/properties/property-toggles";
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
