/**
 * Which locations were *just placed*, so their markers can say so.
 *
 * The ripple is feedback — "that landed" (§8) — and feedback belongs to an
 * event, not to a lifecycle. It used to live on the base `.map-pin__pulse` rule,
 * which meant it played whenever a marker element came into being: once for
 * every pin on page load, twice for every drop (the optimistic `temp-` row is
 * swapped for the server's and the element is rebuilt), and never for a marker
 * the diff loop recycled. Three wrong answers from one honest mistake.
 *
 * So the mutation says a location was dropped and the marker layer asks. A
 * module rather than a prop threaded down through the canvas, because that path
 * deliberately does not re-render React per marker — markers are plain DOM for
 * the reason `pin-marker.ts` gives — and adding a render pass per drop to a
 * component holding up to 3,000 of them is the wrong trade for one animation.
 * It is also the part decidable without a pointer, which is what makes it
 * testable.
 *
 * Reads consume. A drop is one moment, and a mark left behind would ripple again
 * the next time the element happened to be rebuilt — which is the bug this
 * replaced.
 */

const dropped = new Set<string>();

/**
 * How many unclaimed marks are kept.
 *
 * Every mark is normally claimed within a frame, by the render the mutation's
 * own cache write triggers. One is left behind when that never happens — the
 * editor unmounted between the two — and a set that only ever grew would hold a
 * string per orphan for the life of the tab. Oldest out first: an unclaimed mark
 * is stale long before it is numerous.
 */
const LIMIT = 32;

/** A location was placed by hand, just now. */
export function markDropped(placeId: string): void {
  dropped.add(placeId);

  while (dropped.size > LIMIT) {
    const oldest = dropped.values().next();
    if (oldest.done) break;
    dropped.delete(oldest.value);
  }
}

/** Was this location just placed? Answering forgets it. */
export function takeDropped(placeId: string): boolean {
  return dropped.delete(placeId);
}

/** Test seam. Nothing in the app clears the set. */
export function resetDroppedPins(): void {
  dropped.clear();
}
