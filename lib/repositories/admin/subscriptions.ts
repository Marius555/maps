import "server-only";

import { Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";
import type { SubscriptionRow } from "../subscriptions.repository";

/** Cross-account — see the head of `./users.ts`. */

export type AdminSubscription = {
  userId: string;
  plan: string;
  status: string;
  cadence: string | null;
  currentPeriodEnd: string | null;
  updatedAt: string;
};

export async function listAllSubscriptions(): Promise<AdminSubscription[]> {
  const rows: AdminSubscription[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 20; page += 1) {
    const result = await admin.tablesDB.listRows<SubscriptionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.subscriptions,
      queries: [Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
    });

    for (const row of result.rows) {
      rows.push({
        userId: row.userId,
        plan: row.plan ?? "free",
        status: row.status ?? "active",
        cadence: row.cadence ?? null,
        currentPeriodEnd: row.currentPeriodEnd ?? null,
        updatedAt: row.$updatedAt,
      });
    }

    if (result.rows.length < 500) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }

  return rows;
}
