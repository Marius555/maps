"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapHandle } from "@/components/map/map-canvas-impl";
import { MapHintBar } from "@/components/map/map-hint-bar";
import { MapSearch } from "@/components/map/map-search/map-search";
import { MapToolbar } from "@/components/map/map-toolbar";
import { PlaceEditDialog } from "@/components/places/place-form/place-edit-dialog";
import { PreviewDialog } from "@/components/preview/preview-dialog";
import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { roundCoord } from "@/lib/map/geo";
import { nextPlaceDefaults } from "@/lib/places/next-place-defaults";
import { useUpdateMap } from "@/lib/query/maps";
import {
  useCreatePlace,
  usePlaces,
  usePlacesSnapshot,
  useUpdatePlace,
} from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { useEditorStore } from "@/lib/stores/editor-store";
import { EditorSidebar } from "./editor-sidebar";
import { useAddressResolution } from "./use-address-resolution";

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
  const readPlaces = usePlacesSnapshot(map.id);

  const {
    pendingIds: pendingAddressIds,
    failedIds: failedAddressIds,
    resolveAddress,
    retainOnly,
  } = useAddressResolution(map.id);

  const mode = useEditorStore((state) => state.mode);
  const selectedPlaceId = useEditorStore((state) => state.selectedPlaceId);
  const setMode = useEditorStore((state) => state.setMode);
  const toggleAddMode = useEditorStore((state) => state.toggleAddMode);
  const selectPlace = useEditorStore((state) => state.selectPlace);
  const reset = useEditorStore((state) => state.reset);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isAdding = mode === "add";
  const isAtPlaceLimit = places.length >= placeLimit;

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

  // The card needs the label too, not just the colour the pins take.
  const categoryFor = useCallback(
    (place: Place) => categoriesById.get(place.category),
    [categoriesById],
  );

  /*
   * Both depend on `.mutate`/`.mutateAsync`, not on the mutation object: the
   * object is a new identity every render, which would re-run the marker effect
   * (and now the canvas's handle effect) on each one.
   */
  const createMutate = createPlace.mutateAsync;
  const moveMutate = updatePlace.mutate;

  /**
   * Forget the addresses of locations that have since been deleted. The lookup
   * state is keyed by place id and nothing else prunes it.
   */
  useEffect(() => {
    retainOnly(new Set(places.map((place) => place.id)));
  }, [places, retainOnly]);

  /*
   * Declared above the callbacks that use it, not beside the canvas it belongs
   * to: `streetAt` goes in their dependency arrays, and those arrays are built
   * during render — a `const` further down the component would still be in its
   * temporal dead zone when they are evaluated.
   */
  const mapHandle = useRef<MapHandle | null>(null);
  const handleReady = useCallback((handle: MapHandle) => {
    mapHandle.current = handle;
  }, []);

  /**
   * The street under a coordinate, measured against the tiles already on screen.
   *
   * Null whenever the map cannot say — before it is ready, or zoomed out past the
   * road data — and null is fine: the geocoder then answers alone, exactly as it
   * did before this existed. See lib/map/nearest-road.ts for why the geocoder
   * cannot be trusted with this question on its own.
   */
  const streetAt = useCallback(
    (lng: number, lat: number) => mapHandle.current?.streetAt(lng, lat) ?? null,
    [],
  );

  /**
   * Drop a pin, then find out where it landed.
   *
   * The place is created first and addressed second, rather than the other way
   * round, because a pin that takes a second to appear reads as a broken map. So
   * the row arrives instantly under a placeholder name and the street fills itself
   * in behind it.
   */
  const addPlace = useCallback(
    async (coords: { lng: number; lat: number }, known?: GeocodeCandidate) => {
      const lat = roundCoord(coords.lat);
      const lng = roundCoord(coords.lng);

      let created: string;

      try {
        // Read at drop time, not at render time: two pins dropped in quick
        // succession would otherwise both see the same list and land as two
        // "Location 4"s sharing a sortOrder.
        const { name, sortOrder } = nextPlaceDefaults(readPlaces());

        const place = await createMutate({
          name,
          lat,
          lng,
          address: known?.title ?? "",
          category: "",
          sortOrder,
          geocodeStatus: "manual",
          /*
           * The whole of what the search found, not just the line it printed.
           * Only the formatted address used to be kept, so a location added from
           * the address bar had no postcode and its row went on showing the
           * placeholder name — the geocoder had already answered, we were simply
           * throwing most of the answer away.
           */
          addressParts: known?.parts ?? null,
          geocodeConfidence: known?.confidence ?? null,
        });

        created = place.id;
      } catch {
        // The create error is already rendered by the panel, from
        // `createPlace.error` — a plan limit is the case that matters, and it has
        // a message of its own.
        return;
      }

      // Picked from a search result: we already know the address, so asking the
      // geocoder to tell us what it just told us would be a wasted second.
      if (known) return;

      // Only from here. Before this point the row is the optimistic one, which
      // the list recognises by its temporary id and skeletons on its own.
      await resolveAddress(created, { lat, lng }, "", streetAt(lng, lat));
    },
    [createMutate, resolveAddress, readPlaces, streetAt],
  );

  /**
   * Dragging a pin is how a wrong position gets corrected, so a drop is a save.
   * A moved pin was placed deliberately, which makes its coordinates 'manual' —
   * a later geocode pass must not overwrite them.
   *
   * The address is looked up again for the same reason it was looked up on the
   * way in: it describes where the pin is, and the pin is somewhere else now.
   * Leaving the old one is how a location ends up filed under a street it was
   * dragged away from — which is exactly what a correcting drag was meant to fix.
   *
   * Position is saved without waiting for it. The two are separate writes because
   * they finish a second apart, and the pin must not hang in the air meanwhile.
   */
  const movePlace = useCallback(
    (placeId: string, coords: { lng: number; lat: number }) => {
      const lat = roundCoord(coords.lat);
      const lng = roundCoord(coords.lng);

      moveMutate({ placeId, input: { lat, lng, geocodeStatus: "manual" } });

      // The address it has now, so a lookup that finds nothing knows there is a
      // stale one to clear rather than leaving the pin filed under where it was.
      const current = places.find((place) => place.id === placeId)?.address ?? "";

      void resolveAddress(placeId, { lat, lng }, current, streetAt(lng, lat));
    },
    [moveMutate, resolveAddress, places, streetAt],
  );

  /**
   * Try the address again for a location whose lookup came back with nothing.
   *
   * Coordinates come from the place rather than from the row that asked, so a
   * retry always describes where the pin is now — including if it was dragged
   * while the first attempt was failing.
   */
  const retryAddress = useCallback(
    (placeId: string) => {
      const place = places.find((candidate) => candidate.id === placeId);
      if (!place) return;

      void resolveAddress(
        placeId,
        { lat: place.lat, lng: place.lng },
        place.address,
        streetAt(place.lng, place.lat),
      );
    },
    [places, resolveAddress, streetAt],
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

  const [isDraggingPin, setIsDraggingPin] = useState(false);

  /**
   * A pin dragged off the toolbar and let go.
   *
   * The toolbar reports where the pointer was; what is underneath it is the map's
   * question to answer, and `null` is a real answer — a pin dropped on the
   * locations panel or off the edge of the frame was not dropped on the map, and
   * quietly placing it at the nearest coordinate would be inventing an intent.
   */
  const dropPin = useCallback(
    (clientX: number, clientY: number) => {
      const coords = mapHandle.current?.pointToLngLat(clientX, clientY);
      if (coords) void addPlace(coords);
    },
    [addPlace],
  );

  /**
   * Picking a location in the Locations panel flies the camera to it.
   *
   * Only from the panel. Clicking a pin selects the same place and deliberately
   * does *not* move the map: the pin is already under the cursor, and pulling the
   * ground out from under a click is how a map stops feeling direct. Keeping the
   * two paths separate here is what makes that distinction possible at all —
   * `selectedPlaceId` alone cannot say where the selection came from.
   */
  const focusPlace = useCallback(
    (placeId: string) => {
      selectPlace(placeId);

      const place = places.find((candidate) => candidate.id === placeId);
      if (place) mapHandle.current?.flyTo(place);
    },
    [places, selectPlace],
  );

  const [savedViewAt, setSavedViewAt] = useState<number | null>(null);

  /**
   * The confirmation is a reply, not a status: it used to be set on the first
   * save and never cleared, so "View saved" sat on the map for the rest of the
   * session and stopped meaning anything. Keyed on the timestamp so saving twice
   * restarts the timer rather than being swallowed by the first one.
   */
  useEffect(() => {
    if (savedViewAt === null) return;

    const timer = setTimeout(() => setSavedViewAt(null), 2500);
    return () => clearTimeout(timer);
  }, [savedViewAt]);

  const saveCurrentView = async () => {
    const viewport = mapHandle.current?.getViewport();
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
          isAddDisabled={isAtPlaceLimit}
          isSavingView={updateMap.isPending}
          hasSavedView={savedViewAt !== null}
          search={
            <MapSearch
              mapId={map.id}
              isAddDisabled={isAtPlaceLimit}
              onPick={(candidate) => mapHandle.current?.flyTo(candidate)}
              onAdd={(candidate) => {
                // The whole match, so this pin skips the reverse lookup it would
                // otherwise make to learn what we already know — and keeps the
                // postcode and landmark the search already told us.
                void addPlace(candidate, candidate);
                mapHandle.current?.flyTo(candidate);
              }}
            />
          }
          onToggleAdd={toggleAddMode}
          onDropPin={dropPin}
          onDraggingChange={setIsDraggingPin}
          onSaveView={() => void saveCurrentView()}
          onPreview={() => setIsPreviewOpen(true)}
        />

        {/* One bar, two instructions: a pin already in the air needs a different
            sentence from an armed click-to-place mode. Dragging wins when both
            are true, because it is the thing happening right now. */}
        <MapHintBar
          isVisible={isAdding || isDraggingPin}
          message={
            isDraggingPin
              ? "Drop the pin where the location is."
              : undefined
          }
        />

        <MapCanvas
          center={{ lng: map.defaultLng, lat: map.defaultLat }}
          zoom={map.defaultZoom}
          style={map.style}
          places={places}
          selectedPlaceId={selectedPlaceId}
          isAdding={isAdding}
          colorFor={colorFor}
          categoryFor={categoryFor}
          showPlaceCard
          onSelectPlace={selectPlace}
          onEditPlace={setEditingId}
          onMapClick={(coords) => void addPlace(coords)}
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
        pendingAddressIds={pendingAddressIds}
        failedAddressIds={failedAddressIds}
        onRetryAddress={retryAddress}
        error={createPlace.error}
        onSelect={focusPlace}
        onEdit={(placeId) => {
          focusPlace(placeId);
          setEditingId(placeId);
        }}
      />

      <PlaceEditDialog
        map={map}
        place={editingPlace}
        onClose={() => setEditingId(null)}
      />

      <PreviewDialog
        map={map}
        places={places}
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </div>
  );
}
