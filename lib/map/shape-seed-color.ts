import type { Place } from "@/lib/repositories/types";
import { routeOf, type ShapeGeometry } from "@/packages/shared/shapes";

/**
 * The colour a newly drawn line or route should start out as: its first pin's.
 *
 * A route is drawn *through* locations — every stop is one, by rule — and a line
 * bonds its ends to them. So the first thing the owner clicked is a pin they can
 * see, and its colour is the one answer to "what colour should this be?" that
 * they have already given. Cycling the category palette instead means a route
 * traced through a set of black pins comes out blue, which is a colour nobody
 * on that map chose.
 *
 * Only lines and routes. A circle or a polygon is dragged out over empty ground
 * with no pin in the gesture at all, so there is no "first pin" to read and they
 * keep the palette cycle — which is also what stops two areas drawn in a row
 * being the same colour as each other.
 *
 * Pure, and here rather than in the draw hooks, for the reason `route-stops.ts`
 * and `drop-action.ts` are: it is the part of the gesture decidable without a
 * map, and so the part worth testing.
 */

/**
 * The first location a line or route touches, or null.
 *
 * Searched rather than indexed, in both branches, because the question is "the
 * first pin", not "the first point". A route may open on a free waypoint —
 * those were withdrawn, but rows holding them still load — and a line is very
 * often started on empty ground and only *ended* on a pin, which is a line with
 * exactly one pin in it and no reason to be told there is none.
 */
export function seedPlaceId(geometry: ShapeGeometry): string | null {
  if (geometry.kind !== "line") return null;

  const route = routeOf(geometry);

  if (route) {
    return route.stops.find((stop) => stop.placeId)?.placeId ?? null;
  }

  return geometry.from || geometry.to || null;
}

/**
 * That pin's colour, or null to fall back to the palette.
 *
 * Null covers more than "not a line": a bond to a location since deleted, a
 * legacy route of free waypoints, and — deliberately — a pin with no colour of
 * its own. An uncategorised pin is drawn in the theme's accent here and a flat
 * grey once published, and copying that would make every line on an
 * uncategorised map grey. The palette cycle is the better answer to a question
 * the map has not been given an answer to.
 *
 * `colorOf` is the caller's own resolver, so this stays ignorant of how a pin
 * gets its colour — group, custom pin, or category, in that order.
 */
export function shapeSeedColor(
  geometry: ShapeGeometry,
  places: readonly Place[],
  colorOf: (place: Place) => string | undefined,
): string | null {
  const placeId = seedPlaceId(geometry);
  if (!placeId) return null;

  const place = places.find((candidate) => candidate.id === placeId);
  if (!place) return null;

  return colorOf(place) ?? null;
}
