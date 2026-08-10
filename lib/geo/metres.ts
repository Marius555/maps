/**
 * Distances in metres, by equirectangular projection.
 *
 * Everything measured with these is local — a pin against the roads and
 * buildings around it, inside the geocoder's own 1km search radius — where
 * equirectangular and haversine agree to well under a metre. Unlike haversine it
 * also gives the distance to a bounding box, which is what the reverse-geocode
 * selection turns on.
 *
 * The embed keeps its own haversine (embed/src/geo.ts) for continent-scale
 * "find nearest". The two answer different questions at different scales, and
 * CLAUDE.md §4 keeps that directory closed to us anyway.
 *
 * Pure, dependency-free, no `server-only`: the geocoding adapter runs this on the
 * server and the map canvas runs it in the browser.
 */

export type LngLat = { lat: number; lng: number };

/** [west, north, east, south] — the order Photon reports an extent in. */
export type Bounds = [number, number, number, number];

const METRES_PER_DEGREE_LAT = 111_320;

export function metresPerDegreeLng(lat: number): number {
  return METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

export function metresBetween(from: LngLat, to: LngLat): number {
  return Math.hypot(
    (to.lat - from.lat) * METRES_PER_DEGREE_LAT,
    (to.lng - from.lng) * metresPerDegreeLng(from.lat),
  );
}

/** Zero when the point is inside the box. */
export function metresToBounds(
  point: LngLat,
  [west, north, east, south]: Bounds,
): number {
  const outsideLng = Math.max(west - point.lng, 0, point.lng - east);
  const outsideLat = Math.max(south - point.lat, 0, point.lat - north);

  return Math.hypot(
    outsideLat * METRES_PER_DEGREE_LAT,
    outsideLng * metresPerDegreeLng(point.lat),
  );
}

/**
 * Distance from a point to a line segment, clamped to the segment's ends.
 *
 * This is the measurement that reads a street off the map: a road is a polyline,
 * and "which street is this pin on" is the shortest distance to any of its
 * segments. A road's midpoint or its bounding box answer a different, much
 * vaguer question — see lib/map/nearest-road.ts.
 */
export function metresToSegment(
  point: LngLat,
  from: LngLat,
  to: LngLat,
): number {
  const scaleLng = metresPerDegreeLng(point.lat);

  const ax = from.lng * scaleLng;
  const ay = from.lat * METRES_PER_DEGREE_LAT;
  const bx = to.lng * scaleLng;
  const by = to.lat * METRES_PER_DEGREE_LAT;
  const px = point.lng * scaleLng;
  const py = point.lat * METRES_PER_DEGREE_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  // A degenerate segment — both ends the same node — is just a point.
  const t =
    lengthSquared === 0
      ? 0
      : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);

  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
