import "server-only";

import { Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type { AppNotification, NotificationAudience } from "@/lib/notifications/types";
import { toNotification } from "../mappers";
import type { NotificationRow } from "../types";

/**
 * Every notification ever sent, whoever it went to — the operator console's
 * Notifications page. Cross-account by design, like the rest of this folder
 * (see `users.ts`); its only caller is a loader that has run `requireAdmin()`.
 */

/** Newest first; older ones stop listing on the page, they are not deleted. */
const SENT_LIMIT = 200;

export type SentNotification = AppNotification & {
  audience: NotificationAudience;
  audienceUserId: string | null;
  audiencePlans: string[];
};

export async function listAllNotifications(): Promise<SentNotification[]> {
  try {
    const result = await admin.tablesDB.listRows<NotificationRow>({
      databaseId: env.databaseId,
      tableId: TABLES.notifications,
      queries: [Query.orderDesc("publishedAt"), Query.limit(SENT_LIMIT)],
    });

    return result.rows.map((row) => ({
      ...toNotification(row),
      audience: row.audience as NotificationAudience,
      audienceUserId: row.audienceUserId ?? null,
      audiencePlans: row.audiencePlans ?? [],
    }));
  } catch (error) {
    throw toRepositoryError(error);
  }
}
