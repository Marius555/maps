import type {
  LineRoute,
  LngLatTuple,
  ShapeGeometry,
} from "@/packages/shared/shapes";
import type { ShapeRow } from "./types";

/**
 * A shape's geometry, both ways across the database boundary.
 *
 * The two halves live together because they are one translation, and the failure
 * mode they have is a field that exists in one and not the other. Neither
 * direction is a compile error when that happens: reading falls through to a
 * default and writing is a **whitelist** — which it has to be, since the column
 * is JSON and anything spread into it is stored forever with nothing to reject
 * it. So a field added to `LineGeometry` and forgotten here type-checks, saves,
 * and reads back missing, where it looks like a rendering bug rather than a
 * storage one. That is exactly how a route lost its stops the first time one was
 * drawn.
 *
 * Split out of mappers.ts rather than left in it for one reason: that file
 * reaches storage config through `photo-url.ts`, which reads the environment at
 * module load and so cannot be imported by a test. This has no imports but the
 * shared types, which is what lets the whitelist above be held to a test at all.
 *
 * The union carries `kind` because both renderers switch on it; the row keeps it
 * in its own column so a query could filter on it one day. Splitting rather than
 * storing the union whole is what stops the two copies disagreeing.
 */

/** Row → domain. Never throws; a row we cannot read renders as an empty shape. */
export function toShapeGeometry(row: ShapeRow): ShapeGeometry {
  if (row.kind === "polygon") {
    const parsed = parseJson<{ points?: LngLatTuple[] }>(row.geometry, {});
    return { kind: "polygon", points: parsed.points ?? [] };
  }

  /*
   * Explicit, because the fall-through below is to a circle. A line decoded by
   * that path becomes a circle of radius zero — it vanishes from the map, and
   * nothing anywhere reports an error.
   *
   * Empty bonds are dropped rather than kept as "": absent is what "not bonded"
   * means everywhere else in the geometry, and one spelling is enough.
   */
  if (row.kind === "line") {
    const parsed = parseJson<{
      points?: LngLatTuple[];
      from?: string;
      to?: string;
      route?: LineRoute;
    }>(row.geometry, {});

    return {
      kind: "line",
      points: parsed.points ?? [],
      ...(parsed.from ? { from: parsed.from } : {}),
      ...(parsed.to ? { to: parsed.to } : {}),
      // Absent means hand-drawn, which is every line written before routes
      // existed — the reason routes needed no migration and no republish.
      ...(parsed.route ? { route: parsed.route } : {}),
    };
  }

  const parsed = parseJson<Partial<Extract<ShapeGeometry, { kind: "circle" }>>>(
    row.geometry,
    {},
  );

  return {
    kind: "circle",
    lng: parsed.lng ?? 0,
    lat: parsed.lat ?? 0,
    radius: parsed.radius ?? 0,
  };
}

/** Domain → the two columns a row stores it in. */
export function toShapeColumns(geometry: ShapeGeometry): {
  kind: string;
  geometry: string;
} {
  if (geometry.kind === "circle") {
    const { lng, lat, radius } = geometry;
    return { kind: "circle", geometry: JSON.stringify({ lng, lat, radius }) };
  }

  /*
   * The bonds ride along with the points because they are part of what the line
   * *is*: without them a bonded end is a stale coordinate that stops following
   * its pin the moment the page reloads. The same goes for `route` — the stops
   * are the engine's input, so a line that loses them can never be recalculated,
   * and is a route only until the page is reloaded.
   */
  if (geometry.kind === "line") {
    const { points, from, to, route } = geometry;
    return {
      kind: "line",
      geometry: JSON.stringify({
        points,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(route ? { route } : {}),
      }),
    };
  }

  return {
    kind: "polygon",
    geometry: JSON.stringify({ points: geometry.points }),
  };
}

/**
 * A JSON column, or the fallback.
 *
 * Mappers never throw: a single unreadable row would otherwise take the whole
 * list down, and a shape that draws as nothing is a far smaller failure than a
 * map that does not load.
 */
function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
