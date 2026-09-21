"use client";

import { useEffect } from "react";

import { PlaceCountBadge } from "@/components/places/place-count-badge";
import { PageTitle } from "@/components/ui/page-title";
import { prunePreviews } from "@/lib/map-preview/cache";
import { useMaps } from "@/lib/query/maps";
import type { AppMap, MapSummary } from "@/lib/repositories/types";
import { CreateMapDialog } from "./create-map-dialog";
import { MapCard } from "./map-card/map-card";
import { MAP_GRID_CLASS } from "./map-grid";
import { MapListEmpty } from "./map-list-empty";

/**
 * `initialMaps` comes from the server render, so the first paint is real HTML.
 * Every mutation after that flows through the query cache.
 */
export function MapList({
  initialMaps,
  summaries,
  mapLimit,
}: {
  initialMaps: AppMap[];
  /** Keyed by map id. Counted on the server so a card can say something real. */
  summaries: Record<string, MapSummary>;
  /** The plan's ceiling, so the free plan's single map explains itself. */
  mapLimit: number;
}) {
  const { data: maps = [] } = useMaps(initialMaps);

  /*
   * Previews of deleted maps would otherwise sit in the browser's store forever.
   * Keyed on the ids themselves, so it runs again after a delete.
   */
  const mapIds = maps.map((map) => map.id).join(",");
  useEffect(() => {
    void prunePreviews(new Set(mapIds ? mapIds.split(",") : []));
  }, [mapIds]);

  return (
    <div className="space-y-6">
      <PageTitle>Maps</PageTitle>

      {/*
       * The count earns the row the "Create map" button needs. It also answers
       * the question the button raises on the free plan, where the ceiling is
       * one: "1 of 1 maps" says why creating a second one will fail, before it
       * does. With no maps at all the empty state carries its own
       * CreateMapDialog, and "0 of 1 maps" would be a limit nobody is near.
       */}
      {maps.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PlaceCountBadge count={maps.length} limit={mapLimit} noun="maps" />
          <CreateMapDialog align="end" />
        </div>
      ) : null}

      {maps.length === 0 ? (
        <MapListEmpty />
      ) : (
        <ul className={MAP_GRID_CLASS}>
          {maps.map((map) => (
            <li key={map.id} className="min-w-0">
              <MapCard map={map} summary={summaries[map.id]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
