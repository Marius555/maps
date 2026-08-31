import type { LineGeometry, LngLatTuple, ShapeGeometry } from "@/packages/shared/shapes";

/**
 * A bonded line's real position.
 *
 * A line that connects two locations stores their ids, and its own stored
 * coordinates for those ends are a *fallback*, not the truth. Resolving them here
 * on every render is what makes the line follow a pin somebody drags: nothing has
 * to write the line when a location moves, because the line never claimed to know
 * where its ends were.
 *
 * A bond naming a location that no longer exists falls back to the stored point,
 * silently. That is the same contract `groupId` has, and groups.repository.ts
 * makes the argument for it: a reader that treats a dangling id as "not bonded"
 * needs no cleanup pass at all, and cannot strand a line pointing at a location
 * that was deleted while the write was in flight.
 *
 * Pure and free of MapLibre, so the editor's canvas and the publish step can both
 * call it — and so it can be tested without a map.
 */

export type LocatedPlace = { id: string; lat: number; lng: number };

export function resolveGeometry(
  geometry: ShapeGeometry,
  places: ReadonlyMap<string, LocatedPlace>,
): ShapeGeometry {
  if (geometry.kind !== "line") return geometry;

  /*
   * A routed line is not rubber-banded, and this is the one line that stops it.
   *
   * The whole trick below is that an endpoint's stored coordinate is a fallback
   * and the pin is the truth — which is right for a path somebody clicked out,
   * and wrong for one a routing engine snapped to roads. Overwriting point 0
   * there does not reroute anything; it draws a straight kink from the moved pin
   * to wherever the road geometry starts, on the canvas and in the published
   * snapshot alike. A routed line's stops rubber-band instead, and a moved one
   * marks the route stale. See lib/map/route-staleness.ts.
   */
  if (geometry.route) return geometry;

  return resolveLine(geometry, places);
}

export function resolveLine(
  geometry: LineGeometry,
  places: ReadonlyMap<string, LocatedPlace>,
): LineGeometry {
  const { points, from, to } = geometry;
  if (points.length === 0) return geometry;
  if (!from && !to) return geometry;

  const head = bondedPoint(from, places) ?? points[0];
  const tail = bondedPoint(to, places) ?? points[points.length - 1];

  // A one-point line cannot have two distinct ends. Guarded rather than assumed
  // because a drawing abandoned mid-gesture is exactly that, and writing both
  // ends of a single-element array would silently drop `from`.
  if (points.length === 1) return { ...geometry, points: [head] };

  const next = [...points];
  next[0] = head;
  next[next.length - 1] = tail;

  return { ...geometry, points: next };
}

/**
 * The points a line publishes: resolved, with the bonds stripped.
 *
 * The embed has no locations to look an id up in, so a bond that reached a
 * snapshot would be bytes describing a relationship nothing could act on.
 */
export function publishedLinePoints(
  geometry: LineGeometry,
  places: ReadonlyMap<string, LocatedPlace>,
): LngLatTuple[] {
  return resolveLine(geometry, places).points;
}

function bondedPoint(
  id: string | undefined,
  places: ReadonlyMap<string, LocatedPlace>,
): LngLatTuple | null {
  if (!id) return null;

  const place = places.get(id);
  return place ? [place.lng, place.lat] : null;
}

/** Index by id once, so resolving a map's shapes is not a scan per endpoint. */
export function placeIndex(places: readonly LocatedPlace[]): Map<string, LocatedPlace> {
  return new Map(places.map((place) => [place.id, place]));
}
