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

export function useUpdateMap(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateMapInput) =>
      (
        await apiFetch<{ map: AppMap }>(`/api/maps/${mapId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).map,
    onSuccess: (map) => {
      queryClient.setQueryData(queryKeys.maps.detail(map.id), map);
      queryClient.setQueryData<AppMap[]>(queryKeys.maps.list(), (maps = []) =>
        maps.map((existing) => (existing.id === map.id ? map : existing)),
      );
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
    },
  });
}
