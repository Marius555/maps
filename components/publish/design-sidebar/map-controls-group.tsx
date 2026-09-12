"use client";

import { Compass, LocateFixed, Maximize, Ruler, Search } from "lucide-react";

import { PropertyChoice } from "@/components/ui/properties/property-fields";
import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import { PropertyToggles } from "@/components/ui/properties/property-toggles";
import { CONTROL_CORNERS } from "@/lib/validation/embed-settings.schema";
import type { EmbedDesign } from "./use-embed-design";

/**
 * MapLibre's own controls: which of them, and where — plus the two switches
 * that are about the pins rather than about the controls.
 *
 * "Group nearby pins" was already one of those and sets the precedent: this
 * fold is what the map *does*, not only what MapLibre draws on it. "Open a card
 * when a pin is clicked" joins it there rather than in the Results panel fold,
 * because the card is the map's answer to a press and the panel is the other
 * one — an owner switching the card off is usually keeping the panel.
 *
 * Every one of these is close to free in the embed's byte budget, and that is a
 * fact about the build rather than about the controls: `maplibre-gl` is external
 * to the bundle, so its dist files ship whole whether a map names Fullscreen or
 * not. What a switch costs is the line that reads it — which is why this group
 * can be generous where the rest of the designer has to be careful.
 *
 * Two things a customer might expect are deliberately not here. **Traffic and
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

      <PropertyToggles
        label="On the map"
        options={CONTROLS}
        selected={[
          ...(settings.geolocate ? (["geolocate"] as const) : []),
          ...(settings.compass ? (["compass"] as const) : []),
          ...(settings.fullscreen ? (["fullscreen"] as const) : []),
          ...(settings.scale ? (["scale"] as const) : []),
        ]}
        onChange={(value, isSelected) => set(value, isSelected)}
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

        {/* Shown only where it can do something, which is the rule the rest of
            the designer follows. Search and Nearest are docked *inside* the
            results panel on a wide map with a list, and already on its surface;
            the two arrangements where they float over the basemap are a map with
            no list at all, and a narrow one whose list is a drawer. On a wide
            list map with the drawer off there is nothing here to frost, so there
            is no control.

            It carries no colours of its own — the controls read the panel’s own
            transparency, blur and corners, so what is designed is one surface
            rather than two that agree today. */}
        {!settings.list || settings.panelDrawer ? (
          <PropertySwitch
            label="Frost the controls over the map"
            isSelected={settings.toolbarGlass}
            onChange={(value) => set("toolbarGlass", value)}
          />
        ) : null}
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

const CONTROLS = [
  { value: "geolocate", label: "Find my location", icon: LocateFixed },
  { value: "compass", label: "Compass", icon: Compass },
  { value: "fullscreen", label: "Fullscreen", icon: Maximize },
  { value: "scale", label: "Scale bar", icon: Ruler },
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

