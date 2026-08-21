"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  LngLatBounds,
  type MapMouseEvent,
  type Map as MapLibreMap,
} from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";

import {
  boundsIntersectBox,
  isPointInBox,
  type SelectBox as Box,
} from "@/lib/map/marquee";
import { nearestRoad } from "@/lib/map/nearest-road";
import type { NearestRoad } from "@/lib/map/nearest-road";
import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import type { MapStyleKey } from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import type { MapCategory, Place, Shape } from "@/lib/repositories/types";
import type { Selection, Viewport } from "@/lib/stores/editor-store";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { shapeBounds, type ShapeBounds } from "@/packages/shared/shapes";
import { PlaceCard } from "./place-card/place-card";
import { SelectBox, type SelectBoxHandle } from "./select-box/select-box";
import { useSelectBox } from "./select-box/use-select-box";
import { MapShapes, type MapShapesProps } from "./shapes/map-shapes";
import { SHAPE_HIT_LAYERS } from "./shapes/shape-layers";
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
   * Frames a box. What `flyTo` is to a pin, this is to an area: a shape has an
   * extent, and flying to its centre at a fixed zoom would show the middle of a
   * region without showing that it is one.
   */
  fitBounds: (bounds: ShapeBounds) => void;
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
  /** The map's stored `appearance` blob — labels and layer toggles. */
  appearance?: Record<string, unknown>;
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
  /**
   * A pin's colour, decided in full by the caller — category, group, or the
   * custom pin's own, which is handed in as the second argument rather than
   * applied behind the resolver's back. See `paint` in use-place-markers.ts.
   */
  colorFor?: (place: Place, pinColor?: string) => string | undefined;
  /**
   * The map's own pins, for resolving a place's `custom:` icon id.
   *
   * Not derived from `colorFor` and not optional-by-accident: the import review
   * step reuses this canvas for drafts on a map it has not loaded, and those
   * drafts are all plain pins anyway.
   */
  pinIcons?: CustomPinIcon[];
  /** The card needs the whole category, not just the colour the pins take. */
  categoryFor?: (place: Place) => MapCategory | undefined;
  /** `null` clears the selection — a click on the basemap, closing the card. */
  onSelectPlace: (placeId: string | null) => void;
  /** Adds an Edit action to the card. Omit and the card is read-only. */
  onEditPlace?: (placeId: string) => void;
  onMapClick: (coords: { lng: number; lat: number }) => void;
  /** Omit to make pins fixed. Supplying it is what enables dragging. */
  onMovePlace?: (placeId: string, coords: { lng: number; lat: number }) => void;
  /**
   * Areas drawn on the map — circles and polygons — and everything that edits
   * them. Omit it and the canvas has no shape layer at all, which is what the
   * import review and the preview want.
   *
   * A prop group rather than a dozen loose props: this is one feature, it either
   * arrives whole or not at all, and the two callers who don't want it shouldn't
   * have to pass twelve undefineds to say so.
   */
  shapes?: MapShapesProps;
  /**
   * Picking several objects at once, and the marquee that does it.
   *
   * A prop group for the same reason `shapes` is: it is one feature, and the
   * import review and the preview want none of it.
   */
  selection?: MapSelectionProps;
  /** Hands the parent the map handle once there is a map to hand over. */
  onReady?: (handle: MapHandle) => void;
};

export type MapSelectionProps = {
  /** Everything currently picked out, so the pins and shapes can show it. */
  selected: Selection;
  /** True while the select tool is armed. */
  isSelecting: boolean;
  onSelect: (selection: Selection) => void;
  /** Leaves the tool — Escape, or a press that never became a drag. */
  onStopSelecting: () => void;
};

