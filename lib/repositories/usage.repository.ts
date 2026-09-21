import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";
import { DailyBudgetError, LookupLimitError } from "./errors";
import { LOOKUP_LIMITS, getUserPlan, type PlanId } from "./plan-limits";

/**
 * What an account has spent on the geocoder this month, and what the whole app
 * has spent today.
 *
 * ## Why this exists at all
 *
 * Every other ceiling in this codebase bounds something a customer *keeps* — maps,
 * locations, shapes, stored sessions. This one bounds something they *spend*, and
 * until it existed nothing did. Measured before it was written, a single account
 * could cause:
 *
 * - **200** lookups by arming the route tool once, and **200 more on every page
 *   reload**, because the routability sweep's verdicts lived in refs that die with
 *   the page;
 * - **~6,600** by pressing "Sync now" once, with no limit on presses;
 * - **3,000** with one import, with no limit on imports;
 * - **unbounded** by re-posting chunks to `geocode/batch`, which sizes its own plan
 *   check from a `runTotal` the client chooses.
 *
 * Against an upstream selling 3,000 credits a *day*, any one of those is a whole
 * day of everybody's allowance spent by one person in one gesture.
 *
 * ## The two rows, and the two different failures
 *
 * `assertLookupHeadroom` checks both and they are not the same question:
 *
 * - **The account's month** is a pricing question. It refuses with a
 *   `LookupLimitError` naming the plan, because the person who caused it is the
 *   person who can fix it.
 * - **The whole app's day** is a shared-resource question, and the person it stops
 *   is usually not the person who caused it. It must never say "your plan" —
 *   `DailyBudgetError` is a plain "busy, try again" with no blame attached.
 *
 * ## Interactive spend outranks background spend
 *
 * The daily budget is not one queue. A person watching a spinner and a nightly
 * sheet sync are not owed the same service, so background work stops at
 * `BACKGROUND_RESERVE` and leaves the rest for somebody who is actually waiting.
 * Without that split the first import of the morning takes the day's budget and
 * every human-facing lookup fails until midnight.
 *
 * ## The honest caveat: this counter can undercount
 *
 * Appwrite has no atomic increment — CLAUDE.md §6 records the same fact as the
 * reason `mapDaily` exists. So `recordLookups` is a read, an add and a write, and
 * two requests landing together can each read the same value and write the same
 * sum, losing one of them.
 *
 * That is accepted rather than worked around, and the reason it is acceptable is
 * the direction of the error: a lost write makes the counter **lower** than the
 * truth, so the ceiling arrives late rather than early. A ceiling that occasionally
 * lets a few extra lookups through is a rounding error on the bill; one that
 * occasionally refuses a paying customer who has not reached it is a support
 * ticket. The race is also small in practice — `lib/geocoding/throttle.ts` paces
 * every upstream call through one process-wide queue, so concurrent writes for the
 * same account are rare and bounded by however many instances are running.
 *
 * Do not "fix" this with a read-check-write loop or a lock. If exactness is ever
 * needed, the answer is a row per spend and a rollup, which is what `mapSessions`
 * and `mapDaily` already are.
 */

/** The pooled daily row's `userId`. Not a valid Appwrite user id, deliberately. */
const POOL = "*";

/**
 * How many lookups the app as a whole may make in one UTC day.
 *
 * Set to the upstream plan's daily quota. It is a constant rather than an
 * environment variable because it is not configuration — it is a fact about the
 * contract we are on, and it should change in a commit that also explains which
 * contract, beside the number it changed from.
 *
 * Geoapify's free tier is 3,000/day; their API 10 plan is 10,000/day. A
 * self-hosted Photon has no daily quota at all, and when geocoding moves there
 * this number stops describing the geocoder and starts describing only whatever
 * is still hosted. Raise it then — do not delete it, because a budget that exists
 * only while somebody remembers to add it back is not one.
 */
export const DAILY_LOOKUP_BUDGET = 3_000;

/**
 * The share of the day background work may take before it stands aside.
 *
 * 80%, leaving a fifth of the day for people. Not a tuned number — a reserve, and
 * the property that matters is only that it is comfortably under 1.
 */
const BACKGROUND_RESERVE = 0.8;

/**
 * Who is waiting for this lookup.
 *
 * `interactive` — somebody pressed something and is watching: an address search,
 * a pin dropped or dragged, Directions. Spends the day's budget to the last credit.
 *
 * `background` — nobody is waiting: the routability sweep, a sheet sync, the cron
 * job. Stops at the reserve so it cannot starve the case above.
 */
export type SpendKind = "interactive" | "background";

type UsageRow = Models.Row & {
  userId: string;
  period: string;
  lookups?: number | null;
};

/** `YYYY-MM` in UTC — the key for an account's monthly allowance. */
export function usageMonth(now: Date = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `${String(now.getUTCFullYear())}-${month}`;
}

