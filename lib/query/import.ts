"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import type { Place } from "@/lib/repositories/types";
import type { CreatePlaceInput } from "@/lib/validation/place.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/** One chunk of an import's geocoding pass. */
export function useGeocodeBatch(mapId: string) {
  return useMutation({
    mutationFn: async (input: {
      rows: { key: string; address: string }[];
      countryCode?: string;
    }) =>
      (
        await apiFetch<{ results: BatchGeocodeResult[] }>(
          `/api/maps/${mapId}/geocode/batch`,
          { method: "POST", body: JSON.stringify(input) },
        )
      ).results,
  });
}

/**
 * One chunk of the confirmed import.
 *
 * The cache is invalidated rather than patched: several chunks land in sequence,
 * and refetching once at the end is simpler than splicing each chunk's rows into
 * a list the map is also reading.
 */
export function useBulkCreatePlaces(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (places: CreatePlaceInput[]) =>
      await apiFetch<{ places: Place[]; count: number }>(
        `/api/maps/${mapId}/places/bulk`,
        { method: "POST", body: JSON.stringify({ places }) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.places.all(mapId) });
    },
  });
}