export default function MapCanvasImpl({
  center,
  zoom,
  style,
  appearance,
  places,
  selectedPlaceId,
  isAdding,
  fitToPlaces,
  showPlaceCard,
  colorFor,
  pinIcons,
  categoryFor,
  shapes,
  selection,
  onSelectPlace,
  onEditPlace,
  onMapClick,
  onMovePlace,
  onReady,
}: MapCanvasProps) {
  const frame = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const { map, isReady } = useMaplibre(frame, container, {
    center,
    zoom,
    style,
    appearance,
  });

  /*
   * Looked up here rather than passed in, so the card follows a place edited
   * elsewhere — renaming one in the modal updates the open card, because both
   * read the same query cache entry.
   */
  const selectedPlace =
    places.find((place) => place.id === selectedPlaceId) ?? null;

  /*
   * Sets rather than arrays, because both consumers ask "is this one in it?"
   * once per object per render — a 500-place map would otherwise be 500 linear
   * scans of a list that can hold 500 ids.
   */
  const selectedPlaceIds = useMemo(
    () => new Set(selection?.selected.placeIds ?? []),
    [selection?.selected.placeIds],
  );
  const selectedShapeIds = useMemo(
    () => new Set(selection?.selected.shapeIds ?? []),
    [selection?.selected.shapeIds],
  );

  usePlaceMarkers({
    map,
    isReady,
    places,
    selectedPlaceId,
    selectedPlaceIds,
    colorFor,
    pinIcons,
    onSelect: onSelectPlace,
    onMove: onMovePlace,
  });

  // Latest handlers and mode without re-binding the map listener on every render.
  // Assigned in an effect, not during render — refs are not render output.
  const clickHandler = useRef(onMapClick);
  const selectHandler = useRef(onSelectPlace);
  const selectShapeHandler = useRef(shapes?.onSelectShape);
  const addingRef = useRef(isAdding);
  const drawingRef = useRef(shapes?.drawMode ?? null);
  const selectingRef = useRef(selection?.isSelecting ?? false);

  useEffect(() => {
    clickHandler.current = onMapClick;
    selectHandler.current = onSelectPlace;
    selectShapeHandler.current = shapes?.onSelectShape;
    addingRef.current = isAdding;
    drawingRef.current = shapes?.drawMode ?? null;
    selectingRef.current = selection?.isSelecting ?? false;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const handleClick = (event: MapMouseEvent) => {
      // A drawing tool owns every click while it is armed — the polygon tool
      // reads them as vertices, and neither tool wants this one clearing the
      // selection or dropping a pin behind it.
      if (drawingRef.current) return;

      /*
       * So does the select tool, and here it is load-bearing rather than tidy: a
       * marquee ends with a pointerup the browser also reports as a click, and
       * that click would land in the branch below and clear the selection the
       * drag had just made — every time, on every marquee.
       */
      if (selectingRef.current) return;

      if (!addingRef.current) {
        /*
         * Browse mode: a click on the basemap is a click away from whatever was
         * selected, which is what closes the card. Clicks on a pin never reach
         * here — the marker's own listener stops them (use-place-markers.ts) —
         * but a shape is style geometry, not an element, so a click on one
         * arrives here as well as at the shape layer's own handler. Asking what
         * is under the pointer is how this tells the two apart, and it does not
         * depend on which listener happened to be registered first.
         */
        const onShape =
          Boolean(instance.getLayer(SHAPE_HIT_LAYERS[0])) &&
          instance.queryRenderedFeatures(event.point, {
            layers: SHAPE_HIT_LAYERS,
          }).length > 0;

        // A place and a shape are never selected at once, so either way the
        // location's card closes. The shape's only closes when the click landed
        // on neither — when it landed on a shape, the shape layer's own handler
        // is about to open that one's card.
        selectHandler.current(null);
        if (!onShape) selectShapeHandler.current?.(null);
        return;
      }

      clickHandler.current({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };

    instance.on("click", handleClick);
    return () => {
      instance.off("click", handleClick);
    };
  }, [map, isReady]);

  const selectBox = useRef<SelectBoxHandle>(null);

  /*
   * The current places and shapes, for a pointer handler that runs outside
   * React. Same idiom as the handler refs above: the marquee's effect is bound
   * to the tool being armed, not to the data, and a closure over the arrays
   * would be one render out of date by the time a drag ended.
   */
  const placesRef = useRef(places);
  const shapesRef = useRef(shapes?.shapes);
  const selectHandlerRef = useRef(selection?.onSelect);

  useEffect(() => {
    placesRef.current = places;
    shapesRef.current = shapes?.shapes;
    selectHandlerRef.current = selection?.onSelect;
  });

  useSelectBox({
    map,
    isReady,
    isActive: selection?.isSelecting ?? false,
    onPreview: (box) => selectBox.current?.show(box),
    onCancel: () => selection?.onStopSelecting(),
    onSelect: (box) => {
      const instance = map.current;
      if (!instance) return;

      selectHandlerRef.current?.({
        placeIds: pickPlaces(instance, placesRef.current, box),
        shapeIds: pickShapes(instance, shapesRef.current ?? [], box),
      });
    },
  });

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

      fitBounds: (bounds) => {
        const instance = map.current;
        if (!instance) return;

        instance.fitBounds(
          [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ],
          {
            padding: 64,
            // A degenerate box — a polygon whose points all coincide — has zero
            // area and would otherwise zoom to maximum.
            maxZoom: 17,
            duration: prefersReducedMotion ? 0 : 700,
            essential: true,
          },
        );
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
        /*
         * `maplibregl-crosshair`, not Tailwind's `cursor-crosshair`.
         *
         * The cursor the pointer actually reads is the one on
         * `.maplibregl-canvas-container.maplibregl-interactive`, a *child* of
         * this element, and maplibre-gl.css sets it to `grab` — (0,2,0) against
         * a utility class's (0,1,0). So a cursor class here is dead over the
         * canvas, which is why arming a tool still showed a hand. MapLibre ships
         * this class for exactly this case: its own selectors reach the child
         * and the `:active` state, so it beats both `grab` and `grabbing`.
         *
         * Third time this file has lost to maplibre-gl.css on specificity — see
         * the `h-full` note below for the second.
         */
        className={`h-full w-full ${
          isAdding || shapes?.drawMode || selection?.isSelecting
            ? "maplibregl-crosshair"
            : ""
        }`}
      />

      {selection ? <SelectBox ref={selectBox} /> : null}

      {/* Before the place card, so a shape's card never covers a location's —
          the pins are what the map is mostly about. */}
      {shapes ? (
        <MapShapes
          map={map}
          isReady={isReady}
          selectedShapeIds={selectedShapeIds}
          {...shapes}
        />
      ) : null}

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

/**
 * Which pins the box caught.
 *
 * A pin is selected when its own point is inside the box. Its marker is 36px
 * wide on screen, but the pin *is* the point — grazing the edge of a ball with
 * the corner of a marquee is not a selection anyone meant to make.
 */
function pickPlaces(
  instance: MapLibreMap,
  places: readonly Place[],
  box: Box,
): string[] {
  const picked: string[] = [];

  for (const place of places) {
    if (isPointInBox(instance.project([place.lng, place.lat]), box)) {
      picked.push(place.id);
    }
  }

  return picked;
}

/**
 * Which shapes the box caught — anything whose extent it touches.
 *
 * Projected corner by corner rather than compared in degrees, because the box is
 * a rectangle on the screen and the map may be rotated. `project` does not
 * preserve which corner is which under rotation, so the four are min/maxed back
 * into a screen-space box rather than assumed.
 */
function pickShapes(
  instance: MapLibreMap,
  shapes: readonly Shape[],
  box: Box,
): string[] {
  const picked: string[] = [];

  for (const shape of shapes) {
    const bounds = shapeBounds(shape.geometry);
    if (!bounds) continue;

    const corners = [
      instance.project([bounds.west, bounds.north]),
      instance.project([bounds.east, bounds.north]),
      instance.project([bounds.east, bounds.south]),
      instance.project([bounds.west, bounds.south]),
    ];

    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);

    const onScreen: Box = {
      x1: Math.min(...xs),
      y1: Math.min(...ys),
      x2: Math.max(...xs),
      y2: Math.max(...ys),
    };

    if (boundsIntersectBox(onScreen, box)) picked.push(shape.id);
  }

  return picked;
}
