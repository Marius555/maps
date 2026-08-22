"use client";

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { Place } from "@/lib/repositories/types";
import { snapToPlace, type Snap } from "@/lib/map/snap-to-place";
import {
  MIN_LINE_POINTS,
  type LineGeometry,
  type LngLatTuple,
} from "@/packages/shared/shapes";

/**
 * Click a path out, point by point.
 *
 * Nearly `use-draw-polygon.ts`, and deliberately so — the gesture people already
 * know here is the same one. Two differences, both from a line being open:
 * two points is enough to finish, and there is no click-the-first-point-to-close,
 * because a line has nothing to close.
 *
 * The third difference is snapping. Near a location, the point under the cursor
 * jumps onto it and the line remembers *which* location by id, so the endpoint
 * follows that pin afterwards. The snap is applied on hover as well as on click,
 * which is the part that makes it usable: a magnet you only discover after
 * committing is indistinguishable from a misclick.
 *
 * There is no extra highlight on the target pin, deliberately. The rubber band's
 * end visibly leaves the cursor and lands on the pin, which says "this click will
 * attach here" without a second signal — and a halo would mean another layer to
 * re-add after every `setStyle`, for something already shown.
 *
 * Only the two ends bond. A middle point that happens to pass near a pin is a
 * bend in the route, not a stop on it, and bonding it would drag the whole line
 * about when that pin moved.
 */
export function useDrawLine({
  map,
  isReady,
  isActive,
  places,
  onPreview,
  onDraw,
  onCancel,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  isActive: boolean;
  /** Candidates for an endpoint to bond to. */
  places: Place[];
  /** The path as it currently stands, including the point under the cursor. */
  onPreview: (geometry: LineGeometry | null) => void;
  onDraw: (geometry: LineGeometry) => void;
  onCancel: () => void;
}) {
  const handlers = useRef({ onPreview, onDraw, onCancel });
  const live = useRef(places);

  useEffect(() => {
    handlers.current = { onPreview, onDraw, onCancel };
    live.current = places;
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isActive) return;

    let points: LngLatTuple[] = [];
    /** Bonds by point index. Only ever index 0 and the last one survive commit. */
    let bonds = new Map<number, string>();

    const snapAt = (event: MapMouseEvent): Snap =>
      snapToPlace(live.current, event.point, (place) =>
        instance.project([place.lng, place.lat]),
      ) ?? {
        point: [event.lngLat.lng, event.lngLat.lat],
        placeId: null,
      };

    const show = (hover?: LngLatTuple) => {
      // The hovered point is drawn but never stored — it is where the next click
      // *would* land, not a decision anyone has made yet.
      const preview = hover ? [...points, hover] : points;
      handlers.current.onPreview({ kind: "line", points: preview });
    };

    const reset = () => {
      points = [];
      bonds = new Map();
      handlers.current.onPreview(null);
    };

    const commit = () => {
      if (points.length < MIN_LINE_POINTS) return false;

      // Only the ends carry a bond into the saved shape. Anything bonded in the
      // middle was a convenience while drawing and is not a relationship.
      const from = bonds.get(0);
      const to = bonds.get(points.length - 1);

      const drawn: LineGeometry = {
        kind: "line",
        points,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      };

      reset();
      handlers.current.onDraw(drawn);
      return true;
    };

    const onClick = (event: MapMouseEvent) => {
      const snap = snapAt(event);

      if (snap.placeId) bonds.set(points.length, snap.placeId);
      points = [...points, snap.point];
      show();
    };

    const onMouseMove = (event: MapMouseEvent) => {
      if (points.length === 0) return;
      show(snapAt(event).point);
    };

    const onDoubleClick = (event: MapMouseEvent) => {
      // The two clicks underneath already added their points, so the last one is
      // a duplicate of the one before it.
      if (points.length > MIN_LINE_POINTS) {
        bonds.delete(points.length - 1);
        points = points.slice(0, -1);
      }
      if (points.length >= MIN_LINE_POINTS) event.preventDefault();

      commit();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        reset();
        handlers.current.onCancel();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        commit();
        return;
      }

      if (event.key === "Backspace" && points.length > 0) {
        event.preventDefault();
        bonds.delete(points.length - 1);
        points = points.slice(0, -1);

        if (points.length === 0) {
          reset();
        } else {
          show();
        }
      }
    };

    // Double-clicking is how you finish, so it must not also zoom.
    instance.doubleClickZoom.disable();

    instance.on("click", onClick);
    instance.on("mousemove", onMouseMove);
    instance.on("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      instance.off("click", onClick);
      instance.off("mousemove", onMouseMove);
      instance.off("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKeyDown);

      instance.doubleClickZoom.enable();
      handlers.current.onPreview(null);
    };
  }, [map, isReady, isActive]);
}
