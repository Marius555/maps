import type { Metadata } from "next";

import { NotificationComposeForm } from "@/components/admin/sections/notifications/notification-compose-form";
import { SentNotificationsTable } from "@/components/admin/sections/notifications/sent-notifications-table";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadSentNotifications } from "@/lib/admin/metrics/notifications";

export const metadata: Metadata = { title: "Notifications" };

/**
 * Messages to owners: written here, shown on their Notifications page with a
 * count in the sidebar. docs/notes/notifications.md. The sent list appears
 * once there is something in it.
 */
export default async function AdminNotificationsPage() {
  await requireAdminPage();

  const sent = await loadSentNotifications();

  return (
    <>
      <SectionCard title="Write a notification" hint="Plain text; line breaks are kept.">
        <NotificationComposeForm />
      </SectionCard>

      {sent.length > 0 ? (
        <SectionCard
          title="Sent"
          hint="Newest first. Times are UTC. Deleting one removes it for everyone it went to."
        >
          <SentNotificationsTable rows={sent} />
        </SectionCard>
      ) : null}
    </>
  );
}
