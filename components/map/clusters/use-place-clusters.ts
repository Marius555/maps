"use client";

import type * as GeoJSON from "geojson";
import type {
  GeoJSONSource,
  MapLayerMouseEvent,
  Map as MapLibreMap,
} from "maplibre-gl";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

import type { Place } from "@/lib/repositories/types";
import {
  CLUSTER_LAYER,
  CLUSTER_SOURCE,
  addClusterLayers,
  clusterFeatures,
  removeClusterLayers,
  setClusterData,
  setClusterLayersVisible,
  unclusteredPlaceIds,
} from "./cluster-layers";

/**
 * Gathers nearby pins into numbered bubbles, the way the published map does.
 *
 * The bubbles are style layers (cluster-layers.ts); the pins stay DOM markers.
 * On every frame the map draws, this reads which locations the source still has
 * as single points and hands that set to the marker layer, which hides the rest.
 * `render` rather than `moveend`, because the bubbles re-form as a zoom crosses
 * each whole level, and a set that only caught up when the gesture ended would
 * leave pins and the bubbles counting them on screen together for its length.
 * The marker layer skips a set that has not changed, so an ordinary frame writes
 * nothing to the DOM.
 */
export function usePlaceClusters({
  map,
  isReady,
  places,
  selectedPlaceId,
  isEnabled,
  isSuspended,
  isBrowsing,
  onVisibleChange,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  places: Place[];
  /**
   * Always drawn as a pin. Its card is open and anchored to it, and a card
   * pointing into a bubble points at nothing.
   */
  selectedPlaceId: string | null;
  /**
   * Whether this canvas clusters at all. Off, there is no source — the import
   * review and the pin field want every pin, and the editor follows the Publish
   * tab's Clustering switch.
   */
  isEnabled: boolean;
  /**
   * Bubbles hidden and every pin shown, without taking the source down.
   *
   * For the length of a drawing gesture: a route is made of pins and the line
   * tool snaps to them, so a location swallowed by a bubble is one the tool
   * cannot reach. Hidden rather than removed, so putting the tool away does not
   * re-cluster three thousand points to get back to where the map was.
   */
  isSuspended: boolean;
  /**
   * Whether a click on a bubble may zoom into it. Not in add mode, where the
   * click is a location being dropped, and not while selecting.
   */
  isBrowsing: boolean;
  /** `null` means every pin is shown. */
  onVisibleChange: (placeIds: ReadonlySet<string> | null) => void;
}): void {
  const prefersReducedMotion = useReducedMotion();

  const placesRef = useRef(places);
  const selectedRef = useRef(selectedPlaceId);
  const suspendedRef = useRef(isSuspended);
  const browsingRef = useRef(isBrowsing);
  const reducedMotionRef = useRef(prefersReducedMotion);
  const onVisibleChangeRef = useRef(onVisibleChange);

  /** The places array the source was last filled from, so nothing sends it twice. */
  const sent = useRef<Place[] | null>(null);
  /** Whether the inline pointer cursor on the canvas is this hook's to take back. */
  const ownsCursor = useRef(false);

  // First, so every effect below reads this render's values.
  useEffect(() => {
    placesRef.current = places;
    selectedRef.current = selectedPlaceId;
    suspendedRef.current = isSuspended;
    browsingRef.current = isBrowsing;
    reducedMotionRef.current = prefersReducedMotion;
    onVisibleChangeRef.current = onVisibleChange;
  });

  /*
   * Empty deps, reading `map.current` inside — the idiom use-shape-layers.ts uses,
   * for the reason it gives: listing the ref makes the React Compiler refuse the
   * whole hook.
   */
  const sync = useCallback(() => {
    const instance = map.current;
    if (!instance) return;

    if (suspendedRef.current) {
      onVisibleChangeRef.current(null);
      return;
    }

    const ids = unclusteredPlaceIds(instance);
    // Still tiling: keep the last answer rather than a partial one.
    if (ids === undefined) return;

    if (ids && selectedRef.current) ids.add(selectedRef.current);
    onVisibleChangeRef.current(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Source, layers and listeners — and the source again if a style swap ever
   * takes it. lib/map/carry-style.ts normally carries it across, so the guard in
   * `install` short-circuits; this is the fallback for the rebuild path, the same
   * one use-shape-layers.ts keeps.
   */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isEnabled) return;

    const install = () => {
      if (instance.getSource(CLUSTER_SOURCE)) return;

      sent.current = placesRef.current;
      addClusterLayers(instance, clusterFeatures(placesRef.current));
      setClusterLayersVisible(instance, !suspendedRef.current);
    };

    const handleClick = (event: MapLayerMouseEvent) => {
      if (!browsingRef.current) return;

      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      if (!feature || typeof clusterId !== "number") return;

      const source = instance.getSource(CLUSTER_SOURCE) as GeoJSONSource | undefined;

      source
        ?.getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;

          instance.easeTo({
            center: [lng, lat],
            zoom,
            essential: true,
            // Arriving is the point; under reduced motion it just arrives.
            ...(reducedMotionRef.current ? { duration: 0 } : {}),
          });
        })
        // The source was given new data between the click and the answer, and
        // that cluster id no longer exists. Nothing to zoom to.
        .catch(() => {});
    };

    const enter = () => {
      if (!browsingRef.current) return;

      instance.getCanvas().style.cursor = "pointer";
      ownsCursor.current = true;
    };

    const leave = () => {
      if (!ownsCursor.current) return;

      instance.getCanvas().style.cursor = "";
      ownsCursor.current = false;
    };

    install();
    sync();

    instance.on("styledata", install);
    instance.on("render", sync);
    instance.on("click", CLUSTER_LAYER, handleClick);
    instance.on("mouseenter", CLUSTER_LAYER, enter);
    instance.on("mouseleave", CLUSTER_LAYER, leave);

    return () => {
      instance.off("styledata", install);
      instance.off("render", sync);
      instance.off("click", CLUSTER_LAYER, handleClick);
      instance.off("mouseenter", CLUSTER_LAYER, enter);
      instance.off("mouseleave", CLUSTER_LAYER, leave);
    };
  }, [map, isReady, isEnabled, sync]);

  /*
   * Turned off while the canvas is live — the setting changed under it.
   *
   * Its own effect rather than the cleanup above, because that cleanup also runs
   * on unmount, after use-maplibre.ts has already removed the map, and removing
   * a layer from a removed map throws.
   */
  useEffect(() => {
    if (isEnabled) return;

    const instance = map.current;
    if (!instance || !isReady) return;

    sent.current = null;
    removeClusterLayers(instance);
    onVisibleChangeRef.current(null);
  }, [map, isReady, isEnabled]);

  /* A location added, removed or moved re-clusters. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isEnabled) return;
    if (sent.current === places) return;

    sent.current = places;
    setClusterData(instance, clusterFeatures(places));
  }, [map, isReady, isEnabled, places]);

  /*
   * A tool armed or put away, or a different pin selected. Answered now rather
   * than on the next frame, because nothing else may be about to draw one.
   */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isEnabled) return;

    setClusterLayersVisible(instance, !isSuspended);
    sync();
  }, [map, isReady, isEnabled, isSuspended, selectedPlaceId, sync]);

  /*
   * Arming a tool with the pointer already over a bubble leaves the inline
   * pointer behind, and inline beats the crosshair class — `mouseleave` never
   * fires to take it back. The same repair use-shape-layers.ts makes.
   */
  useEffect(() => {
    if (isBrowsing || !ownsCursor.current) return;

    const instance = map.current;
    if (instance) instance.getCanvas().style.cursor = "";
    ownsCursor.current = false;
  }, [map, isBrowsing]);
}
