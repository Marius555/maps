"use client";

import { LocateFixed, PanelLeft, PanelRight, Search } from "lucide-react";

import { PropertyChoice, PropertyScale } from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import { PropertyToggles } from "@/components/ui/properties/property-toggles";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The results panel: whether there is one, where it sits, and what it looks
 * like.
 *
 * Every control below the first is hidden when the panel is off, because they
 * all describe a thing that is not on the map — and a column of live-looking
 * controls that change nothing is worse than a shorter panel. The transparency
 * run goes one step further and hides unless the panel is *floating*: opacity on
 * a docked column reveals the page's own background, not the map, which is not
 * what anyone is asking for when they reach for it.
 *
 * **Width and Transparency are selects; everything else is tiles.** Five words
 * across a 20rem column is about 60px each and none of them are readable, which
 * is the complaint that broke this panel open. The split is per control rather
 * than a blanket rule: a corner tile draws its own radius and says itself at any
 * width, so it stays a tile.
 */
export function PanelGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <PropertySwitches>
        <PropertySwitch
          label="Show the results panel"
          isSelected={settings.list}
          onChange={(value) => set("list", value)}
        />
      </PropertySwitches>

      {settings.list ? (
        <>
          <PropertyChoice
            label="Side"
            value={settings.panelSide}
            options={SIDES}
            onChange={(value) => set("panelSide", value)}
          />

          <PropertyChoice
            label="Placement"
            value={settings.panelFloat ? "over" : "beside"}
            options={PLACEMENTS}
            onChange={(value) => set("panelFloat", value === "over")}
          />

          <PropertyNumberSelect
            label="Width"
            value={settings.panelWidth}
            options={WIDTHS}
            onChange={(value) => set("panelWidth", value)}
          />

          {/* Only a floating panel has the map behind it to show through. */}
          {settings.panelFloat ? (
            <>
              <PropertyNumberSelect
                label="Transparency"
                value={settings.panelOpacity}
                options={OPACITIES}
                onChange={(value) => set("panelOpacity", value)}
              />
              <PropertyScale
                label="Blur behind"
                value={settings.panelBlur}
                options={BLURS}
                onChange={(value) => set("panelBlur", value)}
              />
              <PropertyScale
                label="Corners"
                value={settings.panelRadius}
                options={RADII}
                onChange={(value) => set("panelRadius", value)}
              />
            </>
          ) : null}

          <PropertyToggles
            label="Above the results"
            options={TOOLS}
            selected={[
              ...(settings.search ? (["search"] as const) : []),
              ...(settings.nearest ? (["nearest"] as const) : []),
            ]}
            onChange={(value, isSelected) => set(value, isSelected)}
          />

          {/* Last, because a lone yes/no goes at the end of its fold — a boolean
              interrupting a run of shape controls is the thing that rule exists
              to stop. It is a switch on this panel's own terms: it applies to
              the preview under the pointer rather than waiting for a Save.

              On by default, and deliberately so: the bar is the only thing
              telling a visitor the list continues below the fold. Off is the
              answer for a short list, or for an owner who has designed the
              panel down to its corners and does not want the browser's chrome
              in the middle of it. */}
          <PropertySwitches>
            <PropertySwitch
              label="Show the list's scrollbar"
              isSelected={settings.panelScrollbar}
              onChange={(value) => set("panelScrollbar", value)}
            />
          </PropertySwitches>
        </>
      ) : null}
    </div>
  );
}

const SIDES = [
  { value: "left", label: "Left", icon: <PanelLeft aria-hidden="true" className="size-4" /> },
  { value: "right", label: "Right", icon: <PanelRight aria-hidden="true" className="size-4" /> },
] as const;

/*
 * Two tiles that draw the difference: one box inside the frame, or two boxes
 * side by side. A word each ("Over the map" / "Beside it") is most of the
 * column's width for a choice with two answers.
 */
const PLACEMENTS = [
  {
    value: "over",
    label: "Over the map",
    icon: (
      <span
        aria-hidden="true"
        className="relative block size-3.5 rounded-[2px] border-2 border-current"
      >
        <span className="absolute inset-y-0.5 right-0.5 w-1 bg-current" />
      </span>
    ),
  },
  {
    value: "beside",
    label: "Beside it",
    icon: (
      <span
        aria-hidden="true"
        className="flex size-3.5 items-stretch gap-px rounded-[2px] border-2 border-current"
      >
        <span className="flex-1" />
        <span className="w-1 bg-current" />
      </span>
    ),
  },
] as const;

/** The two controls that can sit above the results, as one line of tiles. */
const TOOLS = [
  { value: "search", label: "Search box", icon: Search },
  { value: "nearest", label: "Nearest to me", icon: LocateFixed },
] as const;

/*
 * Percentages of the embed's own width rather than pixels, and the reason is the
 * same one the stylesheet gives: a fixed panel is a different proportion of every
 * box it lands in, and at the 700px of a preview dialog a 320px column takes more
 * of the frame than the map does.
 */
const WIDTHS = [
  { value: 25, label: "Slim" },
  { value: 30, label: "Narrow" },
  { value: 34, label: "Regular" },
  { value: 42, label: "Wide" },
  { value: 50, label: "Half" },
] as const;

/* Stored as opacity but labelled as transparency, which is the way round
   somebody looking at a see-through panel describes it. */
const OPACITIES = [
  { value: 100, label: "Solid" },
  { value: 94, label: "Faint" },
  { value: 88, label: "Light" },
  { value: 76, label: "Clear" },
  { value: 60, label: "Glass" },
] as const;

/*
 * Three, not five. Blur is a background effect nobody is choosing 16px of, and
 * the two dropped stops sat either side of ones that were already there —
 * `nearestStop` lights the nearer tile for a map that stored one of them, and
 * writes nothing.
 */
const BLURS = [
  { value: 0, label: "None" },
  { value: 10, label: "Soft" },
  { value: 20, label: "Strong" },
] as const;

/**
 * Five corners, as tiles that draw their own corner.
 *
 * The same answer `RADIUS_STOPS` gives in the card designer, and the reason it
 * survives the cull to three elsewhere: a radius is hard to say with a word and
 * trivial to say with the thing itself, so the tile costs no label width at all.
 */
const RADII = [0, 6, 12, 18, 24].map((value, index, all) => ({
  value,
  label: ["Square", "Slight", "Regular", "Round", "Pill"][index] as string,
  icon: (
    <span
      aria-hidden="true"
      className="size-3.5 border-2 border-current"
      style={{ borderRadius: `${String((index / (all.length - 1)) * 7)}px` }}
    />
  ),
}));
