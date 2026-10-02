import "server-only";

import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isNotFound } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";

/**
 * One account's usage, read across every table it owns rows in — for the
 * console's per-user limits page. Cross-account like the rest of this folder
 * (see the head of `./users.ts`): the caller is `lib/admin/metrics/account.ts`,
 * which checks `requireAdmin()` first.
 *
 * Counts only, never the rows: a count query asks for one row and reads
 * Appwrite's `total`, so a Pro account's 15 full maps is a few dozen small
 * requests rather than 45,000 rows over the wire.
 */

type TableId = (typeof TABLES)[keyof typeof TABLES];

async function countRows(tableId: TableId, queries: string[]): Promise<number> {
  const result = await admin.tablesDB.listRows({
    databaseId: env.databaseId,
    tableId,
    queries: [...queries, Query.select(["$id"]), Query.limit(1)],
    total: true,
  });

  return result.total;
}

export type AccountIdentity = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  accessedAt: string;
  verified: boolean;
  enabled: boolean;
};

export async function readAccountIdentity(userId: string): Promise<AccountIdentity | null> {
  try {
    const user = await admin.users.get({ userId });

    return {
      id: user.$id,
      name: user.name,
      email: user.email,
      createdAt: user.registration || user.$createdAt,
      accessedAt: user.accessedAt || "",
      verified: user.emailVerification,
      enabled: user.status,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** The stored row as it is — `getUserPlan` is what decides what it grants. */
export type AccountSubscription = {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  cadence: string | null;
  keptPlan: string | null;
  keptUntil: string | null;
  billingSubscriptionId: string;
};

type SubscriptionRow = Models.Row & {
  plan?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | null;
  cadence?: string | null;
  keptPlan?: string | null;
  keptUntil?: string | null;
  billingSubscriptionId?: string | null;
};

export async function readAccountSubscription(
  userId: string,
): Promise<AccountSubscription | null> {
  const { rows } = await admin.tablesDB.listRows<SubscriptionRow>({
    databaseId: env.databaseId,
    tableId: TABLES.subscriptions,
    queries: [Query.equal("userId", userId), Query.limit(1)],
  });

  const row = rows[0];
  if (!row) return null;

  return {
    plan: row.plan ?? "",
    status: row.status ?? "",
    currentPeriodEnd: row.currentPeriodEnd ?? null,
    cadence: row.cadence ?? null,
    keptPlan: row.keptPlan ?? null,
    keptUntil: row.keptUntil ?? null,
    billingSubscriptionId: row.billingSubscriptionId ?? "",
  };
}

/** What the account has spent on the geocoder in `month` (`YYYY-MM`). */
export async function readAccountLookups(userId: string, month: string): Promise<number> {
  const { rows } = await admin.tablesDB.listRows<Models.Row & { lookups?: number | null }>({
    databaseId: env.databaseId,
    tableId: TABLES.usage,
    queries: [Query.equal("userId", userId), Query.equal("period", month), Query.limit(1)],
  });

  return rows[0]?.lookups ?? 0;
}

export type AccountMapUsage = {
  id: string;
  name: string;
  createdAt: string;
  publishedAt: string | null;
  places: number;
  shapes: number;
  groups: number;
  /** Visitor sessions recorded since `monthStart`. */
  sessions: number;
  /** Null when the map is not linked to a sheet. */
  sheetAutoSync: boolean | null;
};

type MapRow = Models.Row & { name: string; publishedAt?: string | null };
type SheetLinkRow = Models.Row & { mapId: string; autoSync?: boolean | null };

/** Past any plan's map count; a guard on the read, not a limit. */
const MAP_READ_CAP = 100;

/**
 * Every map the account owns, oldest first — the order `isAmongFirstMaps` uses
 * to decide which maps still publish after a downgrade — with what each holds.
 */
export async function readAccountMaps(
  userId: string,
  monthStart: string,
): Promise<AccountMapUsage[]> {
  const [{ rows: maps }, { rows: links }] = await Promise.all([
    admin.tablesDB.listRows<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      queries: [
        Query.equal("userId", userId),
        Query.select(["$id", "$createdAt", "name", "publishedAt"]),
        Query.orderAsc("$createdAt"),
        Query.orderAsc("$id"),
        Query.limit(MAP_READ_CAP),
      ],
    }),
    admin.tablesDB.listRows<SheetLinkRow>({
      databaseId: env.databaseId,
      tableId: TABLES.sheetLinks,
      queries: [Query.equal("userId", userId), Query.limit(MAP_READ_CAP)],
    }),
  ]);

  const autoSync = new Map(links.map((link) => [link.mapId, link.autoSync === true]));

  return Promise.all(
    maps.map(async (map) => {
      const byMap = [Query.equal("mapId", map.$id)];
      const [places, shapes, groups, sessions] = await Promise.all([
        countRows(TABLES.places, byMap),
        countRows(TABLES.shapes, byMap),
        countRows(TABLES.groups, byMap),
        countRows(TABLES.mapSessions, [...byMap, Query.greaterThanEqual("day", monthStart)]),
      ]);

      return {
        id: map.$id,
        name: map.name,
        createdAt: map.$createdAt,
        publishedAt: map.publishedAt ?? null,
        places,
        shapes,
        groups,
        sessions,
        sheetAutoSync: autoSync.has(map.$id) ? (autoSync.get(map.$id) ?? false) : null,
      };
    }),
  );
}
