"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Place } from "@/lib/repositories/types";
import { apiFetch, apiUpload } from "./fetcher";
import { queryKeys } from "./keys";
import { PHOTO_KEYS, mergePlaceFields } from "./place-cache";

/**
 * Photo upload and removal.
 *
 * Both return the updated place, so the cache is patched from the server's own
 * row rather than from a guess about what the new photoUrl will be.
 */
export function useUploadPlacePhoto(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ placeId, file }: { placeId: string; file: File }) => {
      const body = new FormData();
      body.append("photo", file);

      return (
        await apiUpload<{ place: Place }>(
          `/api/maps/${mapId}/places/${placeId}/photo`,
          body,
        )
      ).place;
    },
    onSuccess: (place) => patchPlace(queryClient, mapId, place),
  });
}

export function useRemovePlacePhoto(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (placeId: string) =>
      (
        await apiFetch<{ place: Place }>(
          `/api/maps/${mapId}/places/${placeId}/photo`,
          { method: "DELETE" },
        )
      ).place,
    onSuccess: (place) => patchPlace(queryClient, mapId, place),
  });
}

/**
 * These endpoints change the photo and nothing else, so only the photo fields
 * are taken from the reply. Replacing the whole row let an upload land on top of
 * an address the reverse geocoder had written a moment earlier, and revert it —
 * the same defect described in lib/query/place-cache.ts.
 */
function patchPlace(
  queryClient: ReturnType<typeof useQueryClient>,
  mapId: string,
  place: Place,
): void {
  queryClient.setQueryData<Place[]>(
    queryKeys.places.list(mapId),
    (places = []) =>
      places.map((existing) =>
        existing.id === place.id
          ? mergePlaceFields(existing, place, PHOTO_KEYS)
          : existing,
      ),
  );
}
