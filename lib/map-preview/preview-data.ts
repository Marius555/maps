import { toExportPlace, type ExportPlace } from "@/lib/export/export-place";
import type { OffscreenCamera } from "@/lib/export/render-map";
import { isDefaultView } from "@/lib/map/default-view";
import { isValidLngLat } from "@/lib/map/geo";
import { groupColorIndex } from "@/lib/map/group-colors";
import { placeIndex, resolveGeometry } from "@/lib/map/line-endpoints";
import { selectionBounds } from "@/lib/map/selection-bounds";
import type { AppMap, Group, Place, Shape } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * Everything the maps list needs to draw one map's preview, resolved on the
 * server so the browser does nothing but render it.
 *
 * Pure, so the colour precedence and the framing can be tested without a map.
 * The colours come from `groupColorIndex` and `toExportPlace` — the same two
 * functions the editor's canvas and its PNG export read — so a preview cannot
 * paint a pin a colour the map itself does not.
 */
export type MapPreviewData = {
  places: ExportPlace[];
  /** Colour already resolved (a group's beats the shape's own), lines pinned down. */
  shapes: Shape[];
  pinIcons: CustomPinIcon[];
  camera: OffscreenCamera;
};

/** CSS pixels kept clear around the locations when a preview frames them. */
export const PREVIEW_PADDING = 24;
/** The editor's own fit ceiling, so one shop is a street, not a doorway. */
export const PREVIEW_MAX_ZOOM = 14;

export function buildPreviewData({
  map,
  places,
  shapes,
  groups,
}: {
  map: AppMap;
  places: readonly Place[];
  shapes: readonly Shape[];
  groups: readonly Group[];
}): MapPreviewData {
  // A location with no usable coordinates has nowhere to be drawn, and one at
  // NaN would widen the frame to nothing.
  const usable = places.filter((place) => isValidLngLat(place.lng, place.lat));

  const colors = groupColorIndex({ groups, shapes, tagGroups: map.tagGroups });

  /*
   * Bonded lines follow the locations they connect, as they do in the snapshot
   * (lib/snapshot/build.ts): stored coordinates are only the fallback.
   */
  const located = placeIndex(usable);
  const resolvedShapes = shapes.map((shape) => ({
    ...shape,
    color: colors.forShape(shape),
    geometry: resolveGeometry(shape.geometry, located),
  }));

  return {
    places: usable.map((place) =>
      toExportPlace(place, map.pinIcons, (p, pinColor) => colors.forPlace(p, pinColor)),
    ),
    shapes: resolvedShapes,
    pinIcons: map.pinIcons,
    camera: previewCamera(
      map,
      selectionBounds({
        points: usable,
        geometries: resolvedShapes.map((shape) => shape.geometry),
      }),
    ),
  };
}

/**
 * Where a preview looks — the editor's own opening rule (map-editor.tsx), so the
 * card shows the map the owner sees when they open it.
 *
 * A view the owner saved wins. Otherwise the frame is whatever is on the map,
 * and only a map with nothing on it falls back to the stored default.
 *
 * A saved zoom is one step out from what was saved. It was chosen in the
 * editor's canvas, and a 480px preview is roughly half that wide — at the same
 * zoom it would show a quarter of the area the owner framed.
 */
export function previewCamera(
  map: Pick<AppMap, "defaultLat" | "defaultLng" | "defaultZoom">,
  bounds: ReturnType<typeof selectionBounds>,
): OffscreenCamera {
  if (isDefaultView(map) && bounds) {
    return { bounds, padding: PREVIEW_PADDING, maxZoom: PREVIEW_MAX_ZOOM };
  }

  return {
    center: { lng: map.defaultLng, lat: map.defaultLat },
    zoom: Math.max(0, map.defaultZoom - 1),
  };
}
