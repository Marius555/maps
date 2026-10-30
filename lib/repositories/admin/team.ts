import "server-only";

import { Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/**
 * One account's team, as counts, for the operator console — the members of its
 * own workspace, the invites still out from it, and how many other teams it
 * has joined. Cross-account by nature, so it lives here with the rest of
 * `lib/repositories/admin` and is only read behind `requireAdmin()`.
 */
export type AccountTeam = {
  members: number;
  liveInvites: number;
  memberOf: number;
};

async function count(tableId: string, queries: string[]): Promise<number> {
  const result = await admin.tablesDB.listRows({
    databaseId: env.databaseId,
    tableId,
    queries: [...queries, Query.limit(1)],
    total: true,
  });

  return result.total;
}

export async function readAccountTeam(userId: string): Promise<AccountTeam> {
  const [members, liveInvites, memberOf] = await Promise.all([
    count(TABLES.memberships, [Query.equal("workspaceId", userId)]),
    count(TABLES.invites, [
      Query.equal("workspaceId", userId),
      Query.greaterThan("expiresAt", new Date().toISOString()),
    ]),
    count(TABLES.memberships, [Query.equal("userId", userId)]),
  ]);

  return { members, liveInvites, memberOf };
}
