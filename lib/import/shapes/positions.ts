import { normalizeHeader } from "@/lib/import/detect/normalize";
import type { LngLatTuple } from "@/packages/shared/shapes";

/**
 * Coordinates, read out of anything and repaired on the way.
 *
 * Three problems live here, and they are the three that make a real file fail to
 * import when the geometry inside it was perfectly good.
 *
 * **Nesting.** GeoJSON says a Polygon is three arrays deep and a LineString two,
 * but a file that never says `type` says nothing about depth either. So depth is
 * *measured* rather than assumed: descend until something looks like a position,
 * and the level it was found at is what tells you whether you are holding one
 * ring, a ring with holes, or an archipelago.
 *
 * **Axis order.** [lng, lat] is the spec and [lat, lng] is what half the world
 * writes anyway, because that is the order people say it in. The two are
 * indistinguishable inside ±90 and unmistakable outside it, so the decision is
 * taken once for the whole file from whatever evidence it happens to contain —
 * never per ring, or one file would import half-mirrored.
 *
 * **Projection.** A shapefile exported without reprojecting gives metres, not
 * degrees. Those used to be dropped one vertex at a time as out-of-range, and the
 * import then failed with "none of them had enough points to draw" — a true
 * sentence about the wrong problem. Web Mercator is recognised and converted;
 * anything else is refused by name, because a message that says which projection
 * it is, is a message someone can act on.
 */

export type Axis = "lnglat" | "latlng";

/** Where degrees stop being plausible as a latitude. */
const MAX_LAT = 90;
const MAX_LNG = 180;

/**
 * Web Mercator's own edges, in metres. The x bound is the equator's half
 * circumference; the y bound is that same number run through the projection,
 * which is why it is not the same number.
 */
const MERCATOR_MAX_X = 20_037_508.342_789_244;
const MERCATOR_MAX_Y = 20_048_966.104_014_6;

/**
 * One position as the file wrote it.
 *
 * `fixed` means the source named its own components — `{ lat, lng }` rather than
 * a bare pair — so `a` is already the longitude and no vote applies to it. That
 * is the only kind of position that can be certain of itself.
 */
export type RawPosition = { a: number; b: number; fixed: boolean };
export type RawRing = RawPosition[];

export type Harvest = {
  rings: RawRing[];
  /**
   * How deep the positions were: 1 a bare point, 2 one ring or path, 3 a ring
   * with holes or a set of paths, 4 a set of rings.
   */
  depth: number;
};

const LNG_KEYS = new Set(["lng", "lon", "long", "longitude", "x", "easting"]);
const LAT_KEYS = new Set(["lat", "latitude", "y", "northing"]);

/**
 * The third component, which we read and drop. Listed so an object carrying one
 * still counts as nothing but a position — see `isBarePosition`.
 */
const ALT_KEYS = new Set(["alt", "altitude", "z", "elevation", "ele", "height"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * One node → a position, or null.
 *
 * The array form reads only the first two entries, so `[lng, lat, altitude]`
 * works and the Z is dropped — which is what a GPS export and a QGIS 3D layer
 * both produce.
 */
export function readPosition(value: unknown): RawPosition | null {
  if (Array.isArray(value)) {
    if (value.length < 2) return null;
    if (!finite(value[0]) || !finite(value[1])) return null;

    return { a: value[0], b: value[1], fixed: false };
  }

  if (!isRecord(value)) return null;

  let lng: number | null = null;
  let lat: number | null = null;

  for (const [key, entry] of Object.entries(value)) {
    if (!finite(entry)) continue;

    const folded = normalizeHeader(key);
    if (lng === null && LNG_KEYS.has(folded)) lng = entry;
    else if (lat === null && LAT_KEYS.has(folded)) lat = entry;
  }

  return lng !== null && lat !== null ? { a: lng, b: lat, fixed: true } : null;
}

/**
 * Whether an object is a position and *nothing else*.
 *
 * The distinction that keeps a locations file out of the shape importer.
 * `{ lat, lng }` is a corner; `{ name, lat, lng }` is a shop, and a list of shops
 * read as a ring imports someone's 300 branches as one polygon threaded through
 * all of them. Counting keys is not enough — a shop has exactly three — so every
 * key has to be one a position could have.
 */
export function isBarePosition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!readPosition(value)) return false;

  return Object.keys(value).every((key) => {
    const folded = normalizeHeader(key);
    return LNG_KEYS.has(folded) || LAT_KEYS.has(folded) || ALT_KEYS.has(folded);
  });
}

/**
 * Any nesting of arrays → the rings inside it, and how deep they were.
 *
 * Depth is the *maximum* found, and shallower siblings are folded into it: a
 * malformed file mixing a bare position into a list of rings is better read as a
 * one-point ring among proper ones than refused outright.
 */
export function harvestRings(
  value: unknown,
  budget = { nodes: 200_000 },
): Harvest | null {
  if (budget.nodes-- <= 0) return null;

  const position = readPosition(value);
  if (position) return { rings: [[position]], depth: 1 };

  if (!Array.isArray(value) || value.length === 0) return null;

  const children: Harvest[] = [];
  let depth = 0;

  for (const entry of value) {
    const child = harvestRings(entry, budget);
    if (!child) continue;

    children.push(child);
    if (child.depth > depth) depth = child.depth;
  }

  if (children.length === 0) return null;

  // One level above a position is one ring: every child holds a single point and
  // they belong to the same outline. Above that, each child is already a ring (or
  // a set of them) and they stay separate.
  const rings =
    depth === 1
      ? [children.flatMap((child) => child.rings[0] ?? [])]
      : children.flatMap((child) => child.rings);

  return { rings, depth: depth + 1 };
}

