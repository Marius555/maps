import { KPI_COLOR } from "@/lib/admin/colors";
import type { ContentMetrics } from "@/lib/admin/metrics/content";
import { api, counted } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { MetricTabsCard } from "../../kpi/metric-tabs-card";

/** Visits to published maps and maps created, each a tab over its daily chart. */
export function ContentTraffic({ metrics }: { metrics: ContentMetrics }) {
  return (
    <MetricTabsCard
      label="Map figures for the period"
      tabs={[
        {
          id: "sessions",
          label: "Map sessions",
          value: formatCount(metrics.sessions.value),
          delta: metrics.sessions,
          color: KPI_COLOR.sessions,
          source: api(
            "Appwrite's own count of mapSessions rows per day: visits to published maps with measurement switched on.",
          ),
          chart: {
            kind: "line",
            data: metrics.sessionSeries,
            previous: metrics.sessionPrevious,
            name: "sessions",
          },
        },
        {
          id: "maps",
          label: "New maps",
          value: formatCount(metrics.mapsCreated.value),
          delta: metrics.mapsCreated,
          color: KPI_COLOR.maps,
          source: counted("Maps in the database, bucketed by the UTC day they were created."),
          chart: { kind: "line", data: metrics.mapSeries, previous: metrics.mapPrevious, name: "maps" },
        },
      ]}
    />
  );
}
