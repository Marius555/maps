import type { AppNotification, NotificationFeed } from "./types";

/**
 * Which notifications are new to this account.
 *
 * New means published after the account last opened the Notifications page —
 * or, if it never has, after the account was created. The second half is what
 * stops somebody who signs up today being greeted by a count of every broadcast
 * ever sent; the old ones still list, they just are not news.
 *
 * Pure, so it is tested without Appwrite.
 */
export function toFeed(
  items: readonly AppNotification[],
  seenAt: string | null,
  createdAt: string | null,
): NotificationFeed {
  const since = latest(seenAt, createdAt);

  const flagged = items.map((item) => ({
    ...item,
    isUnread: since === null || Date.parse(item.publishedAt) > since,
  }));

  return {
    items: flagged,
    unreadCount: flagged.filter((item) => item.isUnread).length,
  };
}

/** The later of two ISO stamps, as a timestamp; null when neither parses. */
function latest(...stamps: (string | null)[]): number | null {
  const times = stamps
    .map((stamp) => (stamp ? Date.parse(stamp) : Number.NaN))
    .filter((time) => Number.isFinite(time));

  return times.length ? Math.max(...times) : null;
}

/** Visible now: published, and not yet expired. */
export function isLive(item: AppNotification, now: number): boolean {
  if (Date.parse(item.publishedAt) > now) return false;

  return item.expiresAt === null || Date.parse(item.expiresAt) > now;
}
