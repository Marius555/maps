import { DEFAULT_LAYER_TOGGLES } from "@/packages/shared/style-layers";

import { CONCRETE_MAP_STYLES, isAutoMapStyle, type MapStyleKey } from "./style";

/**
 * The pictures of each basemap theme that the maps list shows, committed under
 * `public/map-themes/`.
 *
 * A picture of a *theme*, not of a map: no locations, no shapes, and no text of
 * any kind — no city, street or water names — so nothing in it reads as "this is
 * your map of Amsterdam". Rendered once in development at `/dev/map-themes` and
 * served as static files, so the maps list runs no map library and asks no tile
 * host for anything.
 *
 * Regenerate them when a theme's colours change or a theme is added — open the
 * page, or run it headless with `?run=1`. A theme with no picture fails
 * theme-images.test.ts, so a broken image cannot reach the maps list.
 *
 * A plain module, not `"use client"`: the card and the generator both import
 * these values, and a constant read through a client reference is not the value.
 */

/** CSS pixels. About the shape of the slanted pane on a wide row; the pane crops. */
export const THEME_IMAGE_SIZE = { width: 960, height: 240 } as const;

export const THEME_IMAGE_PIXEL_RATIOS = [1, 2] as const;

/**
 * Where every picture looks. Somewhere with water, parks and a dense street grid,
 * so each theme's whole palette is on show. The place is never named — labels are
 * off — so it could be anywhere.
 */
export const THEME_IMAGE_CAMERA = {
  center: { lng: 4.8952, lat: 52.3702 },
  zoom: 12,
} as const;

/** Every symbol layer hidden (`applyLabelLevel`), so no text and no POI icons. */
export const THEME_IMAGE_APPEARANCE = {
  labels: "none",
  layers: { ...DEFAULT_LAYER_TOGGLES, poi: false },
} as const;

export type ThemeImageVariant = {
  /** The file's base name under `public/map-themes/`. */
  name: string;
  style: MapStyleKey;
  /** Only Auto depends on it: it has a light picture and a dark one. */
  prefersDark: boolean;
};

export const THEME_IMAGE_VARIANTS: readonly ThemeImageVariant[] = [
  { name: "auto-light", style: "auto", prefersDark: false },
  { name: "auto-dark", style: "auto", prefersDark: true },
  ...CONCRETE_MAP_STYLES.map((style) => ({ name: style, style, prefersDark: false })),
];

export function themeImageFileName(name: string, pixelRatio: number): string {
  return `${name}${pixelRatio === 1 ? "" : `@${pixelRatio}x`}.webp`;
}

/** Every file the generator may write — and the only names it may write. */
export const THEME_IMAGE_FILE_NAMES: ReadonlySet<string> = new Set(
  THEME_IMAGE_VARIANTS.flatMap((variant) =>
    THEME_IMAGE_PIXEL_RATIOS.map((ratio) => themeImageFileName(variant.name, ratio)),
  ),
);

export function themeImageSrc(name: string, pixelRatio: number): string {
  return `/map-themes/${themeImageFileName(name, pixelRatio)}`;
}

export function themeImageSrcSet(name: string): string {
  return THEME_IMAGE_PIXEL_RATIOS.map(
    (ratio) => `${themeImageSrc(name, ratio)} ${ratio}x`,
  ).join(", ");
}

/** The picture names a style is drawn with: two for Auto, one otherwise. */
export function themeImagesFor(style: MapStyleKey): { light: string; dark?: string } {
  return isAutoMapStyle(style)
    ? { light: "auto-light", dark: "auto-dark" }
    : { light: style };
}
