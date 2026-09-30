import "server-only";

import { repoContext } from "@/lib/repositories/context";
import { listNotificationsFor } from "@/lib/repositories/notifications.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import { readSeenState } from "./seen";
import type { NotificationFeed } from "./types";
import { toFeed } from "./unread";

/**
 * The account's notifications with the new ones flagged — what both the
 * Notifications page and `GET /api/notifications` answer with, so the page's
 * first paint and the sidebar's count cannot disagree.
 */
export async function loadNotificationFeed(userId: string): Promise<NotificationFeed> {
  const plan = await getUserPlan(userId);
  const [items, seen] = await Promise.all([
    listNotificationsFor(repoContext(userId), plan),
    readSeenState(userId),
  ]);

  return toFeed(items, seen.seenAt, seen.createdAt);
}
