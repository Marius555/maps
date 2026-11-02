"use client";

import { TriangleAlert } from "lucide-react";

/**
 * A map on the storefront whose site list leaves out the store's address —
 * most often a custom domain connected after the map went on. The embed
 * refuses to draw it there, so visitors see nothing (docs/notes/shopify.md,
 * "Storefront"). One press adds the address and republishes.
 *
 * One line under step 1 of the storefront stepper rather than a box: the
 * stepper is pinned, so every line it takes is one the design folds lose. The
 * toast that answers the press says it published.
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
    <p role="alert" className="flex gap-1.5 text-xs text-pretty text-foreground">
      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
      <span>
        {storeHost} isn&rsquo;t on this map&rsquo;s site list, so the map won&rsquo;t show on your
        store.{" "}
        <button
          type="button"
          disabled={isDisabled || isPending}
          aria-busy={isPending}
          onClick={onFix}
          className="rounded font-medium underline outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add it"}
        </button>
      </span>
    </p>
  );
}
