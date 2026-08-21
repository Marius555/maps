"use client";

import { PlaceCountBadge } from "@/components/places/place-count-badge";
import { PageTitle } from "@/components/ui/page-title";
import { useMaps } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { CreateMapDialog } from "./create-map-dialog";
import { MapCard } from "./map-card";
import { MapListEmpty } from "./map-list-empty";

/**
 * `initialMaps` comes from the server render, so the first paint is real HTML.
 * Every mutation after that flows through the query cache.
 */
export function MapList({
  initialMaps,
  placeCounts,
  mapLimit,
}: {
  initialMaps: AppMap[];
  /** Keyed by map id. Counted on the server so a card can say something real. */
  placeCounts: Record<string, number>;
  /** The plan's ceiling, so the free plan's single map explains itself. */
  mapLimit: number;
}) {
  const { data: maps = [] } = useMaps(initialMaps);

  return (
    <div className="space-y-6">
      <PageTitle>Maps</PageTitle>

      {/*
       * The count earns the row the "New map" button needs. It also answers the
       * question the button raises on the free plan, where the ceiling is one:
       * "1 of 1 maps" says why creating a second one will fail, before it does.
       * With no maps at all the empty state carries its own CreateMapDialog, and
       * "0 of 1 maps" would be a limit nobody is near.
       */}
      {maps.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PlaceCountBadge count={maps.length} limit={mapLimit} noun="maps" />
          <CreateMapDialog />
        </div>
      ) : null}

      {maps.length === 0 ? (
        <MapListEmpty />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((map) => (
            <li key={map.id} className="relative">
              {/* A newly created map isn't in placeCounts until the next server
                  render, and it has no locations yet either way. */}
              <MapCard map={map} placeCount={placeCounts[map.id] ?? 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
