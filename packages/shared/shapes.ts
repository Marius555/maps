/**
 * The geometry of a shape on the map, and the one place it is turned into points.
 *
 * A shape is a circle — a centre and a radius in metres — a polygon, a ring of
 * points the user clicked, or a line, an *open* path between two or more points.
 * The first two are areas and are drawn as MapLibre polygons, because MapLibre
 * has no geographic circle: its `circle` layer sizes itself in *pixels*, so a 2km
 * delivery radius drawn that way would silently be a different distance at every
 * zoom level. `circleRing` is what closes that gap.
 *
 * The line is the odd one out, and the whole reason `shapePoints` exists: closing
 * its path is exactly what would turn a route into a triangle. `shapeRing` and
 * `shapePolygon` therefore take an `AreaGeometry` and will not accept one, which
 * makes that mistake a type error rather than a drawing bug.
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

export type ShapeKind = "circle" | "polygon" | "line";

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

/**
 * A path between points, drawn open.
 *
 * `from` and `to` bond the two ends to locations by id. A bonded end's stored
 * coordinates are a *fallback*, not the truth — the renderer replaces them with
 * wherever that pin is now, which is what makes the line follow a pin someone
 * drags. Both are optional, and an id naming a location that no longer exists is
 * ignored rather than cleaned up: the same contract `groupId` has, for the same
 * reason. See lib/map/line-endpoints.ts.
 *
 * They never reach a published snapshot. Publish resolves them to coordinates,
 * so a visitor downloads a finished path and looks nothing up.
 */
export type LineGeometry = {
  kind: "line";
  /** Open path. Never closed — closing it is what would make it an area. */
  points: LngLatTuple[];
  from?: string;
  to?: string;
  /**
   * Present when this path came out of a routing engine rather than out of
   * clicks — see below. Absent means hand-drawn, which is every line written
   * before routes existed and every line drawn with the plain line tool since.
   */
  route?: LineRoute;
};

/**
 * How a route was asked for. Only `car` is offered in v1: OSRM runs one process
 * per profile and the public demo server serves driving alone, so a bike or foot
 * picker would be a control that 400s against the default endpoint. The union is
 * written out anyway so storage and the snapshot need no change the day a
 * self-hosted engine answers the other two.
 */
export type RouteProfile = "car" | "bike" | "foot";

/**
 * One end of a leg: a pin on the map, or a point somebody clicked.
 *
 * `at` is always the coordinate, even when `placeId` is set — a stop bonded to a
 * location that is later deleted still knows where it was, which is the same
 * fallback contract the line's own `from`/`to` have.
 */
export type RouteStop = {
  at: LngLatTuple;
  /** Location id when this stop is a pin. Absent for a free waypoint. */
  placeId?: string;
};

/**
 * The engine's input and the one part of its answer the geometry cannot yield.
 *
 * `stops` is what was asked; `LineGeometry.points` is what came back, snapped to
 * roads. They are deliberately different lengths — two or three stops become
 * hundreds of points — and the stops are the source of truth: recomputing the
 * route means sending these again.
 *
 * `durationS` is stored because nothing can derive it. A path's *length* is a
 * sum over its own points, which is why it is measured at render time and not
 * kept here; how long it takes to drive depends on speed limits, turn penalties
 * and road classes that never reach the geometry.
 */
export type LineRoute = {
  profile: RouteProfile;
  /** 2..N, in order. */
  stops: RouteStop[];
  /** Seconds, as the engine reported them. */
  durationS: number;
};

/** The kinds that enclose something, and so have a fill and a ring. */
export type AreaGeometry = CircleGeometry | PolygonGeometry;

export type ShapeGeometry = AreaGeometry | LineGeometry;

export function isAreaKind(kind: ShapeKind): kind is AreaGeometry["kind"] {
  return kind !== "line";
}

export function isAreaGeometry(geometry: ShapeGeometry): geometry is AreaGeometry {
  return geometry.kind !== "line";
}

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
export function shapeRing(geometry: AreaGeometry): LngLatTuple[] {
  if (geometry.kind === "circle") return circleRing(geometry);

  const points = geometry.points;
  if (points.length === 0) return [];

  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = first[0] === last[0] && first[1] === last[1];

  return isClosed ? [...points] : [...points, first];
}

/** GeoJSON polygon coordinates — one outer ring, no holes. */
export function shapePolygon(geometry: AreaGeometry): LngLatTuple[][] {
  return [shapeRing(geometry)];
}

/**
 * The points a shape occupies, whatever kind it is — closed for an area, open
 * for a line.
 *
 * The one function that can be handed any geometry, so measuring, framing and
 * hit-testing never have to know which kind they are holding. Drawing still does:
 * a fill layer needs `shapePolygon` and a line layer needs this, and the two are
 * not interchangeable.
 */
export function shapePoints(geometry: ShapeGeometry): LngLatTuple[] {
  return geometry.kind === "line" ? [...geometry.points] : shapeRing(geometry);
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
  const ring = shapePoints(geometry);
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

/** Fewest points that make a path. One is a dot, and a dot is a pin's job. */
export const MIN_LINE_POINTS = 2;

/**
 * The route behind a shape, or null.
 *
 * One narrowing helper rather than `geometry.kind === "line" && geometry.route`
 * spelled out at each call site: the card, the summary, the publish step and the
 * staleness check all ask the same question, and a missed `kind` check reads a
 * route off a circle as `undefined` with no error anywhere.
 */
export function routeOf(geometry: ShapeGeometry): LineRoute | null {
  return geometry.kind === "line" ? (geometry.route ?? null) : null;
}

/**
 * How a shape's outline is marked out: one continuous stroke, dashes, or dots.
 *
 * Here rather than in /lib because the embed draws it too, and here rather than
 * beside `ShapeKind` in the schema because it is not a discriminator — a dotted
 * circle is still a circle, and nothing switches on this except the renderers.
 *
 * "solid" is first and is what absent means. Every shape written before this
 * existed reads back as solid, which is exactly what it has always been drawn as.
 */
export const SHAPE_STROKE_STYLES = ["solid", "dashed", "dotted"] as const;

export type ShapeStrokeStyle = (typeof SHAPE_STROKE_STYLES)[number];

/**
 * The widths a shape is drawn at when nobody has chosen one.
 *
 * A line is the whole object, so it is drawn heavier than an area's edge — and
 * with no fill behind it, a hairline is also a thing you cannot reliably click.
 * These are the two numbers both renderers hard-coded before the width was
 * settable, and they stay the answer so that no existing map moves.
 */
export const DEFAULT_LINE_STROKE_WIDTH = 4;
export const DEFAULT_AREA_STROKE_WIDTH = 2;

/**
 * The width a shape is actually drawn at.
 *
 * `stored` is 0 for every row written before the column existed, and null for a
 * shape whose owner has never opened the control — both mean "the default for
 * this kind", which is a value no column default could hold because it depends
 * on the kind. Resolved here, once, so neither renderer's paint expression has
 * to know the rule and the two cannot drift.
 */
export function strokeWidthOf(isLine: boolean, stored?: number | null): number {
  if (stored != null && stored > 0) return stored;

  return isLine ? DEFAULT_LINE_STROKE_WIDTH : DEFAULT_AREA_STROKE_WIDTH;
}
