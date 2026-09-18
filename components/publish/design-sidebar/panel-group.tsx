"use client";

import { PanelLeft, PanelRight } from "lucide-react";

import { PropertyChoice } from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The results panel: whether there is one, where it sits and how wide.
 *
 * Every control that describes the panel's *shape* is hidden when the panel is
 * off, because they all describe a thing that is not on the map — and a column
 * of live-looking controls that change nothing is worse than a shorter panel.
 *
 * **This fold held eleven controls and now holds six, and the two that left did
 * not go because the fold was long — they went because they were never panel
 * controls.** Search and Nearest are drawn on a map with the list switched off,
 * floating over the basemap; hiding their toggles inside this fold's `list`
 * branch left an owner looking at a search box with no way in this panel to
 * switch it off, and no way to switch it *on* for a bare map either. They are in
 * "Map controls" now, with the glass switch that is about those same controls
 * floating, and that fold was already the one shaped like this: a choice, a row
 * of tiles, and one run of switches at the end.
 *
 * **The surface — transparency, blur, corners — is its own fold.** It is read
 * only on a *floating* panel (opacity on a docked column reveals the page's own
 * background, not the map, which is not what anyone reaches for it wanting), so
 * three of the nine controls here were invisible half the time and pushed the
 * two switches at the foot off the bottom of a 20rem column the other half. A
 * fold that disappears says that better than a gap does — see
 * `panel-surface-group.tsx` and `PropertyFold`'s `isEmpty`.
 *
 * **What is left is one master switch, three selectors, one run of switches.**
 * No boolean sits between two fields, which is the rule
 * `components/ui/properties/property-fields.tsx` states and the rule this fold
 * was breaking in three places at once.
 *
 * **Width is a select; everything else is tiles.** Five words across a 20rem
 * column is about 60px each and none of them are readable, which is the
 * complaint that broke this panel open. The split is per control rather than a
 * blanket rule: a corner tile draws its own radius and says itself at any width,
 * so it stays a tile.
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

          {/* Last, because a run of yes/no questions goes at the end of its fold
              — a boolean interrupting a run of shape controls is the thing that
              rule exists to stop. Both apply to the preview under the pointer
              rather than waiting for a Save.

              The scrollbar is on by default, and deliberately so: the bar is the
              only thing telling a visitor the list continues below the fold. Off
              is the answer for a short list, or for an owner who has designed the
              panel down to its corners and does not want the browser's chrome in
              the middle of it.

              "Narrow", not "mobile": the embed sizes off its own box, so a 360px
              map in a sidebar on a 1440px monitor gets the drawer and a phone
              held sideways may not. Both are inside the `list` branch because a
              drawer is where the list goes, and there is no list to put anywhere
              with the panel switched off.

              The row's card switch is off by default: a card opened from the
              panel rarely fits the part of the map the panel leaves. It is only
              offered while pins open cards at all ("Map controls"), because with
              those off there is no card for a row to open. */}
          <PropertySwitches>
            {settings.card ? (
              <PropertySwitch
                label="Open a card when a row is clicked"
                isSelected={settings.rowCard}
                onChange={(value) => set("rowCard", value)}
              />
            ) : null}
            <PropertySwitch
              label="Show the list's scrollbar"
              isSelected={settings.panelScrollbar}
              onChange={(value) => set("panelScrollbar", value)}
            />
            {/* **Named for what it turns on, because both positions are a
                drawer.** On it is the bottom sheet a thumb drags up; off it is
                the side drawer behind a button in the toolbar, which is what
                this had before the sheet. The old label said "on narrow
                screens", which read as the only alternative being no drawer at
                all — and the stacked layout it seemed to promise is now reached
                by neither position, being what a snapshot written before this
                setting draws and nothing else (§7). */}
            <PropertySwitch
              label="Use a bottom drawer"
              isSelected={settings.panelDrawer}
              onChange={(value) => set("panelDrawer", value)}
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
