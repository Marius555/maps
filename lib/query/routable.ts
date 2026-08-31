"use client";

import { useMutation } from "@tanstack/react-query";

import type { LngLatTuple, RouteProfile } from "@/packages/shared/shapes";
import { apiFetch } from "./fetcher";

/**
 * Whether these locations can be stops on a route.
 *
 * A mutation for `useDirections`' reason — it fires as a consequence of arming
 * the route tool or of pointing at a pin, and there is no key it could sensibly
 * be cached under, since the answer is about coordinates rather than about a
 * location that could be looked up again later. What is worth remembering is
 * remembered by `useRoutability`, per location, for as long as the editor is
 * open.
 *
 * Like directions, this reaches a routing engine and so may only ever be called
 * from the editor. Nothing in the embed can (CLAUDE.md §2).
 */
export function useRoutable(mapId: string) {
  return useMutation({
    mutationFn: (input: { points: LngLatTuple[]; profile: RouteProfile }) =>
      apiFetch<{ results: boolean[] }>(`/api/maps/${mapId}/routable`, {
        method: "POST",
        body: JSON.stringify(input),
        /*
         * A batch is up to 25 points, each its own paced request to the engine —
         * a minute of throttle on the public demo server, plus its 8s ceiling on
         * the last one. Generous, because nobody is waiting on this: the pins
         * grey when the answer lands. Finite all the same.
         */
        signal: AbortSignal.timeout(90_000),
      }),
  });
}
