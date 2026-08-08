"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { LngLatBounds, type MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import type { MapStyleKey } from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import type { Place } from "@/lib/repositories/types";
import type { Viewport } from "@/lib/stores/editor-store";
import { useMaplibre } from "./use-maplibre";
import { usePlaceMarkers } from "./use-place-markers";

// Module scope: runs once per page load however many canvases mount, which is
// what CLAUDE.md §7 asks for. Doing it in a root provider instead would drag
// MapLibre into the initial dashboard bundle.
registerPmtilesProtocol();
// Must happen before the first Map is constructed — see lib/map/worker.ts.
configureMaplibreWorker();

export type MapCanvasProps = {
  center: { lng: number; lat: number };
  zoom: number;
  style: MapStyleKey;
  places: Place[];
  selectedPlaceId: string | null;
  isAdding: boolean;
  /**
   * Frame every pin on first load, instead of honouring center/zoom. For the
   * import review, where the whole point is seeing where everything landed —
   * an import spanning a country would otherwise open on one city.
   */
  fitToPlaces?: boolean;
  colorFor?: (place: Place) => string | undefined;
  onSelectPlace: (placeId: string) => void;
  onMapClick: (coords: { lng: number; lat: number }) => void;
  /** Omit to make pins fixed. Supplying it is what enables dragging. */
  onMovePlace?: (placeId: string, coords: { lng: number; lat: number }) => void;
  /** Hands the parent a reader for the live viewport, for "add at centre" and
   *  "save this view". A snapshot prop would be stale the moment the user pans. */
  onReady?: (readViewport: () => Viewport) => void;
};

export default function MapCanvasImpl({
  center,
  zoom,
  style,
  places,
  selectedPlaceId,
  isAdding,
  fitToPlaces,
  colorFor,
  onSelectPlace,
  onMapClick,
  onMovePlace,
  onReady,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const { map, isReady } = useMaplibre(container, { center, zoom, style });

  usePlaceMarkers({
    map,
    isReady,
    places,
    selectedPlaceId,
    colorFor,
    onSelect: onSelectPlace,
    onMove: onMovePlace,
  });

  // Latest handler and mode without re-binding the map listener on every render.
  // Assigned in an effect, not during render — refs are not render output.
  const clickHandler = useRef(onMapClick);
  const addingRef = useRef(isAdding);

  useEffect(() => {
    clickHandler.current = onMapClick;
    addingRef.current = isAdding;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const handleClick = (event: MapMouseEvent) => {
      if (!addingRef.current) return;
      clickHandler.current({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };

    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
  }, [map, isReady]);

  /**
   * Fit once, not on every places change: refitting would yank the view back
   * every time a pin is dragged, which is exactly when the user is looking at it.
   */
  const hasFitted = useRef(false);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !fitToPlaces) return;
    if (hasFitted.current || places.length === 0) return;

    hasFitted.current = true;

    const bounds = new LngLatBounds();
    for (const place of places) bounds.extend([place.lng, place.lat]);

    instance.fitBounds(bounds, {
      padding: 48,
      // A single pin has zero-area bounds, which would zoom to maximum.
      maxZoom: 14,
      animate: false,
    });
  }, [map, isReady, fitToPlaces, places]);

  useEffect(() => {
    if (!isReady || !onReady) return;

    onReady(() => {
      const instance = map.current;
      if (!instance) return { ...center, zoom };

      const centre = instance.getCenter();
      return { lng: centre.lng, lat: centre.lat, zoom: instance.getZoom() };
    });
  }, [isReady, onReady, map, center, zoom]);

  return (
    <div
      ref={container}
      className={`h-full w-full ${isAdding ? "cursor-crosshair" : ""}`}
    />
  );
}
