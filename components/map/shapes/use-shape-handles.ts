"use client";

import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import {
  edgeMidpointAt,
  edgeMidpoints,
  insertPointAt,
  translatePoints,
} from "@/lib/map/polygon-edit";
import { snapToPlace } from "@/lib/map/snap-to-place";
import type { Place, Shape } from "@/lib/repositories/types";
import { MAX_POLYGON_POINTS } from "@/lib/validation/shape.schema";
import {
  MIN_CIRCLE_RADIUS_M,
  radiusFrom,
  radiusHandle,
  shapeCentre,
  type LngLatTuple,
  type ShapeGeometry,
} from "@/packages/shared/shapes";

/**
 * Past this many corners the midpoints stop being drawn.
 *
 * They double the marker count, and the gesture they exist for — "this boundary
 * is not detailed enough here" — is not one anybody has on a shape already traced
 * with a hundred points. Below the cap they are the difference between a polygon
 * you can refine and one you have to redraw.
 */
const MIDPOINT_LIMIT = 100;

/**
 * The grab points on the selected shape.
 *
 * DOM `Marker`s, not another style layer, and deliberately so: MapLibre's markers
 * already know how to be dragged, so a handle inherits the same machinery the
 * pins use rather than growing a second pointer state machine. It also means a
 * handle is a real element — focusable, styleable, and above the canvas where a
 * cursor change actually reads.
 *
 * A circle gets two. The centre moves it; the one on the border, due east, sizes
 * it. Two handles rather than four because a circle has one dimension — four
 * would be three redundant controls and a lot more to keep in step.
 *
 * A polygon gets three kinds:
 *
 * - **One per corner**, which moves that corner.
 * - **One in the middle**, which moves the whole thing. A polygon could only ever
 *   be reshaped, never *relocated* — the customer who traced a district and then
 *   found it forty metres east had to drag every corner in turn, or delete it and
 *   start again. It is the same `--centre` handle a circle has, because it does
 *   the same job and there is no reason for the two to look different.
 * - **One halfway along every edge**, which is not a corner yet. Drag it and the
 *   edge gains one, at the point you dragged it to. This is the only way to add a
 *   corner after the shape is saved; before it, a boundary that came out too
 *   coarse had to be drawn again from nothing.
 *
 * Every handle stays on screen for every gesture. That sounds like the default
 * and was not: the midpoints used to hide themselves for the length of any drag,
 * on the theory that a suggestion sitting off a moving edge reads as the shape
 * coming apart. It reads far worse. Dragging a corner blanked half the controls,
 * releasing it snapped them back from wherever they had been, and dragging a
 * midpoint hid the very handle the pointer was holding. They ride their edges
 * instead — `positionIn` is what makes that a two-line answer.
 *
 * In every case the drag paints through `onPreview` and saves once, on release.
 * A PATCH per pointer sample would be a request every few milliseconds for a
 * position that is already out of date by the time it lands.
 */
