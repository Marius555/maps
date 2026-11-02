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
 * Called by the sidebar rather than by the storefront row, because the answer
 * is shared: the row and Publish sit side by side in the footer, and only one
 * of their buttons may be filled. `enabled` is false outside the Shopify admin,
 * where nothing is fetched and `primary` says nothing.
 *
 * `justShown` is whether Show on storefront succeeded on this visit — the
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
                "Your map's site list is full, so your store's address couldn't be added. Remove a site under Embed code and domains, beside Publish.",
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

  // The same POST as Show on storefront, which adds the store's address to the
  // site list and republishes; it keeps whichever map is the default.
  const onFixDomain = () =>
    show.mutate(
      { makeDefault: false },
      {
        onSuccess: (result) => {
          if (result.siteRefused || result.domainMissing) {
            toast.warning("Your store's address couldn't be added", {
              description:
                "Your map's site list is full. Remove a site under Embed code and domains, beside Publish, then try again.",
            });
            return;
          }

          toast.success("Store address added", {
            description: `Published with ${result.storeHost} on the map's site list.`,
          });
        },
        onError: (error) => toastError(error, "Couldn't add your store's address"),
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
    onFixDomain,
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
