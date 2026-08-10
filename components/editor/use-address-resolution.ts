"use client";

import { useCallback, useRef, useState } from "react";

import { useReverseGeocode } from "@/lib/query/geocode";
import { useUpdatePlace } from "@/lib/query/places";

type Coords = { lat: number; lng: number };

/**
 * The street the map measured under the pin, when there was a map to ask.
 *
 * Passed in rather than looked up here: this hook knows about lookups and rows,
 * not about MapLibre, and the canvas handle that can answer lives in the editor.
 */
type Road = { names: string[]; distanceM: number } | null;

/**
 * Turning a dropped pin's coordinates into the address it landed on.
 *
 * Lifted out of the editor because it is three pieces of state and a race, none
 * of which the component that composes the canvas and the panel should be
 * holding. The editor asks for a lookup and renders what comes back.
 */
export function useAddressResolution(mapId: string) {
  const reverseGeocode = useReverseGeocode(mapId);
  const updatePlace = useUpdatePlace(mapId);

  const reverseMutate = reverseGeocode.mutateAsync;
  const saveAddress = updatePlace.mutateAsync;

  /**
   * Locations whose address is still being looked up.
   *
   * The row exists before its address does, and the name it exists under is a
   * placeholder we invented. Showing "Location 4" for the second it takes the
   * geocoder to answer teaches the user a name that is about to be replaced by
   * the line they actually wanted, so the list renders a skeleton instead.
   *
   * A set rather than a flag: several pins can be dropped in a row, and each is
   * waiting on its own lookup.
   */
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  /**
   * Locations the geocoder could not place.
   *
   * Kept apart from `pendingIds` because the row says something different about
   * each: one is "wait", the other is "this needs you". Silence was the old
   * behaviour and it read as a bug — a pin that came back as "Location 9" with no
   * address and no explanation is indistinguishable from one we simply lost.
   */
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  /**
   * The newest address lookup asked for per location.
   *
   * The geocoder is paced behind a single process-wide provider
   * (lib/geocoding/throttle.ts), so dragging one pin twice in quick succession
   * puts two lookups in a queue that can answer out of order — and the slower
   * first one would then write the *previous* street over the current one. A pin
   * labelled with somewhere it no longer is, only sometimes, is the worst kind of
   * bug to be told about.
   *
   * So each request takes a number, and only the latest is allowed to land.
   */
  const requests = useRef(new Map<string, number>());

  /**
   * Ask the geocoder what is at these coordinates and write it to the location.
   *
   * `address` is what receives it, not `name`. A location's name is the
   * customer's to write — it is what a visitor sees on the published map — and
   * overwriting it with a street would be us deciding what their shop is called.
   */
  const resolveAddress = useCallback(
    async (
      placeId: string,
      coords: Coords,
      currentAddress = "",
      road: Road = null,
    ) => {
      const token = (requests.current.get(placeId) ?? 0) + 1;
      requests.current.set(placeId, token);

      // A retry is a fresh attempt, so the row stops claiming the last one failed
      // for as long as this one is in the air.
      setMembership(setFailedIds, placeId, false);
      setMembership(setPendingIds, placeId, true);

      try {
        const candidate = await reverseMutate({ ...coords, road });

        // Overtaken while we were waiting — the pin has moved on since, and that
        // later lookup owns both the address and the skeleton now.
        if (requests.current.get(placeId) !== token) return;

        /*
         * A coordinate with nothing mapped at it is an ordinary answer, not a
         * failure, but the row still has no address to show — so it is offered
         * the same "add it yourself" line as a lookup that broke.
         *
         * Any address it had is cleared, not kept. It described where the pin
         * used to be, and a pin dragged into the Baltic that still reads
         * "Dahlberg, Karlskrona" is stating something false with no sign that it
         * is stale — worse than a row admitting it has nothing. A drag already
         * re-derives the address when the lookup succeeds; this is the same rule
         * when it comes back empty.
         */
        if (!candidate?.title) {
          setMembership(setFailedIds, placeId, true);

          if (currentAddress) {
            await saveAddress({
              placeId,
              input: { address: "", geocodeConfidence: null, addressParts: null },
            });
          }
          return;
        }

        /*
         * Awaited, not fired and forgotten. `mutateAsync` resolves once the
         * optimistic write has reached the cache; clearing the skeleton before
         * that rendered the row a frame with the placeholder it had been hiding,
         * and then again with the street — the blink.
         *
         * The confidence travels with the address because it is *about* the
         * address, and saved rather than kept in memory so the row can still say
         * "approximate" after a reload. `geocodeStatus` is deliberately not
         * touched: it stays "manual", meaning a person placed this pin and no
         * later pass may move it, which is true however vague the street was.
         */
        await saveAddress({
          placeId,
          input: {
            address: candidate.title,
            geocodeConfidence: candidate.confidence,
            // The parts behind that line, so the postcode outlives the sentence
            // it was joined into.
            addressParts: candidate.parts ?? null,
          },
        });
      } catch {
        if (requests.current.get(placeId) === token) {
          setMembership(setFailedIds, placeId, true);
        }
      } finally {
        // Also the failure path: a skeleton that never resolves is worse than a
        // row admitting it has nothing.
        if (requests.current.get(placeId) === token) {
          setMembership(setPendingIds, placeId, false);
        }
      }
    },
    [reverseMutate, saveAddress],
  );

  /**
   * Drop everything remembered about locations that no longer exist.
   *
   * Driven by which places are on the map rather than by a call from whoever
   * deleted one, because a location can be removed from the list, from the place
   * card, or by a rollback — and all three have to leave the same nothing behind.
   * Otherwise the token map grows for the lifetime of the page.
   */
  const retainOnly = useCallback((placeIds: ReadonlySet<string>) => {
    for (const placeId of requests.current.keys()) {
      if (!placeIds.has(placeId)) requests.current.delete(placeId);
    }

    setPendingIds((current) => retain(current, placeIds));
    setFailedIds((current) => retain(current, placeIds));
  }, []);

  return { pendingIds, failedIds, resolveAddress, retainOnly };
}

/** Same set back when nothing was dropped, so this can't loop a render. */
function retain(
  current: ReadonlySet<string>,
  keep: ReadonlySet<string>,
): ReadonlySet<string> {
  const next = new Set([...current].filter((id) => keep.has(id)));
  return next.size === current.size ? current : next;
}

type SetIds = React.Dispatch<React.SetStateAction<ReadonlySet<string>>>;

/** Add or remove one id, returning the same set when nothing changes. */
function setMembership(setIds: SetIds, placeId: string, isMember: boolean) {
  setIds((current) => {
    if (current.has(placeId) === isMember) return current;

    const next = new Set(current);
    if (isMember) next.add(placeId);
    else next.delete(placeId);
    return next;
  });
}
