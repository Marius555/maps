import { KPI_COLOR } from "@/lib/admin/colors";
import type { OverviewMetrics } from "@/lib/admin/metrics/overview";
import { api, counted, type DataSource } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { MetricTabsCard, type MetricTab } from "../../kpi/metric-tabs-card";

/**
 * The period's moving figures, each a tab over its own daily chart against the
 * period before. Each one's page has the detail; this is where they are seen
 * side by side.
 */
export function OverviewGrowth({ metrics }: { metrics: OverviewMetrics }) {
  const tab = (
    id: string,
    label: string,
    kpi: OverviewMetrics["signups"],
    name: string,
    color: string,
    source: DataSource,
  ): MetricTab => ({
    id,
    label,
    value: formatCount(kpi.delta.value),
    delta: kpi.delta,
    color,
    source,
    chart: { kind: "line", data: kpi.series, previous: kpi.previous, name },
  });

  return (
    <MetricTabsCard
      label="Figures for the period"
      tabs={[
        tab(
          "signups",
          "Signups",
          metrics.signups,
          "signups",
          KPI_COLOR.signups,
          counted("Accounts from Appwrite, bucketed by the UTC day they were created."),
        ),
        tab(
          "maps",
          "New maps",
          metrics.maps,
          "maps",
          KPI_COLOR.maps,
          counted("Maps in the database, bucketed by the UTC day they were created."),
        ),
        tab(
          "sessions",
          "Map sessions",
          metrics.sessions,
          "sessions",
          KPI_COLOR.sessions,
          api("Appwrite's own count of mapSessions rows per day: visits to published maps with measurement switched on."),
        ),
        tab(
          "calls",
          "API calls",
          metrics.apiCalls,
          "calls",
          KPI_COLOR.apiCalls,
          counted("Our counter around every geocoding and routing request, retries included. Flushed every 15s, so a restart can lose one window."),
        ),
        tab(
          "emails",
          "Emails",
          metrics.emails,
          "emails",
          KPI_COLOR.emails,
          counted("Send attempts in our email log, by UTC day."),
        ),
      ]}
    />
  );
}
