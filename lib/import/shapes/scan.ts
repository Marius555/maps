import { normalizeHeader } from "@/lib/import/detect/normalize";
import { readRadius } from "./circle";
import {
  isEsriGeometry,
  readEsriFeatureSet,
  readEsriGeometry,
  readEsriProjection,
  type EsriProjection,
} from "./esri";
import {
  harvestRings,
  isBarePosition,
  isClosed,
  readPosition,
  type Harvest,
  type RawPosition,
  type RawRing,
} from "./positions";
import { isTopology, readTopology } from "./topojson";

/**
 * Everything in the document that could be a shape, however it is written down.
 *
 * The old reader was a grammar: it matched `FeatureCollection`, then `Feature`,
 * then a geometry `type`, and anything that did not say one of those words was a
 * file with no shapes in it. Which is how
 * `{ "zoneName": "…", "ring": [[lng, lat], …] }` — an ordinary thing to be handed
 * — came back as "we couldn't find any shapes in that file", with the shape
 * sitting right there in it.
 *
 * So this is a search rather than a grammar, and it is the same move
 * `lib/import/detect/` already makes for spreadsheets: **recognise by structure
 * and content, not by names.** A ring is a ring whether its key says
 * `coordinates`, `ring`, `boundary` or `zone_outline`, and a file whose keys are
 * all in Polish is as readable as one whose keys are in English.
 *
 * Names still get a vote where they are the only evidence — an open ring under a
 * key called `route` is a line and one called `boundary` is an area — but they
 * never decide *whether* something is a shape. Only its shape does.
 */

/** How deep, and how much, before we stop looking. A 5MB file must not hang. */
const MAX_DEPTH = 64;
const MAX_NODES = 200_000;

export type RawPart =
  | { kind: "polygon"; ring: RawRing; holes: number }
  | { kind: "line"; ring: RawRing }
  | { kind: "point"; position: RawPosition };

export type Candidate = {
  parts: RawPart[];
  properties: Record<string, unknown> | null;
};

export type Dialect = "geojson" | "topojson" | "esri" | "loose";

export type Scan = {
  candidates: Candidate[];
  dialect: Dialect;
  /** Declared by the document, when it declared one. */
  projection: EsriProjection | null;
  /** True once anything named itself GeoJSON, TopoJSON or Esri. */
  spec: boolean;
};

const GEOJSON_TYPES = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
]);

/** Keys that say "this is an area" when nothing else does. */
const AREA_KEYS = [
  "ring",
  "rings",
  "polygon",
  "boundary",
  "boundaries",
  "outline",
  "border",
  "perimeter",
  "area",
  "zone",
  "region",
  "shape",
  "geofence",
  "fence",
  "hull",
];

