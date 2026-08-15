import "server-only";

import { cache } from "react";
import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/** CLAUDE.md §6. Enforced in the repositories, never only in the UI. */
export const PLAN_LIMITS = {
  free: { maps: 1, places: 10, shapes: 3 },
  starter: { maps: 3, places: 300, shapes: 50 },
  pro: { maps: 15, places: 3000, shapes: 250 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

type SubscriptionRow = Models.Row & {
  plan?: string | null;
  status?: string | null;
};

/**
 * Everyone is on the free plan until Week 4 wires up billing. This reads the
 * table rather than hardcoding, so turning billing on changes no code here.
 *
 * `cache()` keeps it to one read per request even when several creates check it.
 */
export const getUserPlan = cache(async (userId: string): Promise<PlanId> => {
  const result = await admin.tablesDB.listRows<SubscriptionRow>({
    databaseId: env.databaseId,
    tableId: TABLES.subscriptions,
    queries: [Query.equal("userId", userId), Query.limit(1)],
  });

  const subscription = result.rows[0];
  if (!subscription || subscription.status !== "active") return "free";

  return subscription.plan && subscription.plan in PLAN_LIMITS
    ? (subscription.plan as PlanId)
    : "free";
});
