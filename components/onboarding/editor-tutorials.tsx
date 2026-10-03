"use client";

import { useSyncExternalStore } from "react";

import { isOptimisticPlaceId, usePlaces } from "@/lib/query/places";
import { EDITOR_WITH_PLACES } from "./callouts";
import { Tutorial } from "./tutorial-overlay";
import { isTutorialDismissed, subscribeTutorials } from "./tutorial-store";

/**
 * The editor's two overlays, in order: adding locations (`editor`), then the
 * card designer (`card`).
 *
 * **In order, whatever the map holds.** This used to pick by whether the map
 * had a location — `editor` on an empty map, `card` on any other — which meant
 * an owner who imported from the Locations page before ever opening the editor
 * (or anybody testing with `TUTORIAL_ALWAYS_PRESENT` on a map with pins) never
 * saw the first step at all and opened onto "Design your pin cards". So the
 * first is shown until it is closed, and its copy says "add" rather than
 * "drop your first" when there is already something on the map.
 *
 * `card` waits for both: the first closed, and a saved location to design a
 * card for. Closing the first with the X on an empty map therefore draws
 * nothing rather than an arrow at a designer with no example to show. Read
 * from the places cache rather than decided on the server, so dropping the
 * first pin brings it on without a reload.
 *
 * Only saved places count. The dropped pin is in the cache a round trip before
 * it exists, and a plan limit can still take it back out.
 *
 * `editor` and `card` say whether the account still has each one to see; this
 * tab's own closes are in the store.
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

  // The server snapshot says open: `Tutorial` draws nothing on the server
  // either way, and "closed" would mount the card overlay for the hydration
  // pass only to swap it for this one.
  const editorClosed = useSyncExternalStore(
    subscribeTutorials,
    () => isTutorialDismissed("editor"),
    () => false,
  );

  if (editor && !editorClosed) {
    return (
      <Tutorial id="editor" callouts={hasPlaces ? EDITOR_WITH_PLACES : undefined} />
    );
  }
  return card && hasPlaces ? <Tutorial id="card" /> : null;
}
