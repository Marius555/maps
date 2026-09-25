"use client";

import type { StyleSpecification } from "maplibre-gl";

import { renderOffscreenMap } from "@/lib/export/render-map";
import { effectiveAppearance } from "@/lib/map/appearance";
import { registerPmtilesProtocol } from "@/lib/map/pmtiles";
import { resolveStyleUrl } from "@/lib/map/style";
import {
  THEME_IMAGE_APPEARANCE,
  THEME_IMAGE_CAMERA,
  THEME_IMAGE_SIZE,
  type ThemeImageVariant,
} from "@/lib/map/theme-images";
import { configureMaplibreWorker } from "@/lib/map/worker";
import { loadMapStyle } from "@/packages/shared/load-style";

/*
 * Module scope, as render-hero-map.ts does it: this page has no live map to have
 * set the worker URL, and without it every tile fetch silently does nothing.
 */
registerPmtilesProtocol();
configureMaplibreWorker();
const WEBP_QUALITY = 0.82;

/**
 * One theme, drawn off screen with nothing on it and no text, handed back as a
 * WebP for `public/map-themes/`.
 *
 * The same renderer as Export and the hero images (lib/export/render-map.ts), fed
 * the style exactly as the editor resolves it — so the picture is the theme's
 * real colours, not a drawing of them.
 */
export async function renderThemeImage(
  variant: ThemeImageVariant,
  pixelRatio: number,
): Promise<Blob> {
  const look = (await loadMapStyle(
    resolveStyleUrl(variant.style),
    effectiveAppearance(variant.style, THEME_IMAGE_APPEARANCE, variant.prefersDark),
  )) as string | StyleSpecification;

  const canvas = await renderOffscreenMap(
    look,
    { center: THEME_IMAGE_CAMERA.center, zoom: THEME_IMAGE_CAMERA.zoom },
    { cssWidth: THEME_IMAGE_SIZE.width, cssHeight: THEME_IMAGE_SIZE.height, pixelRatio },
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
