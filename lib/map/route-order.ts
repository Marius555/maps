import { collapseRepeats } from "@/lib/map/route-stops";
import { MIN_LINE_POINTS, type RouteStop } from "@/packages/shared/shapes";

/**
 * Reordering a route's stops: what a drag inside the sidebar means, and what
 * "make this the start" and "make this the end" mean.
 *
 * **The order is the route.** A route's stops are the only part of it anybody
 * decided — the hundreds of points between them came from an engine — so which
 * one is first and which is last is not a label on the list, it is the question
 * being asked. Moving a stop is therefore a different route, and the engine has
 * to be asked again; there is no arrangement of the coordinates already on the
 * map that answers it.
 *
 * Pure, and in /lib rather than beside the gesture for the reason
 * `route-stops.ts` and `drop-action.ts` give: this is the part of the
 * interaction decidable without a pointer, and so the part worth testing.
 *
 * **Every function here returns `null` for a move that changes nothing**, and
 * that is a rule about money rather than about tidiness. Each non-null answer
 * becomes a request to a metered routing engine (CLAUDE.md §12), so dropping a
 * stop back where it came from, or pressing "Make this the start" on the stop
 * that is already the start, must not spend one. It is the same contract
 * `removeStopAt` has and the same one `dropAction` has: null is a real answer,
 * and it is what keeps a control dark rather than lighting up and doing nothing.
 *
 * They also collapse consecutive repeats before checking the floor of two,
 * exactly as `removeStopAt` does, and for the same round-trip reason: A→B→A is a
 * route somebody drives, and moving B to the front leaves B→A→A, whose last leg
 * is nought metres.
 */

/**
 * The stops with the one at `from` moved to sit before the one at `insertBefore`.
 *
 * `insertBefore` is an index into the list **as it is now**, 0..length, which is
 * what a drop between two rows naturally gives you: the row you are dropping
 * above. `length` means the end. Expressing it that way rather than as a
 * destination index is what makes "before row 3" mean the same thing whether the
 * stop being dragged started above or below it.
 */
export function moveStop(
  stops: readonly RouteStop[],
  from: number,
  insertBefore: number,
): RouteStop[] | null {
  if (from < 0 || from >= stops.length) return null;
  if (insertBefore < 0 || insertBefore > stops.length) return null;

  const moved = stops[from];
  if (!moved) return null;

  const without = stops.filter((_, at) => at !== from);
  // Removing the stop shifts everything after it down one, so a destination past
  // the hole means one less than it says. Dropping immediately either side of the
  // stop's own row is the identity, and both spellings of it land here.
  const at = insertBefore > from ? insertBefore - 1 : insertBefore;

  return settle(stops, [...without.slice(0, at), moved, ...without.slice(at)]);
}

/** That stop first. The route now leaves from there. */
export function makeStart(
  stops: readonly RouteStop[],
  index: number,
): RouteStop[] | null {
  return moveStop(stops, index, 0);
}

/** That stop last. The route now finishes there. */
export function makeEnd(
  stops: readonly RouteStop[],
  index: number,
): RouteStop[] | null {
  return moveStop(stops, index, stops.length);
}

/**
 * Whether this stop could be moved anywhere at all.
 *
 * Asked by the row so it can leave the drag off and the menu items out, rather
 * than offering three moves that all return null. A two-stop route is the case:
 * either order is a route, so neither end can be "made the start" without simply
 * reversing it — which is a real thing to want and is offered, since `makeStart`
 * on the second of two does change the answer.
 */
export function canReorderStops(stops: readonly RouteStop[]): boolean {
  return stops.length > MIN_LINE_POINTS - 1;
}

/**
 * A reordered list, or null when it is not a different route.
 *
 * The comparison is on the bonded ids in order, which is what "a different
 * route" means — two stops on the same location genuinely are the same value, so
 * swapping them is not a change and must not cost a request.
 */
function settle(
  before: readonly RouteStop[],
  after: readonly RouteStop[],
): RouteStop[] | null {
  const kept = collapseRepeats(after);
  if (kept.length < MIN_LINE_POINTS) return null;

  return sameOrder(before, kept) ? null : kept;
}

function sameOrder(a: readonly RouteStop[], b: readonly RouteStop[]): boolean {
  if (a.length !== b.length) return false;

  return a.every((stop, at) => {
    const other = b[at];
    if (!other) return false;

    // A free waypoint has no id to compare, so it is compared on where it is —
    // legacy routes are full of them and two of them are not interchangeable.
    return stop.placeId
      ? stop.placeId === other.placeId
      : !other.placeId && stop.at[0] === other.at[0] && stop.at[1] === other.at[1];
  });
}
