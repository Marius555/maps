import type { Located } from "@/packages/shared/geo";

/**
 * The projection the landing page's Europe map draws with.
 *
 * A few lines rather than a geography package: a flat lng/lat rectangle is all
 * the map needs, and it does not justify a dependency (CLAUDE.md §3).
 */

export type FlatBounds = {
  west: number;
  east: number;
  north: number;
  south: number;
};

/** A point on a plain lng/lat rectangle, as 0…1 across and down it. */
export function equirect(point: Located, bounds: FlatBounds): { x: number; y: number } {
  return {
    x: (point.lng - bounds.west) / (bounds.east - bounds.west),
    y: (bounds.north - point.lat) / (bounds.north - bounds.south),
  };
}
