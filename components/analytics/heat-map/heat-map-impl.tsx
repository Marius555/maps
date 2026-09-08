"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useRef } from "react";

import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import {
  isDarkMapStyle,
  resolveMapStyle,
  shouldDarkenStyle,
  type MapStyleKey,
} from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import { usePrefersDark } from "@/lib/theme/use-prefers-dark";
import { useMaplibre } from "@/components/map/use-maplibre";
import type { ShapeBounds } from "@/packages/shared/shapes";
import { HEAT_MAX_FIT_ZOOM, type HeatPoint } from "./heat-layers";
import { useHeatLayer } from "./use-heat-layer";

// Module scope: once per page load however many canvases mount, per CLAUDE.md §7.
registerPmtilesProtocol();
// Must happen before the first Map is constructed — see lib/map/worker.ts.
configureMaplibreWorker();

export type HeatMapProps = {
  points: HeatPoint[];
  /** The box the map opens framed on. */
  bounds: ShapeBounds | null;
  /** Fallback view for a map with nothing to frame. */
  center: { lng: number; lat: number };
  zoom: number;
  style: MapStyleKey;
  appearance?: Record<string, unknown>;
};

/**
 * A weighted density map, on the customer's own basemap.
 *
 * A small read-only canvas on `useMaplibre` rather than a reuse of
 * `map-canvas-impl.tsx`, which is bound to the editor's selection, drag-to-add,
 * shape drawing and place cards — none of which exist here. This page has no
 * interaction beyond pan and zoom, and no theme picker, so nothing ever calls
 * `setStyle` on it.
 *
 * It renders the map's *own* basemap and appearance, so the heat sits on the
 * ground the customer chose rather than on a second look invented for this page.
 *
 * **The points are whatever the caller hands it.** It drew the owner's own
 * locations when this page reported on content; it now draws either where
 * visitors were or which locations they opened, weighted by how many. The
 * component does not know or care which — it is one canvas, and the toggle above
 * it swaps the array (./heat-map.tsx).
 */
export default function HeatMapImpl({
  points,
  bounds,
  center,
  zoom,
  style,
  appearance,
}: HeatMapProps) {
  const frame = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);

  const prefersDark = usePrefersDark();

  const { map, isReady } = useMaplibre(frame, container, {
    center,
    zoom,
    bounds,
    // So the page always opens on the density map rather than on its dots.
    maxFitZoom: HEAT_MAX_FIT_ZOOM,
    style,
    appearance,
  });

  /*
   * Is the ground under the heat dark?
   *
   * Two separate ways it can be, and both have to be asked. A pinned basemap or
   * theme is dark because its author made it so, which `isDarkMapStyle` answers
   * off the theme table. Auto is dark because of who is looking — it resolves to
   * a light basemap and is inverted afterwards — which is `shouldDarkenStyle`'s
   * question and cannot be read off the key alone.
   */
  const isDarkGround =
    shouldDarkenStyle(style, prefersDark) || isDarkMapStyle(resolveMapStyle(style));

  useHeatLayer({ map, isReady, points, isDarkGround });

  /*
   * The two-element split `useMaplibre` requires: `frame` is what the layout
   * sizes and what the ResizeObserver watches, `container` is what MapLibre is
   * given.
   *
   * `overflow-hidden` on the frame rather than on whatever wraps this, because
   * between a shrink and the resize the canvas is wider than the frame.
   */
  return (
    <div
      ref={frame}
      className="relative h-full w-full overflow-hidden rounded-xl bg-surface-secondary"
    >
      <div
        ref={container}
        /*
         * `h-full`, never `absolute inset-0` — the same trap map-canvas-impl.tsx
         * documents at length. MapLibre's constructor adds `.maplibregl-map` to
         * this element and maplibre-gl.css sets `position: relative` on that
         * class, at the same specificity as Tailwind's `absolute` and injected
         * after it. MapLibre wins, `inset-0` then sizes nothing, and `height`
         * falls back to `auto` — which is *zero*, because the canvas inside is
         * itself absolutely positioned and contributes no height.
         *
         * The symptom is a full-height frame holding a 0px map, with the canvas,
         * the controls and the style all present and correct and nothing logged.
         * A percentage height does not care what `position` is.
         */
        className="h-full w-full"
      />
    </div>
  );
}
