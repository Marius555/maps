import type { Projection } from "./positions";

/**
 * ArcGIS JSON → the geometries the rest of the reader understands.
 *
 * This is what a government open-data portal hands you when the download button
 * says "JSON" rather than "GeoJSON", and what every ArcGIS Online query endpoint
 * returns by default. It looked enough like GeoJSON to reach the old parser and
 * different enough to produce nothing: no `type`, no `coordinates`, so no parts,
 * so "we couldn't find any shapes in that file" on a file full of shapes.
 *
 * Two things it does that GeoJSON does not, and both change what gets imported:
 *
 * **`rings` is not a Polygon.** GeoJSON says ring zero is the outside and the
 * rest are holes. Esri puts *every* ring of a multipolygon in the same array and
 * tells them apart by winding: outer rings run clockwise, holes run
 * anticlockwise. Read as GeoJSON, a county with three islands imports as one
 * island and two dropped holes.
 *
 * **It carries its own coordinate system.** `spatialReference.wkid` is usually
 * 4326, often 102100, and occasionally a national grid — and the last of those is
 * the one worth naming out loud rather than dropping vertex by vertex.
 */

export type EsriProjection = Projection | { unsupported: number };

/** Geographic, near enough: NAD83 differs from WGS84 by about a metre. */
const GEOGRAPHIC = new Set([4326, 4269, 4267]);
/** Web Mercator, under all four ids Esri and the web have used for it. */
const MERCATOR = new Set([3857, 102100, 102113, 900913]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether this node is an Esri geometry rather than a GeoJSON one. */
export function isEsriGeometry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.type === "string") return false;

  return (
    Array.isArray(value.rings) ||
    Array.isArray(value.paths) ||
    Array.isArray(value.points) ||
    (typeof value.x === "number" && typeof value.y === "number")
  );
}

/**
 * The coordinate system a document or a geometry declares.
 *
 * Null when it declares none, which is common and means "assume the default" —
 * and the default for a file with no `spatialReference` is whatever the numbers
 * themselves say, so the caller falls back to `detectProjection`.
 */
export function readEsriProjection(value: unknown): EsriProjection | null {
  if (!isRecord(value)) return null;

  const reference = value.spatialReference;
  if (!isRecord(reference)) return null;

  const wkid = reference.latestWkid ?? reference.wkid;
  if (typeof wkid !== "number") return null;

  if (GEOGRAPHIC.has(wkid)) return "wgs84";
  if (MERCATOR.has(wkid)) return "webmercator";

  return { unsupported: wkid };
}

export type EsriGeometry = {
  geometry: { type: string; coordinates: unknown };
  /** Interior rings we cannot draw, counted for the preview. */
  holes: number;
};

/**
 * One Esri geometry → a GeoJSON-shaped one.
 *
 * Emitted as MultiPolygon / MultiLineString even for a single ring, because the
 * caller fans those out into one shape each and that is exactly the behaviour
 * `rings` needs.
 */
export function readEsriGeometry(value: unknown): EsriGeometry | null {
  if (!isRecord(value)) return null;

  if (Array.isArray(value.rings)) {
    const outers: unknown[] = [];
    let holes = 0;

    for (const ring of value.rings) {
      if (!Array.isArray(ring) || ring.length < 3) continue;

      // Clockwise is Esri's outer ring. Anticlockwise is a hole, and our geometry
      // has nowhere to put one — counted here so the preview can say a lake is
      // about to fill in.
      if (isClockwise(ring)) outers.push([ring]);
      else holes += 1;
    }

    /*
     * Every ring anticlockwise means the file is wound the other way round —
     * which happens to anything that has been reprojected by a tool that did not
     * care, and to anything written by hand. Read strictly, the whole layer
     * would be holes with nothing to punch them in, and the import would report
     * no shapes in a file full of them. So a document with no outer ring at all
     * is read as a document where every ring is one.
     */
    if (outers.length === 0) {
      const all = value.rings.filter(
        (ring): ring is unknown[] => Array.isArray(ring) && ring.length >= 3,
      );

      if (all.length === 0) return null;

      return {
        geometry: { type: "MultiPolygon", coordinates: all.map((ring) => [ring]) },
        holes: 0,
      };
    }

    return { geometry: { type: "MultiPolygon", coordinates: outers }, holes };
  }

  if (Array.isArray(value.paths)) {
    return {
      geometry: { type: "MultiLineString", coordinates: value.paths },
      holes: 0,
    };
  }

  if (Array.isArray(value.points)) {
    return { geometry: { type: "MultiPoint", coordinates: value.points }, holes: 0 };
  }

  if (typeof value.x === "number" && typeof value.y === "number") {
    return {
      geometry: { type: "Point", coordinates: [value.x, value.y] },
      holes: 0,
    };
  }

  return null;
}

/**
 * The shoelace sign, read in the file's own coordinate units.
 *
 * Only the sign is wanted, so nothing is scaled or projected first: winding does
 * not change under a positive scale, and metres and degrees agree about which way
 * round a ring goes.
 */
function isClockwise(ring: readonly unknown[]): boolean {
  let twiceArea = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];

    if (!Array.isArray(current) || !Array.isArray(next)) continue;
    if (typeof current[0] !== "number" || typeof current[1] !== "number") continue;
    if (typeof next[0] !== "number" || typeof next[1] !== "number") continue;

    twiceArea += current[0] * next[1] - next[0] * current[1];
  }

  return twiceArea < 0;
}

export type EsriFeature = {
  geometry: unknown;
  properties: Record<string, unknown> | null;
};

/**
 * A FeatureSet — what a query endpoint returns — into features.
 *
 * Esri calls the property bag `attributes`; everything else about the shape of
 * the document is close enough to a FeatureCollection that the caller can treat
 * the result the same way.
 */
export function readEsriFeatureSet(value: unknown): EsriFeature[] | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.features)) return null;

  // `geometryType` is Esri's own marker and the only thing separating this from a
  // GeoJSON FeatureCollection, which also has `features`.
  const declared = typeof value.geometryType === "string";
  const features: EsriFeature[] = [];

  for (const feature of value.features) {
    if (!isRecord(feature)) continue;
    if (!declared && !isEsriGeometry(feature.geometry)) return null;

    features.push({
      geometry: feature.geometry,
      properties: isRecord(feature.attributes) ? feature.attributes : null,
    });
  }

  return features.length > 0 ? features : null;
}
