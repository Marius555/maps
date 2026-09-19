"use client";

import type { StyleSpecification } from "maplibre-gl";

import {
  addShapeLayers,
  shapeFeature,
} from "@/components/map/shapes/shape-layers";
import { composeExport } from "@/lib/export/compose";
import { addPlaceLayers } from "@/lib/export/place-features";
import { renderOffscreenMap } from "@/lib/export/render-map";
import { effectiveAppearance } from "@/lib/map/appearance";
import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import { ATTRIBUTION_TEXT, resolveStyleUrl, type MapStyleKey } from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import type { MapPreviewData } from "@/lib/map-preview/preview-data";
import { apiFetch } from "@/lib/query/fetcher";
import { loadMapStyle } from "@/packages/shared/load-style";

/*
 * Module scope, as every other map in the app does it (CLAUDE.md §7). This file
 * is only ever reached through `import()` from use-map-preview.ts, so none of
 * MapLibre runs during server rendering, and the maps list has no live map that
 * would have set the worker URL already — without it every tile fetch silently
 * does nothing and each preview comes back as a flat background.
 */
registerPmtilesProtocol();
configureMaplibreWorker();

/**
 * The frame a preview is drawn at, in CSS pixels. 16:10, the shape of the box
 * on the card, and fixed rather than measured so one cached picture fits every
 * card width — the box scales it with `object-cover`.
 */
export const PREVIEW_WIDTH = 480;
export const PREVIEW_HEIGHT = 300;

/** Pins at 60% of an export's: full size turns a dense map into one blob. */
const PIN_SCALE = 0.6;
/** Small enough to leave the map visible, still legible on a 2× display. */
const CREDIT_FONT_PX = 8;
const WEBP_QUALITY = 0.85;

/**
 * One map, drawn off screen and handed back as an image.
 *
 * The same renderer as Export (lib/export/render-map.ts), fed the same inputs:
 * the style resolved exactly as `useMaplibre` resolves it, the shapes and pins
 * drawn by the export's own layers, the credit painted on by the export's own
 * compositor — so a card is a small copy of the map, not a drawing of it.
 */
export async function renderPreview({
  mapId,
  style,
  appearance,
  prefersDark,
}: {
  mapId: string;
  style: MapStyleKey;
  appearance: Record<string, unknown>;
  prefersDark: boolean;
}): Promise<Blob> {
  const data = await apiFetch<MapPreviewData>(`/api/maps/${mapId}/preview`);

  const look = (await loadMapStyle(
    resolveStyleUrl(style),
    effectiveAppearance(style, appearance, prefersDark),
  )) as string | StyleSpecification;

  // Capped at 2×: a 3× phone would render a 1440px image for a 360px card.
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = await renderOffscreenMap(
    look,
    data.camera,
    { cssWidth: PREVIEW_WIDTH, cssHeight: PREVIEW_HEIGHT, pixelRatio },
    async (map) => {
      // Shapes under the pins, as on the editor's canvas and in an export.
      addShapeLayers(map, {
        type: "FeatureCollection",
        features: data.shapes.map((shape) =>
          shapeFeature(shape, shape.geometry, false),
        ),
      });
      await addPlaceLayers(map, data.places, data.pinIcons, PIN_SCALE);
    },
  );

  // A preview is a rendered map, so it carries the credit like any other (§12).
  composeExport(canvas, {
    attribution: ATTRIBUTION_TEXT,
    pixelRatio,
    fontPx: CREDIT_FONT_PX,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Preview encoding failed."))),
      "image/webp",
      WEBP_QUALITY,
    );
  });
}
