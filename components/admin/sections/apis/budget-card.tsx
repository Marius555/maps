import { SectionCard } from "@/components/analytics/dashboard/section-card";
import type { ApisMetrics } from "@/lib/admin/metrics/apis";
import { counted } from "@/lib/admin/source";
import { BudgetGauge } from "../../charts/budget-gauge";
import { SourceBadge } from "../../kpi/source-badge";

/**
 * The pooled daily budget — the circuit breaker in `usage.repository.ts` — as
 * it stands today. Its history is the "Lookups billed" tab beside it.
 */
export function BudgetCard({ pool }: { pool: ApisMetrics["pool"] }) {
  return (
    <SectionCard
      title="Today's lookup budget"
      action={
        <SourceBadge
          source={counted(
            "Our pooled meter for today (UTC), shared by every account. The tick is where background work stands aside; the budget itself is configuration.",
          )}
        />
      }
    >
      <BudgetGauge used={pool.today} budget={pool.budget} reserve={pool.backgroundCeiling} />
    </SectionCard>
  );
}
