"use client";

import { LocateFixed, Search } from "lucide-react";

import { PropertyChoice } from "@/components/ui/properties/property-fields";
import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import { PropertyToggles } from "@/components/ui/properties/property-toggles";
import { CONTROL_CORNERS } from "@/lib/validation/embed-settings.schema";
import type { EmbedDesign } from "./use-embed-design";

/**
 * Where MapLibre's own controls sit, our two toolbar controls, and the switches
 * that are about what the map *does* rather than about what is drawn on it.
 *
 * **There was a four-tile "On the map" row here and it is gone** — Find my
 * location, Compass, Fullscreen, Scale bar. The map draws zoom in and zoom out
 * and nothing else now, so the only question left about MapLibre's controls is
 * which corner they stand in. The reasoning, and why the four settings are
 * retired rather than deleted, is at `embed/src/map.ts`.
 *
 * That leaves Corner offering a choice for a single pair of buttons, which is
 * still worth asking: it is the one piece of chrome that can land on top of a
 * customer's own content.
 *
 * Three things a customer might expect are deliberately not here. **Traffic and
 * satellite** are metered third-party feeds in the visitor's path, which is the
 * one thing CLAUDE.md §2 forbids outright. And **the attribution** has no
 * switch: credit for OpenStreetMap and the tile provider is required on every
 * rendered map (§12), so offering a control that must always be on is offering a
 * lie.
 */
export function MapControlsGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <PropertyChoice
        label="Corner"
        value={settings.controlsCorner}
        options={CORNERS}
        onChange={(value) => set("controlsCorner", value)}
      />

      {/* Ours rather than MapLibre’s, and that is the only thing that ever made
          them look like results-panel controls. The embed draws both with the
          list switched off, floating over the basemap — which is exactly the
          arrangement in which the panel fold used to hide their toggles, leaving
          an owner with a search box on their map and no way here to switch it
          off, and no way to switch it on for a bare map either. */}
      <PropertyToggles
        label="Search and nearest"
        options={TOOLS}
        selected={[
          ...(settings.search ? (["search"] as const) : []),
          ...(settings.nearest ? (["nearest"] as const) : []),
        ]}
        onChange={(value, isSelected) => set(value, isSelected)}
      />

      {/* The four whose labels are sentences about what the map *does* rather
          than names of a thing sitting on it — no glyph says any of them, so
          they get a line each. */}
      <PropertySwitches>
        <PropertySwitch
          label="Zoom with the scroll wheel"
          isSelected={settings.scrollZoom}
          onChange={(value) => set("scrollZoom", value)}
        />
        <PropertySwitch
          label="Group nearby pins"
          isSelected={settings.clustering}
          onChange={(value) => set("clustering", value)}
        />
        <PropertySwitch
          label="Open a card when a pin is clicked"
          isSelected={settings.card}
          onChange={(value) => set("card", value)}
        />

        {/* Search and Nearest are docked *inside* the results panel on a wide
            map with a list, and already on its surface; the arrangements where
            they float over the basemap are a map with no list at all, and any
            narrow one — where the list is a drawer at *either* position of that
            switch, so the toolbar comes out of the panel either way. That is why
            there is no condition on this one any more: every map has a width at
            which these controls float, and the device tiles are how an owner
            looks at it.

            It carries no colours of its own — the controls read the panel’s own
            transparency, blur and corners, so what is designed is one surface
            rather than two that agree today. */}
        <PropertySwitch
          label="Frost the controls over the map"
          isSelected={settings.toolbarGlass}
          onChange={(value) => set("toolbarGlass", value)}
        />
      </PropertySwitches>

      {/* Said once, where the switch is, rather than in the Card tab that
          designs the thing this hides. Turning it off is a real product — pins
          as a picture, words in the panel — and the one thing an owner needs to
          know is which of the two that press empties. */}
      {settings.card ? null : (
        <p className="text-xs text-muted">
          {settings.list
            ? "Clicking a pin highlights its row in the results panel instead."
            : "With the results panel off too, this map is pins and nothing else."}
        </p>
      )}
    </div>
  );
}

/** The two controls that are ours rather than MapLibre’s, as one line of tiles. */
const TOOLS = [
  { value: "search", label: "Search box", icon: Search },
  { value: "nearest", label: "Nearest to me", icon: LocateFixed },
] as const;

/* Named for where they land on the map rather than for the CSS corner, which is
   the same word said the way somebody looking at a map would say it. */
const LABELS: Record<(typeof CONTROL_CORNERS)[number], string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Lower left",
  "bottom-right": "Lower right",
};

/**
 * The four corners, as tiles that draw their own corner.
 *
 * Named in the schema (`CONTROL_CORNERS`) rather than listed again here, so a
 * control can never offer an option the PATCH rejects as a 400 — and drawn
 * rather than written, for `RADII`'s reason in ./panel-group.tsx: "Lower left"
 * is 60px of text in a 20rem column and a 14px box with a dot in it is not.
 * The word stays in `sr-only` text, which `PropertyChoice` keeps for any option
 * carrying an icon.
 */
const CORNERS = CONTROL_CORNERS.map((value) => {
  const [block, inline] = value.split("-");

  return {
    value,
    label: LABELS[value],
    icon: (
      <span
        aria-hidden="true"
        className="relative block size-3.5 rounded-[2px] border-2 border-current"
      >
        <span
          className={`absolute size-1 bg-current ${
            block === "top" ? "top-0" : "bottom-0"
          } ${inline === "left" ? "left-0" : "right-0"}`}
        />
      </span>
    ),
  };
});

