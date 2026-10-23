import { memo, useMemo } from "react";

import { landDots, type DotGridName } from "@/lib/marketing/world-dots";

import type { FlatView } from "./flat-view";

/**
 * A grid's land drawn as dots, in a flat view's own units — an SVG `<g>` to
 * drop inside the map's `<svg>`.
 *
 * **One `<path>`, not a `<circle>` per dot.** The landing page draws this five
 * times, and as circles it was ~6,500 of the page's ~8,300 elements: Lighthouse
 * put most of a 1.3 s Total Blocking Time on styling and repainting them while
 * the map's entrance played. Each dot is a circle subpath (two half-arcs), so
 * the picture is the same and the tint still comes from `currentColor`.
 *
 * Memoised: thousands of dots that never change are worth not re-rendering
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
  const d = useMemo(() => {
    const arc = `a${radius} ${radius} 0 1 0 ${2 * radius} 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0`;
    return landDots(grid)
      .map((dot) => view.project(dot))
      .filter((p) => p.x >= -radius && p.x <= view.width + radius && p.y >= -radius && p.y <= view.height + radius)
      .map((p) => `M${(p.x - radius).toFixed(1)} ${p.y.toFixed(1)}${arc}`)
      .join("");
  }, [grid, view, radius]);

  return (
    <g className={className} fill="currentColor">
      <path d={d} />
    </g>
  );
});
