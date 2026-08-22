import { simplifyToFit } from "@/lib/import/simplify";
import { ImportSourceError } from "@/lib/import/sources/types";
import { CATEGORY_COLORS } from "@/lib/validation/category.schema";
import {
  DEFAULT_SHAPE_OPACITY,
  MAX_POLYGON_POINTS,
} from "@/lib/validation/shape.schema";
import {
  MIN_LINE_POINTS,
  MIN_POLYGON_POINTS,
  type ShapeGeometry,
} from "@/packages/shared/shapes";
import { circleFromRing, declaresCircle, isDrawableRadius, readRadius } from "./circle";
import {
  decideAxis,
  detectProjection,
  toLngLat,
  type Axis,
  type Projection,
  type RawRing,
} from "./positions";
import { readProperties } from "./properties";
import { scanShapes, type Candidate, type Dialect, type RawPart } from "./scan";

/**
 * A file of geometry → shapes ready to confirm.
 *
 * Deliberately *not* part of the places import wizard. That pipeline turns every
 * source into one `SourceTable` — a rectangular grid of strings — and then spends
 * two steps asking which column is the address and geocoding it. A polygon ring
 * is not a cell, and geometry needs no geocoding: it already knows where it is.
 * Bending the wizard around that would make its step machine, its store and its
 * confirm step all bimodal, which is exactly what `SourceTable` exists to
 * prevent. So this is a file, a preview and a button.
 *
 * Pure, and free of React and the network, so every branch below can be tested
 * against the malformed files people actually have.
 *
 * **One shape per outline.** A `PolygonGeometry` is a single outer ring, so a
 * FeatureCollection of thirteen provinces physically cannot be one shape — and
 * neither can a MultiPolygon of an archipelago. Both fan out.
 *
 * **Holes are dropped.** GeoJSON's second and later rings are holes; our geometry
 * has nowhere to put them. Counted rather than silently discarded, so the preview
 * can say a lake inside a county is about to fill in.
 *
 * The reading itself is four files deep and each one has its own header:
 * ./scan.ts finds the geometry whatever it is wrapped in, ./positions.ts decides
 * the axis order and the projection once for the whole file, ./circle.ts turns
 * the two ways a circle gets written down back into a circle, and
 * ./properties.ts reads the name, colour and description the file already
 * carried.
 */

/** What the file picker accepts, and what a drop is tested against. */
export const SHAPE_FILE_EXTENSIONS = [".geojson", ".json", ".topojson"] as const;
export const SHAPE_FILE_ACCEPT = SHAPE_FILE_EXTENSIONS.join(",");

export type DraftShape = {
  name: string;
  geometry: ShapeGeometry;
  color: string;
  opacity: number;
  description?: string;
  /** Points before simplification, when it ran. Null when the ring was untouched. */
  simplifiedFrom: number | null;
};

/** Why a feature in the file did not become a shape. */
export type SkipReason =
  /** A point with no radius: a location, and locations have their own importer. */
  | "location"
  /** A radius outside what a circle may be — zero, negative, or half the planet. */
  | "radius"
  /** Fewer corners than the smallest drawable shape of its kind. */
  | "too-few-points";

export type Skipped = { label: string; reason: SkipReason };

export type ShapeImport = {
  shapes: DraftShape[];
  skipped: Skipped[];
  /** How many shapes lost interior rings. */
  holesDropped: number;
  /** Round polygons read back as circles, so the preview can say so. */
  circlesDetected: number;
  /** Shapes that took their colour from the file rather than from our palette. */
  styled: number;
  /** What the file turned out to be, for one line of copy. */
  dialect: Dialect;
  axis: Axis;
  /** True when nothing in the file could settle the axis and we took the spec's. */
  axisAmbiguous: boolean;
  /** Set when coordinates had to be converted out of a projection. */
  unprojected: "webmercator" | null;
};

