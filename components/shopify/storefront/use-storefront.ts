"use client";

import { toast } from "@heroui/react";
import { useState } from "react";

import {
  useRemoveFromStorefront,
  useShowOnStorefront,
  useStorefrontStatus,
  type StorefrontStatus,
} from "@/lib/query/shopify";
import { toastError } from "@/lib/query/toast-error";
import { pickerName } from "@/lib/shopify/storefront-maps";
import { storefrontPrimary } from "@/lib/shopify/storefront-step";

/**
 * One map's place on the shop's storefront, the two things that change it
 * (each with its toast), and which button in the Publish sidebar is the main
 * one (docs/notes/shopify.md, "Storefront").
 *
 * Called by the sidebar rather than by the steps, because the answer is shared:
 * the steps sit at the top of the column and Publish in its footer, and only
 * one of them may be filled. `enabled` is false outside the Shopify admin,
 * where nothing is fetched and `primary` says nothing.
 *
 * `justShown` is whether step 1 succeeded on this visit to the page — the
 * moment Add to theme should lead. Local on purpose: it is about what the
 * merchant just did, not about the theme, which the app cannot see.
 */
export function useStorefront(
  mapId: string,
  { enabled, hasPendingChanges }: { enabled: boolean; hasPendingChanges: boolean },
) {
  const status = useStorefrontStatus(mapId, enabled);
  const show = useShowOnStorefront(mapId);
  const remove = useRemoveFromStorefront(mapId);
  const [justShown, setJustShown] = useState(false);

  const primary = storefrontPrimary({
    onStorefront: status.data?.onStorefront,
    isError: status.isError,
    justShown,
    hasPendingChanges,
  });

  const onShow = (makeDefault: boolean) =>
    show.mutate(
      { makeDefault },
      {
        onSuccess: (result) => {
          if (!makeDefault) setJustShown(true);

          if (result.siteRefused) {
            toast.warning(makeDefault ? "Shown by default" : "Shown on your storefront", {
              description:
                "Your map's site list is full, so your store's address couldn't be added. Remove a site under Embed code and domains.",
            });
            return;
          }

          toast.success(makeDefault ? "Shown by default" : "Shown on your storefront", {
            description: makeDefault
              ? "Every Pinglide block shows this map unless it names another."
              : describeShown(result),
          });
        },
        onError: (error) => toastError(error, "Couldn't put this map on your storefront"),
      },
    );

  const onRemove = () =>
    remove.mutate(undefined, {
      onSuccess: () => toast.success("Removed from your storefront"),
      onError: (error) => toastError(error, "Couldn't remove this map from your storefront"),
    });

  return {
    status,
    primary,
    onShow,
    onRemove,
    isShowing: show.isPending,
    busy: show.isPending || remove.isPending,
  };
}

function describeShown(result: StorefrontStatus): string {
  const ready = result.published
    ? "Published and ready for the Pinglide map block."
    : "Ready for the Pinglide map block.";
  const next = result.isDefault
    ? "Next, press Add to theme."
    : `Next, press Add to theme and choose “${pickerName(result.name)}” in the block's Map setting.`;

  return `${ready} ${next}`;
}
