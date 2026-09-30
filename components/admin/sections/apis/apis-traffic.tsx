import { KPI_COLOR, OUTCOME_COLOR, PROVIDER_COLOR } from "@/lib/admin/colors";
import { formatPercent } from "@/lib/admin/format";
import { PROVIDERS, type ApisMetrics } from "@/lib/admin/metrics/apis";
import { counted } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { MetricTabsCard } from "../../kpi/metric-tabs-card";

/**
 * Requests, failures and billed lookups for the period, each a tab over its
 * own daily chart. Requests are stacked by provider, with each provider's total
 * in the legend.
 */
export function ApisTraffic({ metrics }: { metrics: ApisMetrics }) {
  const totals = new Map(metrics.byProvider.map((slice) => [slice.key, slice.value]));
  const requests = metrics.calls.value;
  const since = metrics.trackingSince ? ` Counted since ${metrics.trackingSince}.` : "";

  return (
    <MetricTabsCard
      label="Upstream figures for the period"
      tabs={[
        {
          id: "requests",
          label: "Requests",
          value: formatCount(requests),
          delta: metrics.calls,
          color: KPI_COLOR.apiCalls,
          source: counted(
            `Our counter around every call to a geocoder or router, retries included — each is a credit. Flushed every 15s, so a restart can lose one window.${since}`,
          ),
          chart: {
            kind: "stacked",
            data: metrics.byDay,
            series: PROVIDERS.map((provider) => ({
              key: provider.key,
              label: provider.label,
              color: PROVIDER_COLOR[provider.key],
              total: totals.get(provider.key) ?? 0,
            })),
          },
        },
        {
          id: "failed",
          label: "Failed",
          value:
            requests > 0
              ? `${formatCount(metrics.failed)} · ${formatPercent(metrics.failed / requests)}`
              : formatCount(metrics.failed),
          color: OUTCOME_COLOR.failed,
          source: counted(
            `Requests our counter recorded as a timeout, a refusal or a 5xx. The Endpoints table says which.${since}`,
          ),
          chart: {
            kind: "line",
            data: metrics.failedSeries,
            previous: metrics.failedPrevious,
            name: "failed",
          },
        },
        {
          id: "lookups",
          label: "Lookups billed",
          value: formatCount(metrics.lookups.value),
          delta: metrics.lookups,
          color: KPI_COLOR.lookups,
          source: counted(
            "Our pooled lookup meter: what was spent against plan allowances, across every account.",
          ),
          chart: {
            kind: "line",
            data: metrics.pool.series,
            previous: metrics.pool.previous,
            name: "lookups",
          },
        },
      ]}
    />
  );
}
