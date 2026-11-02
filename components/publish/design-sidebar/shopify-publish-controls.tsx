"use client";

import { StorefrontRow } from "@/components/shopify/storefront/storefront-row";
import type { useStorefront } from "@/components/shopify/storefront/use-storefront";
import type { AppMap, Place } from "@/lib/repositories/types";
import { PublishAction } from "../publish-action";
import { ShareDialog } from "../share-dialog/share-dialog";

/**
 * The Publish footer's controls inside the Shopify admin: where the map stands
 * on the storefront, then Publish with the embed code as a square beside it
 * (docs/notes/shopify.md, "The Publish footer inside Shopify").
 *
 * All of it is pinned, so all of it is height the design folds cannot have.
 * That is why the storefront is one row rather than two numbered steps, and why
 * the embed code — for a merchant who also has another website — is an icon
 * rather than a sentence. It is demoted, not removed: it also holds the map's
 * allowed sites, which the "site list is full" toast sends the merchant to.
 *
 * Exactly one of Show on storefront, Add to theme and Publish is filled, and
 * `storefront.primary` says which.
 */
export function ShopifyPublishControls({
  map,
  places,
  isMeasuring,
  storefront,
}: {
  map: AppMap;
  places: Place[];
  isMeasuring: boolean;
  storefront: ReturnType<typeof useStorefront>;
}) {
  return (
    <>
      <StorefrontRow storefront={storefront} />

      <PublishAction
        mapId={map.id}
        variant={storefront.primary === "publish" ? "primary" : "secondary"}
        onStorefront={storefront.status.data?.onStorefront === true}
        aside={
          <ShareDialog trigger="icon" map={map} places={places} isMeasuring={isMeasuring} />
        }
      />
    </>
  );
}
