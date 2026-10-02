import "server-only";

import { cache } from "react";
import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { withKeptPlan } from "@/lib/billing/plan-change";
import { hasLapsed } from "@/lib/billing/standing";
import { env } from "@/lib/env";
import { PLAN_FEATURES, PLAN_LIMITS, type PlanId } from "@/lib/limits/plans";
import { PlanFeatureError, type GatedFeature } from "./errors";

/*
 * The tables themselves live in lib/limits/plans.ts, the one file to edit when a
 * limit changes. Re-exported so every existing import keeps working.
 */
export {
  LOOKUP_LIMITS,
  MAX_GROUPS_PER_MAP,
  PLAN_FEATURES,
  PLAN_LIMITS,
  SESSION_LIMITS,
  type PlanId,
} from "@/lib/limits/plans";

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
 * The second half of every quantity check: after the insert, count again, and
 * undo this call's rows if the total is now past the limit.
 *
 * **Why a first half is not enough.** Every create counts, then inserts. Two
 * requests landing together both count the same number, both pass, and both
 * insert — five parallel "New map" presses on a free account made five maps.
 * Appwrite has no transaction to put the count and the insert in, so the check
 * runs again once the rows exist, when every racer's rows are visible.
 *
 * Each racer that sees the total over the limit removes **all** of its own rows,
 * so the total can never end above the limit however the requests interleave.
 * Two racers may both be refused where one could have fitted; that is the strict
 * direction, and the retry succeeds.
 *
 * A count that cannot be read lets the rows stand — the same choice
 * `assertLookupHeadroom` makes. The insert already succeeded, and refusing it
 * because a second read failed would lose the customer's work.
 */
export async function rollBackIfOverLimit({
  total,
  limit,
  undo,
  error,
}: {
  total: () => Promise<number>;
  limit: number;
  undo: () => Promise<void>;
  error: Error;
}): Promise<void> {
  let count: number;

  try {
    count = await total();
  } catch {
    return;
  }

  if (count <= limit) return;

  try {
    await undo();
  } catch (cause) {
    console.error("Couldn't remove rows created past a plan limit:", cause);
  }

  throw error;
}

/**
 * Development only: read every account as `pro`.
 *
 * Paid features cannot be exercised by hand on an account that has not bought
 * anything, and by hand is the only way some of their failures show up — a
 * mis-snapped route is a plausible wrong answer rather than an error. So this
 * answers `pro` for everyone, at the one point the plan is resolved rather than
 * at any of the places a limit is enforced: CLAUDE.md §6 says those checks live
 * in the repositories, and every one of them still runs untouched — they are
 * simply asked about a different plan. The ceilings become pro's 3,000 places and
 * 250 shapes rather than no ceiling at all, which keeps every "n of N" badge
 * reading like a sentence.
 *
 * **It is inert in a production build, and that is not belt-and-braces.** This is
 * a switch that hands the paid product to everybody, configured by an environment
 * variable, on a platform where setting one is a form field and a redeploy. It
 * used to be marked "delete this before it is in front of anyone", which is a plan
 * rather than a guarantee — and the day it is wrong is the day nobody notices for
 * a month. Refusing to read it outside development makes the guarantee mechanical:
 * there is no value anybody can set in production that opens this.
 *
 * Read at call time rather than at module load, so a test can set it per case.
 */
function planChecksDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;

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
  currentPeriodEnd?: string | null;
  keptPlan?: string | null;
  keptUntil?: string | null;
};

function asPlan(value: string | null | undefined): PlanId | null {
  return value && value in PLAN_LIMITS ? (value as PlanId) : null;
}

/**
 * Which plan an account is on, read from the `subscriptions` table the billing
 * webhook writes.
 *
 * `cache()` keeps it to one read per request even when several creates check it.
 *
 * **Two conditions, not one, and the second is the safety net.** `status` is what
 * the webhook says; `currentPeriodEnd` is when what it said stops being true. They
 * are separate because a cancellation does *not* end access — Lemon Squeezy keeps
 * a cancelled subscription running to the end of its paid period, so the webhook
 * writes `active` with `currentPeriodEnd` set and expects a later
 * `subscription_expired` to close it. If that event is missed, dropped or retried
 * into a failure, the row sits at `active` forever and the account keeps a plan it
 * stopped paying for. Reading the date here means the worst a lost webhook can do
 * is expire somebody a little early, which they can see and fix, rather than
 * silently give the product away.
 *
 * An absent date means no expiry is known, which is the free row's state and the
 * state of anything written before this column was used. Absent must go on meaning
 * what it meant before.
 *
 * **A downgrade waits for the renewal here, not at the provider.** The provider
 * already bills the lower plan the moment it is asked; `keptPlan` is the higher
 * one the customer paid this period for, granted until `keptUntil`. It only ever
 * raises what a live subscription grants — see `withKeptPlan`.
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
  if (hasLapsed(subscription.currentPeriodEnd)) return "free";

  const keptPlan = asPlan(subscription.keptPlan);

  return withKeptPlan(
    asPlan(subscription.plan) ?? "free",
    keptPlan && subscription.keptUntil
      ? { plan: keptPlan, until: subscription.keptUntil }
      : null,
  );
});
