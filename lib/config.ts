import { BRAND } from "@/lib/brand";

/**
 * App-wide constants that are safe on the client.
 *
 * The name and tagline live in `brand.json` at the repo root, with the logo,
 * company and legal links — rename the product there, not here. They are
 * re-exported under these names so the places that already read them did not
 * have to change.
 */

export const PRODUCT_NAME = BRAND.name;

export const PRODUCT_TAGLINE = BRAND.tagline;

/**
 * Where a new map opens before the owner moves it: the whole world.
 *
 * A new map has nothing on it, so any *place* this opened on would be a guess
 * about where the owner's locations are — and it was Vilnius, which is a guess
 * that is wrong for almost everybody. The world is the one framing that is never
 * wrong, and it is also the framing that makes the first pin easy to drop:
 * zooming in from a whole world takes two scrolls, while panning out of the
 * wrong country takes a search.
 *
 * lat 20 rather than 0 because Mercator gives the northern hemisphere most of
 * the pixels — centred on the equator, the top of the map is empty ocean.
 *
 * A map that still holds these numbers is one whose owner never pressed "Save
 * this view", which is what `lib/map/default-view.ts` reads it as.
 */
export const DEFAULT_CENTER = {
  lat: 20,
  lng: 0,
  zoom: 1,
} as const;
