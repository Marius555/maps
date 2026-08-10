"use client";

import { SectionPanel } from "@/components/ui/section-panel";
import type { AppMap, Place } from "@/lib/repositories/types";
import { EmbedPreview } from "./embed-preview";

/**
 * The preview on the Publish tab: the last look before it goes live.
 *
 * It also quietly exercises the snapshot generator against real data, so a map
 * that would publish empty — or drop locations whose coordinates never resolved
 * — shows that here rather than on the customer's website.
 */
export function PreviewPanel({ map, places }: { map: AppMap; places: Place[] }) {
  return (
    <SectionPanel
      title="Preview"
      description="Exactly what visitors get, built from your locations as they are right now. Nothing here is live until you publish."
    >
      {places.length === 0 ? (
        <p className="text-xs text-muted">
          Add some locations on the Locations tab and they&rsquo;ll show up here.
        </p>
      ) : (
        <EmbedPreview
          map={map}
          places={places}
          className="h-[55dvh] min-h-64 w-full"
        />
      )}
    </SectionPanel>
  );
}
