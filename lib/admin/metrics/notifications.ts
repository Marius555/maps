import "server-only";

import { requireAdmin } from "@/lib/admin/auth/guard";
import { listAllNotifications, type SentNotification } from "@/lib/repositories/admin/notifications";
import { emailsForUserIds } from "@/lib/repositories/admin/users";

export type SentStatus = "scheduled" | "live" | "expired";

export type SentNotificationRow = SentNotification & {
  status: SentStatus;
  /** The one account it went to, by email; null for a broadcast or a deleted account. */
  recipientEmail: string | null;
};

/** What the console's Notifications page lists under "Sent". */
export async function loadSentNotifications(): Promise<SentNotificationRow[]> {
  await requireAdmin();

  const notifications = await listAllNotifications();
  const emails = await emailsForUserIds(
    notifications.flatMap((item) => (item.audienceUserId ? [item.audienceUserId] : [])),
  );
  const now = Date.now();

  return notifications.map((item) => ({
    ...item,
    status: statusOf(item, now),
    recipientEmail: item.audienceUserId ? (emails.get(item.audienceUserId) ?? null) : null,
  }));
}

function statusOf(item: SentNotification, now: number): SentStatus {
  if (Date.parse(item.publishedAt) > now) return "scheduled";
  if (item.expiresAt !== null && Date.parse(item.expiresAt) <= now) return "expired";

  return "live";
}
