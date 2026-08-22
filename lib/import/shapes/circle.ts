import { normalizeHeader } from "@/lib/import/detect/normalize";
import {
  MIN_CIRCLE_RADIUS_M,
  radiusFrom,
  type CircleGeometry,
  type LngLatTuple,
} from "@/packages/shared/shapes";

/**
 * Circles, which almost never arrive looking like one.
 *
 * GeoJSON has no circle. So every tool that draws one has to write it down as
 * something else, and they picked two different somethings:
 *
 * 1. **A point carrying a radius.** Leaflet.Draw and geojson.io write
 *    `properties: { subType: "Circle", radius }`; store-locator exports write a
 *    `radius_km` or a `buffer` column beside the coordinates. Until now every one
 *    of these imported as nothing at all — a Point had no branch and was skipped
 *    without explanation.
 *
 * 2. **A polygon that happens to be round.** turf's `circle`, Mapbox Draw and the
 *    Google Maps API all emit a 64- or 128-sided ring, and that is what "it
 *    cannot recognise a circle" usually means: the shape drew fine and then could
 *    not be *edited*, because a circle has one radius handle and a 64-gon has 64
 *    immovable vertices and no radius at all.
 *
 * Both end as `{ kind: "circle", lng, lat, radius }` — three numbers that redraw
 * at 64 points through `circleRing`, survive the 500-point cap with room to
 * spare, and can be dragged.
 */

/**
 * The fewest vertices a ring may have and still be read as a circle.
 *
 * Deliberately well above the point where the test starts working. A regular
 * hexagon passes every check below and is obviously not a circle — someone drew
 * a hexagon. By 24 sides nobody is drawing by hand: every tool that emits that
 * many evenly spaced vertices at one radius emitted them from a centre and a
 * radius, and giving those back is a restoration rather than a guess.
 */
export const MIN_CIRCLE_VERTICES = 24;

/**
 * How much the distance from the centre may vary across the ring, as a fraction
 * of the mean. Two per cent absorbs the rounding of coordinates printed to six
 * decimals and rejects anything with a corner.
 */
const RADIUS_TOLERANCE = 0.02;

/**
 * How uneven the spacing between vertices may be, as the widest gap over the
 * narrowest.
 *
 * Roundness alone is not enough: an arc, a fan, or a semicircle closed with a
 * chord all sit at one distance from a point and are not circles. Their giveaway
 * is a gap several times the others, which this catches and the radius test
 * cannot.
 */
const GAP_TOLERANCE = 1.5;

/** The schema's own ceiling, restated so a detection cannot fail validation. */
const MAX_CIRCLE_RADIUS_M = 20_000_000;

/**
 * A ring that is a circle → the circle. Null for a ring that is a polygon.
 *
 * Everything is measured in the same equirectangular metre space `circleRing`
 * draws in — `radiusFrom` is literally the function the radius handle uses — so a
 * circle detected here redraws exactly where it was. Haversine would be more
 * correct in the abstract and wrong here: it would disagree with the renderer,
 * and the ring would come back a few metres off the one in the file.
 */
export function circleFromRing(points: readonly LngLatTuple[]): CircleGeometry | null {
  if (points.length < MIN_CIRCLE_VERTICES) return null;

  const centre = centroid(points);

  let min = Infinity;
  let max = 0;
  let total = 0;

  for (const [lng, lat] of points) {
    const radius = radiusFrom(centre, { lng, lat });

    if (radius < min) min = radius;
    if (radius > max) max = radius;
    total += radius;
  }

  const radius = total / points.length;

  if (radius < MIN_CIRCLE_RADIUS_M || radius > MAX_CIRCLE_RADIUS_M) return null;
  if ((max - min) / radius > RADIUS_TOLERANCE) return null;
  if (!evenlySpaced(points, centre)) return null;

  return { kind: "circle", lng: centre.lng, lat: centre.lat, radius };
}

/**
 * The mean vertex — which for any regular polygon is its centre exactly, and for
 * a 64-gon written to six decimals is its centre to well under a millimetre.
 */
function centroid(points: readonly LngLatTuple[]): { lng: number; lat: number } {
  let lng = 0;
  let lat = 0;

  for (const point of points) {
    lng += point[0];
    lat += point[1];
  }

  return { lng: lng / points.length, lat: lat / points.length };
}

/**
 * Whether the vertices are spread evenly around the centre.
 *
 * The longitude term is scaled by cos(latitude) for the same reason `circleRing`
 * scales it: a degree of longitude is shorter than a degree of latitude
 * everywhere but the equator, and unscaled angles would read every circle outside
 * the tropics as an ellipse with the vertices bunched at its ends.
 *
 * Only the ratio matters, so this needs no metres-per-degree constant of its
 * own — one fewer copy of a number that has to agree with the renderer.
 */
