import "server-only";

import { listNotificationsFor } from "@/lib/repositories/notifications.repository";
import { personalPlan } from "@/lib/team/resolve";
import { readSeenState } from "./seen";
import type { NotificationFeed } from "./types";
import { toFeed } from "./unread";

/**
 * The person's notifications with the new ones flagged — what both the
 * Notifications page and `GET /api/notifications` answer with, so the page's
 * first paint and the sidebar's count cannot disagree.
 *
 * Plan-addressed notifications use `personalPlan`, the best plan the person
 * works under, so switching teams never makes a notification appear or vanish.
 */
export async function loadNotificationFeed(userId: string): Promise<NotificationFeed> {
  const plan = await personalPlan(userId);
  const [items, seen] = await Promise.all([
    listNotificationsFor(userId, plan),
    readSeenState(userId),
  ]);

  return toFeed(items, seen.seenAt, seen.createdAt);
}
