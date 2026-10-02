import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminEmpty } from "@/components/admin/kpi/admin-empty";
import { SourceBadge } from "@/components/admin/kpi/source-badge";
import { StatStrip } from "@/components/admin/kpi/stat-strip";
import { AccountMapsTable } from "@/components/admin/sections/users/account-maps-table";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { formatDate } from "@/lib/admin/format";
import { loadAccountLimits, type Usage } from "@/lib/admin/metrics/account";
import { api, counted } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";

export const metadata: Metadata = { title: "Account" };

const PLAN_LABEL: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

const FEATURE_LABEL = {
  routes: "Routes",
  sheetSync: "Sheet sync",
  analytics: "Analytics",
  noBadge: "No badge",
  support: "Email support",
} as const;

function of(usage: Usage): string {
  return `${formatCount(usage.used)} / ${formatCount(usage.limit)}`;
}

function overNote(usage: Usage, fine: string): string {
  return usage.over ? `Over by ${formatCount(usage.used - usage.limit)}` : fine;
}

/**
 * One account against every limit its plan sets.
 *
 * Linked from each row of the Users table. The limits themselves are
 * `lib/limits/plans.ts`; this page only reads them, so a changed number shows up
 * here on the next load.
 */
export default async function AdminAccountPage(props: PageProps<"/admin/users/[id]">) {
  await requireAdminPage();

  const { id } = await props.params;
  const account = await loadAccountLimits(id);

  if (!account) notFound();

  const { user, plan, subscription } = account;
  const kept =
    subscription?.keptPlan && subscription.keptUntil
      ? ` · keeps ${PLAN_LABEL[subscription.keptPlan] ?? subscription.keptPlan} until ${formatDate(subscription.keptUntil)}`
      : "";
  const features = (Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[])
    .filter((feature) => account.features[feature])
    .map((feature) => FEATURE_LABEL[feature]);

  return (
    <>
      <div className="min-w-0 space-y-1">
        <Link href="/admin/users" className="text-sm text-muted hover:text-foreground">
          ← Users
        </Link>
        <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
          {user.name || user.email}
        </h1>
        <p className="truncate text-sm text-muted">
          {user.email} · joined {formatDate(user.createdAt)}
          {user.verified ? "" : " · address unconfirmed"}
          {user.enabled ? "" : " · blocked"}
        </p>
      </div>

      <StatStrip
        label="Plan and limits"
        stats={[
          {
            label: "Plan in force",
            value: PLAN_LABEL[plan] ?? plan,
            source: counted(
              "What every limit check reads: getUserPlan, from the subscription row, its status and its period end.",
            ),
            note: subscription
              ? `Row: ${subscription.plan || "—"}, ${subscription.status || "—"}${
                  subscription.currentPeriodEnd ? ` to ${formatDate(subscription.currentPeriodEnd)}` : ""
                }${kept}`
              : "No subscription row — free",
          },
          {
            label: "Maps",
            value: of(account.maps),
            source: counted("Rows in the maps table owned by this account."),
            note: overNote(account.maps, "Within the plan"),
          },
          {
            label: "Lookups this month",
            value: of(account.lookups),
            source: counted("This account's row in the usage table for the current UTC month."),
            note: overNote(account.lookups, "Resets on the 1st, UTC"),
          },
          {
            label: "Limits exceeded",
            value: formatCount(account.overCount),
            source: counted("Maps, lookups, and each map's locations and shapes, against the plan."),
            note:
              account.overCount > 0
                ? "Over-limit maps stay live but will not republish"
                : features.length > 0
                  ? `Includes ${features.join(", ")}`
                  : "Free features only",
          },
        ]}
      />

      <SectionCard
        title="Maps"
        hint="Oldest first is the order a plan's map count is applied in."
        action={
          <SourceBadge
            source={api("Counted from Appwrite per map: locations, shapes, groups and this month's visitor sessions.")}
          />
        }
      >
        {account.mapRows.length > 0 ? (
          <AccountMapsTable maps={account.mapRows} />
        ) : (
          <AdminEmpty>This account has no maps.</AdminEmpty>
        )}
      </SectionCard>
    </>
  );
}
