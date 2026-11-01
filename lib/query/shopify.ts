"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/** What `/api/maps/[id]/shopify-storefront` answers (docs/notes/shopify.md, "Storefront"). */
export type StorefrontStatus = {
  onStorefront: boolean;
  isDefault: boolean;
  /** The map code a Pinglide block's "Map code" setting takes. */
  code: string;
  /** The theme editor, opened with the Pinglide block added. */
  addBlockUrl: string;
  /** Present after a POST: whether putting it there published the map. */
  published?: boolean;
  /** Present after a POST: the allowlist was full, so the store's domain could not be added. */
  siteRefused?: boolean;
};

const path = (mapId: string) => `/api/maps/${mapId}/shopify-storefront`;

export function useStorefrontStatus(mapId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.shopifyStorefront(mapId),
    queryFn: () => apiFetch<StorefrontStatus>(path(mapId)),
    enabled,
  });
}

export function useShowOnStorefront(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { makeDefault: boolean }) =>
      apiFetch<StorefrontStatus>(path(mapId), { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (status) => {
      queryClient.setQueryData(queryKeys.shopifyStorefront(mapId), status);
      // Showing it may have published it, which the publish status reads.
      if (status.published) void queryClient.invalidateQueries({ queryKey: queryKeys.maps.detail(mapId) });
    },
  });
}

export function useRemoveFromStorefront(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<StorefrontStatus>(path(mapId), { method: "DELETE" }),
    onSuccess: (status) => queryClient.setQueryData(queryKeys.shopifyStorefront(mapId), status),
  });
}
