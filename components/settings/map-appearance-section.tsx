"use client";

import { useMemo } from "react";

import { AppearancePanel } from "@/components/appearance/appearance-panel";
import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { readMapAppearance } from "@/lib/validation/map-appearance.schema";

/**
 * The same appearance controls the editor toolbar carries, on the Settings tab.
 *
 * Its own panel rather than a third field inside Map details, and the reason is
 * the Save button. The name is typed and confirmed; a theme is tried and looked
 * at, and saves the moment it is clicked. Putting a Save-button form and an
 * instant control in one panel leaves the button meaning "save some of this",
 * which is the kind of small confusion that costs a support email per customer.
 *
 * `AppearancePanel` is shared with the toolbar deliberately: a second gallery
 * here would be a second list to add every future theme to.
 */
export function MapAppearanceSection({ map }: { map: AppMap }) {
  const updateMap = useUpdateMap(map.id);
  const appearance = useMemo(
    () => readMapAppearance(map.appearance),
    [map.appearance],
  );

  return (
    <SectionPanel
      title="How the map looks"
      description="Saved as you pick. Visitors see it the next time you publish."
    >
      {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

      <AppearancePanel
        style={map.style}
        appearance={appearance}
        onChangeStyle={(style) => updateMap.mutate({ style })}
        onChangeAppearance={(next) => updateMap.mutate({ appearance: next })}
      />
    </SectionPanel>
  );
}
