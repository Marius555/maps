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
