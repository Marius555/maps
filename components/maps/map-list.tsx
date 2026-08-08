"use client";

import { PageHeader } from "@/components/ui/page-header";
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
}: {
  initialMaps: AppMap[];
  /** Keyed by map id. Counted on the server so a card can say something real. */
  placeCounts: Record<string, number>;
}) {
  const { data: maps = [] } = useMaps(initialMaps);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maps"
        description="Each map holds its own locations, styling and embed code."
        actions={maps.length > 0 ? <CreateMapDialog /> : undefined}
      />

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