export type AxisDecision = { axis: Axis; ambiguous: boolean };

/**
 * Which slot holds the longitude, decided once for the whole file.
 *
 * Only values that could still be degrees vote. A number past ±180 is not a
 * coordinate in either order and belongs to `detectProjection`, not here — left
 * in, a file in metres would "prove" both orders at once and the answer would be
 * a coin toss dressed as evidence.
 */
export function decideAxis(
  rings: readonly RawRing[],
  options: { forced?: Axis; spec?: boolean } = {},
): AxisDecision {
  if (options.forced) return { axis: options.forced, ambiguous: false };

  let firstIsLng = false;
  let secondIsLng = false;

  for (const ring of rings) {
    for (const { a, b, fixed } of ring) {
      if (fixed) continue;
      if (Math.abs(a) > MAX_LNG || Math.abs(b) > MAX_LNG) continue;

      if (Math.abs(a) > MAX_LAT) firstIsLng = true;
      if (Math.abs(b) > MAX_LAT) secondIsLng = true;
    }
  }

  if (firstIsLng && !secondIsLng) return { axis: "lnglat", ambiguous: false };
  if (secondIsLng && !firstIsLng) return { axis: "latlng", ambiguous: false };

  // A document that named itself GeoJSON or Esri has already answered: both
  // specs are longitude first, and a file is more likely to be right about what
  // it is than we are to out-guess it from numbers that fit either way.
  if (options.spec) return { axis: "lnglat", ambiguous: false };

  /*
   * Nothing conclusive — every value sits inside ±90, where the two orders are
   * the same shape mirrored about the diagonal. The spec order is the guess, and
   * saying so is the point: the preview offers a switch rather than pretending
   * this was known.
   */
  return { axis: "lnglat", ambiguous: !(firstIsLng && secondIsLng) };
}

export type Projection = "wgs84" | "webmercator";

/**
 * Degrees, or metres?
 *
 * Asked of the whole file for the same reason the axis is: a set of rings is one
 * layer out of one export, and half of it cannot be in a different coordinate
 * system from the other half.
 *
 * Null means "not degrees and not Web Mercator either" — the caller turns that
 * into a sentence naming the problem rather than dropping every vertex.
 */
export function detectProjection(rings: readonly RawRing[]): Projection | null {
  let outside = 0;
  let total = 0;

  for (const ring of rings) {
    for (const { a, b, fixed } of ring) {
      if (fixed) continue;
      total += 1;

      if (Math.abs(a) <= MAX_LNG && Math.abs(b) <= MAX_LNG) continue;

      outside += 1;
      if (Math.abs(a) > MERCATOR_MAX_X || Math.abs(b) > MERCATOR_MAX_Y) return null;
    }
  }

  if (total === 0) return "wgs84";

  /*
   * Half, rather than one.
   *
   * A file is in one coordinate system, so a projected one has essentially every
   * value out of geographic range — a Mercator easting is six or seven digits.
   * One `[999, 999]` in an otherwise ordinary ring is a typo, and treating the
   * whole layer as metres because of it would move every shape in the file to
   * within a kilometre of null island. Under the threshold the stray vertex is
   * dropped by `toLngLat`, which is what used to happen to all of them.
   */
  return outside * 2 >= total ? "webmercator" : "wgs84";
}

/** Spherical Mercator, inverted. The forward direction lives in MapLibre. */
export function unprojectMercator(x: number, y: number): [number, number] {
  const lng = (x / MERCATOR_MAX_X) * MAX_LNG;
  const scaled = (y / MERCATOR_MAX_X) * MAX_LNG;
  const lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((scaled * Math.PI) / 180)) - Math.PI / 2);

  return [lng, lat];
}

/**
 * A raw ring → the open ring of longitudes and latitudes we store.
 *
 * Three things happen, all of them lossy on purpose. The axis and projection
 * decided above are applied. Anything still out of range is dropped, because one
 * bad vertex would fail the server's schema and take the whole 50-shape chunk
 * with it. And GeoJSON's repeated closing point is removed — our `points` is an
 * *open* ring and both renderers close it themselves.
 */
export function toLngLat(
  ring: RawRing,
  axis: Axis,
  projection: Projection,
): LngLatTuple[] {
  const points: LngLatTuple[] = [];

  for (const { a, b, fixed } of ring) {
    const lngFirst = fixed || axis === "lnglat";
    let lng = lngFirst ? a : b;
    let lat = lngFirst ? b : a;

    if (!fixed && projection === "webmercator") {
      [lng, lat] = unprojectMercator(lng, lat);
    }

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < -MAX_LNG || lng > MAX_LNG || lat < -MAX_LAT || lat > MAX_LAT) continue;

    points.push([lng, lat]);
  }

  return openRing(points);
}

/** Drops the repeated closing point, if there is one. */
export function openRing(points: LngLatTuple[]): LngLatTuple[] {
  if (points.length < 2) return points;

  const first = points[0];
  const last = points[points.length - 1];

  return first[0] === last[0] && first[1] === last[1] ? points.slice(0, -1) : points;
}

/**
 * Whether the ring came in closed — the strongest hint that it is an area rather
 * than a path, and the only one available when the file never said `type`.
 *
 * Four points minimum: a closed triangle is the smallest ring that encloses
 * anything, and below that a repeated point is a duplicate rather than a
 * boundary.
 */
export function isClosed(ring: RawRing): boolean {
  if (ring.length < 4) return false;

  const first = ring[0];
  const last = ring[ring.length - 1];

  return first.a === last.a && first.b === last.b;
}
