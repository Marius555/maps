import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";
import {
  PlaceRowsSkeleton,
  PlaceTableSkeleton,
} from "@/components/ui/skeletons";

/**
 * Shown while the Locations page loads.
 *
 * In its own `(list)` route group, and that is the point of the group: a
 * `loading.tsx` covers its segment's page *and every route below it*, so while
 * this sat directly in `places/` it was also the fallback for `places/import`.
 * Clicking Import therefore played this skeleton, then the import skeleton, then
 * the import page — two shimmer animations out of phase with each other and
 * neither one shaped like what arrived.
 *
 * The list is drawn twice for the same reason `PlacesManager` renders it twice:
 * a seven-column table from `lg` up, stacked rows below.
 */
export default function PlacesLoading() {
  return (
    <Container size="centered">
      <div className="space-y-6">
        {/* The toolbar: search, two filters, then the actions cluster — which is
            three controls in its own flex wrapper (two badges and Import), not
            the single button this used to promise. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Skeleton className="h-14 rounded-xl sm:min-w-56 sm:flex-1" />
          <Skeleton className="h-14 rounded-xl sm:w-48" />
          <Skeleton className="h-14 rounded-xl sm:w-48" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Skeleton className="h-7 w-28 rounded-3xl" />
            <Skeleton className="h-7 w-20 rounded-3xl" />
            <Skeleton className="h-9 w-36 rounded-3xl" />
          </div>
        </div>

        <div className="hidden lg:block">
          <PlaceTableSkeleton rows={8} />
        </div>
        <div className="lg:hidden">
          <PlaceRowsSkeleton rows={8} />
        </div>
      </div>
    </Container>
  );
}
