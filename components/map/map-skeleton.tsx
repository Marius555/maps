import { Skeleton } from "@heroui/react";

/**
 * Placeholder with the canvas's exact footprint, so nothing shifts on load.
 *
 * A shimmer rather than the words "Loading map…": MapLibre is a large chunk on a
 * cold cache, and a static label for a second or two reads as a map that failed
 * rather than one on its way. The text stays for screen readers.
 */
export function MapSkeleton() {
  return (
    <div className="relative h-full w-full" role="status" aria-label="Loading map">
      <Skeleton className="h-full w-full rounded-none" />
      <span className="sr-only">Loading map…</span>
    </div>
  );
}
