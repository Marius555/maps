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
 * `locations-drawer.tsx`, including the `h-[calc(100dvh-3rem)]` that stops the
 * page growing and the `max-md:` variant that allows for the mobile header. Any
 * drift between them shows up as a jump at the moment the skeleton swaps out,
 * which is the one moment nothing should move.
 *
 * Below `lg` the panel is a bottom sheet parked at its peek height, which is why
 * the skeleton shows a rail and a title row and no list at all: that is exactly
 * what the real panel shows when it arrives.
 */
export default function MapEditorLoading() {
  return (
    <Container className="flex min-h-0 flex-col">
      <div className="relative flex h-[calc(100dvh-3rem)] min-h-0 flex-none flex-col gap-4 max-lg:overflow-hidden max-md:h-[calc(100dvh-6.5rem)] lg:flex-row">
        <Skeleton className="min-h-64 w-full flex-1 rounded-xl lg:min-h-0" />

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:h-[var(--sheet-peek)] lg:w-80 lg:shrink-0">
          <div className="flex h-[var(--sheet-peek)] shrink-0 flex-col border-b border-border lg:h-11 lg:justify-center">
            <div className="flex h-5 shrink-0 items-center justify-center lg:hidden">
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-between gap-2 px-3">
              <Skeleton className="h-4 w-20 rounded-lg" />
              <Skeleton className="h-3 w-24 rounded-lg" />
            </div>
          </div>
          <div className="p-2 max-lg:hidden">
            <PlaceRowsSkeleton />
          </div>
        </aside>
      </div>
    </Container>
  );
}
