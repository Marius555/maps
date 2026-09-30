import { Skeleton } from "@heroui/react";

import { Container } from "@/components/ui/container";

/** Shown while the notifications load: three rows in the list's own frame. */
export default function NotificationsLoading() {
  return (
    <Container>
      <ul className="space-y-3">
        {Array.from({ length: 3 }, (_, row) => (
          <li
            key={row}
            className="flex gap-3 rounded-xl border border-border bg-surface p-4 sm:gap-4 sm:p-5"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3 pt-1">
              <Skeleton className="h-3.5 w-2/5 rounded-lg" />
              <Skeleton className="h-3 w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4 rounded-lg" />
            </div>
          </li>
        ))}
      </ul>
    </Container>
  );
}
