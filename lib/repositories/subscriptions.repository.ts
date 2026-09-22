import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import type { KeptPlan, SubscriptionState } from "@/lib/billing/types";
import { env } from "@/lib/env";
import { ownerPermissions } from "./maps.repository";
import { PLAN_LIMITS, type PlanId } from "./plan-limits";

/**
 * What an account is paying for.
 *
 * One row per user, found by `userId` rather than by a fixed row id, the same way
 * `getUserPlan` and `card-design.repository.ts` do. The unique index on `userId`
 * is what makes that safe: there is no state in which an account has two.
 *
 * **The columns are named after the job, not the vendor** — `billingCustomerId`,
 * not `lemonCustomerId` (CLAUDE.md §6). That is not tidiness. A stored column
 * outlives the decision that filled it, and renaming one across live rows to
 * change provider is the kind of migration that gets skipped, leaving the schema
 * lying about itself for years.
 *
 * Nothing here decides anything about access. `getUserPlan` in `plan-limits.ts`
 * is the only reader that matters, and it applies both the status and the expiry
 * — see its docblock for why those are two conditions and not one.
 */

export type SubscriptionRow = Models.Row & {
  userId: string;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  plan?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | null;
  cadence?: string | null;
  keptPlan?: string | null;
  keptCadence?: string | null;
  keptUntil?: string | null;
};

async function findRow(userId: string): Promise<SubscriptionRow | null> {
  const result = await admin.tablesDB.listRows<SubscriptionRow>({
    databaseId: env.databaseId,
    tableId: TABLES.subscriptions,
    queries: [Query.equal("userId", userId), Query.limit(1)],
  });

  return result.rows[0] ?? null;
}

export type Subscription = SubscriptionState & {
  updatedAt: string;
  /**
   * The plan already paid for, kept after a downgrade until the renewal — or
   * null. Read it through `pendingKept`, which also checks the date: a kept plan
   * whose renewal has passed is left in the row and means nothing.
   */
  kept: KeptPlan | null;
};

/** The account's subscription, or null for one that has never bought anything. */
export async function getSubscription(
  userId: string,
): Promise<Subscription | null> {
  try {
    const row = await findRow(userId);
    if (!row) return null;

    return {
      userId,
      plan:
        row.plan && row.plan in PLAN_LIMITS ? (row.plan as PlanId) : "free",
      // Widened rather than validated: the column is an enum, so anything in it
      // was already accepted by the database, and re-deciding here would be a
      // second opinion about the same value.
      status: (row.status ?? "canceled") as Subscription["status"],
      billingCustomerId: row.billingCustomerId ?? "",
      billingSubscriptionId: row.billingSubscriptionId ?? "",
      currentPeriodEnd: row.currentPeriodEnd ?? null,
      // Null for every row written before the column existed, and it stays
      // null rather than being guessed — see `SubscriptionState.cadence`.
      cadence:
        row.cadence === "monthly" || row.cadence === "yearly" ? row.cadence : null,
      updatedAt: row.$updatedAt,
      kept: keptOf(row),
    };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

function keptOf(row: SubscriptionRow): KeptPlan | null {
  if ((row.keptPlan !== "starter" && row.keptPlan !== "pro") || !row.keptUntil) {
    return null;
  }

  return {
    plan: row.keptPlan,
    cadence:
      row.keptCadence === "monthly" || row.keptCadence === "yearly"
        ? row.keptCadence
        : null,
    until: row.keptUntil,
  };
}

/**
 * Write what the provider says is true.
 *
 * **Idempotent, because webhooks are not delivered once.** Providers retry on any
 * non-2xx and can deliver out of order or twice on a good day; a handler that
 * appended, incremented or toggled would drift. This replaces the row's contents
 * with the state the event described, so applying the same event five times is
 * the same as applying it once.
 *
 * The row is given `ownerPermissions` so it looks like every other row this user
 * owns, even though nothing reads it through a session client — `getUserPlan`
 * uses the admin client. Consistency is the point: a row with no permissions is a
 * row somebody has to think about later.
 *
 * **`kept` is written only when it is passed**, and only the change-plan route
 * passes it. The webhook and the cadence backfill leave it alone, which matters
 * because the provider answers a downgrade with a `subscription_updated` event:
 * a write that cleared the kept plan there would take away, seconds later, the
 * month of Pro the downgrade had just promised. `null` clears it.
 */
export async function upsertSubscription(
  state: SubscriptionState,
  kept?: KeptPlan | null,
): Promise<void> {
  const data = {
    plan: state.plan,
    status: state.status,
    billingCustomerId: state.billingCustomerId,
    billingSubscriptionId: state.billingSubscriptionId,
    currentPeriodEnd: state.currentPeriodEnd,
    cadence: state.cadence,
    ...(kept === undefined
      ? {}
      : {
          keptPlan: kept?.plan ?? null,
          keptCadence: kept?.cadence ?? null,
          keptUntil: kept?.until ?? null,
        }),
  };

  try {
    const row = await findRow(state.userId);

    if (row) {
      await admin.tablesDB.updateRow({
        databaseId: env.databaseId,
        tableId: TABLES.subscriptions,
        rowId: row.$id,
        data,
      });

      return;
    }

    await admin.tablesDB.createRow({
      databaseId: env.databaseId,
      tableId: TABLES.subscriptions,
      rowId: ID.unique(),
      data: { userId: state.userId, ...data },
      permissions: ownerPermissions(state.userId),
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Which account a provider-side customer belongs to.
 *
 * The fallback path for renewal events. `meta.custom_data` is set at the checkout
 * and comes back on the events that descend from it, but it is the provider's
 * promise rather than ours — and an event that arrives without it and without
 * this lookup would be a renewal we could not attach to anybody, which is a
 * customer whose plan silently lapses while their card is being charged.
 */
export async function findUserByBillingCustomer(
  billingCustomerId: string,
): Promise<string | null> {
  if (!billingCustomerId) return null;

  try {
    const result = await admin.tablesDB.listRows<SubscriptionRow>({
      databaseId: env.databaseId,
      tableId: TABLES.subscriptions,
      queries: [
        Query.equal("billingCustomerId", billingCustomerId),
        Query.limit(1),
      ],
    });

    return result.rows[0]?.userId ?? null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}
