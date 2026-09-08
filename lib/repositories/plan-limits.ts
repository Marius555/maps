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

/**
 * The analytics half of §6's table: how many visitor sessions a map may record
 * in a calendar month, and how long they are kept.
 *
 * **Separate from `PLAN_LIMITS` because these are not the same kind of number.**
 * Everything in that table is a thing the *owner* creates and can see; these two
 * bound something strangers cause. A map that hits its ceiling is not a customer
 * doing something wrong, so nothing here throws a `PlanLimitError` at anybody —
 * the collector simply stops writing and the dashboard says so.
 *
 * §6's plan table already reads "unlimited (badge shown)" under Views, and that
 * stays true: this caps rows we store, not maps a visitor may load. A map past
 * its ceiling keeps working perfectly for every visitor; it just stops being
 * measured until the month turns.
 *
 * **Not enforced against a real plan yet**, because everybody reads as `free`
 * until Week 4 wires up billing — which would cap every map on the app at a
 * thousand sessions. `SESSION_LIMITS.free` is therefore set where a free map
 * genuinely sits, and the pricing pass is what tightens it. Provisioned now for
 * the reason the `subscriptions` table was: so the code reaches its final shape
 * before the plan does.
 */
export const SESSION_LIMITS = {
  free: { sessionsPerMonth: 20_000, retentionDays: 30 },
  starter: { sessionsPerMonth: 200_000, retentionDays: 180 },
  pro: { sessionsPerMonth: 2_000_000, retentionDays: 365 },
} as const satisfies Record<
  PlanId,
  { sessionsPerMonth: number; retentionDays: number }
>;

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

/**
 * TEMPORARY, and testing only — delete this with the browser pass it exists for.
 *
 * Routes are a paid feature and everyone reads as `free` until Week 4 wires up
 * billing, so both endpoints that reach the routing engine answer 403 and the
 * Draw menu greys its Route row. That leaves the routing half of a provider swap
 * unreachable by hand — and by hand is the only way its failures show up, since
 * they are plausible wrong answers rather than errors.
 *
 * `DISABLE_ALL_PLAN` answers `pro` for everyone instead. It sits here, at the
 * one point the plan is resolved, rather than at any of the ten places a limit
 * is actually enforced: CLAUDE.md §6 says those checks live in the repositories
 * and never only in the UI, and every one of them still runs untouched — they
 * are simply asked about a different plan. The ceilings therefore become pro's
 * 3,000 places and 250 shapes rather than no ceiling at all, which is
 * indistinguishable from unlimited for testing and keeps every "n of N" badge
 * reading like a sentence.
 *
 * Read at call time rather than at module load, so a test can set it per case.
 */
function planChecksDisabled(): boolean {
  const raw = process.env.DISABLE_ALL_PLAN;
  if (!raw || !/^(1|true|yes)$/i.test(raw.trim())) return false;

  warnOnce();
  return true;
}

/**
 * Once per process, not once per request. `getUserPlan` is `cache()`d per
 * request, so a warning inside its body would print on every page load until
 * it stopped being read as a warning.
 */
let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;

  console.warn(
    "DISABLE_ALL_PLAN is set: every account reads as `pro`, so every plan limit and feature gate is bypassed. Testing only — unset it before this is in front of anyone.",
  );
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
  // TEMPORARY — see planChecksDisabled above. Skips the read as well as the check.
  if (planChecksDisabled()) return "pro";

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
