"use client";

import { isOptimisticPlaceId, usePlaces } from "@/lib/query/places";
import { Tutorial } from "./tutorial-overlay";

/**
 * The editor's two overlays, one for each state the map can be in.
 *
 * An empty map is asked for its first location (`editor`); a map with one is
 * pointed at the card designer (`card`). Read from the places cache rather than
 * decided on the server, so dropping the first pin swaps one for the other
 * without a reload — and an import, which lands here, arrives with the second.
 *
 * Only saved places count. The dropped pin is in the cache a round trip before
 * it exists, and a plan limit can still take it back out.
 *
 * `editor` and `card` say whether the account still has each one to see.
 */
export function EditorTutorials({
  mapId,
  editor,
  card,
}: {
  mapId: string;
  editor: boolean;
  card: boolean;
}) {
  // `MapEditor` seeded this query from the page; a second observer reads the
  // same entry without fetching.
  const { data: places = [] } = usePlaces(mapId);
  const hasPlaces = places.some((place) => !isOptimisticPlaceId(place.id));

  if (!hasPlaces) return editor ? <Tutorial id="editor" /> : null;
  return card ? <Tutorial id="card" /> : null;
}
