"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { Place } from "@/lib/repositories/types";
import type {
  CreatePlaceInput,
  UpdatePlaceInput,
} from "@/lib/validation/place.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";
import { mergePlaceFields, patchedKeys } from "./place-cache";

type PlacesPage = {
  places: Place[];
  nextCursor: string | null;
  total: number;
};

/** Guard against an unbounded loop if the server ever returns a stuck cursor. */
const MAX_PAGES = 50;

/**
 * Marks a row that exists only in the cache, waiting on its create round trip.
 *
 * Exported because the UI has to be able to tell one apart: an optimistic place
 * is showing a placeholder name and an empty address, and the list renders a
 * skeleton for it rather than the placeholder (components/places/place-list.tsx).
 */
const TEMP_PLACE_ID_PREFIX = "temp-";

export function isOptimisticPlaceId(placeId: string): boolean {
  return placeId.startsWith(TEMP_PLACE_ID_PREFIX);
}

/**
 * Every place on the map, as one array.
 *
 * The canvas needs all of them to draw markers and the largest plan caps at
 * 3,000, so useInfiniteQuery would hand the UI a paging model it never wants.
 * The cursor pagination is still exercised end to end — it just lives here
 * instead of leaking into components.
 */
async function fetchAllPlaces(mapId: string): Promise<Place[]> {
  const all: Place[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const result: PlacesPage = await apiFetch<PlacesPage>(
      `/api/maps/${mapId}/places${query}`,
    );

    all.push(...result.places);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }

  return all;
}

export function usePlaces(mapId: string, initialData?: Place[]) {
  return useQuery({
    queryKey: queryKeys.places.list(mapId),
    queryFn: () => fetchAllPlaces(mapId),
    initialData,
  });
}

/**
 * The places array as the cache holds it *now*, not as of the last render.
 *
 * A callback rather than a value, because the caller that needs it is a pointer
 * handler deciding what to call the pin it is about to create — and a value
 * closed over at render time is one drop out of date the moment two land in
 * quick succession, which is how two pins ended up as the same "Location 4".
 *
 * Keyed on `mapId` rather than on the key array, which is a fresh object every
 * render and would defeat the memo.
 */
export function usePlacesSnapshot(mapId: string): () => Place[] {
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.getQueryData<Place[]>(queryKeys.places.list(mapId)) ?? [],
    [queryClient, mapId],
  );
}

export function useCreatePlace(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.places.list(mapId);

  return useMutation({
    mutationFn: async (input: CreatePlaceInput) =>
      (
        await apiFetch<{ place: Place }>(`/api/maps/${mapId}/places`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).place,

    // The pin has to appear under the cursor immediately — waiting for the round
    // trip makes the map feel broken.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Place[]>(listKey);

      const now = new Date().toISOString();
      const optimistic: Place = {
        id: `${TEMP_PLACE_ID_PREFIX}${crypto.randomUUID()}`,
        mapId,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        address: input.address ?? "",
        category: input.category ?? "",
        tags: input.tags ?? [],
        fields: input.fields ?? {},
        icon: input.icon ?? "",
        description: input.description ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        url: input.url ?? null,
        hours: input.hours ?? null,
        photoId: null,
        // A place can't have a photo before it exists.
        photoUrl: null,
        sortOrder: input.sortOrder ?? 0,
        geocodeConfidence: input.geocodeConfidence ?? null,
        addressParts: input.addressParts ?? null,
        geocodeStatus: input.geocodeStatus ?? "manual",
        groupId: input.groupId ?? "",
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<Place[]>(listKey, (places = []) => [
        ...places,
        optimistic,
      ]);

      return { previous, tempId: optimistic.id };
    },

    // Rollback removes the optimistic marker. This is the path a plan-limit 403
    // takes, so leaving an orphan pin here would be the most visible bug.
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },

    // Swap the temp row for the real one rather than appending, or the marker
    // diff would draw two pins in the same spot.
    onSuccess: (place, _input, context) => {
      queryClient.setQueryData<Place[]>(listKey, (places = []) =>
        places.map((existing) =>
          existing.id === context?.tempId ? place : existing,
        ),
      );
    },

    /*
     * Marked stale, not refetched.
     *
     * `places.all` prefix-matches the list key, so this used to re-page the whole
     * map (up to 50 requests) after every dropped pin — and that reply, computed
     * before the reverse geocoder had answered, replaced the array the address
     * was about to land in. `onSuccess` already installs the server's own row, so
     * there was nothing for the refetch to reconcile; anything else is picked up
     * on the next mount.
     */
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.places.all(mapId),
        refetchType: "none",
      });
    },
  });
}

