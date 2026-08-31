import type { LngLatTuple } from "@/packages/shared/shapes";

/**
 * Which location a point on screen is close enough to grab.
 *
 * In /lib rather than beside the gesture for the reason drop-action.ts and
 * edge-autoscroll.ts are: this is the part of the interaction decidable without a
 * pointer, and so the part worth testing. The hook supplies the projection; this
 * decides the answer.
 *
 * **Screen pixels, not metres.** A magnet measured in metres is a magnet whose
 * reach changes every time you zoom — irresistible at z18 and useless at z6, with
 * nothing on screen explaining why. Twelve pixels is twelve pixels wherever you
 * are, which is what makes it feel like a magnet rather than a rule.
 */

export type Located = { id: string; lat: number; lng: number };

export type Snap = {
  /** Where the point should actually go — the location's own coordinates. */
  point: LngLatTuple;
  /** The location it landed on, or null when nothing was near enough. */
  placeId: string | null;
};

/**
 * How near a location counts as touching it, in screen pixels.
 *
 * The same figure `use-draw-polygon.ts` uses to decide you clicked its first
 * point again. Both answer "did the user mean *that* thing", and two different
 * answers on one map would be two different feels.
 */
export const SNAP_RADIUS_PX = 12;

/**
 * The same question for the route tool, answered at the size of the pin.
 *
 * Twelve is right where a snap is *sugar*: the line tool can put a point
 * anywhere, so a magnet that only grabs when you are nearly on the pin costs
 * nothing when it misses. For a route a miss costs the whole click — a stop is a
 * location and only a location (`lib/map/route-stops.ts`), so a click that fails
 * to snap adds nothing at all and the tool reads as broken.
 *
 * Measured, it was: clicks registered at 0, 8 and 11px from a pin's centre and
 * were silently discarded at 13, 16 and 20px — against a pin drawn 36px wide.
 * The outer half of every icon pin did nothing.
 *
 * 22 is `.map-pin`'s own half-width (2.75rem / 2): the element you are actually
 * aiming at. It has to stay in step with the `.picking-pins` scale in
 * app/globals.css, which grows a pin to about that while the tool is armed — a
 * pin bigger than its own magnet is the bug above, drawn.
 */
export const ROUTE_SNAP_RADIUS_PX = 22;

export function snapToPlace(
  places: readonly Located[],
  at: { x: number; y: number },
  project: (place: Located) => { x: number; y: number },
  thresholdPx: number = SNAP_RADIUS_PX,
): Snap | null {
  let best: Located | null = null;
  let bestDistance = thresholdPx;

  for (const place of places) {
    const screen = project(place);
    const distance = Math.hypot(screen.x - at.x, screen.y - at.y);

    // Strictly less, so two pins at the same spot resolve to the first rather
    // than flickering between them as the cursor wobbles.
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    best = place;
  }

  if (!best) return null;

  return { point: [best.lng, best.lat], placeId: best.id };
}
