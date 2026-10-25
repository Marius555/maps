"use client";

import { Button } from "@heroui/react";

import { useFreshNotificationFeed } from "@/lib/query/notifications";
import { NotificationList } from "../notification-list";
import { NotificationsSkeleton } from "./notifications-skeleton";

/**
 * What the drawer holds. Mounted when the drawer opens and gone when it shuts,
 * so mounting is opening: the feed is fetched fresh here and `NotificationList`
 * marks it seen, exactly as the page does with the feed it rendered on the
 * server. See `useFreshNotificationFeed` for why not the sidebar's cached copy.
 */
export function NotificationsPanel({ onNavigate }: { onNavigate: () => void }) {
  const { feed, error, retry } = useFreshNotificationFeed();

  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-xl bg-surface-secondary px-4 py-6 text-center">
        <p className="text-sm text-foreground">
          Couldn&apos;t load your notifications. Check your connection and try again.
        </p>
        <Button variant="secondary" size="sm" onPress={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!feed) return <NotificationsSkeleton />;

  return <NotificationList initialFeed={feed} onNavigate={onNavigate} />;
}
