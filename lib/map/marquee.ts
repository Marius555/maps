/**
 * Hit testing for the select tool's drag box.
 *
 * Screen pixels, not degrees, and that is the point: the box is a rectangle the
 * user dragged on their screen. A rotated or pitched map turns a screen
 * rectangle into a quadrilateral on the ground, so testing in geographic space
 * would select things the box visibly did not cover. The caller projects each
 * candidate through MapLibre and compares here.
 *
 * Pure, so it can be tested without a map.
 */

/** A drag box in canvas pixels. Normalised — `x1`/`y1` are always the smaller. */
export type SelectBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** A box from the two corners of a drag, in whichever order they were made. */
export function boxFrom(
  from: { x: number; y: number },
  to: { x: number; y: number },
): SelectBox {
  return {
    x1: Math.min(from.x, to.x),
    y1: Math.min(from.y, to.y),
    x2: Math.max(from.x, to.x),
    y2: Math.max(from.y, to.y),
  };
}

/**
 * How far the pointer has to travel before a drag counts as a marquee.
 *
 * Below this it is a click, and a click means "deselect", not "select the one
 * pin that happened to be under a 2px box".
 */
export const MIN_BOX_SIZE_PX = 4;

export function isBoxUsable(box: SelectBox): boolean {
  return (
    box.x2 - box.x1 >= MIN_BOX_SIZE_PX || box.y2 - box.y1 >= MIN_BOX_SIZE_PX
  );
}

/** A pin: selected when its own point is inside the box. */
export function isPointInBox(
  point: { x: number; y: number },
  box: SelectBox,
): boolean {
  return (
    point.x >= box.x1 &&
    point.x <= box.x2 &&
    point.y >= box.y1 &&
    point.y <= box.y2
  );
}

/**
 * A shape: selected when its projected extent *overlaps* the box.
 *
 * Overlap rather than containment, because a shape is an area and containment
 * would make the large ones unselectable — a two-kilometre delivery radius
 * cannot be enclosed by a box drawn on a screen showing part of it. Touching it
 * with the box is the only gesture that works at every zoom.
 */
export function boundsIntersectBox(
  bounds: SelectBox,
  box: SelectBox,
): boolean {
  return (
    bounds.x1 <= box.x2 &&
    bounds.x2 >= box.x1 &&
    bounds.y1 <= box.y2 &&
    bounds.y2 >= box.y1
  );
}
