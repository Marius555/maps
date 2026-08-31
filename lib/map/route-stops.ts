import type { Snap } from "@/lib/map/snap-to-place";
import { MAX_ROUTE_STOPS } from "@/lib/validation/shape.schema";
import { MIN_LINE_POINTS, type RouteStop } from "@/packages/shared/shapes";

/**
 * What a click does to a route's list of stops, and what the card's × does.
 *
 * Pure, and in /lib rather than beside the gesture for the reason
 * `route-staleness.ts` and `drop-action.ts` give: this is the part of the
 * interaction decidable without a pointer, and so the part worth testing. The
 * hook supplies the projection and the events; this decides the answer.
 *
 * **A stop is a location.** That is the rule the whole file exists to hold. A
 * route drawn through arbitrary points on the ground looks like a route and is
 * not one: nothing can tell you it went out of date, because there is no pin
 * whose moving would mean anything, and the card can only call the stops
 * "waypoint" because there is nothing else to call them. Free waypoints were
 * offered first and withdrawn on use — rows already holding them still load and
 * still draw (`placeId` stays optional in storage), they are simply no longer
 * produced.
 */

/**
 * The stops after a click, or `null` when the click changes nothing.
 *
 * Three ways to change nothing, and none of them is an error worth interrupting
 * anyone about. A fourth — a pin the routing engine cannot reach — *is* worth
 * saying out loud, and is deliberately not here: this is a rule about a list of
 * stops and it knows nothing about roads. `use-draw-route.ts` refuses that click
 * before asking this, which is also what keeps these three silent.
 *
 * - **The click was not on a pin.** The rubber band visibly failed to snap,
 *   which says it better than a toast per stray click would.
 * - **It was on the pin that is already the last stop.** Otherwise a
 *   double-click — which is how you finish — would put a zero-length leg into
 *   the question we ask the engine. It is also what lets the double-click
 *   handler stop slicing a stop back off: with this guard the second click of a
 *   double never added one.
 * - **The route is already at the cap.** The engine would refuse the 26th
 *   anyway, and dropping it silently here is better than sending a request that
 *   comes back as an error about a limit nobody was shown.
 */
export function appendStop(
  stops: readonly RouteStop[],
  snap: Snap | null,
): RouteStop[] | null {
  if (!snap?.placeId) return null;
  if (stops.length >= MAX_ROUTE_STOPS) return null;

  const last = stops[stops.length - 1];
  if (last?.placeId === snap.placeId) return null;

  return [...stops, { at: snap.point, placeId: snap.placeId }];
}

/**
 * Whether this particular stop can be taken out.
 *
 * Per stop, not per route, because the answer genuinely differs between rows of
 * the same route — see `removeStopAt`. The card asks once per row and hides the ×
 * where the answer is no: a control that can never be pressed is not a control,
 * and a disabled button with no explanation is worse than no button.
 */
export function canRemoveStop(
  stops: readonly RouteStop[],
  index: number,
): boolean {
  return removeStopAt(stops, index) !== null;
}

/**
 * The stops without the one at `index`, or `null` when that leaves no route.
 *
 * Two is the floor, and it is the same floor a line has: one point is a dot, and
 * a dot is a pin's job.
 *
 * The subtlety is the round trip. A→B→A is a real route somebody drives, and
 * taking B out of it leaves A→A — nought metres, nought minutes, and *no × left
 * to undo it with*, because two stops is the floor. A dead end reachable in one
 * click from an ordinary route. So consecutive repeats are collapsed before the
 * floor is checked, which turns that case into "this stop cannot come out"
 * rather than "this route is now nonsense": the middle × is simply not offered,
 * and the two ends still are.
 *
 * Found in the browser, not in a test. It is exactly the shape of bug the unit
 * tests here could not have raised, because nothing but a real route makes you
 * ask what happens after the click.
 */
export function removeStopAt(
  stops: readonly RouteStop[],
  index: number,
): RouteStop[] | null {
  if (index < 0 || index >= stops.length) return null;

  const kept = collapseRepeats(stops.filter((_, at) => at !== index));
  return kept.length >= MIN_LINE_POINTS ? kept : null;
}

/**
 * Consecutive stops on the same location, reduced to one.
 *
 * The drawing tool never makes these — `appendStop` refuses the pin that is
 * already last — so this only ever fires on what a removal leaves behind. A leg
 * from a place to itself is not a leg, and asking an engine to drive it is
 * asking a question with no answer.
 *
 * An unbonded stop is always kept, and that guard is load-bearing rather than
 * defensive: every free waypoint on a route drawn before stops had to be
 * locations has `placeId` undefined, so comparing the ids alone would read two
 * genuinely different points as the same one and quietly delete a stop nobody
 * touched.
 */
function collapseRepeats(stops: readonly RouteStop[]): RouteStop[] {
  return stops.filter((stop, at) => {
    if (at === 0 || !stop.placeId) return true;
    return stop.placeId !== stops[at - 1]?.placeId;
  });
}
