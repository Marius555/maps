import { distanceKm } from "@/packages/shared/geo";
import type { LineGeometry, LngLatTuple, RouteStop } from "@/packages/shared/shapes";
import type { LocatedPlace } from "./line-endpoints";

/**
 * Whether a route still describes where its stops are.
 *
 * A hand-drawn line follows a pin somebody drags, because its endpoints are
 * *fallbacks* and the renderer replaces them with wherever the pin is now — see
 * line-endpoints.ts. A route cannot do that. Its points came out of a routing
 * engine and follow real roads; moving the first one onto a pin two streets away
 * does not reroute anything, it draws a straight line from the pin to wherever
 * the road geometry happens to start. The kink would be wrong on the editor's
 * canvas and wrong in the published snapshot, silently, forever.
 *
 * So a routed line's points are left exactly as the engine returned them, and a
 * bonded stop that has moved makes the route **stale** instead: the shape says
 * so, and the owner recalculates when they mean to. Nothing here fires a request
 * — a pin drag must never reach a metered upstream (CLAUDE.md §2), and a route
 * that silently rewrote itself on every drag would do exactly that.
 *
 * Pure and free of MapLibre, like its neighbour, so the canvas, the card and the
 * publish step can all ask — and so it can be tested without a map.
 */

/**
 * How far a bonded stop may drift before the route stops describing it, in
 * metres.
 *
 * About the width of the road the route was snapped to. Under that, asking the
 * engine again returns the same geometry, so a badge would be telling the owner
 * to fix something that is not broken — and a stale badge that appears when a pin
 * is nudged is a badge people learn to ignore.
 */
export const ROUTE_STALE_THRESHOLD_M = 25;

/**
 * The route's stops, with bonded ones moved to where their pin is now.
 *
 * This is the rubber band a routed line *does* have. The stops are the engine's
 * input, so keeping them current is what makes "Recalculate" send the right
 * question; the points it drew last time stay untouched until it answers.
 *
 * A stop naming a location that no longer exists keeps its stored coordinates,
 * silently — the same dangling-id contract the line's own bonds and `groupId`
 * have, and for the same reason: a reader that treats a missing id as "not
 * bonded" needs no cleanup pass and cannot strand a route pointing at a location
 * deleted while a write was in flight.
 */
export function resolvedStops(
  geometry: LineGeometry,
  places: ReadonlyMap<string, LocatedPlace>,
): RouteStop[] {
  const route = geometry.route;
  if (!route) return [];

  return route.stops.map((stop) => {
    const at = livePoint(stop, places);
    return at ? { ...stop, at } : stop;
  });
}

/**
 * True when at least one bonded stop has moved far enough that the drawn route
 * no longer goes where it says it does.
 */
export function isRouteStale(
  geometry: LineGeometry,
  places: ReadonlyMap<string, LocatedPlace>,
): boolean {
  const route = geometry.route;
  if (!route) return false;

  return route.stops.some((stop) => {
    const at = livePoint(stop, places);
    if (!at) return false;

    return distanceM(stop.at, at) > ROUTE_STALE_THRESHOLD_M;
  });
}

/** Where a bonded stop's pin is now, or null when it is free or gone. */
function livePoint(
  stop: RouteStop,
  places: ReadonlyMap<string, LocatedPlace>,
): LngLatTuple | null {
  if (!stop.placeId) return null;

  const place = places.get(stop.placeId);
  return place ? [place.lng, place.lat] : null;
}

function distanceM(from: LngLatTuple, to: LngLatTuple): number {
  return (
    distanceKm({ lng: from[0], lat: from[1] }, { lng: to[0], lat: to[1] }) * 1000
  );
}
