"use client";

import { PanelLeft, PanelRight } from "lucide-react";

import { PropertyChoice } from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import { PanelAutoHint } from "./panel-auto-hint";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The results panel: whether there is one, where it sits and how wide.
 *
 * Every control that describes the panel's *shape* is hidden when the panel is
 * off, because they all describe a thing that is not on the map — and a column
 * of live-looking controls that change nothing is worse than a shorter panel.
 *
 * **This fold held eleven controls and now holds five, and nothing left it
 * because the fold was long — each one left because it was never a panel
 * control.** Search and Nearest are drawn on a map with the list switched off,
 * floating over the basemap; hiding their toggles inside this fold's `list`
 * branch left an owner looking at a search box with no way in this panel to
 * switch it off, and no way to switch it *on* for a bare map either. They are in
 * "Map controls" now, and that fold was already the one shaped like this: a
 * choice, a row of tiles, and one run of switches at the end.
 *
 * **The surface — transparency, blur, corners — is its own fold**, shown
 * whenever the panel is: see `panel-surface-group.tsx`.
 *
 * **Placement and the scrollbar switch are gone too (2026-11-07).** The panel
 * always floats over the map as a sidebar now, and the list always draws its
 * scrollbar — the docked column was the layout the sidebar replaced, and the
 * bar is the one thing telling a visitor the list goes on. Both are fixed in
 * `readEmbedSettings` (`RETIRED_CONTROLS`), not merely hidden, so a map that
 * once chose otherwise is not stuck in a layout nobody can switch off.
 *
 * **What is left is one master switch, two selectors, and the row-card
 * switch.** No boolean sits between two fields, which is the rule
 * `components/ui/properties/property-fields.tsx` states.
 *
 * **Width is a select; Side is tiles.** Five words across a 20rem column is
 * about 60px each and none of them are readable, which is the complaint that
 * broke this panel open; two icons are not.
 */
export function PanelGroup(design: EmbedDesign) {
  const { settings, set } = design;

  return (
    <div className="space-y-3">
      <PropertySwitches>
        <PropertySwitch
          label="Show the results panel"
          isSelected={settings.list}
          onChange={(value) => set("list", value)}
        />
      </PropertySwitches>

      {/* Automatic until the owner touches the switch: no panel for a map of
          one location (lib/embed/panel-auto.ts). */}
      <PanelAutoHint {...design} />

      {settings.list ? (
        <>
          <PropertyChoice
            label="Side"
            value={settings.panelSide}
            options={SIDES}
            onChange={(value) => set("panelSide", value)}
          />

          <PropertyNumberSelect
            label="Width"
            value={settings.panelWidth}
            options={WIDTHS}
            onChange={(value) => set("panelWidth", value)}
          />

          {/* Last, because a yes/no question goes at the end of its fold.

              Off by default: a card opened from the panel rarely fits the part
              of the map the panel leaves. It is only offered while pins open
              cards at all ("Map controls"), because with those off there is no
              card for a row to open. */}
          {settings.card ? (
            <PropertySwitches>
              <PropertySwitch
                label="Open a card when a row is clicked"
                isSelected={settings.rowCard}
                onChange={(value) => set("rowCard", value)}
              />
            </PropertySwitches>
          ) : null}
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
