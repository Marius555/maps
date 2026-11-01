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

/**
 * What an empty map that is still on `DEFAULT_CENTER` is actually framed on in
 * the editor: the populated world, fitted to whatever size the canvas is.
 *
 * `DEFAULT_CENTER`'s fixed zoom 1 is a 1024px-tall world, which a ~800px editor
 * frame crops and a phone crops to one continent — a new map read as "zoomed
 * in". A box adapts to the canvas instead. South −58 / north 78 leave out
 * Antarctica and the high Arctic, which Mercator would otherwise spend most of
 * the frame on. `DEFAULT_CENTER` itself is unchanged: it is what
 * `isDefaultView` compares stored maps against.
 */
export const WORLD_BOUNDS = {
  west: -180,
  south: -58,
  east: 180,
  north: 78,
} as const;

/**
 * How close the editor's canvas frames its content when it opens on it, which
 * for a single location is the zoom it opens at (components/map/use-maplibre.ts).
 *
 * Here rather than beside that hook because the editor reads it too: the flight
 * to a new map's first location has to land on the view a reload will open on.
 * It used to fly to 17 — building level, nothing around the pin to see — and
 * the next reload opened at 14. That hook imports MapLibre at module load, which
 * cannot server-render, so the number cannot live there and be shared.
 */
export const DEFAULT_MAX_FIT_ZOOM = 14;