/** And the ones that say "this is a path". */
const LINE_KEYS = [
  "path",
  "paths",
  "line",
  "route",
  "track",
  "trace",
  "segment",
  "polyline",
  "leg",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function scanShapes(root: unknown): Scan {
  const state = {
    candidates: [] as Candidate[],
    dialect: "loose" as Dialect,
    projection: null as EsriProjection | null,
    spec: false,
    budget: { nodes: MAX_NODES },
  };

  if (isRecord(root) && isTopology(root)) {
    state.dialect = "topojson";
    state.spec = true;

    for (const feature of readTopology(root)) {
      walk(feature.geometry, feature.properties, null, 0, state);
    }

    return finish(state);
  }

  walk(root, null, null, 0, state);
  return finish(state);
}

function finish(state: {
  candidates: Candidate[];
  dialect: Dialect;
  projection: EsriProjection | null;
  spec: boolean;
}): Scan {
  return {
    candidates: state.candidates,
    dialect: state.dialect,
    projection: state.projection,
    spec: state.spec,
  };
}

type State = {
  candidates: Candidate[];
  dialect: Dialect;
  projection: EsriProjection | null;
  spec: boolean;
  budget: { nodes: number };
};

/**
 * One node, and whatever is under it.
 *
 * `bag` is the nearest property object above — a Feature's `properties`, an Esri
 * record's `attributes`, or the plain object a ring was found hanging off. `key`
 * is the name that ring was found under, and it is only ever consulted to break a
 * tie between a line and an area.
 */
function walk(
  value: unknown,
  bag: Record<string, unknown> | null,
  key: string | null,
  depth: number,
  state: State,
): void {
  if (depth > MAX_DEPTH) return;
  if (state.budget.nodes-- <= 0) return;

  if (Array.isArray(value)) {
    const harvest = asCoordinates(value, state.budget);

    if (harvest) {
      emit(harvest, bag, key, 0, state);
      return;
    }

    for (const entry of value) walk(entry, bag, key, depth + 1, state);
    return;
  }

  if (!isRecord(value)) return;

  const declared = readEsriProjection(value);
  if (declared && !state.projection) state.projection = declared;

  if (geoJson(value, bag, depth, state)) return;
  if (esri(value, bag, depth, state)) return;
  if (loose(value, depth, state)) return;

  /*
   * Descending into an untyped record, that record becomes the property bag for
   * everything under it — it is the nearest thing to a `properties` object a file
   * without one has, and it is what makes `zoneName` the name of the ring
   * alongside it.
   */
  for (const [name, entry] of Object.entries(value)) {
    walk(entry, value, name, depth + 1, state);
  }
}

/** The typed branch: a document that says what it is, taken at its word. */
function geoJson(
  value: Record<string, unknown>,
  bag: Record<string, unknown> | null,
  depth: number,
  state: State,
): boolean {
  const type = value.type;
  if (typeof type !== "string") return false;

  if (type === "FeatureCollection" && Array.isArray(value.features)) {
    state.dialect = state.dialect === "loose" ? "geojson" : state.dialect;
    state.spec = true;

    for (const feature of value.features) {
      walk(feature, bag, null, depth + 1, state);
    }

    return true;
  }

  if (type === "Feature") {
    state.dialect = state.dialect === "loose" ? "geojson" : state.dialect;
    state.spec = true;

    const properties = isRecord(value.properties) ? value.properties : bag;
    walk(value.geometry, properties, null, depth + 1, state);
    return true;
  }

  if (type === "GeometryCollection" && Array.isArray(value.geometries)) {
    state.spec = true;
    for (const inner of value.geometries) walk(inner, bag, null, depth + 1, state);
    return true;
  }

  if (!GEOJSON_TYPES.has(type)) return false;

  state.dialect = state.dialect === "loose" ? "geojson" : state.dialect;
  state.spec = true;

  const harvest = harvestRings(value.coordinates, state.budget);
  if (!harvest) return true;

  // The declared type settles the nesting, which is the one thing a bare depth
  // cannot always tell you: a Polygon's second ring is a hole, a
  // MultiLineString's second entry is another line, and both are three deep.
  switch (type) {
    case "Point":
    case "MultiPoint":
      emitPoints(harvest, bag, state);
      return true;

    case "LineString":
    case "MultiLineString":
      emitLines(harvest, bag, state);
      return true;

    case "Polygon":
      emitRings(harvest.rings, bag, state);
      return true;

    case "MultiPolygon":
      emitRingGroups(value.coordinates, bag, state);
      return true;

    default:
      return true;
  }
}

/** ArcGIS, which says what it is in a different vocabulary. */
function esri(
  value: Record<string, unknown>,
  bag: Record<string, unknown> | null,
  depth: number,
  state: State,
): boolean {
  const set = readEsriFeatureSet(value);
  if (set) {
    state.dialect = "esri";
    state.spec = true;

    for (const feature of set) {
      walk(feature.geometry, feature.properties ?? bag, null, depth + 1, state);
    }

    return true;
  }

  if (!isEsriGeometry(value)) return false;

  const read = readEsriGeometry(value);
  if (!read) return true;

  state.dialect = "esri";
  state.spec = true;

  const { geometry, holes } = read;

  if (geometry.type === "MultiPolygon") {
    emitRingGroups(geometry.coordinates, bag, state, holes);
    return true;
  }

  const harvest = harvestRings(geometry.coordinates, state.budget);
  if (!harvest) return true;

  if (geometry.type === "MultiLineString") emitLines(harvest, bag, state);
  else emitPoints(harvest, bag, state);

  return true;
}

/**
 * The branch that reads a file which never said anything: an object with a
 * coordinate-shaped value hanging off one of its keys.
 *
 * The object itself becomes the property bag, which is what makes `zoneName` the
 * name of the ring under `ring` — they are siblings, and in a file with no
 * `properties` wrapper that is the only relationship there is.
 */
function loose(
  value: Record<string, unknown>,
  depth: number,
  state: State,
): boolean {
  // An outline under a key of its own comes first: a record holding both a centre
  // and a boundary means the boundary, and reading the centre would quietly
  // replace a traced shape with a dot.
  for (const [name, entry] of Object.entries(value)) {
    const harvest = asCoordinates(entry, state.budget);
    if (!harvest) continue;

    emit(harvest, value, name, depth, state);
    return true;
  }

  /*
   * A record that *is* a position — `{ name, lat, lng, radius_km }`.
   *
   * Emitted even with no radius on it, and that is the point: index.ts turns a
   * point it cannot draw into a "location" skip, and a file made entirely of
   * those gets told it is a locations file and pointed at the importer that
   * wants it. Refusing to look would give the same file "we couldn't find any
   * shapes", which is true and helps nobody.
   */
  const own = readPosition(value);
  if (own) {
    state.candidates.push({
      parts: [{ kind: "point", position: own }],
      properties: value,
    });
    return true;
  }

  /*
   * A position under a key — `{ centre: { lat, lng }, radius: 500 }`, or the same
   * with `[lng, lat]`.
   *
   * Only when a radius sits beside it. Without that condition any record holding
   * a stray pair of numbers would be claimed as a point, and claiming it stops
   * the walk descending into whatever real shape was further down.
   */
  if (readRadius(value) === null) return false;

  for (const entry of Object.values(value)) {
    const position = readPosition(entry);
    if (!position) continue;

    state.candidates.push({
      parts: [{ kind: "point", position }],
      properties: value,
    });
    return true;
  }

  return false;
}

/**
 * A value → its positions, but only when reading it that way is safe.
 *
 * The guard is what keeps a locations file out. An array of `{ name, lat, lng }`
 * records harvests perfectly well as a ring, and reading it as one would import a
 * customer's 300 branches as a single polygon threaded through all of them. A
 * position is a bare pair, or an object that is *nothing but* a position.
 */
function asCoordinates(
  value: unknown,
  budget: { nodes: number },
): Harvest | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  for (const entry of value) {
    if (Array.isArray(entry)) continue;
    if (isBarePosition(entry)) continue;

    return null;
  }

  return harvestRings(value, budget);
}

