import type { RouteResult } from "@/lib/routing/types";
import type { LineGeometry, RouteProfile, RouteStop } from "@/packages/shared/shapes";

/**
 * The engine's answer and the stops it was asked about, as one saveable line.
 *
 * Pure and here rather than inside the hook, because it is the whole of what
 * "a route" means as data and it is worth holding to a test: the points are the
 * engine's, the stops are ours, and `from`/`to` are derived from the stops
 * rather than stored twice.
 *
 * Those two are not redundant even though `stops` contains them. Every existing
 * reader of a line — the sidebar, the drag handles, the endpoint resolver — knows
 * about `from` and `to` and knows nothing about routes, and keeping them correct
 * is what lets a route be a line everywhere else in the app rather than a second
 * kind of thing. They are written from the stops at the one moment the route is
 * built, which is the only moment they could disagree.
 */
export function toRoutedLine(
  stops: readonly RouteStop[],
  profile: RouteProfile,
  result: RouteResult,
): LineGeometry {
  const first = stops[0];
  const last = stops[stops.length - 1];

  return {
    kind: "line",
    // The engine's geometry, already thinned to fit the snapshot's point cap.
    points: result.points,
    ...(first?.placeId ? { from: first.placeId } : {}),
    ...(last?.placeId ? { to: last.placeId } : {}),
    route: {
      profile,
      stops: [...stops],
      durationS: result.durationS,
    },
  };
}
