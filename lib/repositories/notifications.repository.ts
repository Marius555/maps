import "server-only";

import { ID, Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { isLive } from "@/lib/notifications/unread";
import type { AppNotification } from "@/lib/notifications/types";
import type { NotificationInput } from "@/lib/validation/notification.schema";
import type { RepoContext } from "./context";
import { toNotification } from "./mappers";
import type { PlanId } from "./plan-limits";
import type { NotificationRow } from "./types";

/**
 * Messages from us to account owners. docs/notes/notifications.md.
 *
 * Admin client only, and no row carries a permission: the audience is decided
 * by the query below, never by Appwrite's ACL, so a notification to one account
 * cannot leak through a browser SDK call because no browser can read the table.
 */

/** Most an owner is shown. Older ones stop listing, which is what a feed does. */
const FEED_LIMIT = 50;

/**
 * Every notification addressed to this account and live right now: sent to
 * everyone, to its plan, or to it alone — newest first.
 *
 * Expiry is checked here rather than in the query, because "no expiry or later
 * than now" is an `or` with an `isNull` inside it for a filter that removes, at
 * most, a handful of rows.
 */
export async function listNotificationsFor(
  ctx: RepoContext,
  plan: PlanId,
): Promise<AppNotification[]> {
  const now = new Date();

  try {
    const result = await admin.tablesDB.listRows<NotificationRow>({
      databaseId: env.databaseId,
      tableId: TABLES.notifications,
      queries: [
        Query.or([
          Query.equal("audience", "all"),
          Query.and([
            Query.equal("audience", "user"),
            Query.equal("audienceUserId", ctx.userId),
          ]),
          Query.and([
            Query.equal("audience", "plan"),
            Query.contains("audiencePlans", plan),
          ]),
        ]),
        Query.lessThanEqual("publishedAt", now.toISOString()),
        Query.orderDesc("publishedAt"),
        Query.limit(FEED_LIMIT),
      ],
    });

    return result.rows
      .map(toNotification)
      .filter((item) => isLive(item, now.getTime()));
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Send a notification. Its one caller is `POST /api/admin/notifications`.
 *
 * Takes input already parsed by `notificationInputSchema`, and writes only the
 * audience field that audience uses, so a row never says "everyone" while also
 * naming an account.
 */
export async function createNotification(
  input: NotificationInput,
): Promise<AppNotification> {
  try {
    const row = await admin.tablesDB.createRow<NotificationRow>({
      databaseId: env.databaseId,
      tableId: TABLES.notifications,
      rowId: ID.unique(),
      data: {
        title: input.title,
        body: input.body,
        kind: input.kind,
        audience: input.audience,
        audienceUserId: input.audience === "user" ? (input.audienceUserId ?? null) : null,
        audiencePlans: input.audience === "plan" ? (input.audiencePlans ?? []) : [],
        linkUrl: input.linkUrl || null,
        linkLabel: input.linkUrl ? (input.linkLabel ?? null) : null,
        publishedAt: input.publishedAt ?? new Date().toISOString(),
        expiresAt: input.expiresAt ?? null,
      },
      permissions: [],
    });

    return toNotification(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Withdraw a notification — `DELETE /api/admin/notifications/[id]`. */
export async function deleteNotification(id: string): Promise<void> {
  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.notifications,
      rowId: id,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** The notifications addressed to one account alone — account deletion. */
export async function deleteNotificationsForUser(userId: string): Promise<void> {
  try {
    await admin.tablesDB.deleteRows({
      databaseId: env.databaseId,
      tableId: TABLES.notifications,
      queries: [Query.equal("audienceUserId", userId)],
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}
