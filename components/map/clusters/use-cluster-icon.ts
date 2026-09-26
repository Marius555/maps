"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";

import {
  CLUSTER_COLOR,
  clusterIconPin,
  hideClusterIcon,
  showClusterIcon,
} from "@/packages/shared/clusters";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import {
  pinImageId,
  registerPinImageBitmaps,
  registerPinImages,
} from "@/packages/shared/pin-raster";
import {
  CLUSTER_COUNT_LAYER,
  CLUSTER_ICON_LAYER,
  CLUSTER_LAYER,
  CLUSTER_SOURCE,
} from "./cluster-layers";

/**
 * Draws the editor's clusters as the owner's cluster icon, the way the published
 * map does. The layers come from `showClusterIcon` in packages/shared/clusters.ts,
 * the same function the embed calls.
 *
 * On `styledata`, and that is the hard part. A basemap or theme change runs
 * `setStyle`, and lib/map/carry-style.ts carries the cluster source and its
 * layers across, icon layer included. It does not carry the *image*, so the icon
 * layer arrives naming a picture that no longer exists. `apply` therefore asks
 * whether the image is there, not whether the layer is. It rebuilds only when it
 * is not, which also makes it safe to run on every `styledata`, including the
 * ones its own `addLayer` calls fire.
 *
 * An uploaded image decodes asynchronously, so for a frame or two after a change
 * the grey bubble shows. That is better than an `icon-image` naming a missing
 * picture, which warns on every frame. `pending` stops the `styledata` events
 * fired meanwhile from starting the same decode again.
 */
export function useClusterIcon({
  map,
  isReady,
  isEnabled,
  clusterIcon,
  pinIcons,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /** Whether the canvas clusters at all. Off, there are no layers to dress. */
  isEnabled: boolean;
  /** `AppMap.clusterIcon`: "" for the bubble, a pin id, or an image. */
  clusterIcon: string;
  pinIcons: CustomPinIcon[];
}): void {
  useEffect(() => {
    const instance = map.current;
    if (!instance || !isReady || !isEnabled) return;

    let isCancelled = false;
    /** The image this effect put on the map, so a rebuild knows what it owns. */
    let shown: string | null = null;
    let pending: string | null = null;

    const apply = () => {
      // The cluster layers are installed by usePlaceClusters on the same event.
      // Not there yet means a later `styledata` will call this again.
      if (!instance.getLayer(CLUSTER_COUNT_LAYER)) return;

      const pin = clusterIconPin(clusterIcon, pinIcons);

      if (!pin) {
        if (instance.getLayer(CLUSTER_ICON_LAYER)) {
          hideClusterIcon(instance, CLUSTER_LAYER, CLUSTER_COUNT_LAYER);
        }
        return;
      }

      const id = pinImageId(pin.icon, CLUSTER_COLOR);
      if (pending === id) return;
      if (
        shown === id &&
        instance.hasImage(id) &&
        instance.getLayer(CLUSTER_ICON_LAYER)
      ) {
        return;
      }

      hideClusterIcon(instance, CLUSTER_LAYER, CLUSTER_COUNT_LAYER);
      // An upload always gets the same id (`custom:cluster`), so a new image
      // would otherwise be skipped as one the map already has.
      if (instance.hasImage(id)) instance.removeImage(id);

      const pairs = [{ icon: pin.icon, color: CLUSTER_COLOR }];

      if (registerPinImages(instance, pairs, pin.pins).has(id)) {
        shown = id;
        showClusterIcon(instance, CLUSTER_SOURCE, CLUSTER_LAYER, CLUSTER_COUNT_LAYER, id);
        return;
      }

      pending = id;
      void registerPinImageBitmaps(instance, pairs, pin.pins).then((added) => {
        pending = null;
        if (isCancelled || !added.has(id)) return;
        if (!instance.getLayer(CLUSTER_COUNT_LAYER)) return;
        if (instance.getLayer(CLUSTER_ICON_LAYER)) return;

        shown = id;
        showClusterIcon(instance, CLUSTER_SOURCE, CLUSTER_LAYER, CLUSTER_COUNT_LAYER, id);
      });
    };

    apply();
    instance.on("styledata", apply);

    return () => {
      isCancelled = true;
      instance.off("styledata", apply);
    };
  }, [map, isReady, isEnabled, clusterIcon, pinIcons]);
}
