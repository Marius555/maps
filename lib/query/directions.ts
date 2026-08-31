"use client";

import { useMutation } from "@tanstack/react-query";

import type { RouteOutcome } from "@/lib/routing/types";
import type { LngLatTuple, RouteProfile } from "@/packages/shared/shapes";
import { apiFetch } from "./fetcher";

/**
 * Roads between stops.
 *
 * A mutation, for the reason `useReverseGeocode` is one: it fires as a
 * consequence of an action — finishing a route, or pressing Recalculate — and
 * there is no key it could sensibly be cached under, since the same stops asked
 * twice means the owner wanted it asked again.
 *
 * Importantly, this is the *only* place in the app that reaches a routing
 * engine, and nothing in the embed can. The answer is written into the shape's
 * geometry and published as plain coordinates (CLAUDE.md §2).
 *
 * Resolves with `route: null` when the engine found no way between the stops,
 * which callers should show as "no route", not as a failure. `unreachableStop`
 * indexes into the stops that were sent, and is set only when the engine blamed
 * one of them — the difference between "there is no way to drive this" and
 * "*that* pin is not on a road".
 */
export function useDirections(mapId: string) {
  return useMutation({
    mutationFn: (input: { stops: LngLatTuple[]; profile: RouteProfile }) =>
      apiFetch<RouteOutcome>(`/api/maps/${mapId}/directions`, {
        method: "POST",
        body: JSON.stringify(input),
        /*
         * Comfortably longer than the server's own 8s timeout plus its one
         * retry, and longer again because the request may wait for a throttle
         * slot behind another route. Finite all the same: a route that never
         * answers must fail rather than leave the tool armed forever.
         */
        signal: AbortSignal.timeout(30_000),
      }),
  });
}
