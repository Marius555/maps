/**
 * Messages from us to account owners. docs/notes/notifications.md.
 *
 * A plain module: the page, the sidebar and the repository all read these, and
 * a `"use client"` file would hand a server component a reference rather than
 * the arrays (CLAUDE.md, "Stack specifics").
 */

/** How a notification is drawn. Hand-copied into scripts/appwrite-schema.mjs. */
export const NOTIFICATION_KINDS = ["info", "success", "warning"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Who sees it. Hand-copied into scripts/appwrite-schema.mjs. */
export const NOTIFICATION_AUDIENCES = ["all", "plan", "user"] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

/** One notification as an owner is shown it — never who else it was sent to. */
export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: NotificationKind;
  /** `https://…` or an in-app path. Absent means no button. */
  linkUrl: string | null;
  linkLabel: string | null;
  publishedAt: string;
  expiresAt: string | null;
};

/** What the Notifications page and the sidebar's count are drawn from. */
export type NotificationFeed = {
  items: (AppNotification & { isUnread: boolean })[];
  unreadCount: number;
};
