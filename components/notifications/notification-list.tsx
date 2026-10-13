"use client";

import { useEffect, useRef, useState } from "react";

import { formatCount } from "@/lib/format/number";
import type { NotificationFeed } from "@/lib/notifications/types";
import { useMarkNotificationsSeen, useNotifications } from "@/lib/query/notifications";
import { NotificationItem } from "./notification-item";
import { NotificationSection } from "./notification-section";
import { NotificationsEmpty } from "./notifications-empty";

/**
 * The Notifications page: an inbox, in a readable column.
 *
 * Opening it is reading it: once drawn, the sidebar's count clears and the
 * account's stamp moves on. What was new at load stays marked "New" for the
 * whole visit — `newIds` is taken once, from the feed the server rendered,
 * because the query refetches on focus and would by then report everything
 * read. The same set splits the list into New and Earlier.
 *
 * Every row starts shut and one opens at a time (CLAUDE.md §8, folds).
 */
export function NotificationList({ initialFeed }: { initialFeed: NotificationFeed }) {
  const { data = initialFeed } = useNotifications(initialFeed);
  const markSeen = useMarkNotificationsSeen();
  const { mutate } = markSeen;

  const [newIds] = useState(
    () => new Set(initialFeed.items.filter((item) => item.isUnread).map((item) => item.id)),
  );
  const [now] = useState(() => Date.now());
  const [openId, setOpenId] = useState<string | null>(null);

  // Once per visit, even under Strict Mode's double effect.
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || initialFeed.unreadCount === 0) return;
    marked.current = true;
    mutate(initialFeed);
  }, [initialFeed, mutate]);

  if (data.items.length === 0) return <NotificationsEmpty />;

  const fresh = data.items.filter((item) => newIds.has(item.id));
  const earlier = data.items.filter((item) => !newIds.has(item.id));
  const isGrouped = fresh.length > 0 && earlier.length > 0;

  const groups = [
    { id: "notifications-new", heading: "New", items: fresh },
    { id: "notifications-earlier", heading: "Earlier", items: earlier },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <p className="px-1 text-xs text-muted">
        {formatCount(data.items.length)}{" "}
        {data.items.length === 1 ? "message" : "messages"}
        {fresh.length > 0 ? ` · ${formatCount(fresh.length)} new` : ""}
      </p>

      {groups.map((group) => (
        <NotificationSection
          key={group.id}
          id={group.id}
          heading={isGrouped ? group.heading : null}
        >
          {group.items.map((item) => (
            <NotificationItem
              key={item.id}
              notification={item}
              isNew={newIds.has(item.id)}
              isOpen={openId === item.id}
              onToggle={() =>
                setOpenId((current) => (current === item.id ? null : item.id))
              }
              now={now}
            />
          ))}
        </NotificationSection>
      ))}
    </div>
  );
}