/** `YYYY-MM-DD` in UTC — the key for the pooled daily budget. */
export function usageDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Whether the meter is switched off entirely.
 *
 * The same escape hatch `getUserPlan` honours, read the same way and at call time
 * for the same reason. A testing flag that bypassed the plan but not the allowance
 * would leave a tester refused by a ceiling they had just turned off, which reads
 * as the flag being broken.
 */
function meterDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const raw = process.env.DISABLE_ALL_PLAN;

  return Boolean(raw && /^(1|true|yes)$/i.test(raw.trim()));
}

async function findRow(userId: string, period: string): Promise<UsageRow | null> {
  const result = await admin.tablesDB.listRows<UsageRow>({
    databaseId: env.databaseId,
    tableId: TABLES.usage,
    queries: [
      Query.equal("userId", userId),
      Query.equal("period", period),
      Query.limit(1),
    ],
  });

  return result.rows[0] ?? null;
}

async function readCount(userId: string, period: string): Promise<number> {
  const row = await findRow(userId, period);

  return row?.lookups ?? 0;
}

export type LookupUsage = {
  plan: PlanId;
  used: number;
  limit: number;
};

/**
 * What an account has spent this month, against what its plan allows.
 *
 * For the account page, which states the number rather than waiting for a refusal
 * to state it. Never throws: a usage panel that takes the page down with it is
 * worse than a usage panel that is absent.
 */
export async function getLookupUsage(userId: string): Promise<LookupUsage> {
  const plan = await getUserPlan(userId);
  const limit = LOOKUP_LIMITS[plan].perMonth;

  try {
    return { plan, used: await readCount(userId, usageMonth()), limit };
  } catch {
    return { plan, used: 0, limit };
  }
}

/**
 * Refuse unless both budgets have room for `count` more lookups.
 *
 * Called **before** the upstream request, and paired with `recordLookups` after it
 * answers — never around it, because a request that failed upstream is one the
 * customer should not be billed for. The gap between the two is what the undercount
 * caveat above is mostly about, and it is the right way round: we would rather miss
 * a few than charge for a 502.
 *
 * `count` is what is about to be asked for, not what was asked for last time. A
 * caller that geocodes 25 addresses asserts 25 once rather than 1 twenty-five
 * times — one read instead of twenty-five, and a refusal that arrives before the
 * batch starts rather than in the middle of it.
 */
export async function assertLookupHeadroom(
  userId: string,
  count: number,
  kind: SpendKind,
): Promise<void> {
  if (meterDisabled() || count <= 0) return;

  const plan = await getUserPlan(userId);
  const limit = LOOKUP_LIMITS[plan].perMonth;

  try {
    const [used, pooled] = await Promise.all([
      readCount(userId, usageMonth()),
      readCount(POOL, usageDay()),
    ]);

    if (used + count > limit) throw new LookupLimitError(limit, plan);

    const ceiling =
      kind === "background"
        ? Math.floor(DAILY_LOOKUP_BUDGET * BACKGROUND_RESERVE)
        : DAILY_LOOKUP_BUDGET;

    if (pooled + count > ceiling) throw new DailyBudgetError();
  } catch (error) {
    if (error instanceof LookupLimitError || error instanceof DailyBudgetError) {
      throw error;
    }

    /*
     * The meter could not be read. Let the lookup through.
     *
     * Failing open is the deliberate choice, and it is the same one
     * `lib/email/mx.ts` makes about an uncertain DNS answer: an Appwrite wobble
     * must not become an outage of the thing customers pay for. The exposure is
     * bounded anyway — the upstream has its own hard quota, and it refusing us is
     * a worse error message, not a worse bill.
     */
  }
}

/**
 * Add `count` to the account's month and to the app's day.
 *
 * Both rows, in one call, because a spend that lands in one and not the other is a
 * meter that disagrees with itself and nothing would ever reconcile them.
 *
 * **Never throws.** It is called after the work the caller was asked to do has
 * already succeeded, so anything raised here would turn a successful geocode into
 * a failed request — losing the answer the customer waited for in order to report
 * that we failed to write down that they got it.
 */
export async function recordLookups(userId: string, count: number): Promise<void> {
  if (meterDisabled() || count <= 0) return;

  await Promise.all([
    bump(userId, usageMonth(), count),
    bump(POOL, usageDay(), count),
  ]);
}

async function bump(userId: string, period: string, count: number): Promise<void> {
  try {
    const row = await findRow(userId, period);

    if (row) {
      await admin.tablesDB.updateRow({
        databaseId: env.databaseId,
        tableId: TABLES.usage,
        rowId: row.$id,
        data: { lookups: (row.lookups ?? 0) + count },
      });

      return;
    }

    await admin.tablesDB.createRow({
      databaseId: env.databaseId,
      tableId: TABLES.usage,
      rowId: ID.unique(),
      data: { userId, period, lookups: count },
    });
  } catch {
    /*
     * Two writers can create the same (userId, period) at once and the unique
     * index refuses the loser, which is the race this whole file admits to. The
     * loser's count is dropped rather than retried: see the undercount caveat in
     * the file head — late is survivable, and a retry loop inside a path that must
     * not throw is how a dropped count becomes a hung request.
     */
  }
}
