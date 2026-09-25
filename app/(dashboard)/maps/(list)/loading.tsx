import { Card, Skeleton } from "@heroui/react";

import {
  MAP_INFO_CLASS,
  MAP_LIST_CLASS,
  MAP_PANE_CLASS,
  MAP_ROW_CLASS,
} from "@/components/maps/map-row-layout";
import { Container } from "@/components/ui/container";
import { ListActionsSkeleton } from "@/components/ui/skeletons";

/**
 * Shown while the maps list loads.
 *
 * Same Container, same rows and the same diagonal as the page — the classes are
 * the card's own — down to each line's box height: a 28px title row, a 20px
 * description row, a 16px meta row. So the swap from skeleton to content moves
 * nothing.
 */
export default function MapsLoading() {
  return (
    <Container>
      <div className="space-y-6">
        <ListActionsSkeleton />

        <ul className={MAP_LIST_CLASS}>
          {Array.from({ length: 3 }, (_, card) => (
            <li key={card} className="min-w-0">
              <Card className={MAP_ROW_CLASS}>
                <div className={MAP_PANE_CLASS}>
                  <Skeleton className="size-full rounded-none" />
                </div>
                <div className={MAP_INFO_CLASS}>
                  <div>
                    <div className="flex h-7 items-center">
                      <Skeleton className="h-4 w-2/5 rounded-lg" />
                    </div>
                    <div className="flex h-5 items-center">
                      <Skeleton className="h-3 w-1/3 rounded-lg" />
                    </div>
                  </div>
                  <div className="mt-auto flex h-4 items-center">
                    <Skeleton className="h-3 w-3/5 rounded-lg" />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
