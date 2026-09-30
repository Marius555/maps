import type { Metadata } from "next";

import { SourceBadge } from "@/components/admin/kpi/source-badge";
import { StatStrip } from "@/components/admin/kpi/stat-strip";
import { BillingBreakdown } from "@/components/admin/sections/billing/billing-breakdown";
import { SubscriptionsTable } from "@/components/admin/sections/billing/subscriptions-table";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { formatPercent } from "@/lib/admin/format";
import { loadBillingMetrics } from "@/lib/admin/metrics/billing";
import { formatEuros } from "@/lib/admin/metrics/revenue";
import { api, estimate } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";

export const metadata: Metadata = { title: "Billing" };

/**
 * Not about a period — who pays is a fact about today — so no range picker and
 * no toolbar. The annual run rate is the monthly figure times twelve, so it is
 * a note under that figure rather than a figure of its own.
 */
export default async function AdminBillingPage() {
  await requireAdminPage();

  const metrics = await loadBillingMetrics();
  const webhook = "Subscription state from Lemon Squeezy, as its webhook last reported it.";

  return (
    <>
      <StatStrip
        label="Revenue"
        stats={[
          {
            label: "Monthly revenue",
            value: formatEuros(metrics.mrr),
            source: estimate(
              "Worked out from list prices, in euros before tax: yearly plans spread over 12 months, coupons ignored.",
            ),
            note: `About ${formatEuros(metrics.arr)} a year`,
          },
          {
            label: "Paying accounts",
            value: formatCount(metrics.paying),
            source: api(webhook),
            note: `${formatPercent(metrics.conversion)} of ${formatCount(metrics.accounts)} accounts`,
          },
          {
            label: "Renewing in 30 days",
            value: formatCount(metrics.renewingSoon),
            source: api(`${webhook} Paid periods ending within a month.`),
            note: "Paid periods ending within a month",
          },
        ]}
      />

      <BillingBreakdown metrics={metrics} />

      {metrics.subscriptions.length > 0 ? (
        <SectionCard
          title="Subscriptions"
          action={<SourceBadge source={api(`${webhook} Sorted by what each is worth a month.`)} />}
        >
          <SubscriptionsTable rows={metrics.subscriptions} />
        </SectionCard>
      ) : null}
    </>
  );
}
