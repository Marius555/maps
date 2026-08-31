"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapHandle } from "@/components/map/map-canvas-impl";
import { roundCoord } from "@/lib/map/geo";
import type { AppMap, Place } from "@/lib/repositories/types";

/**
 * The pin, where it currently is, draggable.
 *
 * The address field has always told the user "Or drag the pin on the map to place
 * it exactly" — inside a dialog with no map in it. From the Locations tab that
 * sentence pointed at nothing at all: coordinates were read-only text, so a pin
 * the geocoder dropped in the wrong country could not be corrected from this
 * screen by any means. This is the map that sentence was describing.
 *
 * Short on purpose. It is here to confirm and nudge a position, not to browse —
 * the editor tab is the full canvas, and making this one tall would push the
 * fields the form is actually about below the fold.
 *
 * **The pin moves when it is dragged, and at no other time.** This was armed as
 * add mode, which bought the add cursor, a ghost pin trailing the pointer across
 * a map that already had the only pin it is ever going to have, and a click
 * anywhere that moved the location. The first two went; the click stayed one
 * round longer, and it was the worst of the three — a ghost at least announces
 * itself, while a click landing on the map while you read it silently relocates
 * the business. Dragging is the whole gesture now: it is deliberate, it starts
 * on the thing it moves, and it is the one this caption has always described.
 *
 * `icon` is the form's live value rather than the saved row's, so the marker is a
 * preview of the draft: picking a pin below changes the pin above on the click,
 * and Cancel puts it back. Nothing here writes anything — `icon` is already in
 * form state, and the form's own submit is what saves it.
 */
export function PinMapField({
  map,
  place,
  lat,
  lng,
  icon,
  onChange,
}: {
  map: AppMap;
  place: Place;
  lat: number;
  lng: number;
  /** The form's live pin, which is not yet the one on the stored row. */
  icon: string;
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  // The stored place with the form's live position and pin, so dragging the
  // marker, typing a coordinate and picking a pin all move the same marker.
  const places = useMemo(
    () => [{ ...place, lat, lng, icon }],
    [place, lat, lng, icon],
  );

  const handle = useRef<MapHandle | null>(null);

  /*
   * The last position this map itself produced.
   *
   * `center` is the opening camera and nothing more — the canvas does not follow
   * it — so a coordinate typed into the boxes below moved the marker and left the
   * camera where it was, which on a pin being rescued from the wrong continent
   * meant the pin simply disappeared. Chasing every change instead would fight
   * the user mid-drag, re-centring on each pointermove. Comparing against what
   * the map last emitted separates the two: a drag is already on screen, a typed
   * coordinate or a picked address is not.
   */
  const fromMap = useRef({ lat, lng });

  useEffect(() => {
    if (fromMap.current.lat === lat && fromMap.current.lng === lng) return;

    fromMap.current = { lat, lng };
    handle.current?.flyTo({ lng, lat }, { zoom: 15 });
  }, [lat, lng]);

  const move = useCallback(
    (coords: { lng: number; lat: number }) => {
      const next = { lat: roundCoord(coords.lat), lng: roundCoord(coords.lng) };
      fromMap.current = next;
      onChange(next);
    },
    [onChange],
  );

  return (
    <div className="space-y-1.5">
      <div className="h-48 overflow-hidden rounded-xl border border-border sm:h-56">
        <MapCanvas
          center={{ lng, lat }}
          // Closer than the map's default: this is one location, and opening on
          // a country-wide default would show a pin with no context around it.
          zoom={Math.max(map.defaultZoom, 15)}
          style={map.style}
          places={places}
          pinIcons={map.pinIcons}
          selectedPlaceId={place.id}
          isAdding={false}
          onSelectPlace={() => {}}
          // Required by the canvas, and deliberately inert: with `isAdding`
          // false this never fires, and a basemap click falls into the browse
          // branch — which clears a selection this map does not have and looks
          // for shape layers it was never given. Both no-ops.
          onMapClick={() => {}}
          onMovePlace={(_placeId, coords) => move(coords)}
          onReady={(ready) => {
            handle.current = ready;
          }}
        />
      </div>

      <p className="text-xs text-muted">
        Drag the pin to move this location.
      </p>
    </div>
  );
}
