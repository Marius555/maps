"use client";

import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { Shape } from "@/lib/repositories/types";
import {
  MIN_CIRCLE_RADIUS_M,
  radiusFrom,
  radiusHandle,
  type LngLatTuple,
  type ShapeGeometry,
} from "@/packages/shared/shapes";

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
 * A polygon gets one per vertex.
 *
 * In every case the drag paints through `onPreview` and saves once, on release.
 * A PATCH per pointer sample would be a request every few milliseconds for a
 * position that is already out of date by the time it lands.
 */
export function useShapeHandles({
  map,
  isReady,
  shape,
  onPreview,
  onCommit,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /** The selected shape, or null when nothing is selected. */
  shape: Shape | null;
  onPreview: (shapeId: string, geometry: ShapeGeometry | null) => void;
  onCommit: (shapeId: string, geometry: ShapeGeometry) => void;
}) {
  const handlers = useRef({ onPreview, onCommit });

  useEffect(() => {
    handlers.current = { onPreview, onCommit };
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
     * Move every handle except the one under the pointer.
     *
     * The dragged marker is skipped deliberately: MapLibre rewrites that
     * element's inline transform on every pointer sample, so a `setLngLat` here
     * would be overwritten anyway — and on a clamped drag it fights the gesture.
     */
    const sync = (next: ShapeGeometry, dragged: Marker) => {
      for (const entry of handles) {
        if (entry.marker === dragged) continue;

        const at = entry.positionIn(next);
        if (at) entry.marker.setLngLat([at.lng, at.lat]);
      }
    };

    /** One draggable handle, wired to report where it ended up. */
    const handle = (
      position: { lng: number; lat: number },
      variant: "centre" | "radius" | "vertex",
      label: string,
      onDrag: (to: { lng: number; lat: number }) => ShapeGeometry,
      positionIn: (geometry: ShapeGeometry) => { lng: number; lat: number } | null,
    ) => {
      const element = document.createElement("div");
      element.className = `shape-handle shape-handle--${variant}`;
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", label);
      element.tabIndex = 0;

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
      geometry.points.forEach((point, index) => {
        handle(
          { lng: point[0], lat: point[1] },
          "vertex",
          `Move point ${index + 1}`,
          (to) => {
            const current = live.current;
            const points =
              current?.kind === "polygon" ? current.points : geometry.points;

            const moved: LngLatTuple[] = points.map((existing, at) =>
              at === index ? [to.lng, to.lat] : existing,
            );

            return { kind: "polygon", points: moved };
          },
          (next) => {
            if (next.kind !== "polygon") return null;

            const at = next.points[index];
            return at ? { lng: at[0], lat: at[1] } : null;
          },
        );
      });
    }

    return () => {
      for (const entry of handles) entry.marker.remove();
    };
  }, [map, isReady, shapeId, geometry]);

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
