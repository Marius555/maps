"use client";

import { toast } from "@heroui/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useState } from "react";

import type { MapHandle } from "@/components/map/map-canvas-impl";
import {
  addShapeLayers,
  shapeFeature,
} from "@/components/map/shapes/shape-layers";
import {
  downloadBlob,
  exportFilename,
  exportMapImage,
  ExportError,
  type ExportOptions,
} from "@/lib/export/export-map";
import { DEFAULT_PAPER, DEFAULT_QUALITY } from "@/lib/export/paper";
import type { ExportPlace } from "@/lib/export/place-features";
import type { Place, Shape } from "@/lib/repositories/types";
import {
  resolvePin,
  UNCATEGORISED_PIN_COLOR,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * The export, as one call the toolbar can make.
 *
 * It lives here rather than in `map-editor.tsx` for the reason everything else
 * has been moved out of that file: it is already a thousand lines, and a pending
 * flag, an error string and a toast are three more things it does not need to
 * hold. What the editor keeps is the data — the places, the shapes and the two
 * colour resolvers — because it is the only thing that has them.
 *
 * Those resolvers are the point of passing them in rather than reading a
 * category off each place here. A group's colour beats a category's and beats a
 * custom pin's own (`colorFor` in map-editor.tsx), and that ranking has one owner.
 * A second copy of it would make an exported map disagree with the map it is a
 * picture of, in exactly the case — a recoloured group — where somebody would be
 * exporting to show the grouping off.
 */
export function useMapExport({
  mapHandle,
  name,
  places,
  shapes,
  pinIcons,
  colorFor,
  shapeColorFor,
}: {
  mapHandle: React.RefObject<MapHandle | null>;
  /** Names the file and titles the PDF. */
  name: string;
  places: Place[];
  /** Already resolved: a line bonded to a location carries that location's spot. */
  shapes: Shape[];
  pinIcons?: CustomPinIcon[];
  colorFor: (place: Place, pinColor?: string) => string | undefined;
  shapeColorFor: (shape: Shape) => string;
}) {
  const [options, setOptions] = useState<ExportOptions>({
    format: "png",
    paper: DEFAULT_PAPER,
    quality: DEFAULT_QUALITY,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * The map frame's size, sampled rather than watched.
   *
   * The panel needs it to say what "same shape as the map" multiplies out to, and
   * a ResizeObserver on the canvas would be a re-render of the editor per frame
   * of every window drag to keep a number in a popover that is usually shut
   * correct. Sampling when the panel opens is the same answer at a hundredth of
   * the cost — a frame cannot resize while its own popover is open.
   */
  const [view, setView] = useState({ width: 0, height: 0 });

  /** Called when the panel opens: fresh measurements, and no stale complaint. */
  const refresh = useCallback(() => {
    const current = mapHandle.current?.getExportView();
    if (current) setView({ width: current.width, height: current.height });
    setError(null);
  }, [mapHandle]);

  const run = useCallback(async () => {
    const view = mapHandle.current?.getExportView();
    if (!view) {
      setError("The map isn't ready yet. Give it a moment and try again.");
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const { blob, filename } = await exportMapImage(
        {
          view,
          places: places.map((place) => toExportPlace(place, pinIcons, colorFor)),
          shapes,
          pinIcons,
          title: exportFilename(name),
        },
        options,
        (map: MapLibreMap) => {
          addShapeLayers(map, {
            type: "FeatureCollection",
            // Never selected: the thicker outline a selected shape wears is a
            // fact about this editing session, not about the map.
            features: shapes.map((shape) =>
              shapeFeature(shape, shape.geometry, false, shapeColorFor(shape)),
            ),
          });
        },
      );

      downloadBlob(blob, filename);
      // "Export" on the button, "Exported" in the toast — an action keeps its
      // name through the whole flow (§8).
      toast.success("Exported", { description: filename });
    } catch (caught) {
      setError(
        caught instanceof ExportError
          ? caught.message
          : "We couldn't export that map. Try a smaller quality, or reload the page.",
      );
    } finally {
      setIsBusy(false);
    }
  }, [mapHandle, name, options, pinIcons, places, shapes, colorFor, shapeColorFor]);

  return {
    options,
    view,
    isBusy,
    error,
    setOptions,
    refresh,
    exportMap: useCallback(() => void run(), [run]),
  };
}

/**
 * A location as the export renderer wants it: a point, an icon id and one
 * resolved colour.
 *
 * The colour is ranked exactly as `paint` in use-place-markers.ts ranks it — a
 * custom pin's own colour offered to the resolver, which may override it with a
 * group's. The final fallback is the fixed grey rather than the dashboard's
 * `--accent`, because an exported file has no theme to read and `--accent` is an
 * `oklch()` value that neither MapLibre's colour parser nor a canvas fill would
 * take.
 */
function toExportPlace(
  place: Place,
  pinIcons: CustomPinIcon[] | undefined,
  colorFor: (place: Place, pinColor?: string) => string | undefined,
): ExportPlace {
  const pin = resolvePin(place.icon, pinIcons);

  return {
    lng: place.lng,
    lat: place.lat,
    icon: place.icon,
    color: colorFor(place, pin?.color ?? undefined) ?? UNCATEGORISED_PIN_COLOR,
  };
}
