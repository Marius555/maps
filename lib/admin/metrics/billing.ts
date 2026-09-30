import "server-only";

import { requireAdmin } from "@/lib/admin/auth/guard";
import { CADENCE_COLOR, PLAN_COLOR, SPLIT_COLORS } from "@/lib/admin/colors";
import { listAllSubscriptions } from "@/lib/repositories/admin/subscriptions";
import { listAllUsers } from "@/lib/repositories/admin/users";
import { tallyBy } from "./period";
import { estimateMrr, isPaying, monthlyValue } from "./revenue";
import type { Slice } from "./users";

export type SubscriptionTableRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  cadence: string;
  currentPeriodEnd: string | null;
  monthly: number;
  paying: boolean;
};

export type BillingMetrics = {
  paying: number;
  accounts: number;
  mrr: number;
  arr: number;
  conversion: number;
  planMix: Slice[];
  cadence: Slice[];
  statuses: Slice[];
  mrrByPlan: { key: string; label: string; value: number; color: string }[];
  subscriptions: SubscriptionTableRow[];
  renewingSoon: number;
};

const LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  monthly: "Monthly",
  yearly: "Yearly",
  active: "Active",
  past_due: "Past due",
  canceled: "Cancelled",
  paused: "Paused",
  trialing: "Trialing",
};

export async function loadBillingMetrics(): Promise<BillingMetrics> {
  await requireAdmin();

  const [subscriptions, { users, total }] = await Promise.all([
    listAllSubscriptions(),
    listAllUsers(),
  ]);

  const now = new Date();
  const people = new Map(users.map((user) => [user.id, user]));
  const paid = subscriptions.filter((sub) => isPaying(sub, now));
  const mrr = estimateMrr(subscriptions, now);

  const byPlan = (plan: string) => paid.filter((sub) => sub.plan === plan);
  const soon = now.getTime() + 30 * 86_400_000;

  return {
    paying: paid.length,
    accounts: total,
    mrr,
    arr: mrr * 12,
    conversion: total === 0 ? 0 : paid.length / total,
    planMix: ["free", "starter", "pro"].map((plan) => ({
      key: plan,
      label: LABEL[plan],
      value: plan === "free" ? Math.max(0, total - paid.length) : byPlan(plan).length,
      color: PLAN_COLOR[plan],
    })),
    cadence: ["monthly", "yearly"].map((cadence) => ({
      key: cadence,
      label: LABEL[cadence],
      value: paid.filter((sub) => (sub.cadence ?? "monthly") === cadence).length,
      color: CADENCE_COLOR[cadence],
    })),
    statuses: tallyBy(subscriptions, (sub) => sub.status).map((entry, position) => ({
      key: entry.key,
      label: LABEL[entry.key] ?? entry.key,
      value: entry.count,
      color: SPLIT_COLORS[Math.min(position, SPLIT_COLORS.length - 1)],
    })),
    mrrByPlan: ["starter", "pro"].map((plan) => ({
      key: plan,
      label: LABEL[plan],
      value: Math.round(byPlan(plan).reduce((n, sub) => n + monthlyValue(sub), 0)),
      color: PLAN_COLOR[plan],
    })),
    subscriptions: subscriptions.map((sub) => {
      const person = people.get(sub.userId);

      return {
        id: sub.userId,
        name: person?.name ?? "",
        email: person?.email ?? "Deleted account",
        plan: LABEL[sub.plan] ?? sub.plan,
        status: LABEL[sub.status] ?? sub.status,
        cadence: sub.cadence ? (LABEL[sub.cadence] ?? sub.cadence) : "—",
        currentPeriodEnd: sub.currentPeriodEnd,
        monthly: isPaying(sub, now) ? monthlyValue(sub) : 0,
        paying: isPaying(sub, now),
      };
    }),
    renewingSoon: paid.filter((sub) => {
      const end = sub.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : NaN;
      return Number.isFinite(end) && end <= soon;
    }).length,
  };
}
