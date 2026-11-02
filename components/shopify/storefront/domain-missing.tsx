"use client";

import { Button } from "@heroui/react";
import { TriangleAlert } from "lucide-react";

/**
 * A map on the storefront whose site list leaves out the store's address —
 * most often a custom domain connected after the map went on. The embed
 * refuses to draw it there, so visitors see nothing (docs/notes/shopify.md,
 * "Storefront"). One press adds the address and republishes.
 */
export function DomainMissing({
  storeHost,
  isDisabled,
  isPending,
  onFix,
}: {
  storeHost: string;
  isDisabled: boolean;
  isPending: boolean;
  onFix: () => void;
}) {
  return (
    <div role="alert" className="space-y-1.5 rounded-lg bg-warning/10 p-2.5">
      <p className="flex gap-1.5 text-xs text-foreground">
        <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
        <span>
          {storeHost} isn&rsquo;t on this map&rsquo;s site list, so the map won&rsquo;t show on your
          store. Adding it publishes the map again.
        </span>
      </p>
      <Button size="sm" variant="secondary" isDisabled={isDisabled} isPending={isPending} onPress={onFix}>
        Add {storeHost}
      </Button>
    </div>
  );
}
