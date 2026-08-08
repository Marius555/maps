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
