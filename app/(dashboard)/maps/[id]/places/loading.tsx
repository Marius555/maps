import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";
import { PageHeaderSkeleton, PlaceRowsSkeleton } from "@/components/ui/skeletons";

export default function PlacesLoading() {
  return (
    <Container>
      <div className="space-y-6">
        <PageHeaderSkeleton hasAction />

        {/* The search + category filter row. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Skeleton className="h-14 flex-1 rounded-xl" />
          <Skeleton className="h-14 rounded-xl sm:w-56" />
        </div>

        <PlaceRowsSkeleton rows={8} />
      </div>
    </Container>
  );
}