export type ParseOptions = {
  /** Overrides the vote. What the preview's "latitude first" switch passes back. */
  axis?: Axis;
};

export function parseShapeFile(text: string, options: ParseOptions = {}): ShapeImport {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportSourceError(
      "That file isn't valid JSON. Open it in a text editor and check it starts with a { or a [.",
    );
  }

  const scan = scanShapes(parsed);

  if (scan.candidates.length === 0) {
    throw new ImportSourceError(
      "We couldn't find any shapes in that file. It needs areas, lines or circles — " +
        "GeoJSON, TopoJSON and ArcGIS JSON all work.",
    );
  }

  const rings = everyRing(scan.candidates);
  const { axis, ambiguous } = decideAxis(rings, {
    forced: options.axis,
    spec: scan.spec,
  });
  const projection = resolveProjection(scan.projection, rings);

  const shapes: DraftShape[] = [];
  const skipped: Skipped[] = [];
  let holesDropped = 0;
  let circlesDetected = 0;
  let styled = 0;

  for (const candidate of scan.candidates) {
    const properties = readProperties(candidate.properties);
    const radius = readRadius(candidate.properties);
    const wantsCircle = declaresCircle(candidate.properties);
    const label = properties.name;

    candidate.parts.forEach((part, index) => {
      if (part.kind === "polygon") holesDropped += part.holes;

      const built = toGeometry(part, {
        axis,
        projection,
        radius,
        wantsCircle,
      });

      if ("reason" in built) {
        skipped.push({ label: label ?? "Unnamed feature", reason: built.reason });
        return;
      }

      if (built.fromRing) circlesDetected += 1;
      if (properties.color) styled += 1;

      shapes.push({
        name: partName(label, index, candidate.parts.length, shapes.length),
        geometry: built.geometry,
        // A colour the file already chose beats the palette: a styled export has
        // an opinion, and replacing it is discarding work someone did.
        color: properties.color ?? CATEGORY_COLORS[shapes.length % CATEGORY_COLORS.length],
        opacity: properties.opacity ?? DEFAULT_SHAPE_OPACITY,
        ...(properties.description ? { description: properties.description } : {}),
        simplifiedFrom: built.simplifiedFrom,
      });
    });
  }

  if (shapes.length === 0) throw emptyError(skipped);

  return {
    shapes,
    skipped,
    holesDropped,
    circlesDetected,
    styled,
    dialect: scan.dialect,
    axis,
    axisAmbiguous: ambiguous,
    unprojected: projection === "webmercator" ? "webmercator" : null,
  };
}

type Built =
  | { geometry: ShapeGeometry; simplifiedFrom: number | null; fromRing: boolean }
  | { reason: SkipReason };

/**
 * One part → the geometry we will save, or the reason we cannot.
 *
 * The circle check runs before simplification and before the polygon is accepted
 * as a polygon, because a 64-gon that is really a circle should never reach the
 * simplifier: three numbers beat five hundred points, and the ring the renderer
 * draws from them is the ring the file had.
 */
function toGeometry(
  part: RawPart,
  context: {
    axis: Axis;
    projection: Projection;
    radius: number | null;
    wantsCircle: boolean;
  },
): Built {
  if (part.kind === "point") {
    const [point] = toLngLat([part.position], context.axis, context.projection);
    if (!point) return { reason: "too-few-points" };

    // A point with no radius is a location. It is not a failure and it is not
    // ours — the message the preview shows points at the Locations tab.
    if (context.radius === null) {
      return { reason: context.wantsCircle ? "radius" : "location" };
    }
    if (!isDrawableRadius(context.radius)) return { reason: "radius" };

    return {
      geometry: {
        kind: "circle",
        lng: point[0],
        lat: point[1],
        radius: context.radius,
      },
      simplifiedFrom: null,
      fromRing: false,
    };
  }

  const points = toLngLat(part.ring, context.axis, context.projection);
  const floor = part.kind === "line" ? MIN_LINE_POINTS : MIN_POLYGON_POINTS;

  if (points.length < floor) return { reason: "too-few-points" };

  if (part.kind === "polygon") {
    const circle = circleFromRing(points);
    if (circle) return { geometry: circle, simplifiedFrom: null, fromRing: true };
  }

  const simplified = simplifyToFit(points, MAX_POLYGON_POINTS);

  /*
   * Simplifying can only drop a ring below the floor if it was degenerate to
   * begin with — every point in the same place. Checked rather than assumed,
   * because a shape that fails the server's schema fails the whole chunk it
   * travelled in, not just itself.
   */
  if (simplified.points.length < floor) return { reason: "too-few-points" };

  return {
    geometry:
      part.kind === "line"
        ? { kind: "line", points: simplified.points }
        : { kind: "polygon", points: simplified.points },
    simplifiedFrom: simplified.simplified ? simplified.before : null,
    fromRing: false,
  };
}

