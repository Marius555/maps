"use client";

import { useEffect, useMemo, useRef } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapHandle } from "@/components/map/map-canvas-impl";
import type { DraftPlace } from "@/lib/import/draft-places";
import { draftToPlace } from "@/lib/import/draft-to-place";
import { roundCoord } from "@/lib/map/geo";
import type { AppMap } from "@/lib/repositories/types";

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
 * The camera follows the selected row, because the canvas does not do that on its
 * own (`center` is the opening position and nothing more). Without it "Show on
 * map" is a button that highlights a pin somewhere off screen, and correcting a
 * row by typing a coordinate leaves you looking at where it used to be.
 */
export function ReviewMap({
  map,
  drafts,
  selectedKey,
  placingKey,
  onSelect,
  onPatch,
}: {
  map: AppMap;
  drafts: DraftPlace[];
  selectedKey: string | null;
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
  const selected = placedPlaces.find((place) => place.id === selectedKey);
  const selectedLat = selected?.lat;
  const selectedLng = selected?.lng;

  useEffect(() => {
    if (selectedLat === undefined || selectedLng === undefined) return;

    handle.current?.flyTo({ lng: selectedLng, lat: selectedLat }, { zoom: 14 });
  }, [selectedKey, selectedLat, selectedLng]);

  return (
    <MapCanvas
      center={{ lng: centre.lng, lat: centre.lat }}
      zoom={map.defaultZoom}
      style={map.style}
      places={placedPlaces}
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
