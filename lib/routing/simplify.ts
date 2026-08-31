import type { LngLatTuple } from "@/packages/shared/shapes";

/**
 * Thin a road path down until it fits the snapshot's point cap.
 *
 * A route asked for at full detail comes back with a point every few metres —
 * Oslo to Bergen is several thousand of them. Every one is roughly 24 bytes of
 * JSON on every visitor's download, which is the same argument
 * `MAX_POLYGON_POINTS` already makes about a traced boundary, and the reason a
 * route has to be thinned before it is stored rather than after it is fetched.
 *
 * Douglas–Peucker, run here rather than left to the engine's own `overview=
 * simplified`. That tolerance is OSRM's and is chosen for its own reasons; a
 * long enough route still overruns it. Doubling our own tolerance until the path
 * fits is what turns the cap from a hope into a guarantee.
 *
 * In /lib rather than /packages/shared deliberately: only the server runs this.
 * The embed receives an already-thinned path and pays no bytes for the algorithm
 * (CLAUDE.md §4).
 */

/**
 * Where the doubling starts, in metres.
 *
 * Five metres is inside the width of the road the route was snapped to, so the
 * first pass removes only points that say nothing — a straight motorway sampled
 * every twenty metres collapses to its two ends and the path is visibly
 * identical. Starting lower wastes passes; starting higher rounds off junction
 * geometry that was never the problem.
 */
const START_TOLERANCE_M = 5;

/**
 * A ceiling on the doubling, so a pathological input cannot spin.
 *
 * Twenty doublings from 5m is past 5,000km, by which point any path has been
 * reduced to its two endpoints and the loop would be running on a result that
 * can no longer change.
 */
const MAX_PASSES = 20;

/** Metres per degree of latitude — the same figure packages/shared/shapes.ts uses. */
const METRES_PER_DEGREE_LAT = 111_320;

/**
 * Thin `points` until there are at most `maxPoints` of them.
 *
 * The two endpoints are never moved and never dropped: they are where the route
 * starts and finishes, and a simplifier that shifts them has changed the answer
 * rather than compressed it.
 */
export function simplifyPath(
  points: readonly LngLatTuple[],
  maxPoints: number,
): LngLatTuple[] {
  if (points.length <= maxPoints || points.length <= 2) return [...points];

  let tolerance = START_TOLERANCE_M;
  let result = [...points];

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    result = douglasPeucker(points, tolerance);
    if (result.length <= maxPoints) return result;

    tolerance *= 2;
  }

  /*
   * Twenty doublings could not fit it, which means the path is not a path — a
   * few thousand points scattered rather than strung. Truncating would silently
   * publish half a route, so this keeps the ends and evenly samples between
   * them: still wrong-looking, but wrong along the whole route rather than
   * stopping in the middle of it.
   */
  return sample(points, maxPoints);
}

/**
 * Classic Douglas–Peucker, iterative rather than recursive.
 *
 * Recursion here is bounded by the *depth* of the split, which for a degenerate
 * path is its length — a few thousand frames on a route that happens to bend
 * consistently one way. An explicit stack costs one array and cannot overflow.
 */
export function douglasPeucker(
  points: readonly LngLatTuple[],
  toleranceM: number,
): LngLatTuple[] {
  if (points.length <= 2) return [...points];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  // One scale for the whole path. A route spans a country at most, where the
  // cosine changes too little to matter for a metre-scale tolerance.
  const scaleLng = metresPerDegreeLng(points[0][1]);

  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    if (end - start < 2) continue;

    let furthest = -1;
    let furthestDistance = toleranceM;

    for (let index = start + 1; index < end; index += 1) {
      const distance = perpendicularDistanceM(
        points[index],
        points[start],
        points[end],
        scaleLng,
      );

      if (distance <= furthestDistance) continue;

      furthestDistance = distance;
      furthest = index;
    }

    if (furthest === -1) continue;

    keep[furthest] = true;
    stack.push([start, furthest], [furthest, end]);
  }

  return points.filter((_, index) => keep[index]);
}

/**
 * How far a point sits off the line between two others, in metres.
 *
 * Equirectangular, projected to metres before the maths rather than after: a
 * tolerance in degrees is a different distance at every latitude, which is the
 * bug that makes a simplifier well behaved in Spain and destructive in Norway.
 */
function perpendicularDistanceM(
  point: LngLatTuple,
  start: LngLatTuple,
  end: LngLatTuple,
  scaleLng: number,
): number {
  const px = (point[0] - start[0]) * scaleLng;
  const py = (point[1] - start[1]) * METRES_PER_DEGREE_LAT;
  const ex = (end[0] - start[0]) * scaleLng;
  const ey = (end[1] - start[1]) * METRES_PER_DEGREE_LAT;

  const lengthSquared = ex * ex + ey * ey;
  // A zero-length segment — the route doubled back on itself — has no
  // perpendicular, so fall back to the distance from the shared endpoint.
  if (lengthSquared === 0) return Math.hypot(px, py);

  // Clamped, so a point beyond either end measures to that end rather than to
  // the infinite line through them.
  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / lengthSquared));

  return Math.hypot(px - t * ex, py - t * ey);
}

function metresPerDegreeLng(lat: number): number {
  return Math.max(METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180), 1);
}

/** Both ends plus an even spread between them. The last resort above. */
function sample(points: readonly LngLatTuple[], count: number): LngLatTuple[] {
  const step = (points.length - 1) / (count - 1);
  const out: LngLatTuple[] = [];

  for (let index = 0; index < count; index += 1) {
    out.push(points[Math.round(index * step)]);
  }

  return out;
}
