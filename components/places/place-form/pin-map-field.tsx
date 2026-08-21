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
 * `isAdding` is on so a click places the pin: the canvas only reports basemap
 * clicks while it is armed, and click-to-move is the fastest correction there is
 * when the pin is currently off screen somewhere else.
 */
export function PinMapField({
  map,
  place,
  lat,
  lng,
  onChange,
}: {
  map: AppMap;
  place: Place;
  lat: number;
  lng: number;
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  // The stored place with the form's live position, so dragging the pin and
  // typing a coordinate move the same marker.
  const places = useMemo(() => [{ ...place, lat, lng }], [place, lat, lng]);

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
          isAdding
          onSelectPlace={() => {}}
          onMapClick={move}
          onMovePlace={(_placeId, coords) => move(coords)}
          onReady={(ready) => {
            handle.current = ready;
          }}
        />
      </div>

      <p className="text-xs text-muted">
        Drag the pin, or click the map, to move this location.
      </p>
    </div>
  );
}
