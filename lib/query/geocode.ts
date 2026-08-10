"use client";

import { useMutation } from "@tanstack/react-query";

import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { apiFetch } from "./fetcher";

/**
 * Address lookup, as a mutation rather than a query.
 *
 * Deliberate: a `useQuery` keyed on the input text would fire on every keystroke,
 * which is exactly the autocomplete CLAUDE.md §7 rules out for v1. A mutation
 * only runs when the user submits.
 */
export function useGeocodeSearch(mapId: string) {
  return useMutation({
    mutationFn: async (input: { address: string; countryCode?: string }) =>
      (
        await apiFetch<{ candidates: GeocodeCandidate[] }>(
          `/api/maps/${mapId}/geocode`,
          { method: "POST", body: JSON.stringify(input) },
        )
      ).candidates,
  });
}

/**
 * Coordinates → the address there, for a pin that has just been dropped.
 *
 * Also a mutation, and for a stronger reason than above: this fires as a
 * consequence of an action rather than in response to one, so there is no query
 * key it could sensibly be cached under — the same coordinates twice means two
 * different pins.
 *
 * Resolves to `null` when the provider has nothing to say about that spot, which
 * callers should treat as "leave the address empty", not as a failure.
 */
export function useReverseGeocode(mapId: string) {
  return useMutation({
    mutationFn: async (input: {
      lat: number;
      lng: number;
      /**
       * The street the canvas measured off its own tiles, when it could. The
       * server needs it because the geocoder cannot derive it — see
       * lib/map/nearest-road.ts.
       */
      road?: { names: string[]; distanceM: number } | null;
    }) =>
      (
        await apiFetch<{ candidate: GeocodeCandidate | null }>(
          `/api/maps/${mapId}/geocode/reverse`,
          {
            method: "POST",
            body: JSON.stringify(input),
            /*
             * Generous, but finite. The server paces its own calls and retries
             * once, so a slow answer is normal; what is not survivable is no
             * answer at all, which leaves the row skeletonised for as long as the
             * page is open. Comfortably longer than the server's own 8s timeout
             * plus a retry, so this only fires when nothing is coming back.
             */
            signal: AbortSignal.timeout(25_000),
          },
        )
      ).candidate,
  });
}
