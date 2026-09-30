import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/**
 * Cross-account — see the head of `./users.ts`. Reads what
 * `usage.repository.ts` writes: the pooled `"*"` row per day and one row per
 * account per month.
 */

type UsageRow = Models.Row & { userId: string; period: string; lookups?: number | null };

export type UsagePoint = { period: string; lookups: number };
export type AccountUsage = { userId: string; lookups: number };

/** The whole app's lookups per day since `fromDay` (`YYYY-MM-DD`). */
export async function listPooledLookups(fromDay: string): Promise<UsagePoint[]> {
  const result = await admin.tablesDB.listRows<UsageRow>({
    databaseId: env.databaseId,
    tableId: TABLES.usage,
    queries: [
      Query.equal("userId", "*"),
      Query.greaterThanEqual("period", fromDay),
      Query.limit(500),
    ],
  });

  return result.rows.map((row) => ({ period: row.period, lookups: row.lookups ?? 0 }));
}

/** Every account's spend in one month (`YYYY-MM`), biggest first. */
export async function listAccountLookups(month: string, cap = 2_000): Promise<AccountUsage[]> {
  const rows: AccountUsage[] = [];
  let cursor: string | undefined;

  while (rows.length < cap) {
    const result = await admin.tablesDB.listRows<UsageRow>({
      databaseId: env.databaseId,
      tableId: TABLES.usage,
      queries: [
        Query.equal("period", month),
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    for (const row of result.rows) {
      if (row.userId !== "*") rows.push({ userId: row.userId, lookups: row.lookups ?? 0 });
    }

    if (result.rows.length < 500) break;
    cursor = result.rows[result.rows.length - 1].$id;
  }

  return rows.sort((a, b) => b.lookups - a.lookups);
}
