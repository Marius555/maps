import type { Group, MapTagGroup, Place, Shape } from "@/lib/repositories/types";
import { routeOf } from "@/packages/shared/shapes";
import { pinColorOfTags } from "@/packages/shared/tags";

/**
 * What colour a location or a shape is painted, once the groups are taken into
 * account.
 *
 * This used to be three `useCallback`s inside `map-editor.tsx` and a fourth
 * answer inside `lib/snapshot/build.ts` that simply did not ask the question —
 * which is how a route inside a group came to be one colour on the editor's
 * canvas, the same colour in an exported PNG, and a *different* colour in the
 * preview panel drawn beside it and on the customer's live site. Three renderers
 * and two answers. The precedence is written here once and every renderer reads
 * it, so the only way they can disagree now is by not calling this.
 *
 * **A route lends its group's colour to the pins it stops at.** That is the
 * whole of the sub-group feature as far as colour is concerned: a route is the
 * parent of the locations it connects, so putting the *route* in a group paints
 * its stops without any of them being a member of anything. Nothing is written
 * to a place to make that true — membership is `LineGeometry.route.stops`, which
 * is already ordered and already the thing the engine is re-sent.
 *
 * **Own membership beats an inherited one.** A location the owner deliberately
 * put in a group keeps that group's colour even while it is a stop on a route
 * belonging to another, because the explicit act is the one that should win;
 * taking it out of its group then gives it the route's tint rather than dropping
 * it all the way back to a tag colour.
 *
 * A location that is a stop on two routes in two different groups takes the
 * first route's, in the order the shapes are listed. That is arbitrary and it is
 * *deterministic*, which is the property that matters — the alternative is a pin
 * whose colour depends on which query resolved first.
 */
export type GroupColorIndex = {
  /** A shape's colour: its group's, or its own. */
  forShape: (shape: Shape) => string;
  /**
   * The group colour a location inherits, or undefined for one that inherits
   * none.
   *
   * Separate from `forPlace` because publishing needs exactly this and not the
   * rest: `SnapshotPlace.color` is written *only* when there is an override, so
   * a map with no groups publishes the same bytes it has always published and
   * the embed keeps resolving the pin's own colour for itself (§7).
   */
  overrideForPlace: (place: Place) => string | undefined;
  /**
   * A location's pin colour in full: the override, then the custom pin's own
   * colour, then its first defined tag's.
   *
   * `pinColor` is passed in because the marker layer has already resolved the
   * pin by the time it paints one, and resolving it twice per pin across 3,000
   * of them is work for nothing.
   */
  forPlace: (place: Place, pinColor?: string) => string | undefined;
};

export function groupColorIndex({
  groups,
  shapes,
  tagGroups = [],
}: {
  groups: readonly Group[];
  shapes: readonly Shape[];
  /** The map's tag vocabulary, for the last step of `forPlace`. */
  tagGroups?: readonly MapTagGroup[];
}): GroupColorIndex {
  const byGroup = new Map(groups.map((group) => [group.id, group.color]));

  /*
   * Every location a *grouped route* stops at, and the colour it lends.
   *
   * Built in one pass rather than asked per pin: the alternative is a scan of
   * every shape's stop list inside a callback the marker layer runs once per
   * marker, which is 3,000 × 25 comparisons on a map at the plan ceiling.
   *
   * `set` only when absent, so the first route wins — see the docblock above.
   */
  const byRoute = new Map<string, string>();

  for (const shape of shapes) {
    const color = byGroup.get(shape.groupId);
    if (!color) continue;

    const route = routeOf(shape.geometry);
    if (!route) continue;

    for (const stop of route.stops) {
      // A free waypoint has no id — legacy routes are full of them, and they
      // are not locations, so there is nothing to paint.
      if (stop.placeId && !byRoute.has(stop.placeId)) {
        byRoute.set(stop.placeId, color);
      }
    }
  }

  const overrideForPlace = (place: Place) =>
    // Not `place.groupId` alone: an id naming a group that has been deleted
    // reads as ungrouped everywhere else in this app, and `byGroup` missing it
    // is what makes that true here too.
    byGroup.get(place.groupId) ?? byRoute.get(place.id);

  return {
    forShape: (shape) => byGroup.get(shape.groupId) ?? shape.color,
    overrideForPlace,
    forPlace: (place, pinColor) =>
      overrideForPlace(place) ??
      pinColor ??
      /*
       * The location's **first** tag, which is what replaced its category when
       * the two merged. Walked rather than read off `tags[0]` — `pinColorOfTags`
       * skips ids the map no longer defines, so a pin does not lose its colour
       * because of a tag deleted in Settings months ago.
       */
      pinColorOfTags(tagGroups, place.tags),
  };
}