/**
 * Every position in the file, flat, for the two decisions that have to be taken
 * across all of it at once.
 */
function everyRing(candidates: readonly Candidate[]): RawRing[] {
  const rings: RawRing[] = [];

  for (const candidate of candidates) {
    for (const part of candidate.parts) {
      rings.push(part.kind === "point" ? [part.position] : part.ring);
    }
  }

  return rings;
}

/**
 * What the numbers are in.
 *
 * A declared system wins over a guessed one — a file that says EPSG:27700 is not
 * going to be talked out of it by its coordinates happening to fit inside Web
 * Mercator's bounds. Either way, "not degrees and not something we can convert"
 * is a sentence rather than a silent drop: the old reader binned every vertex as
 * out-of-range and then reported that none of the shapes had enough points, which
 * is true and useless.
 */
function resolveProjection(
  declared: ReturnType<typeof scanShapes>["projection"],
  rings: readonly RawRing[],
): Projection {
  if (declared && typeof declared === "object") {
    throw new ImportSourceError(
      `Those coordinates aren't latitude and longitude — the file says EPSG:${declared.unsupported}. ` +
        "Re-export it as WGS84 (EPSG:4326) and try again.",
    );
  }

  if (declared) return declared;

  const detected = detectProjection(rings);

  if (!detected) {
    throw new ImportSourceError(
      "Those coordinates aren't latitude and longitude — they look like a projected grid. " +
        "Re-export the file as WGS84 (EPSG:4326) and try again.",
    );
  }

  return detected;
}

/**
 * The error for a file we read but could draw nothing from.
 *
 * Split by what was actually in it, because "a file of points" and "a file of
 * broken rings" are different mistakes with different fixes, and one sentence
 * covering both tells the reader nothing about either.
 */
function emptyError(skipped: readonly Skipped[]): ImportSourceError {
  const locations = skipped.filter((entry) => entry.reason === "location").length;

  if (locations === skipped.length && locations > 0) {
    return new ImportSourceError(
      `That file has ${locations === 1 ? "one point" : `${locations} points`} in it and no areas or lines. ` +
        "Points are locations — import them from the Locations tab instead.",
    );
  }

  return new ImportSourceError(
    "We found shapes in that file but none of them had enough points to draw. Check the coordinates.",
  );
}

function partName(
  label: string | null,
  index: number,
  total: number,
  ordinal: number,
): string {
  const base = label ?? `Area ${ordinal + 1}`;
  // A MultiPolygon's parts share one name, so they are numbered — otherwise an
  // archipelago imports as nine identical rows nobody can tell apart.
  const named = total > 1 ? `${base} ${index + 1}` : base;

  // The column is varchar(128), and a name that overflows it fails the insert
  // for the whole chunk rather than just itself.
  return named.slice(0, 128);
}

/*
 * Re-exported so the dialog can name the axis it is asking for without
 * reaching past this module into ./positions.ts — the folder has one door.
 */
export type { Axis } from "./positions";
export type { Dialect } from "./scan";
