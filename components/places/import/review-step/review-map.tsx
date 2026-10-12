"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapHandle } from "@/components/map/map-canvas-impl";
import type { DraftPlace } from "@/lib/import/draft-places";
import { draftToPlace } from "@/lib/import/draft-to-place";
import { roundCoord } from "@/lib/map/geo";
import type { AppMap, Place } from "@/lib/repositories/types";

/**
 * Where every row landed, and the way to move one that landed wrong.
 *
 * `isAdding` and `onMapClick` used to be hard-wired to `false` and a no-op, which
 * made this a read-only picture for exactly the rows that needed it most: an
 * unplaced draft has no pin here — it can't, there is nowhere to draw it — so
 * "drag its pin" was impossible and clicking the map did nothing. Arming a row
 * turns the next click into that row's position, which is the only in-app way to
 * place a location the geocoder couldn't find.
 *
 * The camera follows a row the list asks to show, because the canvas does not do
 * that on its own (`center` is the opening position and nothing more). Without it "Show on
 * map" is a button that highlights a pin somewhere off screen, and correcting a
 * row by typing a coordinate leaves you looking at where it used to be.
 */
export function ReviewMap({
  map,
  drafts,
  selectedKey,
  focus,
  placingKey,
  onSelect,
  onPatch,
}: {
  map: AppMap;
  drafts: DraftPlace[];
  selectedKey: string | null;
  /**
   * A request to show a row's pin: a new object each time, so asking for the
   * same row twice still flies there. Null until the first.
   */
  focus: { key: string } | null;
  /** The row a click will place, or null when clicking does nothing. */
  placingKey: string | null;
  onSelect: (key: string | null) => void;
  onPatch: (
    key: string,
    patch: Partial<DraftPlace>,
    options?: { fromMap?: boolean },
  ) => void;
}) {
  // Only placed drafts can be drawn. The rest are placed from the list.
  const placedPlaces = useMemo(
    () =>
      drafts
        .filter((draft) => draft.lat !== null && draft.lng !== null)
        .map((draft) => draftToPlace(draft, map.id)),
    [drafts, map.id],
  );

  const centre = placedPlaces[0] ?? {
    lat: map.defaultLat,
    lng: map.defaultLng,
  };

  const handle = useRef<MapHandle | null>(null);

  /*
   * Street level, then the pin ripples. Zoom 14 was a neighbourhood, where a pin
   * among a dozen others was still a search; 17 is a block. The ripple is for the
   * street that holds several pins anyway.
   *
   * An event, read when `focus` changes, rather than an effect on the selected
   * row's coordinates. It used to be the latter, so pressing Show on map a second
   * time did nothing (the selection had not changed), and clicking a pin on the
   * map flew to it too.
   */
  const showPlace = useEffectEvent((key: string) => {
    const place = placedPlaces.find((candidate) => candidate.id === key);
    if (!place) return;

    handle.current?.flyTo({ lng: place.lng, lat: place.lat }, { zoom: 17 });
    handle.current?.ripple(key);
  });

  useEffect(() => {
    if (focus) showPlace(focus.key);
  }, [focus]);

  return (
    <MapCanvas
      center={{ lng: centre.lng, lat: centre.lat }}
      zoom={map.defaultZoom}
      style={map.style}
      places={placedPlaces}
      colorFor={draftColor}
      selectedPlaceId={selectedKey}
      isAdding={placingKey !== null}
      fitToPlaces
      onSelectPlace={onSelect}
      onReady={(ready) => {
        handle.current = ready;
      }}
      onMapClick={(coords) => {
        if (!placingKey) return;

        onPatch(
          placingKey,
          {
            lat: roundCoord(coords.lat),
            lng: roundCoord(coords.lng),
            status: "manual",
          },
          { fromMap: true },
        );
      }}
      onMovePlace={(key, coords) => {
        // A dragged pin was positioned deliberately, so it stops being a
        // geocoder guess. What it is *not* allowed to do is clear the row's other
        // problems — that used to be written here as a blind `problem: null`,
        // which let an unnamed row through and killed the import at preflight.
        // Issues are derived in the store now, so this can only say what it knows.
        onPatch(
          key,
          {
            lat: roundCoord(coords.lat),
            lng: roundCoord(coords.lng),
            status: "manual",
          },
          // Already on screen and under the pointer: flying to it would yank the
          // map out from under the drag that just ended.
          { fromMap: true },
        );
      }}
    />
  );
}

/**
 * A draft's pin colour: the file's colour column, or nothing — which leaves the
 * pin in the theme colour, as it will be once saved. Module scope so its
 * identity never changes; the marker layer repaints every pin when it does.
 */
function draftColor(place: Place): string | undefined {
  return place.color || undefined;
}
