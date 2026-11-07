"use client";

import { toast } from "@heroui/react";

import {
  useRemoveFromStorefront,
  useShowOnStorefront,
  useStorefrontStatus,
  type StorefrontStatus,
} from "@/lib/query/shopify";
import { toastError } from "@/lib/query/toast-error";
import { pickerName } from "@/lib/shopify/storefront-maps";
import { useSettleDesign } from "@/components/publish/design-sidebar/design-writes-context";
import { themeAdded as themeAddedFlag } from "@/components/publish/stepper/marked-flag";
import { storefrontSteps } from "@/lib/shopify/storefront-step";

/**
 * One map's place on the shop's storefront, the things that change it (each
 * with its toast), and where the Publish footer's steps stand
 * (docs/notes/shopify.md, "The Publish footer inside Shopify").
 *
 * Called by the sidebar, which hands it to `StorefrontStepper`. `enabled` is
 * false outside the Shopify admin, where nothing is fetched and `primary` says
 * nothing.
 *
 * The theme step has no server answer: `themeAdded` is this browser
 * remembering that Add to theme (or "Already added") was pressed — see
 * `components/publish/stepper/marked-flag.ts`.
 */
export function useStorefront(
  mapId: string,
  {
    enabled,
    hasPendingChanges,
    published,
  }: { enabled: boolean; hasPendingChanges: boolean; published: boolean },
) {
  const status = useStorefrontStatus(mapId, enabled);
  const show = useShowOnStorefront(mapId);
  const remove = useRemoveFromStorefront(mapId);
  const themeAdded = themeAddedFlag.useMarked(mapId);
  // Show on storefront republishes, so it waits for the designer's last save
  // like Publish does — see `DesignWritesProvider`.
  const settleDesign = useSettleDesign();
  const afterSave = (run: () => void) => void settleDesign().then(run);

  const { steps, primary, quietRedeploy } = storefrontSteps({
    onStorefront: status.data?.onStorefront,
    isError: status.isError,
    themeAdded,
    hasPendingChanges,
    published,
  });

  // Marked before leaving: the theme editor replaces the whole admin page, and
  // nothing in this app runs again until the merchant comes back.
  const onAddToTheme = () => {
    const url = status.data?.addBlockUrl;
    if (!url) return;
    themeAddedFlag.mark(mapId);
    window.open(url, "_top");
  };

  // The editor as it is, once the block is in: `addBlockUrl` would add another.
  const onGoToTheme = () => {
    const url = status.data?.themeEditorUrl;
    if (url) window.open(url, "_top");
  };

  const onShow = (makeDefault: boolean) =>
    afterSave(() =>
      show.mutate(
        { makeDefault },
        {
          onSuccess: (result) => {
            if (result.siteRefused) {
              toast.warning(makeDefault ? "Shown by default" : "Shown on your storefront", {
                description:
                  "Your map's site list is full, so your store's address couldn't be added. Remove a site under Embed on another site, at the bottom of this panel.",
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
      ),
    );

  // The same POST as Show on storefront, which adds the store's address to the
  // site list and republishes; it keeps whichever map is the default.
  const onFixDomain = () =>
    afterSave(() =>
      show.mutate(
        { makeDefault: false },
        {
          onSuccess: (result) => {
            if (result.siteRefused || result.domainMissing) {
              toast.warning("Your store's address couldn't be added", {
                description:
                  "Your map's site list is full. Remove a site under Embed on another site, at the bottom of this panel, then try again.",
              });
              return;
            }

            toast.success("Store address added", {
              description: `Published with ${result.storeHost} on the map's site list.`,
            });
          },
          onError: (error) => toastError(error, "Couldn't add your store's address"),
        },
      ),
    );

  const onRemove = () =>
    remove.mutate(undefined, {
      onSuccess: () => toast.success("Removed from your storefront"),
      onError: (error) => toastError(error, "Couldn't remove this map from your storefront"),
    });

  return {
    status,
    steps,
    primary,
    quietRedeploy,
    onAddToTheme,
    onGoToTheme,
    onAlreadyAdded: () => themeAddedFlag.mark(mapId),
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
