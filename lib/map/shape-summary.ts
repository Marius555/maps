import {
  formatDistanceM,
  formatDuration,
  pathLengthM,
} from "@/packages/shared/geo";
import type { ShapeGeometry } from "@/packages/shared/shapes";

/**
 * What a shape is, in a phrase: "Circle · 2.4 km radius", "Polygon · 8 points",
 * "Line · 463 km", "Route · 463 km · 6 h 12 min".
 *
 * The card and the sidebar row both print it, from here, so the two cannot end up
 * describing the same shape differently.
 *
 * A line is measured rather than counted, and that is the one asymmetry worth
 * defending. How many corners a boundary has is a fact about how it was drawn; how
 * long a line is is the thing it was drawn to say. "Line · 4 points" would answer
 * a question nobody asked.
 */
export function shapeSummary(geometry: ShapeGeometry): string {
  if (geometry.kind === "circle") {
    return `Circle · ${formatRadius(geometry.radius)} radius`;
  }

  if (geometry.kind === "line") {
    const length = formatDistanceM(pathLengthM(geometry.points));

    // A route leads with what it is and adds the drive. "Line · 463 km" is true
    // of a route too, and useless — the whole difference between the two is that
    // one of them follows roads, and the travel time is the only part of the
    // summary that could not also describe a straight line drawn by hand.
    return geometry.route
      ? `Route · ${length} · ${formatDuration(geometry.route.durationS)}`
      : `Line · ${length}`;
  }

  const count = geometry.points.length;
  return `Polygon · ${count} ${count === 1 ? "point" : "points"}`;
}

/**
 * A radius in the unit a person would say it in.
 *
 * Metres below a kilometre, kilometres above — and one decimal place at most,
 * because "2.4 km" is the answer and "2.437 km" is a measurement nobody asked
 * for. Metric only for now; an imperial option is a settings question, not a
 * formatting one.
 */
export function formatRadius(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;

  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
