"use client";

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { Place } from "@/lib/repositories/types";
import {
  PIN_CSS_VARS,
  pinCssVars,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";
import { createPinElement, setPinIcon, setPinSelected } from "./pin-marker";

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
  selectedPlaceIds,
  pinIcons,
  colorFor,
  onSelect,
  onMove,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  places: Place[];
  selectedPlaceId: string | null;
  /**
   * Pins picked out by the marquee or a group. They wear the same ring a clicked
   * pin does — the difference between one and many is which card opens, not how
   * the marker looks.
   */
  selectedPlaceIds?: ReadonlySet<string>;
  /** The map's own pins, for resolving a place's `custom:` icon id. */
  pinIcons?: CustomPinIcon[];
  /**
   * The pin's colour, resolved entirely by the caller. Undefined falls back to
   * --accent.
   *
   * The pin's own colour is handed *in* rather than applied here — see `paint`.
   * Memoise it: its identity is what tells this hook the colours have moved.
   */
  colorFor?: (place: Place, pinColor?: string) => string | undefined;
  onSelect: (placeId: string) => void;
  /** Fired once, on drop. Dragging is how a bad geocode gets corrected (§7). */
  onMove?: (placeId: string, coords: { lng: number; lat: number }) => void;
}) {
  const markers = useRef(new globalThis.Map<string, Marker>());
  /*
   * Held in refs because the marker's own listeners close over them once, when
   * the marker is created, and must go on calling whatever the latest render
   * passed. `colorFor` is deliberately *not* one of these: it decides what is
   * drawn rather than what happens on an event, so it belongs in the diff
   * effect's dependencies — see the note there.
   */
  const onSelectRef = useRef(onSelect);
  const onMoveRef = useRef(onMove);
  /**
   * Markers the pointer is currently holding. A background refetch landing
   * mid-drag would otherwise call setLngLat and yank the pin out of the user's
   * hand.
   */
  const dragging = useRef(new Set<string>());

  useEffect(() => {
    onSelectRef.current = onSelect;
    onMoveRef.current = onMove;
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
        paint(element, place, pinIcons, colorFor);
        continue;
      }

      const element = createPinElement(place.name);
      paint(element, place, pinIcons, colorFor);

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
    /*
     * `pinIcons` and `colorFor` are both here, and for the same reason: each of
     * them can change while the places array stays identical. A pin recoloured in
     * the studio changes the drawing; a group recoloured in its rename dialog
     * changes what every member is painted (see `colorFor` in map-editor.tsx).
     *
     * `colorFor` used to be left out and read from the ref instead, which is the
     * bug that made a group's new colour reach the sidebar dots and the shapes
     * but not the pins — those only caught up when something else happened to
     * write the places array, such as dragging one of them into the group.
     * `use-shape-layers.ts` had it right all along.
     *
     * Re-running costs nothing: the loop below diffs, so an unchanged marker is
     * repainted in place rather than rebuilt, and no drop animation restarts.
     */
  }, [map, isReady, places, pinIcons, onMove, colorFor]);

  useEffect(() => {
    for (const [id, marker] of markers.current) {
      setPinSelected(
        marker.getElement(),
        id === selectedPlaceId || (selectedPlaceIds?.has(id) ?? false),
      );
    }
  }, [selectedPlaceId, selectedPlaceIds, places]);

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

/**
 * The marker's whole appearance, in one place.
 *
 * The shape is read off the place — an icon is the location's own — and the
 * colour is decided by the caller, in full.
 *
 * It used to be decided half here: a custom pin brings its own colour, and this
 * function preferred it over whatever the resolver returned. That was the whole
 * rule while there were only two candidates, and it broke the moment there was a
 * third — a group's colour has to beat a custom pin's, and this layer had no way
 * to know that. So the pin's colour is passed *in* as one more input and the
 * resolver ranks all three (see map-editor.tsx). One place owns the order.
 *
 * A marker says shape and colour and nothing else. An approximate address is a
 * note about the *address*, not the position, so it stays on the list row and the
 * place card, where there is room to say what it means.
 */
function paint(
  element: HTMLElement,
  place: Place,
  pinIcons: CustomPinIcon[] | undefined,
  colorFor: ((place: Place, pinColor?: string) => string | undefined) | undefined,
): void {
  const pin = setPinIcon(element, place.icon, pinIcons);
  // A custom pin without its own colour is `null`, which is the same thing as
  // "no opinion" here and must not read as a colour to rank.
  const pinColor = pin?.color ?? undefined;

  setPinVars(element, pinCssVars(pin, colorFor?.(place, pinColor)));
}

/**
 * The pin's design as inline custom properties the pin CSS reads.
 *
 * Cleared before it is written, and that is not tidiness. Markers are recycled by
 * the diff pass above — the same element outlives a location being recategorised,
 * regrouped, or given a different pin entirely — so a property the new pin does
 * not set has to be *removed*, or the element keeps the old one. A pin taken from
 * a thick ring to none would otherwise keep the thick ring forever.
 */
function setPinVars(element: HTMLElement, vars: Record<string, string>): void {
  for (const name of PIN_CSS_VARS) {
    const value = vars[name];

    if (value) element.style.setProperty(name, value);
    else element.style.removeProperty(name);
  }
}
