import { SectionCard } from "@/components/analytics/dashboard/section-card";
import type { BillingMetrics } from "@/lib/admin/metrics/billing";
import { formatEuros } from "@/lib/admin/metrics/revenue";
import { api } from "@/lib/admin/source";
import { SplitBar, hasSlices } from "../../kpi/split-bar";
import { SourceBadge } from "../../kpi/source-badge";

/**
 * Who pays for what, how often, and in what state — three splits in one card,
 * each left out when it has nothing in it, and the card with them. A paid
 * plan's row carries what it earns a month.
 */
export function BillingBreakdown({ metrics }: { metrics: BillingMetrics }) {
  if (![metrics.planMix, metrics.cadence, metrics.statuses].some(hasSlices)) return null;

  const revenue = new Map(metrics.mrrByPlan.map((row) => [row.key, row.value]));

  return (
    <SectionCard
      title="Breakdown"
      action={
        <SourceBadge
          source={api(
            "Plans, cadences and statuses as Lemon Squeezy last reported them to the webhook. Plans are across every account; cadence across paying ones.",
          )}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <SplitBar
          title="Plan"
          slices={metrics.planMix}
          detail={(slice) => {
            const value = revenue.get(slice.key);
            return value ? `${formatEuros(value)}/mo` : null;
          }}
        />
        <SplitBar title="Billing cadence" slices={metrics.cadence} />
        <SplitBar title="Subscription status" slices={metrics.statuses} />
      </div>
    </SectionCard>
  );
}
