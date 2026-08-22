import { formatDistanceM, pathLengthM } from "@/packages/shared/geo";
import type { ShapeGeometry } from "@/packages/shared/shapes";

/**
 * What a shape is, in a phrase: "Circle · 2.4 km radius", "Polygon · 8 points",
 * "Line · 463 km".
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
    return `Line · ${formatDistanceM(pathLengthM(geometry.points))}`;
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
