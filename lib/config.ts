/**
 * App-wide constants that are safe on the client.
 *
 * PRODUCT_NAME is a placeholder — renaming the product is a one-line change here.
 */

export const PRODUCT_NAME = "Map Embed";

export const PRODUCT_TAGLINE =
  "Put your locations on a map and embed it on your site.";

/** Where a new map opens before the owner moves it. */
export const DEFAULT_CENTER = {
  lat: 54.687,
  lng: 25.28,
  zoom: 11,
} as const;
