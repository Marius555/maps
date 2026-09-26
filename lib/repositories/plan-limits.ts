import "server-only";

import { cache } from "react";
import { Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { withKeptPlan } from "@/lib/billing/plan-change";
import { hasLapsed } from "@/lib/billing/standing";
import { env } from "@/lib/env";
import { PlanFeatureError, type GatedFeature } from "./errors";

/** CLAUDE.md §6. Enforced in the repositories, never only in the UI. */
export const PLAN_LIMITS = {
  free: { maps: 1, places: 25, shapes: 3 },
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
 * How many upstream address lookups an account may cause in a calendar month.
 *
 * **Its own table rather than a fourth key in `PLAN_LIMITS`, for two reasons.**
 * The mechanical one: `lib/marketing/plans.test.ts` compares the page's numbers
 * to `PLAN_LIMITS[plan.id]` with an exact-shape `toEqual`, so a fourth key there
 * is a broken test rather than a new row. The real one is the same distinction
 * `SESSION_LIMITS` is drawn on — everything in `PLAN_LIMITS` is a thing the owner
 * *creates and can see*, and this bounds something they *spend*.
 *
 * A lookup is one request to the geocoder: an address searched, a pin dropped or
 * dragged, a row geocoded on import or on a sheet sync, or one pin asked about by
 * the route tool's routability sweep. They are pooled because the provider pools
 * them — on Geoapify a routing `nearest()` probe is billed as a reverse geocode,
 * so counting routing separately would describe a bill nobody sends us.
 *
 * **Sized above full entitlement, deliberately.** Pro's 15 maps × 3,000 places is
 * 45,000 locations, and importing all of them inside one month has to work — a
 * ceiling that refuses a customer using exactly what they paid for is a bug with
 * a number attached. So 50,000 is entitlement plus slack, and at roughly
 * $0.20/1,000 on a hosted provider the worst case is about $10 against ~€35.80 net
 * of the merchant-of-record's fee. The property to preserve when these move: the
 * plan must still be profitable *at its ceiling*.
 *
 * What this number is therefore for is scripted abuse, not thrift. Bursts — one
 * import draining a shared daily allowance and stalling every other customer —
 * are the daily circuit breaker's job in `usage.repository.ts`, not this table's.
 */
export const LOOKUP_LIMITS = {
  free: { perMonth: 250 },
  starter: { perMonth: 4_000 },
  pro: { perMonth: 50_000 },
} as const satisfies Record<PlanId, { perMonth: number }>;

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
 *
 * Sheet sync is here on the same argument. Importing a sheet once is free on
 * every plan; keeping a map linked to one re-reads it every day and geocodes
 * whatever changed, which is spend nobody pressed a button for. Enforced where
 * the link is created and again on every sync, so a downgraded account's links
 * go quiet rather than keep spending.
 *
 * Analytics is the odd one out: it is a pricing decision and not a cost one. Its
 * cost is already bounded by `SESSION_LIMITS`, and it is gated because it is what
 * the paid plans are *worth* — the comparable products charge between $39 and $70
 * a month for this one tab. Enforced on the page that reads it and again in
 * `loadCollectGate`, so a free map stops being written to as well as stops being
 * shown; a map that was free therefore records nothing, and upgrading starts its
 * history that day rather than backfilling one.
 *
 * `noBadge` is the other pricing line: a free map carries a small "Made with"
 * link, which is how a stranger's visitor finds us, and paying removes it. Read
 * at publish (publish.repository.ts) — so a plan change reaches a live map on its
 * next publish, never by itself, which is §7's rule for everything in a snapshot.
 */
export const PLAN_FEATURES = {
  free: { routes: false, sheetSync: false, analytics: false, noBadge: false },
  starter: { routes: true, sheetSync: true, analytics: true, noBadge: true },
  pro: { routes: true, sheetSync: true, analytics: true, noBadge: true },
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
