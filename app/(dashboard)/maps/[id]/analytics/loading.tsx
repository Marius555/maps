import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";

/**
 * Shown while the Analytics page loads.
 *
 * The same `Container size` as the page, which is not optional: a skeleton at a
 * different width moves the layout at the moment it is replaced.
 *
 * No route group around it, unlike `maps/(list)` or `places/(list)` — a
 * `loading.tsx` covers its segment's page *and every route below it*, and this
 * segment has no routes below it. Add one and this needs the group.
 *
 * It mirrors what actually arrives, top to bottom: the period picker, five stat
 * tiles, the chart, the map, and the first table. Not the whole page — a
 * skeleton of nine sections is a longer, greyer version of the wait it is meant
 * to shorten, and everything below the fold is replaced before anyone scrolls to
 * it.
 *
 * The range picker is *not* skeletoned. Changing period is a navigation inside
 * a transition (`range-picker.tsx`), which keeps the old figures on screen and
 * never reaches this file — so drawing a placeholder for the one control that
 * survives a range change would be drawing a lie.
 */
export default function AnalyticsLoading() {
  return (
    <Container size="centered">
      <div className="flex items-end justify-between gap-3 pb-4">
        <Skeleton className="h-4 w-48 rounded-lg" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      <div className="space-y-10">
        {/* Five tiles, at the two breakpoints the real row uses. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, tile) => (
            <Skeleton key={tile} className="h-[5.75rem] w-full rounded-xl" />
          ))}
        </div>

        <div className="space-y-3">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-[140px] w-full rounded-lg" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-4 w-40 rounded-lg" />
          <Skeleton className="h-[min(55dvh,460px)] w-full rounded-xl" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-4 w-44 rounded-lg" />

          {Array.from({ length: 6 }, (_, row) => (
            <div
              key={row}
              className="flex items-center gap-3 border-t border-border py-2"
            >
              <Skeleton className="h-4 w-2/5 rounded-lg" />
              <Skeleton className="ml-auto h-4 w-16 rounded-lg" />
              <Skeleton className="h-1.5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
