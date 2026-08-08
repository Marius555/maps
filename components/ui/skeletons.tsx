import { Skeleton } from "@heroui/react";

/**
 * Shapes shared by the route-level `loading.tsx` files.
 *
 * v3's Skeleton is a standalone box, not a wrapper — there is no `isLoaded` and
 * you don't wrap real children in it. You render a tree that mirrors the real
 * one, which is why these live next to each other: if a skeleton stops matching
 * its page, the swap becomes a visible jump.
 */

export function PageHeaderSkeleton({ hasAction = false }: { hasAction?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className="h-4 w-64 rounded-lg" />
      </div>
      {hasAction ? <Skeleton className="h-9 w-28 rounded-3xl" /> : null}
    </div>
  );
}

/** Mirrors SectionPanel: header block, then rows of fields. */
export function SectionPanelSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32 rounded-lg" />
        <Skeleton className="h-3 w-3/5 rounded-lg" />
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <Skeleton key={row} className="h-10 w-full rounded-xl" />
      ))}
    </div>
  );
}

/** Mirrors PlaceListItem's 48px row. */
export function PlaceRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-12 items-center gap-2 px-2">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5 rounded-lg" />
            <Skeleton className="h-3 w-3/5 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
