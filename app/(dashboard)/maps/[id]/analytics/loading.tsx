import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";

/**
 * Shown while the Analytics page loads.
 *
 * The same `Container` width as the page, which is not optional: a skeleton at a
 * different width moves the layout at the moment it is replaced.
 *
 * No route group around it, unlike `maps/(list)` or `places/(list)` — a
 * `loading.tsx` covers its segment's page *and every route below it*, and this
 * segment has no routes below it. Add one and this needs the group.
 *
 * It mirrors what actually arrives, top to bottom: the period select, the four
 * headline cards, the traffic chart beside the rates, and the heat map. Not the
 * whole page: a skeleton of every card is a longer, greyer version of the wait
 * it is meant to shorten.
 *
 * The period switch is skeletoned here only for the first load. Changing period
 * is a navigation inside a transition (`range-picker.tsx`), which keeps the old
 * figures on screen and never reaches this file.
 */
export default function AnalyticsLoading() {
  return (
    <Container className="mx-auto max-w-7xl">
      <div className="pb-5">
        {/* The select: its label, then its trigger. */}
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="mt-1.5 h-9 w-44 rounded-xl" />
      </div>

      <div className="space-y-4">
        {/* Four headline cards, at the breakpoints the real row uses. */}
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, card) => (
            <Skeleton key={card} className="h-[12.5rem] w-full rounded-3xl" />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[22rem] w-full rounded-3xl lg:col-span-2" />
          <Skeleton className="h-[22rem] w-full rounded-3xl" />
        </div>

        <Skeleton className="h-[min(55dvh,460px)] w-full rounded-3xl" />
      </div>
    </Container>
  );
}
