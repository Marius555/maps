import "server-only";

import { requireAdmin } from "@/lib/admin/auth/guard";
import {
  LOOKUP_LIMITS,
  PLAN_FEATURES,
  PLAN_LIMITS,
  SESSION_LIMITS,
  type PlanId,
} from "@/lib/limits/plans";
import {
  readAccountIdentity,
  readAccountLookups,
  readAccountMaps,
  readAccountSubscription,
  type AccountIdentity,
  type AccountSubscription,
} from "@/lib/repositories/admin/account";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import { usageMonth } from "@/lib/repositories/usage.repository";

/**
 * One account against every limit its plan sets — the console's answer to
 * "is this customer inside their plan?".
 *
 * The plan is `getUserPlan`'s, the same function every repository check asks, so
 * this page and the refusals a customer meets can never disagree about which
 * plan applies. The stored subscription row is shown beside it because the two
 * can differ legitimately (a lapsed period, a downgrade still inside the month
 * already paid for) and the difference is exactly what an operator is usually
 * looking for.
 */

export type Usage = { used: number; limit: number; over: boolean };

function usage(used: number, limit: number): Usage {
  return { used, limit, over: used > limit };
}

export type AccountMapRow = {
  id: string;
  name: string;
  createdAt: string;
  publishedAt: string | null;
  /** False for a map past the plan's map count — it will not republish. */
  withinMapAllowance: boolean;
  places: Usage;
  shapes: Usage;
  groups: number;
  sessions: Usage;
  sheetAutoSync: boolean | null;
  /** Any reason Publish would refuse this map today. */
  over: boolean;
};

export type AccountLimits = {
  user: AccountIdentity;
  plan: PlanId;
  subscription: AccountSubscription | null;
  features: (typeof PLAN_FEATURES)[PlanId];
  maps: Usage;
  lookups: Usage;
  mapRows: AccountMapRow[];
  /** How many limits the account is past, across everything above. */
  overCount: number;
};

export async function loadAccountLimits(userId: string): Promise<AccountLimits | null> {
  await requireAdmin();

  const user = await readAccountIdentity(userId);
  if (!user) return null;

  const month = usageMonth();
  const [plan, subscription, lookups, maps] = await Promise.all([
    getUserPlan(userId),
    readAccountSubscription(userId),
    readAccountLookups(userId, month),
    readAccountMaps(userId, `${month}-01`),
  ]);

  const limits = PLAN_LIMITS[plan];
  const sessionLimit = SESSION_LIMITS[plan].sessionsPerMonth;

  const mapRows = maps.map((map, index): AccountMapRow => {
    const places = usage(map.places, limits.places);
    const shapes = usage(map.shapes, limits.shapes);
    const withinMapAllowance = index < limits.maps;

    return {
      ...map,
      withinMapAllowance,
      places,
      shapes,
      sessions: usage(map.sessions, sessionLimit),
      over: places.over || shapes.over || !withinMapAllowance,
    };
  });

  const mapUsage = usage(maps.length, limits.maps);
  const lookupUsage = usage(lookups, LOOKUP_LIMITS[plan].perMonth);

  const overCount =
    (mapUsage.over ? 1 : 0) +
    (lookupUsage.over ? 1 : 0) +
    mapRows.reduce((sum, row) => sum + (row.places.over ? 1 : 0) + (row.shapes.over ? 1 : 0), 0);

  return {
    user,
    plan,
    subscription,
    features: PLAN_FEATURES[plan],
    maps: mapUsage,
    lookups: lookupUsage,
    mapRows,
    overCount,
  };
}
