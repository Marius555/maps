"use client";

import { PageHeader } from "@/components/ui/page-header";
import { SectionPanel } from "@/components/ui/section-panel";
import { useMap } from "@/lib/query/maps";
import { usePlaces } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { hasUnpublishedChanges } from "@/lib/snapshot/staleness";
import { AllowedDomainsForm } from "./allowed-domains-form";
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
}: {
  initialMap: AppMap;
  initialPlaces: Place[];
}) {
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = initialPlaces } = usePlaces(initialMap.id, initialPlaces);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Publish"
        description="Put this map live, then paste one line into your site."
      />

      <SectionPanel
        title="Publish this map"
        description="Publishing writes a static copy of your locations that visitors load directly. Your dashboard is never part of what they load."
        footer={<PublishAction mapId={map.id} />}
      >
        <PublishStatus
          map={map}
          hasPendingChanges={hasUnpublishedChanges(map, places)}
        />

        {places.length === 0 ? (
          <p className="text-xs text-muted">
            This map has no locations yet, so it would publish empty. Add some on
            the Locations tab first.
          </p>
        ) : null}
      </SectionPanel>

      {map.snapshotUrl ? <EmbedSnippet snapshotUrl={map.snapshotUrl} /> : null}

      <AllowedDomainsForm key={map.id} map={map} />
    </div>
  );
}
