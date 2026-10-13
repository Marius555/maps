import type { Metadata } from "next";

import { NotificationList } from "@/components/notifications/notification-list";
import { Container, Measure } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { requireUser } from "@/lib/auth/current-user";
import { loadNotificationFeed } from "@/lib/notifications/feed";

export const metadata: Metadata = { title: "Notifications" };

/**
 * Messages from us: product news, maintenance, notes about this account.
 * docs/notes/notifications.md.
 *
 * Read on the server so the list is there on the first paint, with the new ones
 * already flagged; the client then clears the sidebar's count.
 *
 * In `Measure`, Settings' reading column: the full-width container stretched a
 * single message across the whole screen.
 */
export default async function NotificationsPage() {
  const user = await requireUser();
  const feed = await loadNotificationFeed(user.id);

  return (
    <Container>
      <PageTitle>Notifications</PageTitle>
      <Measure>
        <NotificationList initialFeed={feed} />
      </Measure>
    </Container>
  );
}
