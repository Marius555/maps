"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/** What `/api/maps/[id]/shopify-storefront` answers (docs/notes/shopify.md, "Storefront"). */
export type StorefrontStatus = {
  onStorefront: boolean;
  isDefault: boolean;
  /** The map's name — what a Pinglide block's "Map" picker lists it as. */
  name: string;
  /** The theme editor, opened with the Pinglide block added. */
  addBlockUrl: string;
  /** The live theme's editor, with nothing added — "Go to theme". */
  themeEditorUrl: string;
  /** The storefront's public host, as Shopify has it now. */
  storeHost: string;
  /**
   * On the storefront, but the map's site list leaves out the store's address,
   * so the map would be blank there. Showing it again adds the address.
   */
  domainMissing: boolean;
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
