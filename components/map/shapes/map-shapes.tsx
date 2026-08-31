"use client";

import { toast } from "@heroui/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

import { useDrawRoute } from "@/components/map/routes/use-draw-route";
import { probeOrder } from "@/lib/map/probe-order";
import { placeIndex } from "@/lib/map/line-endpoints";
import { isRouteStale, resolvedStops } from "@/lib/map/route-staleness";
import { removeStopAt } from "@/lib/map/route-stops";
import type { Place, Shape } from "@/lib/repositories/types";
import {
  routeOf,
  type LineGeometry,
  type RouteProfile,
  type RouteStop,
  type ShapeGeometry,
  type ShapeKind,
} from "@/packages/shared/shapes";
import { ShapeCard } from "./shape-card/shape-card";
import { useDrawCircle } from "./use-draw-circle";
import { useDrawLine } from "./use-draw-line";
import { useDrawPolygon } from "./use-draw-polygon";
import { useShapeHandles } from "./use-shape-handles";
import { useShapeLayers } from "./use-shape-layers";

/**
 * One frozen empty set, so a canvas with no routing at all hands the drawing
 * hook the same object on every render rather than a new one to re-run on.
 */
const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * Everything shape-shaped that happens inside the canvas, in one component.
 *
 * It exists so `map-canvas-impl.tsx` gains one child and one prop group rather
 * than five hooks and a dozen props — the canvas is already the largest file in
 * the folder, and the import review and preview screens reuse its props without
 * wanting any of this.
 *
 * The drawing hooks share exactly one thing: the preview channel. Drawing paints
 * through `draw`, dragging a handle paints through `preview`, and both write
 * straight to the GeoJSON source without a React render. See use-shape-layers.ts.
 */
export type MapShapesProps = {
  shapes: Shape[];
  selectedShapeId: string | null;
  /** Which tool is armed, or null in browse mode. */
  drawMode: ShapeKind | null;
  /**
   * What colour to actually paint each shape. Defaults to the shape's own.
   *
   * A shape in a group takes the group's colour, so that membership is visible
   * on the map and not only in the sidebar. Resolved by the caller for the same
   * reason the pins' colour is: `map-editor.tsx` is the only place that knows
   * about groups.
   */
  colorFor?: (shape: Shape) => string;
  onSelectShape: (shapeId: string | null) => void;
  onEditShape?: (shapeId: string) => void;
  onCreateShape: (geometry: ShapeGeometry) => void;
  onUpdateShape: (shapeId: string, geometry: ShapeGeometry) => void;
  /** Leaves the drawing tool — Escape, or a gesture that drew nothing. */
  onStopDrawing: () => void;
  /**
   * True while the route tool is armed.
   *
   * Separate from `drawMode` because a route is not a `ShapeKind`: it saves as a
   * line, so folding it in would arm the plain line tool alongside it and every
   * click would be handled twice.
   */
  isRouting?: boolean;
  /**
   * Ask a routing engine for roads between stops.
   *
   * Supplied by the caller rather than called here, so the one place in the app
   * that reaches a metered service stays one place — and so the screens that
   * only display a map (preview, import review) inherit no routing at all by
   * simply not passing it.
   */
  onRoute?: (
    stops: readonly RouteStop[],
    profile: RouteProfile,
  ) => Promise<LineGeometry | null>;
  /** True while a route request is in flight, for the card's Recalculate. */
  isRoutePending?: boolean;
  /**
   * Locations the routing engine cannot reach, and how to find out.
   *
   * Optional as a pair, for `onRoute`'s reason: the screens that only display a
   * map never arm the route tool, so they inherit neither the state nor the
   * requests. Absent, every pin is treated as reachable and the engine still has
   * the last word when a route is actually asked for.
   */
  unroutableIds?: ReadonlySet<string>;
  /** The one location a click is waiting on, drawn as being asked about. */
  checkingId?: string | null;
  /** Ask about these locations in the background. Answers arrive as they land. */
  onProbeRoutability?: (places: readonly Place[]) => void;
  /**
   * Settle one location now, waiting for the engine if the answer is not in.
   *
   * The click path, as opposed to `onProbeRoutability`'s sweep: a stop must
   * never be accepted on a pin whose verdict simply had not arrived yet.
   */
  onCheckRoutability?: (place: Place) => Promise<boolean>;
  /** Stop the background sweep — the tool has disarmed. */
  onStopProbing?: () => void;
};

