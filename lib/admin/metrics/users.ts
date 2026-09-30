import "server-only";

import type { Delta } from "@/lib/analytics/view";
import { requireAdmin } from "@/lib/admin/auth/guard";
import { GREY, PLAN_COLOR, SPLIT_COLORS } from "@/lib/admin/colors";
import { listAllSubscriptions } from "@/lib/repositories/admin/subscriptions";
import { listAllUsers, listOAuthUserIds } from "@/lib/repositories/admin/users";
import type { AdminRange } from "@/lib/validation/admin.schema";
import {
  countByDay,
  deltaOf,
  periodOf,
  sum,
  withinDays,
  type DayPoint,
} from "./period";
import { isPaying } from "./revenue";

export type Slice = { key: string; label: string; value: number; color: string };

export type UserRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  accessedAt: string;
  verified: boolean;
  method: string;
  plan: string;
};

export type UsersMetrics = {
  total: number;
  truncated: boolean;
  signups: Delta;
  signupSeries: DayPoint[];
  signupPrevious: DayPoint[];
  active7: number;
  active30: number;
  verification: Slice[];
  methods: Slice[];
  plans: Slice[];
  users: UserRow[];
};

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

export async function loadUsersMetrics(range: AdminRange): Promise<UsersMetrics> {
  await requireAdmin();

  const [{ users, total, truncated }, identities, subscriptions] = await Promise.all([
    listAllUsers(),
    listOAuthUserIds(),
    listAllSubscriptions(),
  ]);

  const now = new Date();
  const period = periodOf(range, now);
  const created = users.map((user) => user.createdAt);
  const signupSeries = countByDay(created, period.days);
  const signupPrevious = countByDay(created, period.previousDays);

  const paying = new Map(
    subscriptions
      .filter((sub) => isPaying(sub, now))
      .map((sub) => [sub.userId, sub.plan] as const),
  );

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    accessedAt: user.accessedAt,
    verified: user.verified,
    method: identities.get(user.id) ?? "email",
    plan: paying.get(user.id) ?? "free",
  }));

  const verified = rows.filter((row) => row.verified).length;
  const google = rows.filter((row) => row.method !== "email").length;
  const planCounts = { free: 0, starter: 0, pro: 0 } as Record<string, number>;
  for (const row of rows) planCounts[row.plan] = (planCounts[row.plan] ?? 0) + 1;

  return {
    total,
    truncated,
    signups: deltaOf(sum(signupSeries), sum(signupPrevious)),
    signupSeries,
    signupPrevious,
    active7: rows.filter((row) => withinDays(row.accessedAt, 7, now)).length,
    active30: rows.filter((row) => withinDays(row.accessedAt, 30, now)).length,
    verification: [
      { key: "verified", label: "Confirmed", value: verified, color: SPLIT_COLORS[0] },
      { key: "unverified", label: "Not confirmed", value: rows.length - verified, color: GREY },
    ],
    methods: [
      { key: "email", label: "Email", value: rows.length - google, color: SPLIT_COLORS[0] },
      { key: "google", label: "Google", value: google, color: SPLIT_COLORS[1] },
    ],
    plans: ["free", "starter", "pro"].map((plan) => ({
      key: plan,
      label: PLAN_LABEL[plan],
      value: planCounts[plan] ?? 0,
      color: PLAN_COLOR[plan],
    })),
    users: rows,
  };
}
