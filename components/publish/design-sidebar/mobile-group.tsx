"use client";

import {
  PropertySwitch,
  PropertySwitches,
} from "@/components/ui/properties/property-switch";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The map on a screen with no room for a column beside it.
 *
 * A fold of its own rather than a line at the foot of "Results panel", because
 * that fold describes a panel standing next to a map — its side, its placement,
 * its width — and every one of those answers is cancelled at the width this one
 * is about. An owner who has pressed the phone tile now has somewhere to go.
 *
 * **"On a phone" is a shorter truth than the setting's own, and knowingly so.**
 * The embed sizes off its *own* box rather than the viewport, so a 360px map in
 * a sidebar on a 1440px monitor gets this too and a phone held sideways may not.
 * That caveat used to be in the panel fold's copy as "narrow, not mobile"; the
 * fold is named the way an owner would say it and the header's device tiles are
 * how either case is checked.
 *
 * **It holds one switch and is meant to.** `panelDrawer` is the only published
 * setting the embed reads below a breakpoint at all. `toolbarGlass` is the one
 * that looks like it belongs here and does not: the toolbar floats at *any*
 * width once the results panel is off, so a list-less desktop map wears that
 * glass too, and filing it under a phone would hide it from the owner of one.
 */
export function MobileGroup({ settings, set }: EmbedDesign) {
  return (
    <div className="space-y-3">
      <PropertySwitches>
        {/* **Named for what it turns on, because both positions are a drawer.**
            On it is the bottom sheet a thumb drags up; off it is the side drawer
            behind a button in the toolbar, which is what this had before the
            sheet. The old label said "on narrow screens", which read as the only
            alternative being no drawer at all — and the stacked layout it seemed
            to promise is now reached by neither position, being what a snapshot
            written before this setting draws and nothing else (§7). */}
        <PropertySwitch
          label="Use a bottom drawer"
          isSelected={settings.panelDrawer}
          onChange={(value) => set("panelDrawer", value)}
        />
      </PropertySwitches>
    </div>
  );
}
