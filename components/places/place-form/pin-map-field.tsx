"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapHandle } from "@/components/map/map-canvas-impl";
import type { AppMap, Place } from "@/lib/repositories/types";
import { pinColorOfTags } from "@/packages/shared/tags";

/**
 * The pin, where it currently is — to look at, not to drag.
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
 * **Nothing on this map moves the pin.** It was armed as add mode once, then
 * as a click-to-move, then as a drag — and each was a way to relocate a business
 * by touching a map while reading it. The owner asked for the last one to go
 * too: the pin moves only through Find New Location and the Coordinates fold,
 * both of which are typed on purpose. `onMovePlace` is simply not passed, which
 * is what builds the marker with `draggable: false` (use-place-markers.ts).
 *
 * **It ripples for as long as the dialog is open** — `.pulsing-pins` in
 * globals.css, the drop ripple on a loop — so the eye lands on the one pin
 * this dialog is about. Reduced motion gets a still halo in its place.
 *
 * `icon`, `color` and `tags` are the form's live values rather than the saved
 * row's, so the marker is a preview of the draft: picking a pin or a colour
 * below changes the pin above on the click, and Cancel puts it back. Nothing
 * here writes anything — the form's own submit is what saves it.
 */
export function PinMapField({
  map,
  place,
  lat,
  lng,
  icon,
  color,
  tags,
}: {
  map: AppMap;
  place: Place;
  lat: number;
  lng: number;
  /** The form's live pin, which is not yet the one on the stored row. */
  icon: string;
  /** The form's live pin colour, "" for none. */
  color: string;
  /** The form's live tags, whose first one colours a pin with nothing else. */
  tags: string[];
}) {
  // The stored place with the form's live position, pin, colour and tags, so
  // typing a coordinate, picking an address or a pin all redraw one marker.
  const places = useMemo(
    () => [{ ...place, lat, lng, icon, color, tags }],
    [place, lat, lng, icon, color, tags],
  );

  const handle = useRef<MapHandle | null>(null);

  /*
   * The position the camera was last pointed at.
   *
   * `center` is the opening camera and nothing more — the canvas does not follow
   * it — so a coordinate typed into the boxes below moved the marker and left the
   * camera where it was, which on a pin being rescued from the wrong continent
   * meant the pin simply disappeared. Every change of position now comes from
   * outside this map, so every one is followed.
   */
  const shown = useRef({ lat, lng });

  useEffect(() => {
    if (shown.current.lat === lat && shown.current.lng === lng) return;

    shown.current = { lat, lng };
    handle.current?.flyTo({ lng, lat }, { zoom: 15 });
  }, [lat, lng]);

  /*
   * The same order the editor's canvas paints by (`groupColorIndex.forPlace`),
   * short of the group step: this dialog has no groups loaded, and a grouped
   * pin is rare enough that the draft's own colour is the better preview.
   * Memoised because the marker layer repaints every pin when it changes.
   */
  const colorFor = useCallback(
    (candidate: Place, pinColor?: string) =>
      pinColor ||
      candidate.color ||
      pinColorOfTags(map.tagGroups, candidate.tags),
    [map.tagGroups],
  );

  return (
    <div className="space-y-1.5">
      {/* Shorter in a narrow container, which on a phone is the bottom sheet.
          A 192px map above four fields, a tag picker and a pin strip is most of
          what a sheet can show before anything is scrolled — and the map is the
          one thing here that reads fine smaller. A container query, so the size
          answers to the box rather than to the window. */}
      <div className="pulsing-pins h-40 overflow-hidden rounded-xl border border-border @md:h-48 @2xl:h-56">
        <MapCanvas
          center={{ lng, lat }}
          // Closer than the map's default: this is one location, and opening on
          // a country-wide default would show a pin with no context around it.
          zoom={Math.max(map.defaultZoom, 15)}
          style={map.style}
          places={places}
          pinIcons={map.pinIcons}
          colorFor={colorFor}
          selectedPlaceId={place.id}
          isAdding={false}
          onSelectPlace={() => {}}
          // Required by the canvas, and deliberately inert: with `isAdding`
          // false this never fires, and a basemap click falls into the browse
          // branch — which clears a selection this map does not have and looks
          // for shape layers it was never given. Both no-ops.
          onMapClick={() => {}}
          // No `onMovePlace`: without it the marker is not draggable. See the
          // docblock above.
          onReady={(ready) => {
            handle.current = ready;
          }}
        />
      </div>

      <p className="text-xs text-muted">
        Use Find New Location or Coordinates to move this location.
      </p>
    </div>
  );
}
