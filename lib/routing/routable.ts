import type { NearestResult } from "./types";

/**
 * Whether a location can be a stop on a route.
 *
 * Pure and separate from the adapter for the reason `simplify.ts` is: it is a
 * rule, not a request, and it is the part worth testing. The engine answers how
 * far the nearest road is; this decides whether that is near enough to be worth
 * offering to somebody.
 */

/**
 * How far a pin may sit from the nearest road and still be a stop, in metres.
 *
 * Deliberately generous. An engine will happily route to a point kilometres off
 * the network by drawing a straight leg from the road to it, so this is a
 * judgement about *quality*, not about possibility — the impossible case is
 * `NoSegment`, which arrives as a null snap and is refused whatever this number
 * says. Two kilometres keeps a farm shop at the end of an unmapped track, which
 * is a real customer's real location, and refuses a pin dropped in the sea.
 *
 * The one number to move if routes start being offered for pins that visibly
 * cannot have them, or refused for pins that plainly can.
 */
export const ROUTE_SNAP_MAX_DISTANCE_M = 2000;

/**
 * A null snap is the engine saying there is no road at all within its own reach,
 * which is exactly the `NoSegment` a route through this point would fail with.
 */
export function isRoutableSnap(nearest: NearestResult): boolean {
  if (!nearest) return false;

  return nearest.snapM <= ROUTE_SNAP_MAX_DISTANCE_M;
}
