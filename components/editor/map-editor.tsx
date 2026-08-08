"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { MapHintBar } from "@/components/map/map-hint-bar";
import { MapToolbar } from "@/components/map/map-toolbar";
import { PlaceEditDialog } from "@/components/places/place-form/place-edit-dialog";
import { roundCoord } from "@/lib/map/geo";
import { useUpdateMap } from "@/lib/query/maps";
import { useCreatePlace, usePlaces, useUpdatePlace } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { useEditorStore, type Viewport } from "@/lib/stores/editor-store";
import { EditorSidebar } from "./editor-sidebar";

/**
 * Composes the canvas, toolbar and place list. Data comes from the query cache;
 * the only local state is which mode the editor is in and what's selected.
 *
 * The map's name and section tabs live in the route layout, so this owns the
 * canvas and nothing above it.
 */
export function MapEditor({
  map,
  initialPlaces,
  placeLimit,
}: {
  map: AppMap;
  initialPlaces: Place[];
  placeLimit: number;
}) {
  const { data: places = [] } = usePlaces(map.id, initialPlaces);
  const createPlace = useCreatePlace(map.id);
  const updatePlace = useUpdatePlace(map.id);
  const updateMap = useUpdateMap(map.id);

  const mode = useEditorStore((state) => state.mode);
  const selectedPlaceId = useEditorStore((state) => state.selectedPlaceId);
  const setMode = useEditorStore((state) => state.setMode);
  const toggleAddMode = useEditorStore((state) => state.toggleAddMode);
  const selectPlace = useEditorStore((state) => state.selectPlace);
  const reset = useEditorStore((state) => state.reset);

  const [editingId, setEditingId] = useState<string | null>(null);

  const isAdding = mode === "add";

  // Leaving the editor with mode: 'add' still set would arm the next map.
  useEffect(() => reset, [reset]);

  const categoriesById = useMemo(
    () => new Map(map.categories.map((category) => [category.id, category])),
    [map.categories],
  );

  // Read from the ref inside the marker layer, so this identity may change freely.
  const colorFor = useCallback(
    (place: Place) => categoriesById.get(place.category)?.color,
    [categoriesById],
  );

  const addPlace = useCallback(
    (coords: { lng: number; lat: number }) => {
      createPlace.mutate({
        name: `Location ${places.length + 1}`,
        lat: roundCoord(coords.lat),
        lng: roundCoord(coords.lng),
        address: "",
        category: "",
        sortOrder: places.length,
        geocodeStatus: "manual",
      });
    },
    [createPlace, places.length],
  );

  /**
   * Dragging a pin is how a wrong position gets corrected, so a drop is a save.
   * A moved pin was placed deliberately, which makes its coordinates 'manual' —
   * a later geocode pass must not overwrite them.
   *
   * Depends on `.mutate`, not the mutation object: the object is a new identity
   * every render, which would re-run the marker effect on each one.
   */
  const moveMutate = updatePlace.mutate;
  const movePlace = useCallback(
    (placeId: string, coords: { lng: number; lat: number }) => {
      moveMutate({
        placeId,
        input: {
          lat: roundCoord(coords.lat),
          lng: roundCoord(coords.lng),
          geocodeStatus: "manual",
        },
      });
    },
    [moveMutate],
  );

  // Escape leaves add mode — the toolbar toggle stays sticky so several pins can
  // be dropped in a row.
  useEffect(() => {
    if (!isAdding) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode("browse");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdding, setMode]);

  const readViewport = useRef<(() => Viewport) | null>(null);
  const handleReady = useCallback((reader: () => Viewport) => {
    readViewport.current = reader;
  }, []);

  const [savedViewAt, setSavedViewAt] = useState<number | null>(null);

  const saveCurrentView = async () => {
    const viewport = readViewport.current?.();
    if (!viewport) return;

    await updateMap.mutateAsync({
      defaultLat: roundCoord(viewport.lat),
      defaultLng: roundCoord(viewport.lng),
      // Appwrite's column is bounded 0–24 and MapLibre reports fractional zoom.
      defaultZoom: Math.round(viewport.zoom * 100) / 100,
    });

    setSavedViewAt(Date.now());
  };

  const editingPlace = places.find((place) => place.id === editingId) ?? null;

  return (
    /*
     * `lg`, not `md`: with a 240px nav sidebar and a 320px locations panel, a
     * 768px viewport would leave the map about 200px wide. It stacks until there
     * is genuinely room for both.
     */
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/*
       * A framed panel rather than a slab bled to the window edges. dvh, not vh:
       * mobile browser chrome would clip the canvas otherwise.
       */}
      <div className="relative h-[55dvh] min-h-64 w-full overflow-hidden rounded-xl border border-border lg:h-auto lg:min-h-0 lg:flex-1">
        <MapToolbar
          isAdding={isAdding}
          isBusy={createPlace.isPending}
          isSavingView={updateMap.isPending}
          hasSavedView={savedViewAt !== null}
          onToggleAdd={toggleAddMode}
          onAddAtCentre={() => {
            const centre = readViewport.current?.();
            if (centre) addPlace(centre);
          }}
          onSaveView={() => void saveCurrentView()}
        />
        <MapHintBar isVisible={isAdding} />

        <MapCanvas
          center={{ lng: map.defaultLng, lat: map.defaultLat }}
          zoom={map.defaultZoom}
          style={map.style}
          places={places}
          selectedPlaceId={selectedPlaceId}
          isAdding={isAdding}
          colorFor={colorFor}
          onSelectPlace={selectPlace}
          onMapClick={addPlace}
          onMovePlace={movePlace}
          onReady={handleReady}
        />
      </div>

      <EditorSidebar
        mapId={map.id}
        places={places}
        categoriesById={categoriesById}
        placeLimit={placeLimit}
        selectedPlaceId={selectedPlaceId}
        error={createPlace.error}
        onSelect={selectPlace}
        onEdit={(placeId) => {
          selectPlace(placeId);
          setEditingId(placeId);
        }}
      />

      <PlaceEditDialog
        map={map}
        place={editingPlace}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}
