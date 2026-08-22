"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import type { Place, Shape } from "@/lib/repositories/types";
import type { CreatePlaceInput } from "@/lib/validation/place.schema";
import type { CreateShapeInput } from "@/lib/validation/shape.schema";
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

/**
 * One chunk of a confirmed GeoJSON import.
 *
 * The shapes twin of `useBulkCreatePlaces`, invalidating rather than patching
 * for the same reason: several chunks land in sequence, and refetching once at
 * the end beats splicing each one into a list the canvas is also reading.
 *
 * Not optimistic, unlike `useCreateShape`. A drawn shape has to appear under the
 * pointer that drew it or the gesture feels broken; an import is a dialog with a
 * button, and the honest thing there is for the rows to appear when they exist.
 */
export function useBulkCreateShapes(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shapes: CreateShapeInput[]) =>
      await apiFetch<{ shapes: Shape[]; count: number }>(
        `/api/maps/${mapId}/shapes/bulk`,
        { method: "POST", body: JSON.stringify({ shapes }) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shapes.all(mapId) });
    },
  });
}
