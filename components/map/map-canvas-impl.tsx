"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { LngLatBounds, type MapMouseEvent } from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { nearestRoad } from "@/lib/map/nearest-road";
import type { NearestRoad } from "@/lib/map/nearest-road";
import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import type { MapStyleKey } from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import type { MapCategory, Place } from "@/lib/repositories/types";
import type { Viewport } from "@/lib/stores/editor-store";
import { PlaceCard } from "./place-card/place-card";
import { useMaplibre } from "./use-maplibre";
import { usePlaceMarkers } from "./use-place-markers";

// Module scope: runs once per page load however many canvases mount, which is
// what CLAUDE.md §7 asks for. Doing it in a root provider instead would drag
// MapLibre into the initial dashboard bundle.
registerPmtilesProtocol();
// Must happen before the first Map is constructed — see lib/map/worker.ts.
configureMaplibreWorker();

/**
 * Where the road names live in the OpenMapTiles schema every basemap preset
 * shares. Named here rather than inline so the two halves stay together.
 */
const ROAD_SOURCE = "openmaptiles";
const ROAD_SOURCE_LAYER = "transportation_name";

/**
 * The imperative surface the canvas hands its parent.
 *
 * A handle rather than the MapLibre instance itself: the parent needs to move the
 * camera and read the viewport, not to reach into a map it does not own. The embed
 * models the same boundary the same way (`MapHandle` in embed/src/map.ts).
 *
 * `next/dynamic` does not forward refs (see map-canvas.tsx), so this arrives
 * through a callback prop rather than `useImperativeHandle`.
 */
export type MapHandle = {
  getViewport: () => Viewport;
  /** Eases to a place, zooming in if the current zoom is further out than `zoom`. */
  flyTo: (target: { lng: number; lat: number }, options?: { zoom?: number }) => void;
  /**
   * What a point on the screen is, geographically. `null` when that point is not
   * over the map at all — which is what a pin dragged out of the toolbar and
   * dropped on the sidebar looks like, and the answer there is "nothing".
   *
   * Takes viewport coordinates (a pointer event's `clientX`/`clientY`) because
   * the caller is a control outside the canvas and cannot know its offset.
   */
  pointToLngLat: (
    clientX: number,
    clientY: number,
  ) => { lng: number; lat: number } | null;
  /**
   * The street a coordinate is standing on, read off the tiles already drawn.
   *
   * The geocoder cannot answer this — it publishes bounding boxes, and a box
   * around an angled corner block covers the road beside it. See
   * lib/map/nearest-road.ts. `null` whenever the map cannot say: no instance yet,
   * no tiles loaded there, or nothing named within range. Every one of those
   * falls back to the geocoder alone, which is where we were before.
   */
  streetAt: (lng: number, lat: number) => NearestRoad | null;
};

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
  /**
   * Show the selected place's card beside its pin. Off by default, so the import
   * review step — which reuses this canvas for drafts that are not saved rows —
   * keeps its bare map. Same idiom as `fitToPlaces` above.
   */
  showPlaceCard?: boolean;
  colorFor?: (place: Place) => string | undefined;
  /** The card needs the whole category, not just the colour the pins take. */
  categoryFor?: (place: Place) => MapCategory | undefined;
  /** `null` clears the selection — a click on the basemap, closing the card. */
  onSelectPlace: (placeId: string | null) => void;
  /** Adds an Edit action to the card. Omit and the card is read-only. */
  onEditPlace?: (placeId: string) => void;
  onMapClick: (coords: { lng: number; lat: number }) => void;
  /** Omit to make pins fixed. Supplying it is what enables dragging. */
  onMovePlace?: (placeId: string, coords: { lng: number; lat: number }) => void;
  /** Hands the parent the map handle once there is a map to hand over. */
  onReady?: (handle: MapHandle) => void;
};

