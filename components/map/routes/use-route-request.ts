"use client";

import { useCallback, useEffect, useRef } from "react";

import { toRoutedLine } from "@/lib/map/routed-line";
import { useDirections } from "@/lib/query/directions";
import { toastError } from "@/lib/query/toast-error";
import { toast } from "@heroui/react";
import type { Place } from "@/lib/repositories/types";
import type { LineGeometry, RouteProfile, RouteStop } from "@/packages/shared/shapes";

/**
 * Ask the engine for roads between stops, and hand back a line ready to save.
 *
 * The one place a route is computed, for both of the moments it happens: a
 * finished drawing, and Recalculate on a route whose stops have moved.
 *
 * **Out-of-order answers are dropped.** The server paces its own calls, so two
 * requests started a moment apart can finish in either order — and the losing
 * one would otherwise write its geometry last and leave the map showing a route
 * nobody asked for most recently. A monotonic token is the same fix
 * `use-address-resolution.ts` uses against the same throttle, and for the same
 * reason: the answer that matters is the one to the newest question, not the
 * newest answer.
 *
 * Failures are spoken out loud rather than rendered inline. By the time one
 * arrives the drawing tool has already disarmed and there is no control left on
 * screen to put a message beside — the case `toastError` exists for.
 *
 * **A refused stop is named, and remembered.** The engine tells us which
 * coordinate it could not put on a road, so the toast can say which of the
 * user's own locations is the problem — and `onUnroutable` greys that pin, so
 * the same route cannot be drawn again by hand. Learning it here costs nothing:
 * it is the request that was going to be made anyway.
 */
export function useRouteRequest(
  mapId: string,
  {
    places,
    onUnroutable,
  }: {
    /** Where a refused stop's name comes from. */
    places: Place[];
    /** Told which location the engine refused, so its pin can say so. */
    onUnroutable?: (placeId: string) => void;
  },
) {
  const directions = useDirections(mapId);
  const token = useRef(0);

  // The same `live` idiom the drawing hooks use: `request` must stay stable for
  // the callbacks it is passed to, and the newest locations must still be
  // readable inside it.
  const live = useRef({ places, onUnroutable });
  useEffect(() => {
    live.current = { places, onUnroutable };
  });

  const request = useCallback(
    async (
      stops: readonly RouteStop[],
      profile: RouteProfile,
    ): Promise<LineGeometry | null> => {
      const mine = (token.current += 1);

      try {
        const { route, unreachableStop } = await directions.mutateAsync({
          stops: stops.map((stop) => stop.at),
          profile,
        });

        // Superseded while we were waiting. Silently, because the newer request
        // is the one the user is watching and it will speak for itself.
        if (mine !== token.current) return null;

        if (!route) {
          refuse(stops, unreachableStop, live.current);
          return null;
        }

        return toRoutedLine(stops, profile, route);
      } catch (error) {
        if (mine !== token.current) return null;

        toastError(error, "Couldn't work out the route");
        return null;
      }
    },
    [directions],
  );

  return { request, isPending: directions.isPending };
}

/**
 * Say why there is no route, as precisely as the engine allowed.
 *
 * Two genuinely different messages, because they ask for two different things.
 * A named stop is one location to move, and the pin greys so it cannot be picked
 * again; an unnamed refusal is a journey that cannot be driven, which no single
 * pin is to blame for.
 */
function refuse(
  stops: readonly RouteStop[],
  unreachableStop: number | null,
  { places, onUnroutable }: { places: Place[]; onUnroutable?: (id: string) => void },
) {
  const placeId =
    unreachableStop === null ? undefined : stops[unreachableStop]?.placeId;

  if (!placeId) {
    // A real answer, not a failure: the engine worked and there is no way to
    // drive it. Said plainly, with what to do about it.
    toast.warning("No route between those stops", {
      description:
        "The engine could not find a drivable way between them. Move a stop nearer a road and try again.",
      timeout: 8000,
    });
    return;
  }

  onUnroutable?.(placeId);

  const name = places.find((place) => place.id === placeId)?.name;

  toast.warning(`${name ?? "That location"} can't be a stop`, {
    description:
      "There is no road near it, so the routing engine can't reach it. Move the pin closer to a road, or pick a different location.",
    timeout: 8000,
  });
}