function evenlySpaced(
  points: readonly LngLatTuple[],
  centre: { lng: number; lat: number },
): boolean {
  const scale = Math.cos((centre.lat * Math.PI) / 180);

  const angles = points
    .map(([lng, lat]) => Math.atan2(lat - centre.lat, (lng - centre.lng) * scale))
    .sort((left, right) => left - right);

  let min = Infinity;
  let max = 0;

  for (let index = 0; index < angles.length; index += 1) {
    // The last gap wraps around the top of the circle, and it is the one an arc
    // closed with a chord gives itself away on — so it is measured, not skipped.
    const next = index === angles.length - 1 ? angles[0] + 2 * Math.PI : angles[index + 1];
    const gap = next - angles[index];

    if (gap < min) min = gap;
    if (gap > max) max = gap;
  }

  // A ring with two vertices in the same place has a zero gap and no opinion
  // about evenness. Refuse rather than divide by it.
  if (min <= 0) return false;

  return max / min <= GAP_TOLERANCE;
}

/**
 * The property names a radius might be under, folded through `normalizeHeader`
 * so `Radius_KM`, `radius km` and `radiusKm` are one entry.
 *
 * A key is matched by its stem and whatever is left over is read as a unit, which
 * is what lets six stems and six units cover thirty-six spellings. The vague ones
 * — `range`, `distance` — are in the list on purpose: this table is only ever
 * consulted for a *point*, and a point with no radius is discarded anyway, so the
 * worst a false match can do is turn something we were about to throw away into a
 * circle the preview shows before anything is saved.
 */
const RADIUS_STEMS = [
  "radius",
  "bufferradius",
  "bufferdistance",
  "buffer",
  "serviceradius",
  "servicearea",
  "deliveryradius",
  "catchmentradius",
  "catchment",
  "range",
  "distance",
] as const;

/** Multiplier to metres. The empty key is the default when no unit is written. */
const UNITS: Record<string, number> = {
  "": 1,
  m: 1,
  meter: 1,
  meters: 1,
  metre: 1,
  metres: 1,
  km: 1000,
  kilometer: 1000,
  kilometers: 1000,
  kilometre: 1000,
  kilometres: 1000,
  mi: 1609.344,
  mile: 1609.344,
  miles: 1609.344,
  ft: 0.3048,
  foot: 0.3048,
  feet: 0.3048,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144,
  nmi: 1852,
  nauticalmile: 1852,
  nauticalmiles: 1852,
};

const UNIT_KEYS = new Set(["unit", "units", "radiusunit", "radiusunits", "distanceunit"]);

/**
 * A property bag → the radius it names, in metres. Null when it names none.
 *
 * The number may be written as a string — XML feeds and half of every CSV-derived
 * JSON do — so it is coerced rather than type-checked.
 */
export function readRadius(properties: Record<string, unknown> | null): number | null {
  if (!properties) return null;

  const sibling = siblingUnit(properties);
  let best: number | null = null;
  // Annotated, because `as const` narrows the length to a literal and the rank
  // assigned below is an ordinary number.
  let bestRank: number = RADIUS_STEMS.length;

  for (const [key, value] of Object.entries(properties)) {
    const amount = toNumber(value);
    if (amount === null || amount <= 0) continue;

    const folded = normalizeHeader(key);
    const rank = RADIUS_STEMS.findIndex((stem) => folded.startsWith(stem));
    // A later stem in the table never displaces an earlier one, so `radius_km`
    // wins over a `range` column that happens to sit in the same record.
    if (rank < 0 || rank >= bestRank) continue;

    /*
     * What is left after the stem has to be a unit or nothing at all. A
     * `radiusLabel` is not a radius written in labels, it is a different field
     * that happens to start the same way, and reading it as metres would put a
     * five-metre circle on the map with no explanation.
     */
    const suffix = folded.slice(RADIUS_STEMS[rank].length);
    const scale = suffix ? UNITS[suffix] : sibling;
    if (scale === undefined) continue;

    best = amount * scale;
    bestRank = rank;
  }

  return best;
}

/**
 * The unit named by a field of its own, for `{ radius: 5, units: "km" }`.
 *
 * Metres when nothing says otherwise — the unit a radius is written in when its
 * key does not say, in every export I have seen and in the schema's own column.
 */
function siblingUnit(properties: Record<string, unknown>): number {
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== "string") continue;
    if (!UNIT_KEYS.has(normalizeHeader(key))) continue;

    const scale = UNITS[normalizeHeader(value)];
    if (scale !== undefined) return scale;
  }

  return 1;
}

/**
 * Leaflet.Draw and geojson.io mark a circle they saved as a point, and they are
 * the reason a Point is worth looking twice at rather than skipping outright.
 */
export function declaresCircle(properties: Record<string, unknown> | null): boolean {
  if (!properties) return false;

  for (const [key, value] of Object.entries(properties)) {
    if (typeof value !== "string") continue;

    const folded = normalizeHeader(key);
    if (folded !== "subtype" && folded !== "type" && folded !== "shapetype") continue;
    if (normalizeHeader(value) === "circle") return true;
  }

  return false;
}

/** Within the bounds the schema will accept, so a chunk never fails on one row. */
export function isDrawableRadius(radius: number): boolean {
  return (
    Number.isFinite(radius) &&
    radius >= MIN_CIRCLE_RADIUS_M &&
    radius <= MAX_CIRCLE_RADIUS_M
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