export function useShapeHandles({
  map,
  isReady,
  shape,
  places,
  color,
  onPreview,
  onCommit,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /** Candidates a line's endpoint can bond to as it is dropped. */
  places: Place[];
  /** The selected shape, or null when nothing is selected. */
  shape: Shape | null;
  /**
   * What the shape is actually painted on the map — a group's colour, or its
   * own. Only the midpoints read it: they are dots *on the outline*, so they have
   * to wear the outline's colour, and a grouped shape's outline is not its own.
   */
  color: string;
  onPreview: (shapeId: string, geometry: ShapeGeometry | null) => void;
  onCommit: (shapeId: string, geometry: ShapeGeometry) => void;
}) {
  const handlers = useRef({ onPreview, onCommit });
  /*
   * Read at drop time, never at mount time. The handles are rebuilt only when the
   * shape or its colour changes, so capturing `places` in that effect would bond
   * against whatever was on the map when the shape was selected.
   */
  const livePlaces = useRef(places);

  useEffect(() => {
    handlers.current = { onPreview, onCommit };
    livePlaces.current = places;
  });

  /**
   * The geometry the handles are currently describing.
   *
   * A ref rather than a closure over `shape.geometry`, because dragging one
   * vertex has to start from where the *previous* drag left the others — and the
   * query cache is only written on release.
   */
  const live = useRef<ShapeGeometry | null>(null);

  /**
   * True from pointer-down to release. While it is set, the effect below must not
   * rebuild the handles: a background refetch landing mid-drag would otherwise
   * replace the element the pointer is holding, and the drag would die.
   */
  const isDragging = useRef(false);

  /**
   * The shape whose preview is still up while its PATCH is in flight, or null.
   *
   * Releasing a handle does *not* clear the preview any more, and that is the
   * whole fix for the flicker. `useUpdateShape.onMutate` is an async function
   * opening with `await cancelQueries`, so the optimistic cache write lands a
   * microtask or more after the pointer comes up. Deleting the override in the
   * `dragend` handler redraws the source there and then — synchronously, from a
   * `shapes` array that still holds the *pre-drag* geometry — so the old outline
   * gets painted for a frame or two before the new one arrives.
   *
   * So the rule is: a preview is cleared when the saved geometry catches up, not
   * when the pointer lifts. The effect at the bottom of this file does that.
   */
  const pendingPreviewId = useRef<string | null>(null);

  const shapeId = shape?.id ?? null;
  const geometry = shape?.geometry ?? null;

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !shapeId || !geometry) return;
    if (isDragging.current) return;

    live.current = geometry;

    /**
     * The handles currently on the map, each with the rule for where it belongs.
     *
     * `positionIn` is what lets a drag move the handles it is *not* holding.
     * MapLibre moves the dragged element itself, but knows nothing about the
     * others — so before this, moving a circle by its centre left the radius
     * handle stranded at the old position for the whole gesture, and it only
     * caught up when the commit rebuilt every marker from scratch.
     */
    const handles: {
      marker: Marker;
      /** Where this handle sits for a given geometry, or null if it no longer applies. */
      positionIn: (geometry: ShapeGeometry) => { lng: number; lat: number } | null;
    }[] = [];

    /**
     * True from the moment a midpoint drag inserts its corner.
     *
     * Every `positionIn` below indexes into the ring by position, and an insert
     * shifts each corner after it by one — so from that instant the other handles'
     * closures are describing the wrong entries. Nothing needs them to be right:
     * splitting one edge in two moves no corner and changes no *other* edge, so
     * every handle but the dragged one is already where it belongs. Suspending the
     * sync is what keeps them there until the commit rebuilds the set.
     */
    let hasGrown = false;

    /**
     * Move every handle except the one under the pointer.
     *
     * The dragged marker is skipped deliberately: MapLibre rewrites that
     * element's inline transform on every pointer sample, so a `setLngLat` here
     * would be overwritten anyway — and on a clamped drag it fights the gesture.
     */
    const sync = (next: ShapeGeometry, dragged: Marker) => {
      if (hasGrown) return;

      for (const entry of handles) {
        if (entry.marker === dragged) continue;

        const at = entry.positionIn(next);
        if (at) entry.marker.setLngLat([at.lng, at.lat]);
      }
    };

    /**
     * One draggable handle, wired to report where it ended up.
     *
     * Returns its element, which one caller needs: a midpoint stops being a
     * midpoint half-way through its own drag.
     */
    const handle = (
      position: { lng: number; lat: number },
      variant: "centre" | "radius" | "vertex" | "midpoint",
      label: string,
      onDrag: (to: { lng: number; lat: number }) => ShapeGeometry,
      positionIn: (geometry: ShapeGeometry) => { lng: number; lat: number } | null,
    ) => {
      const element = document.createElement("div");
      element.className = `shape-handle shape-handle--${variant}`;
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", label);
      element.tabIndex = 0;

      // Only the midpoints read it — see the `color` prop — but setting it on
      // every handle keeps one rule about where the value lives.
      element.style.setProperty("--shape-handle-color", color);

      const marker = new Marker({ element, draggable: true })
        .setLngLat([position.lng, position.lat])
        .addTo(instance);

      marker.on("dragstart", () => {
        isDragging.current = true;
        element.classList.add("shape-handle--dragging");
      });

      marker.on("drag", () => {
        const next = onDrag(marker.getLngLat());
        live.current = next;
        sync(next, marker);
        handlers.current.onPreview(shapeId, next);
      });

      marker.on("dragend", () => {
        isDragging.current = false;
        element.classList.remove("shape-handle--dragging");

        const next = onDrag(marker.getLngLat());
        live.current = next;
        sync(next, marker);

        /*
         * The preview stays up. It is cleared once the cache has the new
         * geometry — see `pendingPreviewId` above and the effect below.
         */
        pendingPreviewId.current = shapeId;
        handlers.current.onCommit(shapeId, next);
      });

      // A handle sits on top of the shape it belongs to; a click that reached the
      // fill underneath would re-select what is already selected, and a click that
      // reached the map would clear the selection out from under the handles.
      element.addEventListener("click", (event) => event.stopPropagation());

      handles.push({ marker, positionIn });

      return element;
    };

    if (geometry.kind === "circle") {
      handle(
        geometry,
        "centre",
        "Move this circle",
        (to) => {
          const current = live.current;
          const radius =
            current?.kind === "circle" ? current.radius : geometry.radius;

          return { kind: "circle", lng: to.lng, lat: to.lat, radius };
        },
        (next) =>
          next.kind === "circle" ? { lng: next.lng, lat: next.lat } : null,
      );

      handle(
        radiusHandle(geometry),
        "radius",
        "Resize this circle",
        (to) => {
          const current = live.current;
          const centre = current?.kind === "circle" ? current : geometry;

          return {
            kind: "circle",
            lng: centre.lng,
            lat: centre.lat,
            // Floored, or the handle lands under the centre handle and neither can
            // be picked up again.
            radius: Math.max(radiusFrom(centre, to), MIN_CIRCLE_RADIUS_M),
          };
        },
        // Due east of the centre, which is the contract `radiusHandle` states and
        // the only direction this handle is supposed to travel in.
        (next) => (next.kind === "circle" ? radiusHandle(next) : null),
      );
    } else {
      const saved = geometry;
      /*
       * Polygon or line — the handles are identical and the geometry they write
       * is not. Carried in a variable rather than hardcoded because this branch
       * used to be the polygon branch by assumption: a line fell into it and
       * every drag wrote `kind: "polygon"`, quietly turning a route into an area
       * on its first edit.
       */
      const kind = saved.kind;
      const isClosed = kind === "polygon";

      /** The ring as it stands right now, part-way through a drag included. */
      const livePoints = (): readonly LngLatTuple[] => {
        const current = live.current;
        return current && current.kind === kind ? current.points : saved.points;
      };

      /**
       * Rebuild the geometry, carrying a line's bonds across.
       *
       * The bonds have to survive every reshape: they live on the geometry, so a
       * spread that forgot them would silently unbond a line the moment anyone
       * nudged a middle corner.
       */
      const rebuild = (points: LngLatTuple[]): ShapeGeometry =>
        kind === "line"
          ? { ...(live.current?.kind === "line" ? live.current : saved), points }
          : { kind: "polygon", points };

      /** One corner moved, the rest left where they are. */
      const moveVertex = (index: number, to: { lng: number; lat: number }) => {
        const points: LngLatTuple[] = livePoints().map((existing, at) =>
          at === index ? [to.lng, to.lat] : existing,
        );

        return rebuild(points);
      };

      /*
       * The whole shape, by its middle.
       *
       * The step is measured from where the *centre* currently is rather than
       * from where the drag started, and that is what makes it need no
       * drag-start capture: `live.current` is rewritten on every pointer sample,
       * so each sample contributes only its own increment. `dragend` runs this
       * once more with an unmoved pointer, which is a zero step — idempotent, as
       * it has to be.
       */
      handle(
        shapeCentre(saved),
        "centre",
        "Move this shape",
        (to) => {
          const points = livePoints();
          const from = shapeCentre({ kind: "polygon", points: [...points] });

          return rebuild(
            translatePoints(points, to.lng - from.lng, to.lat - from.lat),
          );
        },
        (next) => (next.kind === kind ? shapeCentre(next) : null),
      );

      /**
       * Which end of a line this corner is, or null for a middle point.
       *
       * Only the ends bond. A middle point that passes near a pin is a bend in
       * the route, not a stop on it — bonding it would drag the whole line about
       * whenever that location moved.
       */
      const endOf = (index: number): "from" | "to" | null => {
        if (kind !== "line") return null;
        if (index === 0) return "from";
        if (index === saved.points.length - 1) return "to";
        return null;
      };

      saved.points.forEach((point, index) => {
        const end = endOf(index);

        handle(
          { lng: point[0], lat: point[1] },
          "vertex",
          `Move point ${index + 1}`,
          (to) => {
            if (!end) return moveVertex(index, to);

            /*
             * An endpoint decides its bond on every sample, not just on release.
             * Dropped near a location it attaches; dragged away it lets go — and
             * because the preview redraws from the resolved geometry, both are
             * visible while the pointer is still down rather than announced by a
             * jump afterwards.
             */
            const snap = snapToPlace(livePlaces.current, instance.project(to), (place) =>
              instance.project([place.lng, place.lat]),
            );

            const moved = moveVertex(
              index,
              snap ? { lng: snap.point[0], lat: snap.point[1] } : to,
            );
            if (moved.kind !== "line") return moved;

            const next = { ...moved };
            if (snap?.placeId) {
              next[end] = snap.placeId;
            } else {
              delete next[end];
            }

            return next;
          },
          (next) => {
            if (next.kind !== kind) return null;

            const at = next.points[index];
            return at ? { lng: at[0], lat: at[1] } : null;
          },
        );
      });

      /*
       * A point that is not a point yet, halfway along each edge.
       *
       * Nothing happens until it is dragged, and the corner is inserted on the
       * first sample of that drag rather than on `dragstart` — so a click on one
       * leaves the shape exactly as it was. From the insert onwards the handle is
       * an ordinary vertex handle for the corner it just made, which is why the
       * ring only ever gains one point per gesture however far it travels.
       *
       * It also *looks* like one from that moment, because it is one: the class is
       * swapped on insert rather than waiting for the rebuild. Without it the
       * thing under the pointer went on drawing itself as a suggestion for the
       * length of the drag that had already accepted it.
       */
      const canGrow = saved.points.length < Math.min(MAX_POLYGON_POINTS, MIDPOINT_LIMIT);

      if (canGrow) {
        edgeMidpoints(saved.points, isClosed).forEach((midpoint, index) => {
          // The new corner lands *after* the edge's first corner.
          const at = index + 1;
          let hasInserted = false;

          /*
           * Assigned from the call the closure below is an argument to, which is
           * why it is read through a variable rather than passed in: the element
           * does not exist until `handle` has been given the handler that wants
           * it. By the time anything drags, it does.
           */
          const element: HTMLElement = handle(
            midpoint,
            "midpoint",
            `Add a point between ${index + 1} and ${isClosed ? ((index + 1) % saved.points.length) + 1 : index + 2}`,
            (to) => {
              if (hasInserted) return moveVertex(at, to);

              hasInserted = true;
              hasGrown = true;
              element.classList.replace(
                "shape-handle--midpoint",
                "shape-handle--vertex",
              );

              return rebuild(insertPointAt(livePoints(), at, [to.lng, to.lat]));
            },
            /*
             * It rides its edge while a *neighbouring* corner is dragged, which is
             * the whole reason midpoints are no longer hidden for the length of a
             * drag. They were, and it made the two commonest gestures wrong:
             * dragging a corner blanked every suggestion on the shape, and
             * releasing it teleported them from where they had been to where they
             * now belonged.
             *
             * Only ever asked while some *other* handle is being dragged — `sync`
             * skips the one under the pointer, and suspends entirely once this
             * handle has inserted (see `hasGrown`) — so reading the edge at this
             * index is always reading the edge this handle still sits on.
             */
            (next) =>
              next.kind === kind
                ? edgeMidpointAt(next.points, index, isClosed)
                : null,
          );
        });
      }
    }

    return () => {
      for (const entry of handles) entry.marker.remove();
    };
  }, [map, isReady, shapeId, geometry, color]);

  /*
   * The saved geometry has changed, so the preview held over from the last drag
   * has nothing left to say. Declared after the effect above so both run against
   * the same geometry in one commit — the handles are rebuilt and the override
   * dropped together, and there is no frame showing one without the other.
   *
   * This also covers a failed PATCH: the rollback is a cache write too, so the
   * preview clears and the shape snaps back to what the server actually has.
   */
  useEffect(() => {
    const pending = pendingPreviewId.current;
    if (!pending || isDragging.current) return;

    pendingPreviewId.current = null;
    handlers.current.onPreview(pending, null);
  }, [shapeId, geometry]);

  // Deselecting or unmounting mid-drag must not leave a preview pinned on a shape
  // nobody is holding any more.
  useEffect(() => {
    return () => {
      isDragging.current = false;

      const pending = pendingPreviewId.current;
      if (!pending) return;

      pendingPreviewId.current = null;
      handlers.current.onPreview(pending, null);
    };
  }, [shapeId]);
}