/** An untyped harvest → parts, with its depth standing in for the missing type. */
function emit(
  harvest: Harvest,
  bag: Record<string, unknown> | null,
  key: string | null,
  depth: number,
  state: State,
): void {
  if (harvest.depth <= 1) {
    emitPoints(harvest, bag, state);
    return;
  }

  if (harvest.depth === 2) {
    const ring = harvest.rings[0] ?? [];
    if (isArea(ring, key)) emitRings([ring], bag, state);
    else emitLines(harvest, bag, state);
    return;
  }

  if (harvest.depth === 3) {
    // Every ring closed is what a Polygon with holes looks like; anything open
    // among them is a set of paths, because a path that closed would have been a
    // ring to begin with.
    if (harvest.rings.every((ring) => isClosed(ring))) {
      emitRings(harvest.rings, bag, state);
    } else {
      emitLines(harvest, bag, state);
    }
    return;
  }

  // Four deep and up: one shape per ring, holes indistinguishable from islands
  // without a type to say. Counted as shapes, which loses a lake and keeps an
  // archipelago — the trade that costs the least on real files.
  emitRings(
    harvest.rings.map((ring) => ring),
    bag,
    state,
    true,
  );
}

/**
 * Whether an untyped ring encloses something.
 *
 * Closed is conclusive: a path that ends where it started is a boundary, and
 * nobody draws a route that way. Failing that the key name decides, and failing
 * that it is a line — the safer of the two, because a line drawn as an area
 * gains a fill nobody asked for, while an area drawn as a line is still visibly
 * the right outline.
 */
function isArea(ring: RawRing, key: string | null): boolean {
  if (isClosed(ring)) return true;
  if (!key) return false;

  const folded = normalizeHeader(key);
  if (LINE_KEYS.some((name) => folded.includes(name))) return false;

  return AREA_KEYS.some((name) => folded.includes(name));
}

function emitPoints(
  harvest: Harvest,
  bag: Record<string, unknown> | null,
  state: State,
): void {
  const parts: RawPart[] = [];

  for (const ring of harvest.rings) {
    for (const position of ring) parts.push({ kind: "point", position });
  }

  if (parts.length > 0) state.candidates.push({ parts, properties: bag });
}

function emitLines(
  harvest: Harvest,
  bag: Record<string, unknown> | null,
  state: State,
): void {
  const parts: RawPart[] = harvest.rings
    .filter((ring) => ring.length > 0)
    .map((ring) => ({ kind: "line", ring }) as const);

  if (parts.length > 0) state.candidates.push({ parts, properties: bag });
}

/** Ring zero is the outside; the rest are holes, unless told otherwise. */
function emitRings(
  rings: readonly RawRing[],
  bag: Record<string, unknown> | null,
  state: State,
  allOuter = false,
  known = 0,
): void {
  const usable = rings.filter((ring) => ring.length > 0);
  if (usable.length === 0) return;

  const parts: RawPart[] = allOuter
    ? usable.map((ring) => ({ kind: "polygon", ring, holes: 0 }) as const)
    : [{ kind: "polygon", ring: usable[0], holes: usable.length - 1 + known }];

  state.candidates.push({ parts, properties: bag });
}

/** A MultiPolygon: each entry is its own polygon, with its own holes. */
function emitRingGroups(
  value: unknown,
  bag: Record<string, unknown> | null,
  state: State,
  known = 0,
): void {
  if (!Array.isArray(value)) return;

  const parts: RawPart[] = [];
  let holes = known;

  for (const polygon of value) {
    const harvest = harvestRings(polygon, state.budget);
    if (!harvest) continue;

    const rings = harvest.rings.filter((ring) => ring.length > 0);
    if (rings.length === 0) continue;

    parts.push({ kind: "polygon", ring: rings[0], holes: 0 });
    holes += rings.length - 1;
  }

  if (parts.length === 0) return;

  // The whole feature's holes ride on its first part: the count is reported per
  // file, and spreading it across parts would only make the arithmetic harder to
  // follow for no visible difference.
  const first = parts[0];
  if (first.kind === "polygon") first.holes = holes;

  state.candidates.push({ parts, properties: bag });
}
