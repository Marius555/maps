"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import type { Place, Shape } from "@/lib/repositories/types";
import type { CreatePlaceInput } from "@/lib/validation/place.schema";
import type { CreateShapeInput } from "@/lib/validation/shape.schema";
import { readGeocodeStream } from "@/lib/import/geocode-stream";
import { apiFetch, errorFromResponse } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * One chunk of an import's geocoding pass, read as it streams.
 *
 * `onResult` is called per address, the moment the server finds it — that is
 * what moves the wizard's progress bar address by address rather than chunk by
 * chunk. The format, and why buffering cannot break it, is
 * `lib/import/geocode-stream.ts`.
 *
 * No retry here, and that is on purpose even though a chunk is exactly the kind
 * of request worth retrying: `mutations: { retry: 0 }` is set globally in
 * `lib/query/client.ts` so a create can never fire twice, and the retry this
 * needs is not React Query's anyway. It has to back off on the server's own
 * `Retry-After`, give up on a chunk without giving up on the run, retry only the
 * addresses not yet answered, and count consecutive failures across chunks —
 * which is `lib/import/geocode-run.ts`.
 *
 * **Every chunk has a deadline.** A request that never settled used to leave the
 * wizard at "0 of N" for good: nothing gave up on it, and Skip is only read
 * between chunks. The timeout turns that into a failure with no status, which
 * the run retries and then skips like any dropped connection. `signal` is the
 * Skip button's own abort, combined with it.
 */
export const GEOCODE_CHUNK_TIMEOUT_MS = 35_000;

export function useGeocodeBatch(mapId: string) {
  return useMutation({
    mutationFn: async ({
      signal,
      onResult,
      ...input
    }: {
      rows: { key: string; address: string }[];
      countryCode?: string;
      runTotal?: number;
      signal?: AbortSignal;
      onResult: (result: BatchGeocodeResult) => void;
    }) => {
      // Just over the host's 30-second request ceiling, so a request the host
      // would answer is never cut short by us.
      const timeout = AbortSignal.timeout(GEOCODE_CHUNK_TIMEOUT_MS);

      const response = await fetch(`/api/maps/${mapId}/geocode/batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });

      if (!response.ok) throw await errorFromResponse(response);

      return await readGeocodeStream(response, onResult);
    },
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
