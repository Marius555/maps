import { distanceKm, type Located } from "@/packages/shared/geo";

/**
 * Which pins to ask the routing engine about first, and how many to ask about
 * at all.
 *
 * Arming the route tool wants one thing on screen: every pin that cannot be a
 * stop, drawn as one that cannot. The engine is the only thing that knows, and
 * it answers one coordinate at a time behind a process-wide throttle — a second
 * each on the public server (lib/routing/osrm.ts). So the sweep is not "ask
 * about everything", it is an *order* and a *ceiling*, and both are decisions
 * worth making once and testing.
 *
 * In /lib rather than beside the gesture for snap-to-place.ts's reason: this is
 * the part of the interaction decidable without a pointer.
 *
 * The order this used to have was "pins with no address, and nothing else",
 * which was the bug the whole feature died of. Every pin that arrived by
 * geocode, search or import has an address, so on a real map that filter
 * selected nothing at all and no pin ever greyed. Address-less pins still go
 * first — a location the reverse geocoder found nothing within 300m of is very
 * often one with no road either — but they are a head start, not the whole
 * list.
 */

/** A place, as much of one as the order cares about. */
export type ProbeCandidate = Located & { id: string; address: string };

/**
 * How many pins one arming of the tool may ask about.
 *
 * A Pro map holds 3,000 locations (CLAUDE.md §6) and the public engine answers
 * one a second, so "all of them" is fifty minutes of requests for a gesture
 * that lasts twenty seconds. Two hundred is a few minutes in the worst case and
 * covers every pin on a map anyone is actually drawing a route across; past
 * that, the click-time check is what catches the rest, and it is exact.
 */
export const ROUTE_PROBE_LIMIT = 200;

/**
 * The sweep, in the order it should run.
 *
 * Nearest the centre of the map after the address-less ones, because the pins
 * someone is about to click are the pins they are looking at. A sweep that
 * started at the top of the places array would spend its whole ceiling on
 * locations off screen.
 */
export function probeOrder<T extends ProbeCandidate>(
  places: readonly T[],
  centre: Located,
  limit: number = ROUTE_PROBE_LIMIT,
): T[] {
  if (limit <= 0) return [];

  const ranked = places.map((place, index) => ({
    place,
    // Two keys, so the sort is total: without the index, two pins the same
    // distance from the centre could swap between calls and the sweep would
    // re-order itself as the map moved.
    keys: [
      place.address ? 1 : 0,
      distanceKm(centre, place),
      index,
    ] as const,
  }));

  ranked.sort((a, b) => {
    for (let at = 0; at < a.keys.length; at += 1) {
      const difference = a.keys[at] - b.keys[at];
      if (difference !== 0) return difference;
    }
    return 0;
  });

  return ranked.slice(0, limit).map((entry) => entry.place);
}
