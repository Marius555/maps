"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AppMap } from "@/lib/repositories/types";
import type { CreateMapInput, UpdateMapInput } from "@/lib/validation/map.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

export function useMaps(initialData?: AppMap[]) {
  return useQuery({
    queryKey: queryKeys.maps.list(),
    queryFn: async () => (await apiFetch<{ maps: AppMap[] }>("/api/maps")).maps,
    initialData,
  });
}

export function useMap(mapId: string, initialData?: AppMap) {
  return useQuery({
    queryKey: queryKeys.maps.detail(mapId),
    queryFn: async () =>
      (await apiFetch<{ map: AppMap }>(`/api/maps/${mapId}`)).map,
    initialData,
  });
}

export function useCreateMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMapInput) =>
      (
        await apiFetch<{ map: AppMap }>("/api/maps", {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).map,
    onSuccess: (map) => {
      queryClient.setQueryData<AppMap[]>(queryKeys.maps.list(), (maps = []) => [
        map,
        ...maps,
      ]);
      queryClient.setQueryData(queryKeys.maps.detail(map.id), map);
    },
  });
}

/**
 * Optimistic, and it has to be.
 *
 * This started as write-through-on-success, which is exactly right for a form
 * with a Save button: nothing on screen claims to have changed until the server
 * agrees. The appearance controls are the opposite shape — clicking a theme
 * swatch is expected to repaint the canvas in that frame, and a round trip of
 * latency there reads as a broken control rather than a slow one. The editor
 * canvas draws straight from this cache, so patching it *is* the repaint.
 *
 * The patch is a shallow merge over the cached map, which is safe because
 * `UpdateMapInput` is a partial of the same shape and every JSON field on it is
 * replaced whole by the repository anyway.
 */
export function useUpdateMap(mapId: string) {
  const queryClient = useQueryClient();
  const detailKey = queryKeys.maps.detail(mapId);

  const write = (map: AppMap) => {
    queryClient.setQueryData(detailKey, map);
    queryClient.setQueryData<AppMap[]>(queryKeys.maps.list(), (maps = []) =>
      maps.map((existing) => (existing.id === map.id ? map : existing)),
    );
  };

  return useMutation({
    mutationFn: async (input: UpdateMapInput) =>
      (
        await apiFetch<{ map: AppMap }>(`/api/maps/${mapId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).map,

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailKey });

      const previousDetail = queryClient.getQueryData<AppMap>(detailKey);
      const previousList = queryClient.getQueryData<AppMap[]>(
        queryKeys.maps.list(),
      );

      if (previousDetail) write({ ...previousDetail, ...input } as AppMap);

      return { previousDetail, previousList };
    },

    onError: (_error, _input, context) => {
      // Both caches, because onMutate wrote both. Restoring only the detail
      // would leave the maps list showing a change the server rejected.
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.maps.list(), context.previousList);
      }
    },

    // The server's answer replaces the guess: it carries `updatedAt`, which the
    // publish staleness badge reads and the optimistic patch cannot know.
    onSuccess: write,

    // Marked stale, not refetched — same reasoning as the group mutations.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey, refetchType: "none" });
    },
  });
}

export function useDeleteMap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mapId: string) =>
      apiFetch<void>(`/api/maps/${mapId}`, { method: "DELETE" }),
    onSuccess: (_result, mapId) => {
      queryClient.setQueryData<AppMap[]>(queryKeys.maps.list(), (maps = []) =>
        maps.filter((map) => map.id !== mapId),
      );
      queryClient.removeQueries({ queryKey: queryKeys.maps.detail(mapId) });
      queryClient.removeQueries({ queryKey: queryKeys.places.all(mapId) });
      queryClient.removeQueries({ queryKey: queryKeys.shapes.all(mapId) });
    },
  });
}
