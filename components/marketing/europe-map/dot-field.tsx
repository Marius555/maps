import { memo, useMemo } from "react";

import { landDots, type DotGridName } from "@/lib/marketing/world-dots";

import type { FlatView } from "./flat-view";

/**
 * A grid's land drawn as dots, in a flat view's own units — an SVG `<g>` to
 * drop inside the map's `<svg>`.
 *
 * Memoised: thousands of circles that never change are worth not re-rendering
 * every time something animating over them sets state.
 */
export const DotField = memo(function DotField({
  grid,
  view,
  radius,
  className,
}: {
  grid: DotGridName;
  view: FlatView;
  /** In view units. */
  radius: number;
  className?: string;
}) {
  const dots = useMemo(
    () =>
      landDots(grid)
        .map((dot) => view.project(dot))
        .filter((p) => p.x >= -radius && p.x <= view.width + radius && p.y >= -radius && p.y <= view.height + radius),
    [grid, view, radius],
  );

  return (
    <g className={className} fill="currentColor">
      {dots.map((p, i) => (
        <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={radius} />
      ))}
    </g>
  );
});
