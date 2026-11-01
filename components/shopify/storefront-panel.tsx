"use client";

import { Button, toast } from "@heroui/react";
import { Copy, Store } from "lucide-react";

import { copyText } from "@/components/ui/copy-text";
import { useMe } from "@/lib/query/auth";
import {
  useRemoveFromStorefront,
  useShowOnStorefront,
  useStorefrontStatus,
  type StorefrontStatus,
} from "@/lib/query/shopify";
import { toastError } from "@/lib/query/toast-error";

/**
 * "Show on storefront", in the Publish sidebar — only inside the Shopify admin
 * (docs/notes/shopify.md, "Storefront"). Everywhere else it renders nothing,
 * and the embed code beside it is how a map gets onto a site.
 *
 * Showing a map puts it on the list the "Pinglide map" theme block reads; the
 * first one becomes the default, so a block needs no settings. Further maps are
 * picked in the block by their map code.
 */
export function StorefrontPanel({ mapId }: { mapId: string }) {
  const { data } = useMe();
  const isShopify = Boolean(data?.user.shopify);

  const status = useStorefrontStatus(mapId, isShopify);
  const show = useShowOnStorefront(mapId);
  const remove = useRemoveFromStorefront(mapId);

  if (!isShopify) return null;

  const current = status.data;
  const busy = show.isPending || remove.isPending;

  const onShow = (makeDefault: boolean) =>
    show.mutate(
      { makeDefault },
      {
        onSuccess: (result) =>
          toast.success(makeDefault ? "Shown by default" : "On your storefront", {
            description: describe(result),
          }),
        onError: (error) => toastError(error, "Couldn't put this map on your storefront"),
      },
    );

  const onRemove = () =>
    remove.mutate(undefined, {
      onSuccess: () => toast.success("Removed from your storefront"),
      onError: (error) => toastError(error, "Couldn't remove this map from your storefront"),
    });

  return (
    <section aria-label="Shopify storefront" className="space-y-2 rounded-xl border border-border p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Store aria-hidden="true" className="size-4" />
        Your Shopify storefront
      </h3>

      {status.isPending ? (
        <p className="text-xs text-muted">Checking your storefront…</p>
      ) : current?.onStorefront ? (
        <>
          <p className="text-xs text-muted">
            {current.isDefault
              ? "This is the map a Pinglide block shows unless it names another."
              : "On your storefront. A Pinglide block shows it when its map code is this one."}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Map code</span>
            <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono">{current.code}</code>
            <Button
              size="sm"
              variant="tertiary"
              isIconOnly
              aria-label="Copy map code"
              onPress={() => void copyText(current.code, "Map code")}
            >
              <Copy aria-hidden="true" className="size-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => window.open(current.addBlockUrl, "_top")}
            >
              Add to theme
            </Button>
            {current.isDefault ? null : (
              <Button size="sm" variant="tertiary" isDisabled={busy} onPress={() => onShow(true)}>
                Show by default
              </Button>
            )}
            <Button size="sm" variant="tertiary" isDisabled={busy} onPress={onRemove}>
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            Makes this map available to the Pinglide map block in your theme. It
            publishes the map first if it has never been published.
          </p>
          <Button size="sm" variant="secondary" className="w-full" isPending={show.isPending} onPress={() => onShow(false)}>
            Show on storefront
          </Button>
        </>
      )}
    </section>
  );
}

function describe(result: StorefrontStatus): string {
  if (result.siteRefused) {
    return "Your map's site list is full, so your store's address couldn't be added. Remove a site under Embed code and domains.";
  }

  return result.published
    ? "Published, and ready for the Pinglide map block in your theme."
    : "Ready for the Pinglide map block in your theme.";
}
