"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

import {
  HEAT_SOURCE,
  addHeatLayers,
  heatFeatures,
  setHeatGround,
  type HeatPoint,
} from "./heat-layers";

/**
 * Puts the coverage layers on the map, and keeps them there.
 *
 * Much simpler than `use-shape-layers.ts`, and for one reason: the data never
 * changes. Nothing on the Analytics page adds, drags or recolours a location, so
 * the source is added already populated instead of added empty and filled — there
 * is no second code path to keep in step, and no per-frame update to throttle.
 *
 * The `styledata` handler is the same guard the shape layers carry. Nothing here
 * calls `setStyle`, but MapLibre abandons its style diff and reloads from scratch
 * whenever the diff throws, and that path drops every runtime source. `styledata`
 * fires repeatedly while a style and its tiles load, so the guard tests for the
 * source rather than re-adding: `addHeatLayers` is idempotent, but re-serialising
 * three thousand points on every tile batch is not free.
 */
export function useHeatLayer({
  map,
  isReady,
  points,
  isDarkGround,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  points: readonly HeatPoint[];
  /**
   * Whether the basemap under this is dark, which flips the ramp's anchor.
   * Resolved by the caller, because "is Auto dark right now" is a question about
   * the viewer rather than about the map.
   */
  isDarkGround: boolean;
}) {
  const data = useMemo(() => heatFeatures(points), [points]);

  /*
   * The ground, readable by the install effect without being a dependency of it.
   *
   * Depending on it directly would tear the source down and rebuild it on a
   * colour change, handing the whole feature collection back to the worker to
   * re-tile. Seeded correctly at mount, and kept current by the effect below.
   */
  const groundRef = useRef(isDarkGround);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady) return;

    const install = () => {
      if (instance.getSource(HEAT_SOURCE)) return;
      addHeatLayers(instance, data, groundRef.current);
    };

    install();
    instance.on("styledata", install);

    return () => {
      instance.off("styledata", install);
    };
  }, [map, isReady, data]);

  /**
   * Repaint when the ground flips under a map that is already up.
   *
   * Only Auto reaches here: a pinned basemap or theme looks the same for
   * everyone, but Auto follows the dashboard's own light/dark. `setStyle` carries
   * the source across (lib/map/carry-style.ts), so the layers survive the swap
   * still painted for the ground they were added on, and the install effect above
   * short-circuits on the source it finds.
   *
   * This effect owns `groundRef` as well as the repaint, so the value the install
   * effect reads is written in exactly one place.
   */
  useEffect(() => {
    groundRef.current = isDarkGround;

    const instance = map.current;
    if (!instance || !isReady) return;

    setHeatGround(instance, isDarkGround);
  }, [map, isReady, isDarkGround]);
}
