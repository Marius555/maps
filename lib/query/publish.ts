"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PublishResult } from "@/lib/repositories/publish.repository";
import type { AppMap } from "@/lib/repositories/types";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

export function usePublishMap(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<PublishResult>(`/api/maps/${mapId}/publish`, { method: "POST" }),
    onSuccess: ({ map }) => {
      // The response carries the updated row, so publishedAt and snapshotUrl
      // land in the cache without a refetch.
      queryClient.setQueryData(queryKeys.maps.detail(map.id), map);
      queryClient.setQueryData<AppMap[]>(queryKeys.maps.list(), (maps = []) =>
        maps.map((existing) => (existing.id === map.id ? map : existing)),
      );
    },
  });
}
