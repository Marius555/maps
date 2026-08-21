import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";
import { PlaceRowsSkeleton } from "@/components/ui/skeletons";

/**
 * Shown while the editor loads.
 *
 * Mirrors the two-panel layout at the same breakpoint as the editor itself, so
 * the map frame and the locations panel are already in place when the real
 * content arrives.
 *
 * The height classes are copied verbatim from `map-editor.tsx` and
 * `editor-sidebar.tsx`, including the `lg:h-[calc(100dvh-3rem)]` that stops the
 * page growing. Any drift between them shows up as a jump at the moment the
 * skeleton swaps out, which is the one moment nothing should move.
 */
export default function MapEditorLoading() {
  return (
    <Container className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:h-[calc(100dvh-3rem)] lg:flex-none lg:flex-row">
        <Skeleton className="h-[55dvh] min-h-64 w-full rounded-xl lg:h-auto lg:min-h-0 lg:flex-1" />

        <aside className="flex max-h-[60dvh] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:max-h-none lg:w-80 lg:shrink-0">
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
