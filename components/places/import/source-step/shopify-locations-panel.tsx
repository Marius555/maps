"use client";

import { Button } from "@heroui/react";
import { Store } from "lucide-react";

/**
 * "Import from Shopify": the store's own locations, in one press
 * (docs/notes/shopify.md, "Import from Shopify"). Only offered inside the
 * Shopify admin.
 *
 * The first press asks Shopify for permission to read locations — an optional
 * scope, so installing never asked for it — and the copy says so before the
 * dialog appears. After that the rows go through the same mapping and review
 * as a file.
 */
export function ShopifyLocationsPanel({
  isBusy,
  isDisabled,
  onImport,
}: {
  isBusy: boolean;
  isDisabled: boolean;
  onImport: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-4 rounded-xl border border-border px-5 py-5">
      <div className="flex gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-default text-foreground">
          <Store className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">Your store&rsquo;s locations</p>
          <p className="text-xs text-muted">
            Brings in every active location from Shopify — name, address and phone — already
            placed on the map. The first time, Shopify asks you to allow Pinglide to read your
            locations.
          </p>
        </div>
      </div>

      <Button className="self-start" isPending={isBusy} isDisabled={isDisabled} onPress={onImport}>
        Import from Shopify
      </Button>
    </div>
  );
}
