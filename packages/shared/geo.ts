/**
 * Distances on the globe, for both build targets.
 *
 * Haversine, and deliberately not the equirectangular maths in lib/geo/metres.ts.
 * That file scopes itself to local measurements — a pin against the buildings
 * around it — and points here for continent-scale work. A line is continent-scale:
 * it can run from Oslo to Bergen, and the flat approximation drifts at that range.
 *
 * This lives in /packages/shared for the reason shapes.ts does. The editor's shape
 * card and the embed's popup describe the same line, and the preview panel renders
 * the real embed bundle beside the editor's own canvas — two length functions
 * would print two different distances for one line on one screen.
 *
 * Zero dependencies, vanilla TS, per CLAUDE.md §4.
 */

import type { LngLatTuple } from "./shapes";

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

/**
 * How long a path is, in metres, following every bend.
 *
 * The sum of its segments rather than the distance between its ends: a line
 * clicked around a coastline is not as long as the crow flies, and reporting the
 * shortcut would be reporting a distance nobody drew.
 */
export function pathLengthM(points: readonly LngLatTuple[]): number {
  let metres = 0;

  for (let index = 1; index < points.length; index += 1) {
    const [fromLng, fromLat] = points[index - 1];
    const [toLng, toLat] = points[index];

    metres +=
      distanceKm({ lng: fromLng, lat: fromLat }, { lng: toLng, lat: toLat }) * 1000;
  }

  return metres;
}

/** Rounded the way a person would say it, not to three decimal places. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;

  return `${Math.round(km)} km`;
}

/** The same, from metres — what every shape stores. */
export function formatDistanceM(metres: number): string {
  return formatDistance(metres / 1000);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
