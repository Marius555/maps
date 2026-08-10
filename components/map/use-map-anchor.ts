"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

/** Breathing room between the anchored card and the frame's edges. */
const MARGIN = 8;

/**
 * Pins a DOM element to a geographic point.
 *
 * The position is written straight onto the element's `style.transform` rather
 * than held in React state. A pan fires `move` on every animation frame, and a
 * `setState` per frame would re-render whatever hangs off this anchor — sixty
 * times a second, for content that never changed.
 *
 * The returned ref goes on a wrapper that MapLibre does not own, so this is not a
 * `Marker`: markers are managed by the map and cannot hold React children.
 */
export function useMapAnchor(
  map: React.RefObject<MapLibreMap | null>,
  isReady: boolean,
  /** Where to pin it, or `null` when there is nothing to pin. */
  point: { lng: number; lat: number } | null,
  /**
   * How much room the anchored content needs to its right. When there is less
   * than this between the point and the map container's edge, the anchor is
   * marked `data-flip="left"` so CSS can open it on the other side instead.
   */
  flipWidth = 0,
) {
  const anchor = useRef<HTMLDivElement>(null);

  /*
   * `point` is depended on by identity, which is what makes a dragged pin work:
   * dropping one writes to the query cache, the place object is replaced, and
   * this re-runs and repositions. Nothing else would — dragging a marker does not
   * move the map, so no `move` event fires.
   *
   * Places come from the query cache and are never mutated in place, so identity
   * changing is a reliable signal that a coordinate might have.
   */
  const lng = point?.lng;
  const lat = point?.lat;

  /*
   * The anchored content's height, measured by an observer rather than read
   * during `place()`.
   *
   * The vertical clamp below needs it, and `offsetHeight` is a forced layout —
   * paying that on every frame of a pan is the cost this whole file exists to
   * avoid. The height only changes when the content does, which is exactly what
   * a ResizeObserver reports.
   */
  const contentHeight = useRef(0);
  const reposition = useRef<(() => void) | null>(null);

  useEffect(() => {
    const element = anchor.current?.firstElementChild;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      contentHeight.current = entry?.contentRect.height ?? 0;
      reposition.current?.();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const instance = map.current;
    const element = anchor.current;
    if (!instance || !isReady || !element || lng === undefined || lat === undefined) {
      return;
    }

    const place = () => {
      const { x, y } = instance.project([lng, lat]);
      const frame = instance.getContainer();
      const frameHeight = frame.clientHeight;

      /*
       * How far the card has to move off centre to stay inside the frame.
       *
       * CSS centres it on the pin (`translateY(-50%)`), which is right until the
       * pin is near an edge and the card is tall — and the frame is
       * `overflow-hidden`, so the half hanging out is not scrolled to, it is
       * gone. Nudging it back is better than opening it somewhere it cannot be
       * read. Zero when it already fits, which is the usual case.
       */
      const height = contentHeight.current;
      const top = y - height / 2;
      const lowest = Math.max(MARGIN, frameHeight - height - MARGIN);
      const shift = Math.min(Math.max(top, MARGIN), lowest) - top;

      /*
       * Rounded to whole pixels. Text at a subpixel offset is resampled by the
       * compositor on every frame of a pan, which is exactly the shimmer the rest
       * of this folder exists to avoid.
       */
      element.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      element.style.setProperty("--map-anchor-shift", `${Math.round(shift)}px`);

      // What the content may grow to before it has to scroll itself. Written
      // here because it tracks the frame, which resizes without a React render.
      element.style.setProperty(
        "--map-anchor-max-height",
        `${Math.max(frameHeight - MARGIN * 2, 0)}px`,
      );

      // An attribute rather than a class: CSS owns which side things open on, and
      // this stays a statement about the geometry.
      element.dataset.flip = frame.clientWidth - x < flipWidth ? "left" : "right";
    };

    place();
    reposition.current = place;

    // `move` covers pan, zoom, rotate and the resize-driven pan compensation in
    // use-maplibre.ts, so it is the only event needed.
    instance.on("move", place);

    return () => {
      reposition.current = null;
      instance.off("move", place);
    };
  }, [map, isReady, lng, lat, flipWidth]);

  return anchor;
}
