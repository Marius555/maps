/**
 * TopoJSON → plain GeoJSON geometries.
 *
 * TopoJSON is what a boundary file looks like once someone has cared about its
 * size: every border between two countries is stored **once**, as an arc, and
 * each country is a list of arc indices — which is why the world at full detail
 * is a few hundred kilobytes rather than several megabytes. It is the default
 * output of `mapshaper` and the format almost every "countries.json" and
 * "us-states.json" on the internet is in.
 *
 * Nothing downstream needs to know about any of that, so this decodes to the
 * geometries the rest of the reader already understands and stops there. Three
 * things have to be got right, and all three are silent when wrong:
 *
 * - **Quantisation.** With a `transform`, every position is a *delta* from the
 *   one before it in integer grid units. Read absolutely, a country comes out as
 *   a tangle a few metres across near null island.
 * - **Negative indices.** `~i` — so `-1` means arc 0 reversed, not arc -1. Get
 *   this wrong and rings fail to close, which MapLibre renders as nothing at all.
 * - **Shared endpoints.** Consecutive arcs repeat the point they meet at, so each
 *   arc after the first contributes all but its first position.
 */

type Position = [number, number];

type Transform = { scale: [number, number]; translate: [number, number] };

/** A decoded geometry, in the shape `scan.ts` already reads. */
export type TopoFeature = {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown> | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isTopology(value: unknown): boolean {
  return isRecord(value) && value.type === "Topology" && Array.isArray(value.arcs);
}

/**
 * The whole document → its features. Empty when there is nothing drawable in it,
 * which the caller turns into the same "no shapes in that file" it would give
 * any other empty source.
 */
export function readTopology(document: Record<string, unknown>): TopoFeature[] {
  const arcs = decodeArcs(document.arcs, readTransform(document.transform));
  const objects = isRecord(document.objects) ? Object.values(document.objects) : [];

  const features: TopoFeature[] = [];
  for (const object of objects) collect(object, arcs, features);

  return features;
}

function readTransform(value: unknown): Transform | null {
  if (!isRecord(value)) return null;

  const scale = pair(value.scale);
  const translate = pair(value.translate);

  return scale && translate ? { scale, translate } : null;
}

function pair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  if (typeof value[0] !== "number" || typeof value[1] !== "number") return null;

  return [value[0], value[1]];
}

/**
 * Every arc, with the deltas summed and the grid mapped back onto degrees.
 *
 * Done once for the document rather than per geometry: an arc is shared by every
 * shape that borders along it, and decoding it again for each of them is the
 * saving TopoJSON exists to make, thrown away.
 */
function decodeArcs(value: unknown, transform: Transform | null): Position[][] {
  if (!Array.isArray(value)) return [];

  return value.map((arc) => {
    if (!Array.isArray(arc)) return [];

    const points: Position[] = [];
    let x = 0;
    let y = 0;

    for (const entry of arc) {
      const position = pair(entry);
      if (!position) continue;

      if (transform) {
        // Quantised: integer deltas along the grid, absolute only once summed.
        x += position[0];
        y += position[1];
        points.push([
          x * transform.scale[0] + transform.translate[0],
          y * transform.scale[1] + transform.translate[1],
        ]);
      } else {
        points.push(position);
      }
    }

    return points;
  });
}

/** One arc index → its positions, reversed when the index is negative. */
function arcAt(index: number, arcs: Position[][]): Position[] {
  const arc = index < 0 ? arcs[~index] : arcs[index];
  if (!arc) return [];

  return index < 0 ? [...arc].reverse() : arc;
}

/** A list of arc indices → one continuous line, without the doubled joins. */
function stitch(indices: unknown, arcs: Position[][]): Position[] {
  if (!Array.isArray(indices)) return [];

  const points: Position[] = [];

  for (const index of indices) {
    if (typeof index !== "number") continue;

    const arc = arcAt(index, arcs);
    // The first position of every arc after the first is the last position of
    // the one before it — the join, stored twice by design.
    points.push(...(points.length === 0 ? arc : arc.slice(1)));
  }

  return points;
}

function stitchRings(rings: unknown, arcs: Position[][]): Position[][] {
  if (!Array.isArray(rings)) return [];

  return rings.map((ring) => stitch(ring, arcs)).filter((ring) => ring.length > 0);
}

function collect(
  object: unknown,
  arcs: Position[][],
  into: TopoFeature[],
  inherited: Record<string, unknown> | null = null,
): void {
  if (!isRecord(object)) return;

  const properties = isRecord(object.properties) ? object.properties : inherited;

  if (object.type === "GeometryCollection") {
    if (!Array.isArray(object.geometries)) return;
    for (const inner of object.geometries) collect(inner, arcs, into, properties);
    return;
  }

  const coordinates = coordinatesOf(object, arcs);
  if (coordinates === null) return;

  into.push({
    geometry: { type: String(object.type ?? ""), coordinates },
    properties,
  });
}

function coordinatesOf(
  object: Record<string, unknown>,
  arcs: Position[][],
): unknown {
  switch (object.type) {
    // Points are stored as literal coordinates rather than arcs — they have no
    // shared borders to be worth an index.
    case "Point":
    case "MultiPoint":
      return object.coordinates ?? null;

    case "LineString":
      return stitch(object.arcs, arcs);

    case "MultiLineString":
    case "Polygon":
      return stitchRings(object.arcs, arcs);

    case "MultiPolygon": {
      if (!Array.isArray(object.arcs)) return null;
      return object.arcs.map((polygon) => stitchRings(polygon, arcs));
    }

    default:
      return null;
  }
}
