import type { SnapshotPlace } from "@/packages/shared/snapshot";

import { distanceKm, type Located } from "@/packages/shared/geo";

/**
 * "Find nearest", against the snapshot the visitor already has.
 *
 * The maths itself moved to packages/shared/geo.ts when lines arrived: the editor
 * has to measure a line the same way this does, and §4 keeps /lib closed to this
 * directory but not /packages/shared. Re-exported here so the rest of the embed
 * keeps importing distance from one place.
 */
export { distanceKm, formatDistance, pathLengthM } from "@/packages/shared/geo";
export type { Located } from "@/packages/shared/geo";

export function nearestPlace(
  from: Located,
  places: SnapshotPlace[],
): SnapshotPlace | null {
  let best: SnapshotPlace | null = null;
  let bestDistance = Infinity;

  for (const place of places) {
    const distance = distanceKm(from, place);
    if (distance >= bestDistance) continue;

    bestDistance = distance;
    best = place;
  }

  return best;
}
