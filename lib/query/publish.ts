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
      queryClient.setQueryData<AppMap>(queryKeys.maps.detail(map.id), (cached) =>
        withNewerEdits(map, cached),
      );
      // No list cached means nothing to patch — see addMapToCachedList in ./maps.ts.
      queryClient.setQueryData<AppMap[]>(queryKeys.maps.list(), (maps) =>
        maps?.map((existing) => (existing.id === map.id ? withNewerEdits(map, existing) : existing)),
      );
    },
  });
}

/**
 * The publish reply, without undoing a design change made while it was out.
 *
 * Publishing never writes `settings`, so the reply's copy is only ever as new as
 * the moment the server read the row — and a switch pressed during the request
 * is newer than that. Taking the reply whole put the old value back into the
 * cache, and the switch flipped back under the owner's finger (2026-11-07). The
 * cache's settings are the optimistic, newest answer, so they stay; `updatedAt`
 * keeps the later of the two, so that change still reads as unpublished.
 */
function withNewerEdits(published: AppMap, cached: AppMap | undefined): AppMap {
  if (!cached) return published;

  const cachedAt = Date.parse(cached.updatedAt);
  const publishedAt = Date.parse(published.updatedAt);

  return {
    ...published,
    settings: cached.settings,
    updatedAt: cachedAt > publishedAt ? cached.updatedAt : published.updatedAt,
  };
}
