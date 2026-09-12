"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import {
  LngLatBounds,
  type MapMouseEvent,
  type Map as MapLibreMap,
} from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  boundsIntersectBox,
  isPointInBox,
  type SelectBox as Box,
} from "@/lib/map/marquee";
import type { ExportView } from "@/lib/export/render-map";
import { nearestRoad } from "@/lib/map/nearest-road";
import type { NearestRoad } from "@/lib/map/nearest-road";
import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import { selectionBounds } from "@/lib/map/selection-bounds";
import { effectiveCardLayout } from "@/lib/card/designer-status";
import { cardThemeClass } from "@/lib/card/card-theme";
import { usePrefersDark } from "@/lib/theme/use-prefers-dark";
import type { MapStyleKey } from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import type {
  AppMap,
  MapField,
  MapTagGroup,
  Place,
  Shape,
} from "@/lib/repositories/types";
import type { Selection, Viewport } from "@/lib/stores/editor-store";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { shapeBounds, type ShapeBounds } from "@/packages/shared/shapes";
import { tagChipsOf } from "@/packages/shared/tags";
import { useAddModeGhost } from "./add-location/use-add-mode-ghost";
import { PlaceCard } from "./place-card/place-card";
import { SelectBox, type SelectBoxHandle } from "./select-box/select-box";
import { useSelectBox } from "./select-box/use-select-box";
import { MapShapes, type MapShapesProps } from "./shapes/map-shapes";
import { SHAPE_HIT_LAYERS } from "./shapes/shape-layers";
import { useMaplibre } from "./use-maplibre";
import { usePlaceMarkers } from "./use-place-markers";

/**
 * One frozen empty set, so "no route is being drawn" is the same value every
 * time. `usePlaceMarkers` keys an effect on this identity; a fresh `new Set()`
 * per render would re-stamp every marker on the map sixty times a second while
 * it is panned.
 */