export default function MapCanvasImpl({
  center,
  zoom,
  style,
  places,
  selectedPlaceId,
  isAdding,
  fitToPlaces,
  showPlaceCard,
  colorFor,
  categoryFor,
  onSelectPlace,
  onEditPlace,
  onMapClick,
  onMovePlace,
  onReady,
}: MapCanvasProps) {
  const frame = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const { map, isReady } = useMaplibre(frame, container, { center, zoom, style });

  /*
   * Looked up here rather than passed in, so the card follows a place edited
   * elsewhere — renaming one in the modal updates the open card, because both
   * read the same query cache entry.
   */
  const selectedPlace =
    places.find((place) => place.id === selectedPlaceId) ?? null;

  usePlaceMarkers({
    map,
    isReady,
    places,
    selectedPlaceId,
    colorFor,
    onSelect: onSelectPlace,
    onMove: onMovePlace,
  });

  // Latest handlers and mode without re-binding the map listener on every render.
  // Assigned in an effect, not during render — refs are not render output.
  const clickHandler = useRef(onMapClick);
  const selectHandler = useRef(onSelectPlace);
  const addingRef = useRef(isAdding);

  useEffect(() => {
    clickHandler.current = onMapClick;
    selectHandler.current = onSelectPlace;
    addingRef.current = isAdding;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const handleClick = (event: MapMouseEvent) => {
      if (!addingRef.current) {
        // Browse mode: a click on the basemap is a click away from whatever was
        // selected, which is what closes the card. Clicks on a pin never reach
        // here — the marker's own listener stops them (use-place-markers.ts).
        selectHandler.current(null);
        return;
      }

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

  /**
   * The map's initial view, for the one case where the handle is asked for a
   * viewport before there is a map to ask. A ref so the effect below does not
   * depend on it — `center` is a fresh object literal every render.
   */
  const fallbackViewport = useRef<Viewport>({ ...center, zoom });

  const prefersReducedMotion = useReducedMotion();

  /**
   * Built inside the effect rather than memoized outside it. The handle closes
   * over a ref, which is precisely what the React Compiler will not let a
   * `useMemo` do — and it does not need to survive renders, because the only
   * thing that consumes it is this effect.
   */
  useEffect(() => {
    if (!isReady) return;

    onReady?.({
      getViewport: () => {
        const instance = map.current;
        if (!instance) return fallbackViewport.current;

        const centre = instance.getCenter();
        return { lng: centre.lng, lat: centre.lat, zoom: instance.getZoom() };
      },

      pointToLngLat: (clientX, clientY) => {
        const instance = map.current;
        const box = container.current?.getBoundingClientRect();
        if (!instance || !box) return null;

        const x = clientX - box.left;
        const y = clientY - box.top;
        if (x < 0 || y < 0 || x > box.width || y > box.height) return null;

        const { lng, lat } = instance.unproject([x, y]);
        return { lng, lat };
      },

      /*
       * `querySourceFeatures`, not `queryRenderedFeatures`. The rendered kind
       * returns only symbols that actually got placed, and road labels are
       * dropped wholesale by label collision — the street under the pin is
       * exactly the one most likely to have lost its label to a neighbour. The
       * source kind reads the parsed tile regardless of what was drawn.
       *
       * `openmaptiles` / `transportation_name` come from the basemap style
       * (lib/map/style.ts); Liberty draws six layers from that source layer, so
       * it is always parsed and present.
       */
      streetAt: (lng, lat) => {
        const instance = map.current;
        if (!instance) return null;

        try {
          const features = instance.querySourceFeatures(ROAD_SOURCE, {
            sourceLayer: ROAD_SOURCE_LAYER,
          });

          return nearestRoad(features, { lng, lat });
        } catch {
          // A style swap can leave the source missing for a frame. Not knowing
          // the street is an ordinary answer here, not a failure.
          return null;
        }
      },

      flyTo: (target, options) => {
        const instance = map.current;
        if (!instance) return;

        instance.flyTo({
          center: [target.lng, target.lat],
          // Zoom in to see the place, but never back out: someone who has zoomed
          // in to compare two neighbouring pins should not be thrown back out to
          // street level for picking one of them.
          zoom: Math.max(instance.getZoom(), options?.zoom ?? 15),
          // The flight is decoration for anyone who asked not to have it — the
          // point is arriving, so under reduced motion it just arrives.
          duration: prefersReducedMotion ? 0 : 700,
          // Marks the movement as essential so the browser's own reduced-motion
          // handling does not cancel it and leave the camera where it was.
          essential: true,
        });
      },
    });
  }, [isReady, onReady, map, prefersReducedMotion]);

  return (
    /*
     * Two elements, not one. The frame owns the layout, the background and the
     * clipping; the container is MapLibre's and nothing else touches it.
     *
     * The frame is also what `PlaceCard` positions against — it is the `relative`
     * one, and the card projects a coordinate into it every frame.
     *
     * `bg-surface-secondary` sits on the frame, so it is what the user looks at
     * between the canvas mounting and the first tiles arriving — and what shows in
     * the strip briefly revealed while the frame outgrows the canvas, before the
     * debounced resize lands. Left unset that gap is white, which on a dark
     * basemap is a flash.
     *
     * No fade on top of it: the tiles painting in already says "the map is
     * ready", and an animation that adds nothing is one §8 asks us to remove.
     */
    <div
      ref={frame}
      // `overflow-hidden` here, not on whatever the caller wraps this in: between
      // a shrink and the debounced resize, the canvas is wider than the frame.
      className="relative h-full w-full overflow-hidden bg-surface-secondary"
    >
      <div
        ref={container}
        /*
         * `h-full`, never `absolute inset-0`. MapLibre's constructor adds
         * `.maplibregl-map` to this element, and maplibre-gl.css sets
         * `position: relative` on that class — the same specificity as Tailwind's
         * `absolute`, injected after it, because the stylesheet rides in on this
         * module's own dynamic chunk. MapLibre wins. `inset-0` then sizes nothing,
         * `height` falls back to `auto`, and auto is *zero*, because the canvas
         * inside is itself absolutely positioned and contributes no height.
         *
         * That is a 590px frame holding a 0px map, with the canvas, both controls
         * and the style all present and correct, and not one error logged
         * anywhere. A percentage height does not care what `position` is, which is
         * why this is the form that survives.
         */
        className={`h-full w-full ${isAdding ? "cursor-crosshair" : ""}`}
      />

      {showPlaceCard ? (
        <PlaceCard
          map={map}
          isReady={isReady}
          // Hidden while adding: the point of add mode is dropping several pins
          // in a row, and a card opening over the map after each one is in the way.
          place={isAdding ? null : selectedPlace}
          category={selectedPlace ? categoryFor?.(selectedPlace) : undefined}
          onClose={() => onSelectPlace(null)}
          onEdit={onEditPlace}
        />
      ) : null}
    </div>
  );
}
