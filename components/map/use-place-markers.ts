"use client";

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { Place } from "@/lib/repositories/types";
import { createPinElement, setPinSelected } from "./pin-marker";

/**
 * Keeps the map's markers in sync with the places array by diffing, not by
 * clearing and re-adding. Re-adding would restart the drop animation on every
 * unrelated change and throw away marker DOM the browser is happy to keep.
 */
export function usePlaceMarkers({
  map,
  isReady,
  places,
  selectedPlaceId,
  colorFor,
  onSelect,
  onMove,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  places: Place[];
  selectedPlaceId: string | null;
  /** Category colour, resolved by the caller. Undefined falls back to --accent. */
  colorFor?: (place: Place) => string | undefined;
  onSelect: (placeId: string) => void;
  /** Fired once, on drop. Dragging is how a bad geocode gets corrected (§7). */
  onMove?: (placeId: string, coords: { lng: number; lat: number }) => void;
}) {
  const markers = useRef(new globalThis.Map<string, Marker>());
  // Held in refs so a new callback identity doesn't rebuild every marker.
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMove);
  const colorForRef = useRef(colorFor);
  /**
   * Markers the pointer is currently holding. A background refetch landing
   * mid-drag would otherwise call setLngLat and yank the pin out of the user's
   * hand.
   */
  const dragging = useRef(new Set<string>());

  useEffect(() => {
    onSelectRef.current = onSelect;
    onMoveRef.current = onMove;
    colorForRef.current = colorFor;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const seen = new Set<string>();

    for (const place of places) {
      seen.add(place.id);
      const existing = markers.current.get(place.id);

      if (existing) {
        const element = existing.getElement();

        if (!dragging.current.has(place.id)) {
          const { lng, lat } = existing.getLngLat();
          if (lng !== place.lng || lat !== place.lat) {
            existing.setLngLat([place.lng, place.lat]);
          }
        }

        element.setAttribute("aria-label", place.name);
        setPinColor(element, colorForRef.current?.(place));
        continue;
      }

      const element = createPinElement(place.name);
      setPinColor(element, colorForRef.current?.(place));

      // A drag ends with a mouseup on the element, which the browser then
      // reports as a click. Without this flag, dropping a pin would also
      // select it — and in add mode the map click would drop a second pin.
      let movedWhileDown = false;

      element.addEventListener("click", (event) => {
        // Without this the click falls through to the map and, in add mode,
        // drops a second pin on top of the one just clicked.
        event.stopPropagation();

        if (movedWhileDown) {
          movedWhileDown = false;
          return;
        }

        onSelectRef.current(place.id);
      });

      const marker = new Marker({ element, draggable: Boolean(onMove) })
        .setLngLat([place.lng, place.lat])
        .addTo(instance);

      marker.on("dragstart", () => {
        movedWhileDown = true;
        dragging.current.add(place.id);
        element.classList.add("map-pin--dragging");
      });

      marker.on("dragend", () => {
        dragging.current.delete(place.id);
        element.classList.remove("map-pin--dragging");

        const { lng, lat } = marker.getLngLat();
        onMoveRef.current?.(place.id, { lng, lat });
      });

      markers.current.set(place.id, marker);
    }

    for (const [id, marker] of markers.current) {
      if (seen.has(id)) continue;
      marker.remove();
      markers.current.delete(id);
      dragging.current.delete(id);
    }
  }, [map, isReady, places, onMove]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      setPinSelected(marker.getElement(), id === selectedPlaceId);
    }
  }, [selectedPlaceId, places]);

  useEffect(() => {
    const current = markers.current;
    const held = dragging.current;
    return () => {
      for (const marker of current.values()) marker.remove();
      current.clear();
      held.clear();
    };
  }, []);
}

/** Category colour as an inline custom property the pin CSS reads. */
function setPinColor(element: HTMLElement, color: string | undefined): void {
  if (color) {
    element.style.setProperty("--pin-color", color);
  } else {
    element.style.removeProperty("--pin-color");
  }
}