const NO_STOPS: ReadonlySet<string> = new Set<string>();

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
   *
   * `animate: false` is for framing that happens *on open* rather than in answer
   * to a click — there is no previous view to travel from, so the flight is a
   * journey nobody asked for and a delay before the map is usable.
   */
  fitBounds: (bounds: ShapeBounds, options?: { animate?: boolean }) => void;
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
  /**
   * Everything needed to draw this map again somewhere else: the resolved style,
   * and where the camera is standing in it.
   *
   * The image export renders a *second* map off screen, at a page size and a
   * resolution the window cannot provide, and this is what it copies from. Still
   * only the camera and the style, which is the same side of the line the rest of
   * this handle sits on — locations and shapes belong to the editor, which has
   * them already, and handing them out through here would turn a remote control
   * for the viewpoint into an accessor for the whole canvas.
   *
   * The style is taken live rather than rebuilt from the map's stored theme, so a
   * tint, a label level and a layer toggle all come through with nothing to keep
   * in step. Null before the map exists.
   */
  getExportView: () => ExportView | null;
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
   * The pin sticky add mode is armed with, so the map can draw it under the
   * pointer. Optional: the import review reuses this canvas and never adds.
   */
  addIcon?: string;
  /**
   * Frame every pin on first load, instead of honouring center/zoom. For the
   * import review, where the whole point is seeing where everything landed —
   * an import spanning a country would otherwise open on one city.
   */
  fitToPlaces?: boolean;
  /**
   * Open framed on this box, instead of on center/zoom.
   *
   * The caller's own answer to the same question `fitToPlaces` asks, for when
   * the box is not simply "every pin" — the editor frames pins *and* areas, and
   * only when the owner has never saved a view of their own.
   *
   * Both end up in MapLibre's constructor rather than in a `fitBounds` after
   * `load`, which is the difference between one tile load and two. See
   * `Options.bounds` in use-maplibre.ts.
   */
  initialBounds?: ShapeBounds | null;
  /**
   * Show the selected place's card beside its pin. Off by default, so the import
   * review step — which reuses this canvas for drafts that are not saved rows —
   * keeps its bare map. Same idiom as `fitToPlaces` above.
   */
  showPlaceCard?: boolean;
  /**
   * The account's own card design, straight off its row — see
   * lib/repositories/card-design.repository.ts. One design for every map the
   * account owns, unlike `appearance` and `style` above.
   *
   * Resolved here rather than by the caller so an account that predates the
   * designer, one that has never opened it, and one whose JSON was hand-edited
   * all mean the same thing.
   */
  cardLayout?: Record<string, unknown>;
  /** The map's extra field definitions, for the card's own rows and buttons. */
  fields?: MapField[];
  /**
   * The map's tag vocabulary, for the card's Tags block and its colours.
   *
   * The groups rather than a per-place lookup: `tagChipsOf` is one walk of the
   * map's whole vocabulary and this canvas already holds it, so a second prop
   * asking the caller to resolve each place would be a second copy of a rule
   * that decides what colour the pin under the card is. Optional, like `fields`:
   * the import review step reuses this canvas for drafts on a map it has not
   * loaded.
   */
  tagGroups?: MapTagGroup[];
  /**
   * A pin's colour, decided in full by the caller — a group's, the custom pin's
   * own, or the location's first tag. The pin's own colour is handed in as the
   * second argument rather than applied behind the resolver's back. See `paint`
   * in use-place-markers.ts.
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
  /** `null` clears the selection — a click on the basemap, closing the card. */
  onSelectPlace: (placeId: string | null) => void;
  /** Adds an Edit action to the card. Omit and the card is read-only. */
  onEditPlace?: (placeId: string) => void;
  /**
   * Lets the place card fill itself in: every block this location left empty
   * draws a dashed `+` that opens the one field behind it. See `PlaceCard.slots`
   * and `cardSlotOf`.
   *
   * A prop group for `shapes`' and `selection`'s reason — one feature, arriving
   * whole — and omitted by the two canvases that must not have it: the import
   * review, whose drafts are not rows yet and cannot be PATCHed, and the preview
   * panel, which is showing what a visitor sees.
   *
   * **The whole `AppMap`, where this canvas otherwise deliberately takes only
   * `fields` and `tagGroups`.** The tags slot opens `TagPicker`, whose quick-add
   * writes the map's own `tagGroups` and so needs its id as well as its
   * vocabulary (components/tags/tag-quick-add.tsx). Narrowing it to those two
   * props would mean a picker that cannot create the first tag on a map that has
   * none — which is the map every one of these slots is most useful on.
   */
  cardSlots?: { map: AppMap };
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
  /**
   * Whether the bottom-left zoom stack carries a compass too. Passed straight
   * through — see `Options.showCompass` in use-maplibre.ts for why the editor
   * wants one and the three small maps do not.
   */
  showCompass?: boolean;
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
  addIcon = "",
  fitToPlaces,
  initialBounds,
  showPlaceCard,
  cardLayout: storedCardLayout,
  fields,
  tagGroups,
  colorFor,
  pinIcons,
  shapes,
  selection,
  showCompass,
  cardSlots,
  onSelectPlace,
  onEditPlace,
  onMapClick,
  onMovePlace,
  onReady,
}: MapCanvasProps) {
  const frame = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);

  // The card's light/dark for an Auto map — the same source `useMaplibre` reads
  // for the basemap, so the two cannot disagree. See `cardThemeClass`.
  const prefersDark = usePrefersDark();

  /**
   * The box the map is *born* framed on, decided before it exists.
   *
   * A lazy `useState` rather than a memo, because this has to be the answer from
   * the first render and must never change afterwards: the map reads it once at
   * construction, and re-deciding it later would describe a camera move that
   * already happened. `fitToPlaces` resolves to a box here too, so the import
   * review takes the same one-tile-load path as the editor.
   */
  /**
   * The locations the route currently being drawn has already taken.
   *
   * State, and held here, for the reason `checkingId` is state in
   * `use-routability.ts`: the marker layer draws it. The gesture belongs to
   * `MapShapes`, the pins belong to `usePlaceMarkers`, and this component is the
   * nearest thing that owns both — so the list comes up out of one and goes down
   * into the other without map-editor.tsx learning that a route has a look.
   *
   * A set rather than the array it arrives as: the marker effect asks
   * `has(id)` once per marker, and a route may hold 25 stops against 3,000 pins.
   */
  const [stopIds, setStopIds] = useState<ReadonlySet<string>>(NO_STOPS);

  /*
   * Stable, so it never re-binds the drawing effect that closes over it — and it
   * collapses "still empty" back onto `NO_STOPS`, so disarming twice, or a
   * cleanup landing after a reset, does not restyle every marker for nothing.
   */
  const handleStopsChange = useCallback((placeIds: readonly string[]) => {
    setStopIds(placeIds.length === 0 ? NO_STOPS : new Set(placeIds));
  }, []);

  const [openingBounds] = useState<ShapeBounds | null>(
    () =>
      initialBounds ??
      (fitToPlaces ? selectionBounds({ points: places, geometries: [] }) : null),
  );

  /*
   * Read from the stored blob once per change, not per render: the card reads
   * `layout.width` to decide which side of the pin it opens on, and a fresh
   * object every render would re-run that measurement sixty times a second while
   * the map is panned.
   */
  const cardLayout = useMemo(
    () => effectiveCardLayout(storedCardLayout),
    [storedCardLayout],
  );

  const { map, isReady } = useMaplibre(frame, container, {
    center,
    zoom,
    bounds: openingBounds,
    style,
    appearance,
    showCompass,
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

  /*
   * The mode classes MapLibre's own container wears, derived once so the effect
   * below and nothing else decides when they are on.
   */
  /*
   * A route is drawn with the same gesture as a line but is not a `ShapeKind`,
   * so `drawMode` is null throughout — which quietly excluded it from every flag
   * derived from `drawMode`, this file's two included. The consequence was not
   * cosmetic: `drawing-shapes` is what makes the pins inert, and the route tool
   * is the one tool whose every click is *supposed* to land on a pin. Without it
   * each click hit the marker, opened that location's card and never reached the
   * map, so the only stops that could be added were the ones on empty ground.
   * Every flag below therefore asks about the route tool by name.
   */
  const isRouting = Boolean(shapes?.isRouting);

  const isCrosshair =
    isAdding ||
    Boolean(shapes?.drawMode) ||
    isRouting ||
    Boolean(selection?.isSelecting);
  const isDrawing = Boolean(shapes?.drawMode) || isRouting;

  /*
   * Written with `classList`, never with React's `className`.
   *
   * MapLibre's constructor adds `maplibregl-map` to this same element, and that
   * class carries `position: relative` and `overflow: hidden`. React owns an
   * attribute it renders: had `className` held these two, every toggle of a mode
   * would rewrite the whole attribute and take MapLibre's class with it. Benign
   * only for as long as the frame outside happens to be `relative` too.
   *
   * So the element is rendered with a static class list and never touched by
   * React again, and the modes are added beside MapLibre's rather than over it.
   *
   * `maplibregl-crosshair`, not Tailwind's `cursor-crosshair`. The cursor the
   * pointer actually reads is the one on
   * `.maplibregl-canvas-container.maplibregl-interactive` — a *child* of this
   * element — and maplibre-gl.css sets it to `grab` at (0,2,0), against a utility
   * class's (0,1,0). A cursor class here is dead over the canvas, which is why
   * arming a tool still showed a hand. MapLibre ships this class for exactly this
   * case: its selectors reach the child and the `:active` state, so it beats both
   * `grab` and `grabbing`. Ours would have to win on source order against a
   * stylesheet injected at runtime by this module's own dynamic chunk, which is
   * not a fight worth picking twice.
   *
   * `drawing-shapes` is separate, and the shape tools and the route tool set it.
   * A location's marker is a DOM element over the canvas, roughly 26px across —
   * wider than the 12px the line tool snaps from. So every click inside the
   * magnet's reach landed on the marker, opened that location's card, and never
   * reached the map at all: the hint bar promised a snap the UI made unreachable.
   * The class turns markers inert for the length of a drawing gesture
   * (app/globals.css). For the route tool it is not a refinement but the whole
   * feature — see `isRouting` above.
   *
   * Not extended to add mode. Dropping a pin on top of an existing one is a thing
   * people do by accident far more often than on purpose, and its card opening is
   * the feedback that says so.
   *
   * `picking-pins` is the route tool alone, and it is an instruction rather than
   * a behaviour: it grows every pin and ripples it a few times, because a route
   * is made of locations and nothing else on screen said so. Arming the tool
   * moved the cursor and wrote a hint bar, while the things you are meant to
   * click looked exactly as they had a moment before — so the first question
   * anyone asked was what to do with it. The scale holds for the length of the
   * gesture; the ripple is a bounded burst, because a Pro map is 3,000 markers
   * and an endless animation on all of them buys no further information.
   */
  useEffect(() => {
    const element = container.current;
    if (!element) return;

    element.classList.toggle("maplibregl-crosshair", isCrosshair);
    element.classList.toggle("drawing-shapes", isDrawing);
    element.classList.toggle("picking-pins", isRouting);
  }, [isCrosshair, isDrawing, isRouting]);

  /*
   * The armed pin, under the pointer, for the length of sticky add mode — the
   * half of "two ways to add a location" that used to show you nothing. See
   * use-add-mode-ghost.ts.
   */
  useAddModeGhost({
    container,
    isActive: isAdding,
    icon: addIcon,
    pinIcons,
  });

  usePlaceMarkers({
    map,
    isReady,
    places,
    selectedPlaceId,
    selectedPlaceIds,
    colorFor,
    pinIcons,
    // The same flag that writes `.drawing-shapes` below. The stylesheet takes
    // markers out of the pointer's way; this says the same thing in JavaScript,
    // because a library that writes `pointer-events` inline can undo a rule but
    // not a guard. See the note on that rule in app/globals.css.
    isArmed: isDrawing,
    // Drawn grey while the route tool is armed, and inert to it. The set lives
    // with the shapes props because routing is what gathers it, but the pins are
    // what wear it.
    unroutableIds: shapes?.unroutableIds,
    checkingId: shapes?.checkingId,
    // Which pins the route being drawn has taken. It comes back up out of
    // `MapShapes` below — see `handleStopsChange`.
    stopIds,
    onSelect: onSelectPlace,
    onMove: onMovePlace,
  });

  // Latest handlers and mode without re-binding the map listener on every render.
  // Assigned in an effect, not during render — refs are not render output.
  const clickHandler = useRef(onMapClick);
  const selectHandler = useRef(onSelectPlace);
  const selectShapeHandler = useRef(shapes?.onSelectShape);
  const addingRef = useRef(isAdding);
  // `isDrawing`, not `shapes?.drawMode`: the route tool arms no `ShapeKind`, and
  // reading the kind here let every route click fall through to the browse-mode
  // branch below and select whatever shape it landed on. See `isRouting` above.
  const drawingRef = useRef(isDrawing);
  const selectingRef = useRef(selection?.isSelecting ?? false);

  useEffect(() => {
    clickHandler.current = onMapClick;
    selectHandler.current = onSelectPlace;
    selectShapeHandler.current = shapes?.onSelectShape;
    addingRef.current = isAdding;
    drawingRef.current = isDrawing;
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
        // Filtered to the layers that are actually there:
        // `queryRenderedFeatures` throws on a layer it cannot find, and a map
        // with no shapes has added none of them.
        const layers = SHAPE_HIT_LAYERS.filter((layer) =>
          instance.getLayer(layer),
        );
        const onShape =
          layers.length > 0 &&
          instance.queryRenderedFeatures(event.point, { layers }).length > 0;

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
   *
   * Pre-armed when the map was already born framed, which is the normal case —
   * the effect below then never runs at all. What is left for it is the one case
   * construction cannot cover: a canvas that mounted with nothing on it and got
   * its first locations afterwards.
   */
  const hasFitted = useRef(openingBounds !== null);

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

      getExportView: () => {
        const instance = map.current;
        const box = container.current?.getBoundingClientRect();
        if (!instance || !box) return null;

        const centre = instance.getCenter();

        return {
          // MapLibre's own resolved style: sources with their URLs filled in and
          // layers with the theme's tint already applied.
          style: instance.getStyle(),
          center: { lng: centre.lng, lat: centre.lat },
          zoom: instance.getZoom(),
          bearing: instance.getBearing(),
          pitch: instance.getPitch(),
          // CSS pixels, which is what MapLibre measures its zoom against — the
          // export scales its own zoom from the ratio between the two.
          width: box.width,
          height: box.height,
        };
      },

      fitBounds: (bounds, options) => {
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
            duration:
              options?.animate === false || prefersReducedMotion ? 0 : 700,
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
         * Static, and it has to stay static — the mode classes are added by the
         * `classList` effect above, which explains why.
         */
        className="h-full w-full"
      />

      {selection ? <SelectBox ref={selectBox} /> : null}

      {/* Before the place card, so a shape's card never covers a location's —
          the pins are what the map is mostly about. */}
      {shapes ? (
        <MapShapes
          map={map}
          isReady={isReady}
          // The canvas already has these; shapes need them because a line bonded
          // to a location is drawn from wherever that location is now.
          places={places}
          selectedShapeIds={selectedShapeIds}
          onStopsChange={handleStopsChange}
          {...shapes}
        />
      ) : null}

      {showPlaceCard ? (
        <PlaceCard
          map={map}
          isReady={isReady}
          /* The card draws in the map's own light/dark — the studio, this
             canvas and the customer's site are one picture. See
             `cardThemeClass`. */
          theme={cardThemeClass(style, prefersDark)}
          /*
           * Hidden while adding: the point of add mode is dropping several pins
           * in a row, and a card opening over the map after each one is in the
           * way.
           *
           * Hidden while drawing for a harder reason. The card is 256px of
           * `pointer-events-auto` parked 22px from its pin, and MapLibre fires
           * neither `click` nor `mousemove` under it — so a line drawn towards a
           * selected location stopped dead at the edge of its own card, with the
           * rubber band frozen and the endpoint unplaceable. Making markers inert
           * (the `drawing-shapes` class) never reached this: the card is a React
           * sibling of the map container, not a marker inside it. MapShapes has
           * always applied the same rule to its own card — see map-shapes.tsx.
           *
           * It also settles an Escape that meant two things at once: the card
           * closed on it and the line tool cancelled on it, both from window
           * listeners, so one press did both. Unmounted, the card has no listener
           * to fire.
           */
          place={isAdding || isDrawing ? null : selectedPlace}
          layout={cardLayout}
          fields={fields ?? []}
          tagChips={
            selectedPlace ? tagChipsOf(tagGroups ?? [], selectedPlace.tags) : []
          }
          // The same pins the markers are drawn from, so a card holding a Logo
          // block shows the pin its own location wears.
          pinIcons={pinIcons ?? []}
          slots={cardSlots}
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
