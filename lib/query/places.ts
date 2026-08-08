"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Place } from "@/lib/repositories/types";
import type {
  CreatePlaceInput,
  UpdatePlaceInput,
} from "@/lib/validation/place.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

type PlacesPage = {
  places: Place[];
  nextCursor: string | null;
  total: number;
};

/** Guard against an unbounded loop if the server ever returns a stuck cursor. */
const MAX_PAGES = 50;

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
        id: `temp-${crypto.randomUUID()}`,
        mapId,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        address: input.address ?? "",
        category: input.category ?? "",
        description: input.description ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        url: input.url ?? null,
        photoId: null,
        // A place can't have a photo before it exists.
        photoUrl: null,
        sortOrder: input.sortOrder ?? 0,
        geocodeConfidence: null,
        geocodeStatus: input.geocodeStatus ?? "manual",
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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.places.all(mapId) });
    },
  });
}

export function useUpdatePlace(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.places.list(mapId);

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
      const previous = queryClient.getQueryData<Place[]>(listKey);

      queryClient.setQueryData<Place[]>(listKey, (places = []) =>
        places.map((existing) =>
          existing.id === placeId ? { ...existing, ...input } : existing,
        ),
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },

    onSuccess: (place) => {
      queryClient.setQueryData<Place[]>(listKey, (places = []) =>
        places.map((existing) => (existing.id === place.id ? place : existing)),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.places.all(mapId) });
    },
  });
}
