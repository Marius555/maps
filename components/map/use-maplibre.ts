"use client";

// MapLibre v6 is ESM with named exports — there is no default export.
import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { ATTRIBUTION_HTML, STYLE_URLS, type MapStyleKey } from "@/lib/map/style";

type Options = {
  center: { lng: number; lat: number };
  zoom: number;
  style: MapStyleKey;
};

/**
 * Owns one MapLibre instance for the lifetime of the container.
 *
 * StrictMode double-invokes effects in development, so create and destroy must
 * be symmetric — otherwise you get two canvases and a leaked WebGL context.
 */
export function useMaplibre(
  container: React.RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Read once at creation. Changing the initial view later would yank the map
  // out from under someone mid-pan.
  const initial = useRef(options);

  useEffect(() => {
    const element = container.current;
    if (!element || mapRef.current) return;

    const map = new MapLibreMap({
      container: element,
      style: STYLE_URLS[initial.current.style],
      center: [initial.current.center.lng, initial.current.center.lat],
      zoom: initial.current.zoom,
      // MapLibre defaults antialias to false, which leaves every road casing,
      // building edge and diagonal label looking jagged. Vector basemaps are
      // almost all diagonal geometry, so this is the single biggest visual win
      // available and costs one MSAA pass on hardware that already has it.
      canvasContextAttributes: { antialias: true },
      // OpenStreetMap and tile-provider credit must be visible on every rendered
      // map (CLAUDE.md §12). compact:false keeps it expanded at any width.
      attributionControl: {
        compact: false,
        customAttribution: ATTRIBUTION_HTML,
      },
    });

    map.addControl(new NavigationControl(), "top-right");
    map.on("load", () => setIsReady(true));

    // MapLibre reports tile, style and worker failures through this event and
    // nowhere else — without it, a broken basemap is silent.
    map.on("error", (event) => console.error("[maplibre]", event.error));

    mapRef.current = map;

    // The editor switches between a stacked and a side-by-side layout at `md`,
    // and MapLibre only re-reads its container size when told to.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(element);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setIsReady(false);
    };
  }, [container]);

  return { map: mapRef, isReady };
}
