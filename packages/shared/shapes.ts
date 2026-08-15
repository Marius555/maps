/**
 * The geometry of an area on the map, and the one place it is turned into points.
 *
 * A shape is either a circle — a centre and a radius in metres — or a polygon, a
 * ring of points the user clicked. Both are drawn as MapLibre polygons, because
 * MapLibre has no geographic circle: its `circle` layer sizes itself in *pixels*,
 * so a 2km delivery radius drawn that way would silently be a different distance
 * at every zoom level. `circleRing` is what closes that gap.
 *
 * This lives here rather than in /lib because both targets have to draw the same
 * circle, not two that agree today — the same argument darken-style.ts makes. The
 * preview panel renders the real embed bundle beside the editor's own canvas, so
 * a ring of 64 points in one and 32 in the other is two visibly different circles
 * on one screen.
 *
 * Zero dependencies, vanilla TS, per CLAUDE.md §4 — whatever this directory
 * imports, the embed inherits.
 */

export type ShapeKind = "circle" | "polygon";

/** [lng, lat] — GeoJSON's order, so a ring needs no rearranging on the way out. */
export type LngLatTuple = [number, number];

export type CircleGeometry = {
  kind: "circle";
  lng: number;
  lat: number;
  /** Metres. Distances a customer thinks in, not degrees. */
  radius: number;
};

export type PolygonGeometry = {
  kind: "polygon";
  /** Open ring — the closing point is added at render time, not stored. */
  points: LngLatTuple[];
};

export type ShapeGeometry = CircleGeometry | PolygonGeometry;

/**
 * How many points a circle is drawn with.
 *
 * At 64 the straight edge between two neighbours is under a thousandth of the
 * radius, which is invisible at any zoom that fits the whole circle — and if you
 * zoom in far enough to see one edge, that edge fills the screen and reads as
 * straight anyway. Doubling it would double the bytes in every published snapshot
 * for nothing.
 */
export const CIRCLE_SEGMENTS = 64;

/**
 * Metres per degree of latitude, and the same figure scaled for longitude.
 *
 * Deliberately duplicated from lib/geo/metres.ts rather than imported: §4 closes
 * `@/lib` to this directory and ESLint enforces it, because whatever /packages/shared
 * imports ships to visitors. It is one constant and a cosine.
 *
 * Equirectangular, like that file. A shape is a local thing — a delivery radius, a
 * campus, a district — and at those scales this and haversine agree to well under
 * a metre.
 */
const METRES_PER_DEGREE_LAT = 111_320;

function metresPerDegreeLng(lat: number): number {
  // Clamped away from the poles, where a degree of longitude is zero metres and
  // the division below would return Infinity.
  return Math.max(METRES_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180), 1);
}

/**
 * A circle as a closed ring of points.
 *
 * The first point is repeated at the end because GeoJSON requires a linear ring to
 * close, and MapLibre will not fill one that does not.
 */
export function circleRing(
  circle: CircleGeometry,
  segments = CIRCLE_SEGMENTS,
): LngLatTuple[] {
  const scaleLng = metresPerDegreeLng(circle.lat);
  const ring: LngLatTuple[] = [];

  for (let step = 0; step < segments; step += 1) {
    const angle = (step / segments) * 2 * Math.PI;

    ring.push([
      circle.lng + (Math.cos(angle) * circle.radius) / scaleLng,
      circle.lat + (Math.sin(angle) * circle.radius) / METRES_PER_DEGREE_LAT,
    ]);
  }

  ring.push(ring[0]);
  return ring;
}

/**
 * The ring either kind of shape renders as — the one function every renderer
 * calls, so neither has to know which kind it is holding.
 */
export function shapeRing(geometry: ShapeGeometry): LngLatTuple[] {
  if (geometry.kind === "circle") return circleRing(geometry);

  const points = geometry.points;
  if (points.length === 0) return [];

  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];

  return isClosed ? [...points] : [...points, first];
}

/** GeoJSON polygon coordinates — one outer ring, no holes. */
export function shapePolygon(geometry: ShapeGeometry): LngLatTuple[][] {
  return [shapeRing(geometry)];
}

/**
 * Where a shape's card and label hang.
 *
 * A circle's centre is its centre. A polygon's is the mean of its vertices rather
 * than its area centroid: the mean cannot land outside a concave shape's own
 * outline the way a naive area centroid can on a crescent, and a card anchored to
 * empty ground beside the shape it describes is the failure that matters here.
 */
export function shapeCentre(geometry: ShapeGeometry): { lng: number; lat: number } {
  if (geometry.kind === "circle") {
    return { lng: geometry.lng, lat: geometry.lat };
  }

  const points = geometry.points;
  if (points.length === 0) return { lng: 0, lat: 0 };

  let lng = 0;
  let lat = 0;

  for (const [pointLng, pointLat] of points) {
    lng += pointLng;
    lat += pointLat;
  }

  return { lng: lng / points.length, lat: lat / points.length };
}

export type ShapeBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/**
 * The box a shape occupies. Null for a polygon with no points, which is what a
 * drawing abandoned before its first click looks like.
 */
export function shapeBounds(geometry: ShapeGeometry): ShapeBounds | null {
  const ring = shapeRing(geometry);
  if (ring.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }

  return { west, south, east, north };
}

/**
 * Where the handle that resizes a circle sits: due east of the centre, on the
 * border.
 *
 * Due east rather than "wherever it was last dragged" because a handle has to be
 * findable — a circle whose grab point moved every time you used it would make
 * you hunt for it. It stays geographically east if the map is rotated, which is
 * the same promise the pins make.
 */
export function radiusHandle(circle: CircleGeometry): { lng: number; lat: number } {
  return {
    lng: circle.lng + circle.radius / metresPerDegreeLng(circle.lat),
    lat: circle.lat,
  };
}

/** The radius implied by dragging the border handle to a point, in metres. */
export function radiusFrom(
  centre: { lng: number; lat: number },
  point: { lng: number; lat: number },
): number {
  return Math.hypot(
    (point.lat - centre.lat) * METRES_PER_DEGREE_LAT,
    (point.lng - centre.lng) * metresPerDegreeLng(centre.lat),
  );
}

/**
 * The smallest circle we will draw, in metres.
 *
 * Not a validation nicety: a circle can be dragged to zero radius, and a zero
 * radius puts the resize handle exactly under the move handle, where neither can
 * be grabbed again. Ten metres is small enough to mean "as small as I wanted" and
 * large enough that the two handles are still separate objects on screen.
 */
export const MIN_CIRCLE_RADIUS_M = 10;

/** Fewest points that enclose an area. Two make a line, one makes nothing. */
export const MIN_POLYGON_POINTS = 3;
