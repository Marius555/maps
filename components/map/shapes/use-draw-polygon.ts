"use client";

import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import {
  MIN_POLYGON_POINTS,
  type LngLatTuple,
  type PolygonGeometry,
} from "@/packages/shared/shapes";

/**
 * Click a boundary out, point by point.
 *
 * The line follows the cursor between clicks, so the edge you are about to commit
 * to is visible before you commit to it. Finish by clicking the first point
 * again, by double-clicking, or by pressing Enter — three ways because the first
 * is the one people try, the second is the one they know from other tools, and
 * the third is the one that works without a pointer at all.
 *
 * Backspace takes back the last point. Escape abandons the whole outline, which
 * matters more here than for a circle: a polygon is many decisions, and being
 * unable to undo the ninth without losing the first eight would make anyone
 * reluctant to start.
 */
export function useDrawPolygon({
  map,
  isReady,
  isActive,
  onPreview,
  onDraw,
  onCancel,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  isActive: boolean;
  /** The outline as it currently stands, including the point under the cursor. */
  onPreview: (geometry: PolygonGeometry | null) => void;
  onDraw: (geometry: PolygonGeometry) => void;
  onCancel: () => void;
}) {
  const handlers = useRef({ onPreview, onDraw, onCancel });

  useEffect(() => {
    handlers.current = { onPreview, onDraw, onCancel };
  });

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isActive) return;

    /** How near the first point counts as clicking it, in screen pixels. */
    const CLOSE_RADIUS_PX = 12;

    let points: LngLatTuple[] = [];

    const show = (hover?: LngLatTuple) => {
      // The hovered point is drawn but never stored — it is where the next click
      // *would* land, not a decision anyone has made yet.
      const preview = hover ? [...points, hover] : points;
      handlers.current.onPreview({ kind: "polygon", points: preview });
    };

    const reset = () => {
      points = [];
      handlers.current.onPreview(null);
    };

    const commit = () => {
      if (points.length < MIN_POLYGON_POINTS) return false;

      const drawn = { kind: "polygon" as const, points };
      reset();
      handlers.current.onDraw(drawn);
      return true;
    };

    const isOnFirstPoint = (event: MapMouseEvent) => {
      if (points.length < MIN_POLYGON_POINTS) return false;

      const first = instance.project(points[0]);
      return (
        Math.hypot(first.x - event.point.x, first.y - event.point.y) <
        CLOSE_RADIUS_PX
      );
    };

    const onClick = (event: MapMouseEvent) => {
      if (isOnFirstPoint(event) && commit()) return;

      points = [...points, [event.lngLat.lng, event.lngLat.lat]];
      show();
    };

    const onMouseMove = (event: MapMouseEvent) => {
      if (points.length === 0) return;
      show([event.lngLat.lng, event.lngLat.lat]);
    };

    const onDoubleClick = (event: MapMouseEvent) => {
      // The two clicks underneath already added their points, so the last one is
      // a duplicate of the one before it.
      if (points.length > MIN_POLYGON_POINTS) points = points.slice(0, -1);
      if (points.length >= MIN_POLYGON_POINTS) event.preventDefault();

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
