import { metresToSegment } from "@/lib/geo/metres";
import type { LngLatTuple } from "@/packages/shared/shapes";

/**
 * Ramer–Douglas–Peucker, so a real boundary file will fit.
 *
 * This is not a nicety. A government-published province or municipality boundary
 * routinely carries several thousand vertices — Nunavut is about 6,800 — and
 * `MAX_POLYGON_POINTS` is 500. Without this, importing a genuine GeoJSON file
 * fails validation on nearly every feature it contains.
 *
 * The cap is about the snapshot rather than the database (see shape.schema.ts):
 * every point is roughly 24 bytes that every visitor to the customer's website
 * downloads. A 6,800-point coastline is 160KB for one region, and detail no one
 * can see at the zoom the whole region fits on screen.
 *
 * In /lib/import rather than /packages/shared because only the dashboard ever
 * simplifies. The embed draws what it is given, and §4 means anything put beside
 * `shapeRing` ships to every visitor.
 *
 * Distances in metres via lib/geo/metres.ts, so a tolerance is a number a person
 * can reason about — "collapse anything under 50 metres" — rather than a
 * quantity of degrees that means something different at every latitude.
 */

/** Iterative, not recursive: a 7,000-point ring can nest deeply enough to matter. */
function simplifyAt(
  points: readonly LngLatTuple[],
  toleranceM: number,
): LngLatTuple[] {
  if (points.length < 3) return [...points];

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end - start < 2) continue;

    const from = { lng: points[start][0], lat: points[start][1] };
    const to = { lng: points[end][0], lat: points[end][1] };

    let worst = -1;
    let worstAt = -1;

    for (let index = start + 1; index < end; index += 1) {
      const distance = metresToSegment(
        { lng: points[index][0], lat: points[index][1] },
        from,
        to,
      );

      if (distance > worst) {
        worst = distance;
        worstAt = index;
      }
    }

    // Everything between these two is closer to the straight line than the
    // tolerance, so the straight line says the same thing with two points.
    if (worst <= toleranceM || worstAt < 0) continue;

    keep[worstAt] = 1;
    stack.push([start, worstAt], [worstAt, end]);
  }

  const result: LngLatTuple[] = [];
  for (let index = 0; index < points.length; index += 1) {
    if (keep[index]) result.push(points[index]);
  }

  return result;
}

export type SimplifyResult = {
  points: LngLatTuple[];
  /** How many points went in, for telling the user what happened to their file. */
  before: number;
  /** Whether anything was actually dropped. */
  simplified: boolean;
};

/**
 * The fewest points that still fit, found by raising the tolerance until it does.
 *
 * A search rather than a fixed tolerance, because there is no single number that
 * works: 50 metres barely touches a hand-drawn campus and leaves a national
 * boundary five times over the cap. Starting small and doubling means a shape
 * that already fits is returned untouched, and one that does not is reduced by
 * the least amount that works rather than flattened to a default.
 *
 * The loop cannot fall through, and that is worth stating because it means there
 * is no "gave up" branch to reason about. Each round doubles, so twenty rounds
 * spans 10 metres to roughly 5,000 kilometres — and at a tolerance that large
 * RDP keeps nothing but the two endpoints. So the last round always returns two
 * points, which fits any cap worth having.
 *
 * The one cap not worth having is guarded separately: below two points there is
 * no path left to be a simplification *of*.
 */
export function simplifyToFit(
  points: readonly LngLatTuple[],
  maxPoints: number,
): SimplifyResult {
  const before = points.length;

  if (before <= maxPoints) {
    return { points: [...points], before, simplified: false };
  }

  if (maxPoints < 2) {
    return {
      points: points.slice(0, Math.max(maxPoints, 0)),
      before,
      simplified: true,
    };
  }

  let toleranceM = 10;
  let result = simplifyAt(points, toleranceM);

  for (let round = 1; round < 20 && result.length > maxPoints; round += 1) {
    toleranceM *= 2;
    result = simplifyAt(points, toleranceM);
  }

  return { points: result, before, simplified: true };
}
