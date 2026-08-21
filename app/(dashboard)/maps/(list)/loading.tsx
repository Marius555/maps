import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";
import { ListActionsSkeleton } from "@/components/ui/skeletons";

/**
 * Shown while the maps list loads.
 *
 * Same Container as the page, so the swap from skeleton to content moves nothing.
 */
export default function MapsLoading() {
  return (
    <Container>
      <div className="space-y-6">
        <ListActionsSkeleton />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, card) => (
            <li key={card}>
              <Skeleton className="h-32 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
