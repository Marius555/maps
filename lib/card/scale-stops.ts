/**
 * The stop a number lands on, for a control that offers a handful of them.
 *
 * The designer's numeric properties are named choices rather than sliders — five
 * tiles, not a track (see components/card/designer/properties/property-scales.tsx).
 * That leaves one question the tiles cannot answer on their own: what to light
 * when the stored number is not one of them. It happens constantly and is not an
 * edge case — a block's width and height come from dragging its own resize
 * handles, `defaultPadding` is 4 on a scale whose stops are 0 and 8, and every
 * design saved while these were sliders holds whatever the thumb was over.
 *
 * The control uses `disallowEmptySelection`, so an unmatched value lights
 * *nothing* — a row of five tiles, none of them pressed, on a property that
 * plainly has a value. Snapping is what stops that.
 *
 * **Display only.** Nothing writes the snapped number back: the stored value is
 * the truth until someone presses a tile, so opening a panel can never quietly
 * change a design (the same rule `defaultCardLayout` follows).
 *
 * Ties go to the lower stop, so the answer does not depend on the order the
 * stops were written in.
 */
export function nearestStop(value: number, stops: readonly number[]): number {
  let best = stops[0] ?? 0;
  let distance = Math.abs(value - best);

  for (const stop of stops) {
    const next = Math.abs(value - stop);
    // Strictly closer, so an equal distance keeps the first — which, on an
    // ascending table, is the lower of the two.
    if (next < distance) {
      best = stop;
      distance = next;
    }
  }

  return best;
}
