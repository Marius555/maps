import { Skeleton } from "@heroui/react";

import { Container, Measure } from "@/components/ui/container";

/** Shown while the notifications load: three rows in the list's own frame. */
export default function NotificationsLoading() {
  return (
    <Container>
      <Measure className="space-y-6">
        <Skeleton className="h-3 w-28 rounded-lg" />
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {Array.from({ length: 3 }, (_, row) => (
            <li key={row} className="space-y-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <Skeleton className="h-3.5 w-2/5 rounded-lg" />
                <Skeleton className="ml-auto h-3 w-16 rounded-lg" />
              </div>
              <div className="space-y-2 pl-11">
                <Skeleton className="h-3 w-full rounded-lg" />
                <Skeleton className="h-3 w-3/4 rounded-lg" />
              </div>
            </li>
          ))}
        </ul>
      </Measure>
    </Container>
  );
}
