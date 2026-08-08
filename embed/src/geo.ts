import type { SnapshotPlace } from "@/packages/shared/snapshot";

/** Mean Earth radius, kilometres. */
const EARTH_RADIUS_KM = 6371;

export type Located = { lat: number; lng: number };

/**
 * Great-circle distance in kilometres.
 *
 * Runs entirely in the visitor's browser against the snapshot they already
 * downloaded, which is what makes "find nearest" free (CLAUDE.md §2). Sorting a
 * few thousand places this way is microseconds.
 */
export function distanceKm(from: Located, to: Located): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

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

/** Rounded the way a person would say it, not to three decimal places. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;

  return `${Math.round(km)} km`;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