export function useUpdatePlace(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.places.list(mapId);

  /** Rewrite one row, leaving every other row's identity untouched. */
  const patchRow = (placeId: string, update: (place: Place) => Place) => {
    queryClient.setQueryData<Place[]>(listKey, (places = []) =>
      places.map((existing) =>
        existing.id === placeId ? update(existing) : existing,
      ),
    );
  };

  return useMutation({
    mutationFn: async ({
      placeId,
      input,
    }: {
      placeId: string;
      input: UpdatePlaceInput;
    }) =>
      (
        await apiFetch<{ place: Place }>(`/api/maps/${mapId}/places/${placeId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).place,

    // Applied before the round trip. Dragging a pin is the loudest caller here:
    // without this the marker snaps back to its old coordinates as soon as the
    // places array re-renders, then jumps forward again on response.
    onMutate: async ({ placeId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey });

      /*
       * This row's prior values, not a snapshot of the whole list. A list-wide
       * snapshot meant one failed PATCH rolled back every other edit that had
       * landed beside it while this one was in flight — dragging two pins and
       * having the first fail undid the second as well.
       */
      const previous = queryClient
        .getQueryData<Place[]>(listKey)
        ?.find((place) => place.id === placeId);

      patchRow(placeId, (existing) => ({ ...existing, ...input }));

      return { placeId, keys: patchedKeys(input), previous };
    },

    // Only what this request changed, and only on its own row.
    onError: (_error, _variables, context) => {
      if (!context?.previous) return;

      const { placeId, keys, previous } = context;
      patchRow(placeId, (existing) => mergePlaceFields(existing, previous, keys));
    },

    /*
     * Merged field by field rather than replacing the row. See
     * lib/query/place-cache.ts — two writes to one place overlap routinely here,
     * and a whole-row replace let the slower reply revert the faster one's field.
     */
    onSuccess: (place, _variables, context) => {
      patchRow(place.id, (existing) =>
        mergePlaceFields(existing, place, context.keys),
      );
    },
  });
}

export function useDeletePlace(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.places.list(mapId);

  return useMutation({
    mutationFn: (placeId: string) =>
      apiFetch<void>(`/api/maps/${mapId}/places/${placeId}`, {
        method: "DELETE",
      }),
    onMutate: async (placeId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Place[]>(listKey);

      queryClient.setQueryData<Place[]>(listKey, (places = []) =>
        places.filter((place) => place.id !== placeId),
      );

      return { previous };
    },
    onError: (_error, _placeId, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    // Same reasoning as the create above: the optimistic filter is already
    // correct and the response carries no body to reconcile against.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.places.all(mapId),
        refetchType: "none",
      });
    },
  });
}

/**
 * Adds one tag to every selected location.
 *
 * One PATCH each, for the same reason `useAssignToGroup` is one PATCH each: a
 * marquee selection is bounded by what fits in a drag box. `useSetGroupPin` is
 * the case that needed a batch endpoint instead, and it is a different case —
 * it writes *every* member of a group, which §6 allows 3,000 of.
 *
 * The PATCH carries the whole `tags` array because that is the column's shape;
 * Appwrite has no "append to array". Each one is built from the place's own
 * current tags, so two of these landing at once cannot lose each other's work
 * unless they hit the same location — and a location is only in one selection.
 *
 * Places already wearing the tag are skipped rather than rewritten: a no-op
 * PATCH still bumps `updatedAt`, and that is what the publish tab reads to
 * decide whether the map has unpublished changes.
 */
export function useAddTagToPlaces(mapId: string) {
  const updatePlace = useUpdatePlace(mapId);
  const updatePlaceAsync = updatePlace.mutateAsync;

  return useCallback(
    async (places: Place[], tagId: string) => {
      const pending = places.filter((place) => !place.tags.includes(tagId));

      await Promise.all(
        pending.map((place) =>
          updatePlaceAsync({
            placeId: place.id,
            input: { tags: [...place.tags, tagId] },
          }),
        ),
      );
    },
    [updatePlaceAsync],
  );
}
