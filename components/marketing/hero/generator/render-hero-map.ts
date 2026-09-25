"use client";

import type { StyleSpecification } from "maplibre-gl";

import { renderOffscreenMap } from "@/lib/export/render-map";
import { effectiveAppearance } from "@/lib/map/appearance";
import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import { resolveStyleUrl, type MapStyleKey } from "@/lib/map/style";
import { configureMaplibreWorker } from "@/lib/map/worker";
import { HERO_APPEARANCE, HERO_CAMERA, HERO_SIZE } from "@/lib/marketing/hero-map";
import { loadMapStyle } from "@/packages/shared/load-style";

/*
 * Module scope, as every off-screen renderer does it: this page has no live map to have
 * set the worker URL, and without it every tile fetch silently does nothing.
 */
registerPmtilesProtocol();
configureMaplibreWorker();

const WEBP_QUALITY = 0.8;

/**
 * One look of the hero's basemap, drawn off screen and handed back as a WebP.
 *
 * The same renderer as Export and the maps list's previews
 * (lib/export/render-map.ts), fed the style exactly as the editor resolves it.
 * Nothing is drawn on top: the pins and the credit are HTML on the landing page,
 * so they stay sharp and the credit survives the frame cropping the picture.
 */
export async function renderHeroMap(
  style: MapStyleKey,
  pixelRatio: number,
): Promise<Blob> {
  const look = (await loadMapStyle(
    resolveStyleUrl(style),
    // `prefersDark` only matters to Auto, which neither look is.
    effectiveAppearance(style, HERO_APPEARANCE, false),
  )) as string | StyleSpecification;

  const canvas = await renderOffscreenMap(
    look,
    { center: HERO_CAMERA.center, zoom: HERO_CAMERA.zoom },
    { cssWidth: HERO_SIZE.width, cssHeight: HERO_SIZE.height, pixelRatio },
    () => {},
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("WebP encoding failed."))),
      "image/webp",
      WEBP_QUALITY,
    );
  });
}
