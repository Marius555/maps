import type { LngLatTuple } from "@/packages/shared/shapes";

/**
 * Reshaping a polygon or a line after it has been drawn.
 *
 * `/lib` rather than `/packages/shared`, deliberately: a polygon is only ever
 * edited in the dashboard, and the embed would inherit anything put next to
 * `shapeRing` (§4). The geometry that both targets *draw* lives there; the
 * geometry only one of them *changes* lives here.
 *
 * Equirectangular like everything else in this codebase's local geometry: a
 * midpoint is the average of two neighbouring corners, and at the scale a
 * customer traces a district the difference from a great-circle midpoint is well
 * under a metre.
 *
 * Pure, so the index arithmetic — which is where this kind of thing goes wrong —
 * can be tested without a map.
 */

/**
 * The point halfway along every edge, including the one that closes the ring.
 *
 * One per edge, so a triangle gets three and the last of them sits between the
 * final corner and the first. That closing edge is the one most easily forgotten
 * and the one a user is most likely to want a point on, because it is the edge
 * they never clicked.
 *
 * Indexed by the edge's *first* corner: entry `i` lies between `points[i]` and
 * `points[i + 1]`, so inserting there means inserting at `i + 1`.
 *
 * Empty for anything that has no edges — a ring of one point has nowhere to put
 * a midpoint, and a ring of none has nothing at all.
 *
 * `isClosed` is what separates a ring from a path. A line has no edge back to its
 * start, so it has one fewer midpoint than it has points — offering one there
 * would be offering to bend a segment that is not drawn.
 */
export function edgeMidpoints(
  points: readonly LngLatTuple[],
  isClosed = true,
): { lng: number; lat: number }[] {
  if (points.length < 2) return [];

  const edges = isClosed ? points.length : points.length - 1;

  return Array.from(
    { length: edges },
    (_, index) => edgeMidpointAt(points, index, isClosed)!,
  );
}

/**
 * One edge's midpoint, by the index of the corner it starts at.
 *
 * The single-edge form exists because it is called per handle per pointer sample:
 * a midpoint marker has to follow the edge it sits on while a *neighbouring*
 * corner is being dragged, and asking `edgeMidpoints` for the whole ring to read
 * one entry out of it would make that O(n) inside a loop that is already O(n).
 *
 * Null when there is no such edge, which is what a ring too short to have one
 * looks like.
 */
export function edgeMidpointAt(
  points: readonly LngLatTuple[],
  index: number,
  isClosed = true,
): { lng: number; lat: number } | null {
  if (points.length < 2) return null;

  const from = points[index];
  // An open path stops at its last point rather than wrapping to its first.
  const to = isClosed ? points[(index + 1) % points.length] : points[index + 1];
  if (!from || !to) return null;

  return { lng: (from[0] + to[0]) / 2, lat: (from[1] + to[1]) / 2 };
}

/**
 * A ring with one more corner in it.
 *
 * `index` is where the new point ends up, so inserting on edge `i` — between
 * corners `i` and `i + 1` — is `insertPointAt(points, i + 1, …)`. An index past
 * the end appends, which is exactly what the closing edge needs: its midpoint
 * inserts at `points.length`, after the final corner and before the wrap back to
 * the first.
 *
 * Returns a new array. The caller's is the geometry a drag started from and must
 * survive being read again on the next pointer sample.
 */
export function insertPointAt(
  points: readonly LngLatTuple[],
  index: number,
  point: LngLatTuple,
): LngLatTuple[] {
  const at = Math.max(0, Math.min(index, points.length));

  return [...points.slice(0, at), point, ...points.slice(at)];
}

/**
 * Every corner moved by the same amount.
 *
 * What dragging a polygon by its centre does: the shape keeps its form and
 * changes its place. In degrees rather than metres, because the caller has a
 * pointer position and the difference between where the shape was and where it
 * now is — converting to metres and back would only round it twice.
 */
export function translatePoints(
  points: readonly LngLatTuple[],
  deltaLng: number,
  deltaLat: number,
): LngLatTuple[] {
  return points.map(([lng, lat]) => [lng + deltaLng, lat + deltaLat]);
}
