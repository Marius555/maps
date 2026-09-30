import "server-only";

import type { Delta } from "@/lib/analytics/view";
import { requireAdmin } from "@/lib/admin/auth/guard";
import { PROVIDER_COLOR } from "@/lib/admin/colors";
import { listApiCalls, type ApiCallCount } from "@/lib/repositories/api-calls.repository";
import { listAllUsers } from "@/lib/repositories/admin/users";
import { listAccountLookups, listPooledLookups } from "@/lib/repositories/admin/usage";
import { listAllSubscriptions } from "@/lib/repositories/admin/subscriptions";
import { LOOKUP_LIMITS, type PlanId } from "@/lib/repositories/plan-limits";
import {
  BACKGROUND_RESERVE,
  DAILY_LOOKUP_BUDGET,
  usageMonth,
} from "@/lib/repositories/usage.repository";
import type { AdminRange } from "@/lib/validation/admin.schema";
import { deltaOf, periodOf, seriesOf, sum, toDay, type DayPoint } from "./period";
import { isPaying } from "./revenue";
import type { Slice } from "./users";

export const PROVIDERS = [
  { key: "geoapify", label: "Geoapify" },
  { key: "photon", label: "Photon" },
  { key: "osrm", label: "OSRM" },
] as const;

const KIND_LABEL: Record<string, string> = {
  geocode: "Address search",
  reverse: "Reverse geocode",
  route: "Route",
  nearest: "Snap to road",
};

export type ProviderDay = { day: string; geoapify: number; photon: number; osrm: number };

export type EndpointRow = {
  key: string;
  provider: string;
  kind: string;
  ok: number;
  failed: number;
  errorRate: number;
};

export type SpenderRow = {
  userId: string;
  name: string;
  email: string;
  plan: PlanId;
  lookups: number;
  limit: number;
};

export type ApisMetrics = {
  calls: Delta;
  callSeries: DayPoint[];
  failed: number;
  failedSeries: DayPoint[];
  failedPrevious: DayPoint[];
  byDay: ProviderDay[];
  byProvider: Slice[];
  endpoints: EndpointRow[];
  pool: {
    today: number;
    budget: number;
    backgroundCeiling: number;
    series: DayPoint[];
    previous: DayPoint[];
  };
  lookups: Delta;
  spenders: SpenderRow[];
  month: string;
  /** Which upstreams answer right now, from the same switches the adapters read. */
  active: { geocoder: string; router: string };
  /** The first day with a counter row, or null when none exists yet. */
  trackingSince: string | null;
};

export async function loadApisMetrics(range: AdminRange): Promise<ApisMetrics> {
  await requireAdmin();

  const now = new Date();
  const period = periodOf(range, now);
  const month = usageMonth(now);

  const [calls, pooled, accounts, { users }, subscriptions] = await Promise.all([
    listApiCalls(period.previousFromDay, toDay(now)),
    listPooledLookups(period.previousFromDay),
    listAccountLookups(month),
    listAllUsers(),
    listAllSubscriptions(),
  ]);

  const current = calls.filter((row) => row.day >= period.fromDay);
  const previous = calls.filter((row) => row.day < period.fromDay);
  const total = (rows: ApiCallCount[]) => rows.reduce((n, row) => n + row.ok + row.failed, 0);

  const byDayMap = new Map<string, ProviderDay>(
    period.days.map((day) => [day, { day, geoapify: 0, photon: 0, osrm: 0 }]),
  );
  for (const row of current) {
    const entry = byDayMap.get(row.day);
    if (entry) entry[row.provider] += row.ok + row.failed;
  }
  const byDay = period.days.map((day) => byDayMap.get(day)!);

  const endpoints = new Map<string, EndpointRow>();
  for (const row of current) {
    const key = `${row.provider}:${row.kind}`;
    const entry = endpoints.get(key) ?? {
      key,
      provider: row.provider,
      kind: KIND_LABEL[row.kind] ?? row.kind,
      ok: 0,
      failed: 0,
      errorRate: 0,
    };
    entry.ok += row.ok;
    entry.failed += row.failed;
    endpoints.set(key, entry);
  }
  for (const entry of endpoints.values()) {
    entry.errorRate = entry.failed / Math.max(1, entry.ok + entry.failed);
  }

  const failedByDay = new Map<string, number>();
  for (const row of calls) {
    failedByDay.set(row.day, (failedByDay.get(row.day) ?? 0) + row.failed);
  }

  const failed = current.reduce((n, row) => n + row.failed, 0);
  const pooledMap = new Map(pooled.map((row) => [row.period, row.lookups]));
  const poolSeries = seriesOf(pooledMap, period.days);
  const poolPrevious = seriesOf(pooledMap, period.previousDays);

  const people = new Map(users.map((user) => [user.id, user]));
  const plans = new Map(
    subscriptions
      .filter((sub) => isPaying(sub, now))
      .map((sub) => [sub.userId, sub.plan as PlanId] as const),
  );

  const spenders = accounts.slice(0, 25).map((row) => {
    const plan = plans.get(row.userId) ?? "free";
    const person = people.get(row.userId);

    return {
      userId: row.userId,
      name: person?.name ?? "",
      email: person?.email ?? "Deleted account",
      plan,
      lookups: row.lookups,
      limit: LOOKUP_LIMITS[plan].perMonth,
    };
  });

  const callSeries = byDay.map((entry) => ({
    day: entry.day,
    value: entry.geoapify + entry.photon + entry.osrm,
  }));

  return {
    calls: deltaOf(total(current), total(previous)),
    callSeries,
    failed,
    failedSeries: seriesOf(failedByDay, period.days),
    failedPrevious: seriesOf(failedByDay, period.previousDays),
    byDay,
    byProvider: PROVIDERS.map((provider) => ({
      key: provider.key,
      label: provider.label,
      value: sum(byDay.map((entry) => ({ day: entry.day, value: entry[provider.key] }))),
      color: PROVIDER_COLOR[provider.key],
    })),
    endpoints: [...endpoints.values()].sort((a, b) => b.ok + b.failed - (a.ok + a.failed)),
    pool: {
      today: pooledMap.get(toDay(now)) ?? 0,
      budget: DAILY_LOOKUP_BUDGET,
      backgroundCeiling: Math.floor(DAILY_LOOKUP_BUDGET * BACKGROUND_RESERVE),
      series: poolSeries,
      previous: poolPrevious,
    },
    lookups: deltaOf(sum(poolSeries), sum(poolPrevious)),
    spenders,
    month,
    active: {
      geocoder: process.env.GEOCODER_PROVIDER === "geoapify" ? "Geoapify" : "Photon",
      router: process.env.ROUTING_PROVIDER === "geoapify" ? "Geoapify" : "OSRM",
    },
    trackingSince: calls.length ? calls.reduce((a, row) => (row.day < a ? row.day : a), calls[0].day) : null,
  };
}
