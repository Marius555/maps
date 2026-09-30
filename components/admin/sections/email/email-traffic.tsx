import { KPI_COLOR, OUTCOME_COLOR, TEMPLATE_COLOR } from "@/lib/admin/colors";
import { formatPercent } from "@/lib/admin/format";
import { TEMPLATES, type EmailMetrics } from "@/lib/admin/metrics/email";
import { api, counted } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { MetricTabsCard } from "../../kpi/metric-tabs-card";

/**
 * Sends for the period: attempts stacked by template (each template's total in
 * the legend), then what Resend took and what it did not.
 */
export function EmailTraffic({ metrics }: { metrics: EmailMetrics }) {
  const attempts = metrics.sends.value;
  const delivered = attempts - metrics.failed;
  const totals = new Map(metrics.byTemplate.map((slice) => [slice.key, slice.value]));
  const share = (count: number) =>
    attempts > 0 ? `${formatCount(count)} · ${formatPercent(count / attempts)}` : formatCount(count);

  return (
    <MetricTabsCard
      label="Email figures for the period"
      tabs={[
        {
          id: "attempts",
          label: "Attempts",
          value: formatCount(attempts),
          delta: metrics.sends,
          color: KPI_COLOR.emails,
          source: counted("Every send in our email log, by template. Counted since the log began."),
          chart: {
            kind: "stacked",
            data: metrics.byDay,
            series: TEMPLATES.map((template) => ({
              key: template.key,
              label: template.label,
              color: TEMPLATE_COLOR[template.key],
              total: totals.get(template.key) ?? 0,
            })),
          },
        },
        {
          id: "delivered",
          label: "Delivered to Resend",
          value: share(delivered),
          color: OUTCOME_COLOR.ok,
          source: api(
            "Resend's own reply to each send, as logged. What happens after it accepts one is in Resend's log.",
          ),
          chart: {
            kind: "line",
            data: metrics.deliveredSeries,
            previous: metrics.deliveredPrevious,
            name: "delivered",
          },
        },
        {
          id: "failed",
          label: "Failed",
          value: share(metrics.failed),
          color: OUTCOME_COLOR.failed,
          source: api(
            "Resend's refusal, an unreachable Resend, or no API key. Hover a failure in the table for the reason.",
          ),
          chart: {
            kind: "line",
            data: metrics.failedSeries,
            previous: metrics.failedPrevious,
            name: "failed",
          },
        },
      ]}
    />
  );
}
