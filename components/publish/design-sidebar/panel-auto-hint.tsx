"use client";

import { TextAction } from "@/components/publish/stepper/text-action";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The line under "Show the results panel" saying who decided it.
 *
 * While the panel is automatic (`lib/embed/panel-auto.ts`) the switch moves on
 * its own when locations are added or removed, and a switch that moves by
 * itself needs to say so. Once the owner takes it over, "Use automatic" hands
 * it back.
 */
export function PanelAutoHint({ settings, set, placeCount }: EmbedDesign) {
  if (!settings.listAuto) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
        Set by you.
        <TextAction tone="accent" onPress={() => set("listAuto", true)}>
          Use automatic
        </TextAction>
      </p>
    );
  }

  return (
    <p className="text-xs text-muted">
      {placeCount <= 1
        ? "Off automatically while this map has one location. The search box is hidden too."
        : "On automatically while this map has more than one location."}
    </p>
  );
}
