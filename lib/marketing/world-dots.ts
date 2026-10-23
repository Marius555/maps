import type { Located } from "@/packages/shared/geo";

import { WORLD_DOT_GRIDS } from "./world-dots.data";

/**
 * The land mask the landing page's Europe map draws as dots, decoded.
 *
 * The bits come from scripts/build-world-dots.mjs, which samples the Natural
 * Earth raster once; each cell is land or sea, and a land cell is one dot at its
 * centre. Decoding is memoised per grid.
 */

export type DotGridName = keyof typeof WORLD_DOT_GRIDS;

export type DotGridBounds = {
  west: number;
  east: number;
  north: number;
  south: number;
  step: number;
};

/** The same six-bit alphabet the script encodes with. */
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const decoded = new Map<DotGridName, readonly Located[]>();

/** Every land cell of a grid, as the lng/lat of its centre. */
export function landDots(name: DotGridName): readonly Located[] {
  const cached = decoded.get(name);
  if (cached) return cached;

  const grid = WORLD_DOT_GRIDS[name];
  const dots: Located[] = [];

  grid.rows.forEach((row, r) => {
    for (let c = 0; c < grid.cols; c++) {
      const value = ALPHABET.indexOf(row[Math.floor(c / 6)]);
      if (((value >> (5 - (c % 6))) & 1) === 0) continue;
      dots.push({
        lng: grid.west + (c + 0.5) * grid.step,
        lat: grid.north - (r + 0.5) * grid.step,
      });
    }
  });

  decoded.set(name, dots);
  return dots;
}

/** The rectangle a grid covers, for projecting it onto a flat frame. */
export function gridBounds(name: DotGridName): DotGridBounds {
  const grid = WORLD_DOT_GRIDS[name];
  return {
    west: grid.west,
    east: grid.west + grid.cols * grid.step,
    north: grid.north,
    south: grid.north - grid.rows.length * grid.step,
    step: grid.step,
  };
}
