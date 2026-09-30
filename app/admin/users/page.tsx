import type { Metadata } from "next";

import { MetricTabsCard } from "@/components/admin/kpi/metric-tabs-card";
import { SourceBadge } from "@/components/admin/kpi/source-badge";
import { SplitBar, hasSlices } from "@/components/admin/kpi/split-bar";
import { StatStrip } from "@/components/admin/kpi/stat-strip";
import { UsersTable } from "@/components/admin/sections/users/users-table";
import { AdminToolbar } from "@/components/admin/shell/admin-toolbar";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { KPI_COLOR } from "@/lib/admin/colors";
import { formatPercent } from "@/lib/admin/format";
import { loadUsersMetrics } from "@/lib/admin/metrics/users";
import { api, counted, countedUnless } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { parseAdminRange } from "@/lib/validation/admin.schema";

export const metadata: Metadata = { title: "Users" };

const CAPPED = "Only the newest 5,000 accounts were read, so this undercounts.";

/**
 * Four blocks: the accounts, how many arrived day by day, how they split, and
 * the list. The chart, the breakdown and the list each drop out when empty.
 */
export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  await requireAdminPage();

  const range = parseAdminRange((await props.searchParams).range);
  const metrics = await loadUsersMetrics(range);
  const share = (count: number) =>
    metrics.total > 0 ? `${formatPercent(count / metrics.total)} of all accounts` : undefined;
  const active = countedUnless(
    metrics.truncated,
    "Accounts whose last sign-in, by Appwrite's last-access time, falls in the window.",
    CAPPED,
  );
  const splits = [metrics.plans, metrics.verification, metrics.methods];

  return (
    <>
      <AdminToolbar range={range} />

      <StatStrip
        label="Accounts"
        stats={[
          {
            label: "All accounts",
            value: formatCount(metrics.total),
            source: api("Appwrite's total of user accounts."),
            note: metrics.truncated ? "Breakdowns read the newest 5,000." : "Every account on the install",
          },
          {
            label: "New in the period",
            value: formatCount(metrics.signups.value),
            delta: metrics.signups,
            source: countedUnless(
              metrics.truncated,
              "Accounts from Appwrite whose creation date falls in the period.",
              CAPPED,
            ),
            note: `Against the ${String(range)} days before`,
          },
          { label: "Active, 7 days", value: formatCount(metrics.active7), source: active, note: share(metrics.active7) },
          { label: "Active, 30 days", value: formatCount(metrics.active30), source: active, note: share(metrics.active30) },
        ]}
      />

      <MetricTabsCard
        label="Signups for the period"
        tabs={[
          {
            id: "signups",
            label: "Signups",
            value: formatCount(metrics.signups.value),
            delta: metrics.signups,
            color: KPI_COLOR.signups,
            source: counted("Accounts from Appwrite, bucketed by the UTC day they were created."),
            chart: {
              kind: "line",
              data: metrics.signupSeries,
              previous: metrics.signupPrevious,
              name: "signups",
            },
          },
        ]}
      />

      {splits.some(hasSlices) ? (
        <SectionCard
          title="Breakdown"
          action={
            <SourceBadge
              source={countedUnless(
                metrics.truncated,
                "Tallied from Appwrite user records and the subscriptions table. Unconfirmed accounts are read-only.",
                CAPPED,
              )}
            />
          }
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <SplitBar title="Plan" slices={metrics.plans} />
            <SplitBar title="Email confirmed" slices={metrics.verification} />
            <SplitBar title="Sign-in method" slices={metrics.methods} />
          </div>
        </SectionCard>
      ) : null}

      {metrics.users.length > 0 ? (
        <SectionCard
          title="Accounts"
          action={<SourceBadge source={api("Appwrite user records. Sort by any column; dates are UTC.")} />}
        >
          <UsersTable users={metrics.users} />
        </SectionCard>
      ) : null}
    </>
  );
}
