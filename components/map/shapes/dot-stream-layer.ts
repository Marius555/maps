"use client";

import type * as GeoJSON from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

import type { DotRun } from "@/lib/map/dot-lanes";
import {
  dotStream,
  dotView,
  type DotBounds,
  type DotView,
} from "@/packages/shared/dot-stream";

/**
 * The shared dotted stretches as points, for `SHAPE_DOT_STREAM_LAYER`.
 *
 * One MultiPoint per route per stretch, holding that route's turns: every
 * `lanes`-th dot, starting at its lane. It wears the route's id, colour and
 * selection, so a click on one of its dots selects the right route and a
 * selected route's dots thicken with the rest of it. See
 * packages/shared/dot-stream.ts for where the dots go and why they are placed
 * here rather than by MapLibre.
 */
export function dotStreamFeatures(
  runs: readonly DotRun[],
  /** The route each run belongs to, as it is drawn right now. */
  owners: ReadonlyMap<string, { color: string; selected: boolean }>,
  view: DotView,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: runs.flatMap((run) => {
      const owner = owners.get(run.id);
      if (!owner || run.stroke !== "dotted" || run.lanes < 2) return [];

      return [
        {
          type: "Feature" as const,
          geometry: {
            type: "MultiPoint" as const,
            coordinates: dotStream(
              run.points,
              run.width,
              run.lane,
              run.lanes,
              view.level,
              view.box,
            ),
          },
          properties: {
            id: run.id,
            color: owner.color,
            selected: owner.selected,
            width: run.width,
          },
        },
      ];
    }),
  };
}

/** Whether any run here is drawn by the stream layer at all. */
export function hasDotStream(runs: readonly DotRun[]): boolean {
  return runs.some((run) => run.stroke === "dotted" && run.lanes > 1);
}

/** What the map is showing, in the form packages/shared/dot-stream.ts takes. */
export function mapBounds(map: MapLibreMap): DotBounds {
  const bounds = map.getBounds();
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/** The view to place dots for, from the map as it is now. */
export function mapDotView(map: MapLibreMap): DotView {
  return dotView(mapBounds(map), map.getZoom());
}
