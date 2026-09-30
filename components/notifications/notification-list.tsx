"use client";

import { useEffect, useRef, useState } from "react";

import type { NotificationFeed } from "@/lib/notifications/types";
import { useMarkNotificationsSeen, useNotifications } from "@/lib/query/notifications";
import { NotificationItem } from "./notification-item";
import { NotificationsEmpty } from "./notifications-empty";

/**
 * The Notifications page.
 *
 * Opening it is reading it: once drawn, the sidebar's count clears and the
 * account's stamp moves on. What was new at load stays marked "New" for the
 * whole visit — `newIds` is taken once, from the feed the server rendered,
 * because the query refetches on focus and would by then report everything
 * read.
 */
export function NotificationList({ initialFeed }: { initialFeed: NotificationFeed }) {
  const { data = initialFeed } = useNotifications(initialFeed);
  const markSeen = useMarkNotificationsSeen();
  const { mutate } = markSeen;

  const [newIds] = useState(
    () => new Set(initialFeed.items.filter((item) => item.isUnread).map((item) => item.id)),
  );
  const [now] = useState(() => Date.now());

  // Once per visit, even under Strict Mode's double effect.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || initialFeed.unreadCount === 0) return;
    marked.current = true;
    mutate(initialFeed);
  }, [initialFeed, mutate]);

  if (data.items.length === 0) return <NotificationsEmpty />;

  return (
    <ul className="space-y-3">
      {data.items.map((item) => (
        <li key={item.id}>
          <NotificationItem notification={item} isNew={newIds.has(item.id)} now={now} />
        </li>
      ))}
    </ul>
  );
}
