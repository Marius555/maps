import { shapeBounds, type ShapeBounds } from "@/packages/shared/shapes";
import type { ShapeGeometry } from "@/packages/shared/shapes";

/**
 * The box that holds everything in a selection.
 *
 * What `fitBounds` needs when a group's header is clicked: a group can hold
 * pins and areas at once, and flying to the first member would put the rest off
 * screen. Pure, so it can be tested without a map.
 *
 * A pin contributes its own point — degenerate bounds, which is correct: a
 * marker has no extent on the ground, only on the screen, and screen size is the
 * map's problem to pad for.
 */
export type SelectionSource = {
  points: readonly { lng: number; lat: number }[];
  geometries: readonly ShapeGeometry[];
};

/** Null when the selection is empty, or holds only shapes with no geometry yet. */
export function selectionBounds({
  points,
  geometries,
}: SelectionSource): ShapeBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let found = false;

  const widen = (bounds: ShapeBounds) => {
    found = true;
    if (bounds.west < west) west = bounds.west;
    if (bounds.east > east) east = bounds.east;
    if (bounds.south < south) south = bounds.south;
    if (bounds.north > north) north = bounds.north;
  };

  for (const point of points) {
    widen({
      west: point.lng,
      east: point.lng,
      south: point.lat,
      north: point.lat,
    });
  }

  for (const geometry of geometries) {
    const bounds = shapeBounds(geometry);
    if (bounds) widen(bounds);
  }

  return found ? { west, south, east, north } : null;
}