export function MapShapes({
  map,
  isReady,
  shapes,
  places,
  selectedShapeId,
  selectedShapeIds,
  drawMode,
  colorFor,
  onSelectShape,
  onEditShape,
  onCreateShape,
  onUpdateShape,
  onStopDrawing,
  isRouting,
  onRoute,
  isRoutePending,
  unroutableIds,
  onProbeRoutability,
  onCheckRoutability,
  onStopProbing,
  onStopsChange,
}: MapShapesProps & {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /**
   * The map's locations, for lines to bond to and be drawn from.
   *
   * Supplied by the canvas, which already has them, rather than by the caller's
   * prop group — so map-editor.tsx never learns that shapes grew an opinion
   * about pins, and the import review and preview screens that reuse these props
   * are unaffected.
   */
  places: Place[];
  /**
   * Shapes picked out by the marquee or a group, which light up the same way a
   * clicked one does. Empty when the canvas has no selection feature at all.
   */
  selectedShapeIds?: ReadonlySet<string>;
  /**
   * Which locations the route being drawn has taken as stops, as that changes.
   *
   * Supplied by the canvas for `places`' reason and passed straight back to it:
   * the gesture happens in here, and the pins that have to show it are markers
   * the canvas owns. Nothing in this component reads it — routing state travels
   * *down* through the caller's prop group, and this is the one piece that has
   * to travel back up.
   */
  onStopsChange?: (placeIds: readonly string[]) => void;
}) {
  // Only the camera move to a route's stop reads it. Here rather than inside
  // that callback because a hook cannot be called from one.
  const prefersReducedMotion = useReducedMotion();

  const { preview, draw } = useShapeLayers({
    map,
    isReady,
    shapes,
    selectedShapeId,
    selectedShapeIds,
    drawMode,
    isRouting,
    colorFor,
    onSelect: onSelectShape,
  });

  /*
   * Looked up here rather than passed in, so the card and the handles follow a
   * shape edited elsewhere — renaming one in the dialog updates the open card,
   * because both read the same query cache entry.
   */
  const selectedShape =
    shapes.find((shape) => shape.id === selectedShapeId) ?? null;

  /**
   * True between a finished gesture and the row for it appearing in `shapes`.
   *
   * The drawing tools clear their draft the moment the pointer comes up, but the
   * create is a round trip — even the optimistic insert is a microtask away,
   * because `useCreateShape.onMutate` opens with `await cancelQueries`. Without
   * this the circle you just drew blinks out and back in. Same rule the handles
   * follow on release: the draft goes when the saved data can replace it.
   */
  const isDrafting = useRef(false);

  const createShape = useCallback(
    (geometry: ShapeGeometry) => {
      isDrafting.current = true;
      // Re-paints what the tool just cleared. Both calls land inside the same
      // pointerup handler, so nothing is painted in between.
      draw(geometry);
      onCreateShape(geometry);
    },
    [draw, onCreateShape],
  );

  useEffect(() => {
    if (!isDrafting.current) return;

    isDrafting.current = false;
    draw(null);
  }, [shapes, draw]);

  useDrawCircle({
    map,
    isReady,
    isActive: drawMode === "circle",
    onPreview: draw,
    onDraw: createShape,
    onCancel: onStopDrawing,
  });

  useDrawPolygon({
    map,
    isReady,
    isActive: drawMode === "polygon",
    onPreview: draw,
    onDraw: createShape,
    onCancel: onStopDrawing,
  });

  useDrawLine({
    map,
    isReady,
    isActive: drawMode === "line",
    places,
    onPreview: draw,
    onDraw: createShape,
    onCancel: onStopDrawing,
  });

  /**
   * A finished set of stops, turned into a route and saved.
   *
   * The straight draft is re-drawn before the request rather than left to the
   * tool, which clears its own preview on commit: without it the whole gesture
   * blinks off the map for the length of a round trip and reads as a lost click.
   * The road path replaces it when the engine answers, in the same `draw` channel
   * — so nothing here re-renders React while the map changes.
   */
  const drawRoute = useCallback(
    async (stops: RouteStop[]) => {
      if (!onRoute) return;

      draw({ kind: "line", points: stops.map((stop) => stop.at) });

      const geometry = await onRoute(stops, "car");
      if (!geometry) {
        // The request said why, in a toast. Clearing the draft is what stops a
        // straight line hanging on the map pretending to be a route.
        draw(null);
        return;
      }

      createShape(geometry);
    },
    [draw, createShape, onRoute],
  );

  /**
   * A click on a pin the engine cannot reach.
   *
   * Named, because the pin is grey and visibly there — "nothing happened" is
   * exactly the reading this whole feature exists to stop. The same sentence the
   * route request gives when it learns the same thing the expensive way
   * (use-route-request.ts), so a location says the same thing about itself
   * whichever way you find out.
   */
  const refuseStop = useCallback(
    (placeId: string) => {
      const name = places.find((place) => place.id === placeId)?.name;

      toast.warning(`${name ?? "That location"} can't be a stop`, {
        description:
          "There is no road near it, so the routing engine can't reach it. Move the pin closer to a road, or pick a different location.",
        timeout: 6000,
      });
    },
    [places],
  );

  /**
   * Every pin, asked about in the background as soon as the tool is armed.
   *
   * This used to be `places.filter((place) => !place.address)`, on the argument
   * that a location the reverse geocoder found nothing within 300m of is very
   * often one with no road either. The argument is sound and the filter was
   * still the bug that killed the feature: every pin that arrives by geocode,
   * search or import *has* an address, so on a real map it selected nothing,
   * asked nothing, and no pin ever greyed. Address-less pins now go first
   * instead of going alone — see lib/map/probe-order.ts, which also decides how
   * far down the list to go and why.
   *
   * Ordered from the middle of the map outward, so the ceiling is spent on the
   * pins someone is looking at rather than on whatever the array held first.
   */
  const probe = onProbeRoutability;
  const stopProbing = onStopProbing;

  /** The pin the pointer has settled on, asked about one at a time. */
  const considerStop = useCallback(
    (placeId: string) => {
      const place = places.find((candidate) => candidate.id === placeId);
      if (place) probe?.([place]);
    },
    [places, probe],
  );

  /** The pin a click is waiting on, so its marker can say so. */
  const checkStop = useCallback(
    async (placeId: string) => {
      const place = places.find((candidate) => candidate.id === placeId);
      if (!place || !onCheckRoutability) return true;

      return onCheckRoutability(place);
    },
    [places, onCheckRoutability],
  );

  /*
   * Read through a ref, and the effect below depends on neither.
   *
   * The effect's cleanup *aborts* the sweep, so anything in its dependency list
   * kills a sweep in progress — and `asked` then holds every pin the dead sweep
   * had claimed, so the restart asks about nothing. Two things in the obvious
   * list change on their own: `places` on any background refetch, and `probe`
   * on every single render, because the caller builds it inline. The sweep must
   * start when the tool arms and stop when it disarms, and at no other moment.
   */
  const sweepInputs = useRef({ places, probe, stopProbing });
  useEffect(() => {
    sweepInputs.current = { places, probe, stopProbing };
  });

  useEffect(() => {
    if (!isRouting || !isReady) return;

    const centre = map.current?.getCenter();
    if (!centre) return;

    const { places: known, probe: ask } = sweepInputs.current;
    if (!ask) return;

    const sweep = probeOrder(known, centre);
    if (sweep.length > 0) ask(sweep);

    // Disarming ends the sweep. Two hundred pins at one request per second on
    // the public engine runs for minutes after the gesture it was drawn for.
    return () => sweepInputs.current.stopProbing?.();
  }, [isRouting, isReady, map]);

  useDrawRoute({
    map,
    isReady,
    isActive: Boolean(isRouting && onRoute),
    places,
    unroutableIds: unroutableIds ?? EMPTY_IDS,
    onPreview: draw,
    onDraw: drawRoute,
    onRefused: refuseStop,
    onCheck: checkStop,
    onConsider: considerStop,
    onCancel: onStopDrawing,
    onStopsChange,
  });

  /*
   * The selected route's stops, moved to where their pins are now, and whether
   * that has taken the route away from the roads it was drawn on.
   *
   * Computed from the live locations on every render rather than stored, for the
   * same reason a line's endpoints are resolved rather than written: nothing has
   * to touch a route when a location moves, and a route can never be left holding
   * a coordinate that has quietly stopped being true.
   */
  const selectedRoute = selectedShape ? routeOf(selectedShape.geometry) : null;
  const selectedLine =
    selectedShape && selectedShape.geometry.kind === "line"
      ? selectedShape.geometry
      : null;

  const isStale = selectedLine
    ? isRouteStale(selectedLine, placeIndex(places))
    : false;

  /**
   * Ask the engine for a route through these stops and save what comes back.
   *
   * The one path for both ways a saved route changes — Recalculate, and dropping
   * a stop from the card. They differ only in which stops they hand over, so
   * anything else they shared would be a second copy of the same four lines with
   * its own opportunity to forget the profile.
   */
  const routeThrough = useCallback(
    async (stops: readonly RouteStop[]) => {
      if (!onRoute || !selectedShape || !selectedRoute) return;

      const geometry = await onRoute(stops, selectedRoute.profile);
      if (geometry) onUpdateShape(selectedShape.id, geometry);
    },
    [onRoute, selectedShape, selectedRoute, onUpdateShape],
  );

  /** The stops as they are *now* — the whole content of "recalculate". */
  const recalculate = useCallback(() => {
    if (!selectedLine) return;
    void routeThrough(resolvedStops(selectedLine, placeIndex(places)));
  }, [routeThrough, selectedLine, places]);

  /**
   * One stop dropped, and the route asked again for the ones that remain.
   *
   * Resolved first, so the survivors go back to the engine at the positions
   * their pins are at now rather than where they were when it last answered —
   * removing a stop from a route that had also gone stale should not quietly
   * re-commit the stale coordinates.
   */
  const removeStop = useCallback(
    (index: number) => {
      if (!selectedLine) return;

      const next = removeStopAt(
        resolvedStops(selectedLine, placeIndex(places)),
        index,
      );

      // null at two stops, which is the fewest a path can have. The card hides
      // the control there, so this is the second guard rather than the message.
      if (next) void routeThrough(next);
    },
    [routeThrough, selectedLine, places],
  );

  /**
   * Move the map to one of the route's stops.
   *
   * The third stop of a long route is usually off screen, and with the vertex
   * handles gone the list is the only thing that knows where it is. It flies to
   * where the pin is *now* — through `resolvedStops`, so a stop whose location
   * has moved is found where it moved to and not where the route last drew it.
   *
   * It deliberately does not select that location: `selectPlace` clears
   * `selectedShapeId`, so opening the pin's card would close the route card the
   * list is being read in.
   *
   * The camera rule is `MapHandle.flyTo`'s, restated rather than shared because
   * the handle belongs to the canvas and this component holds the map directly:
   * zoom in but never back out, and under reduced motion just arrive.
   */
  const focusStop = useCallback(
    (index: number) => {
      const instance = map.current;
      if (!instance || !selectedLine) return;

      const stop = resolvedStops(selectedLine, placeIndex(places))[index];
      if (!stop) return;

      instance.flyTo({
        center: stop.at,
        zoom: Math.max(instance.getZoom(), 15),
        duration: prefersReducedMotion ? 0 : 700,
        // Marks the move as essential so the browser's own reduced-motion
        // handling does not cancel it and leave the camera where it was.
        essential: true,
      });
    },
    [map, selectedLine, places, prefersReducedMotion],
  );

  useShapeHandles({
    map,
    isReady,
    places,
    /*
     * No handles while a tool is armed: they sit exactly where the next click
     * would go, and grabbing one instead of drawing is not what anyone meant.
     *
     * And none at all on a routed line, which is a different argument and a
     * firmer one. A route's points are the engine's answer about where the roads
     * go; dragging one moves the path off the road it snapped to, and
     * `resolveGeometry` already refuses to rubber-band a routed line for exactly
     * that reason. A handle writing a geometry the rest of the system declines
     * to trust was never coherent. A route is changed through its stops instead
     * — see `removeStop` and Recalculate.
     */
    shape: drawMode || isRouting || selectedRoute ? null : selectedShape,
    // The colour the outline is actually painted, resolved the same way
    // `useShapeLayers` resolves it — a grouped shape's midpoints have to sit on
    // the line they belong to, not on the colour it stopped being.
    color: selectedShape
      ? (colorFor?.(selectedShape) ?? selectedShape.color)
      : "",
    onPreview: preview,
    onCommit: onUpdateShape,
  });

  const close = useCallback(() => onSelectShape(null), [onSelectShape]);

  return (
    <ShapeCard
      // Hidden while drawing, like the place card is while adding pins: a card
      // opening over the map is in the way of the thing you are drawing.
      shape={drawMode || isRouting ? null : selectedShape}
      places={places}
      isRouteStale={isStale}
      isRecalculating={isRoutePending ?? false}
      onClose={close}
      onEdit={onEditShape}
      // Focusing a stop needs only the map, which this component always has;
      // the other two reach the engine, so they stand down wherever routing
      // does — the preview and import-review screens pass no `onRoute`.
      onFocusStop={selectedRoute ? focusStop : undefined}
      onRemoveStop={onRoute && selectedRoute ? removeStop : undefined}
      onRecalculate={onRoute && selectedRoute ? recalculate : undefined}
    />
  );
}
