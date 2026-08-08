import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";
import { PlaceRowsSkeleton } from "@/components/ui/skeletons";

/**
 * Shown while the editor loads.
 *
 * Mirrors the two-panel layout at the same breakpoint as the editor itself, so
 * the map frame and the locations panel are already in place when the real
 * content arrives.
 */
export default function MapEditorLoading() {
  return (
    <Container className="flex flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <Skeleton className="h-[55dvh] min-h-64 w-full rounded-xl lg:h-auto lg:min-h-0 lg:flex-1" />

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:w-80 lg:shrink-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <Skeleton className="h-4 w-20 rounded-lg" />
            <Skeleton className="h-3 w-24 rounded-lg" />
          </div>
          <div className="p-2">
            <PlaceRowsSkeleton />
          </div>
        </aside>
      </div>
    </Container>
  );
}
