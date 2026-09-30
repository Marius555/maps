import type { OverviewMetrics } from "@/lib/admin/metrics/overview";
import { formatEuros } from "@/lib/admin/metrics/revenue";
import { api, counted, estimate } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { BudgetMeter } from "../../charts/budget-meter";
import { StatStrip } from "../../kpi/stat-strip";

/** Where the install stands right now, whatever the period. */
export function OverviewNow({ metrics }: { metrics: OverviewMetrics }) {
  return (
    <StatStrip
      label="Right now"
      stats={[
        {
          label: "Accounts",
          value: formatCount(metrics.totalUsers),
          source: api("Appwrite's total of user accounts. Active means signed in, by Appwrite's last-access time."),
          note: `${formatCount(metrics.active7)} active in the last 7 days`,
        },
        {
          label: "Monthly revenue",
          value: formatEuros(metrics.mrr),
          source: estimate("Worked out from list prices: yearly plans spread over 12 months, tax and coupons ignored."),
          note: `${formatCount(metrics.paying)} paying · about ${formatEuros(metrics.mrr * 12)} a year`,
        },
        {
          label: "Maps",
          value: formatCount(metrics.mapCount),
          source: api("Appwrite's row totals for maps and locations."),
          note: `${formatCount(metrics.published)} published · ${formatCount(metrics.places)} locations`,
        },
        {
          label: "Lookups today",
          value: formatCount(metrics.poolToday),
          source: counted("Our pooled lookup meter for today (UTC), the circuit breaker in usage.repository.ts."),
          extra: (
            <BudgetMeter
              used={metrics.poolToday}
              budget={metrics.poolBudget}
              reserve={metrics.poolReserve}
              label="Daily budget"
            />
          ),
        },
      ]}
    />
  );
}
