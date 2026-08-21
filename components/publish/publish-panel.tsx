"use client";

import { PreviewPanel } from "@/components/preview/preview-panel";
import { PageTitle } from "@/components/ui/page-title";
import { SectionPanel } from "@/components/ui/section-panel";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import { useShapes } from "@/lib/query/shapes";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { hasUnpublishedChanges } from "@/lib/snapshot/staleness";
import { AllowedDomainsForm } from "./allowed-domains-form";
import { EmbedSettingsForm } from "./embed-settings-form";
import { EmbedSnippet } from "./embed-snippet";
import { PublishAction } from "./publish-action";
import { PublishStatus } from "./publish-status";

/**
 * Client shell for the Publish tab.
 *
 * Reads through the query cache like the settings page does, so publishing
 * updates the status line and reveals the snippet without a navigation.
 */
export function PublishPanel({
  initialMap,
  initialPlaces,
  initialShapes,
}: {
  initialMap: AppMap;
  initialPlaces: Place[];
  initialShapes: Shape[];
}) {
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = initialPlaces } = usePlaces(initialMap.id, initialPlaces);
  const { data: shapes = initialShapes } = useShapes(initialMap.id, initialShapes);

  return (
    <div className="space-y-6">
      <PageTitle>Publish</PageTitle>

      <SectionPanel
        title="Publish this map"
        description="Publishing writes a static copy of your locations that visitors load directly. Your dashboard is never part of what they load."
        footer={<PublishAction mapId={map.id} />}
      >
        <PublishStatus
          map={map}
          hasPendingChanges={hasUnpublishedChanges(map, places, shapes)}
        />

        {/* A map carrying only shapes publishes something real, so this waits
            until there is genuinely nothing to put on a customer's site. */}
        {places.length === 0 && shapes.length === 0 ? (
          <p className="text-xs text-muted">
            This map has no locations yet, so it would publish empty. Add some on
            the Locations tab first.
          </p>
        ) : null}
      </SectionPanel>

      <PreviewPanel map={map} places={places} shapes={shapes} />

      {map.snapshotUrl ? <EmbedSnippet snapshotUrl={map.snapshotUrl} /> : null}

      <EmbedSettingsForm key={`settings-${map.id}`} map={map} />

      <AllowedDomainsForm key={map.id} map={map} />
    </div>
  );
}
