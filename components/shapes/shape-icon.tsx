import { Circle, Pentagon } from "lucide-react";

import type { ShapeGeometry } from "@/packages/shared/shapes";

/**
 * What a shape is, as a silhouette.
 *
 * A row used to identify itself with a filled dot, which said "shape" and nothing
 * else — a circle and a polygon drew the same swatch, so the only thing telling
 * them apart was the line of text underneath. Outlined and dashed, in the shape's
 * own colour, the swatch says *which kind* before anything is read, and it does it
 * the way the thing on the map looks: an area is an outline around nothing, not a
 * solid lozenge.
 *
 * The same `Circle` and `Pentagon` the drawing tools use
 * (components/map/shapes/shape-tools-button.tsx), so the row and the tool that
 * made it are drawn from one vocabulary. lucide strokes with `currentColor`, and
 * `stroke-dasharray` on the `<svg>` is inherited by the paths inside it, so both
 * ride in as ordinary props.
 */
export function ShapeIcon({
  geometry,
  color,
  className = "size-4 shrink-0",
}: {
  geometry: ShapeGeometry;
  /** What the shape is actually painted on the map — a group's colour, or its own. */
  color: string;
  className?: string;
}) {
  const Glyph = geometry.kind === "circle" ? Circle : Pentagon;

  return (
    <Glyph
      aria-hidden="true"
      className={className}
      style={{ color }}
      /* Short dashes: at 16px a longer pattern puts two gaps on a circle and
         reads as a broken ring rather than a dashed one. */
      strokeDasharray="3 2.5"
    />
  );
}
