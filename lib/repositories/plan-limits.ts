import "server-only";

import { cache } from "react";
import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";
import { PlanFeatureError, type GatedFeature } from "./errors";

/** CLAUDE.md §6. Enforced in the repositories, never only in the UI. */
export const PLAN_LIMITS = {
  free: { maps: 1, places: 10, shapes: 3 },
  starter: { maps: 3, places: 300, shapes: 50 },
  pro: { maps: 15, places: 3000, shapes: 250 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

/**
 * What a plan can do, as against how much of it. §6's table is quantities; this
 * is the on/off half, kept beside it so a plan is described in one place.
 *
 * Routes are here because they are the one feature whose cost is not already
 * bounded by a quantity somewhere else. A location is geocoded once, ever, and
 * the place ceiling caps how many of those there can be — but a map with three
 * pins can have its route redrawn all afternoon, and arming the tool probes
 * every pin on the map besides. So the gate is both the pricing decision and
 * the spend cap, which is why it is enforced on the two endpoints that reach
 * the engine rather than only hidden in the toolbar.
 */
export const PLAN_FEATURES = {
  free: { routes: false },
  starter: { routes: true },
  pro: { routes: true },
} as const satisfies Record<PlanId, Record<GatedFeature, boolean>>;

/**
 * Whether a plan includes a feature — the table read, with no lookup.
 *
 * Server-side only, like everything in this module. The editor needs the same
 * answer in the browser and gets it the way it gets `placeLimit`: resolved on
 * the page and passed down as a prop.
 */
export function planAllows(plan: PlanId, feature: GatedFeature): boolean {
  return PLAN_FEATURES[plan][feature];
}

/**
 * Refuse unless the caller's plan includes the feature.
 *
 * `getUserPlan` is `cache()`d per request, so a route that already resolved the
 * plan for something else pays nothing to ask again here.
 */
export async function assertPlanFeature(
  userId: string,
  feature: GatedFeature,
): Promise<void> {
  const plan = await getUserPlan(userId);

  if (!planAllows(plan, feature)) {
    throw new PlanFeatureError(feature, plan);
  }
}

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
