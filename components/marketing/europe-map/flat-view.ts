import { equirect, type FlatBounds } from "@/lib/marketing/europe-map/projection";
import type { Located } from "@/packages/shared/geo";

/**
 * A lng/lat rectangle laid out as an SVG coordinate space.
 *
 * Longitude is squeezed by the cosine of the middle latitude, so a regional
 * map is not stretched sideways the way a raw lng/lat grid is — Europe drawn
 * plain equirectangular is a third too wide. `squeeze: false` keeps it plain.
 */
export type FlatView = {
  width: number;
  height: number;
  project: (point: Located) => { x: number; y: number };
};

export function flatView(
  bounds: FlatBounds,
  height: number,
  squeeze: boolean,
): FlatView {
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180);
  const aspect =
    ((bounds.east - bounds.west) * (squeeze ? Math.cos(midLat) : 1)) /
    (bounds.north - bounds.south);
  const width = Math.round(height * aspect);

  return {
    width,
    height,
    project: (point) => {
      const p = equirect(point, bounds);
      return { x: p.x * width, y: p.y * height };
    },
  };
}
