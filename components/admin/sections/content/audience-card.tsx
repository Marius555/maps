import { LazyBarListChart } from "@/components/analytics/charts/lazy";
import { BAR_ROW_PX } from "@/components/analytics/charts/chart-colors";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { KPI_COLOR } from "@/lib/admin/colors";
import type { ContentMetrics } from "@/lib/admin/metrics/content";
import { countedUnless } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { SplitBar, hasSlices } from "../../kpi/split-bar";
import { SourceBadge } from "../../kpi/source-badge";

/**
 * Where published-map visitors come from — country, host site, device — as
 * columns of one card, since all three read the same sample and say so once.
 * Not drawn when the period had no sessions.
 */
export function AudienceCard({ metrics }: { metrics: ContentMetrics }) {
  if (metrics.sampleSize === 0) return null;

  const parts = [
    metrics.countries.length > 0 ? (
      <Ranked key="countries" title="Top countries" rows={metrics.countries} color={KPI_COLOR.signups} />
    ) : null,
    metrics.hosts.length > 0 ? (
      <Ranked key="hosts" title="Top host sites" rows={metrics.hosts} color={KPI_COLOR.sessions} />
    ) : null,
    hasSlices(metrics.devices) ? <SplitBar key="devices" title="Devices" slices={metrics.devices} /> : null,
  ].filter(Boolean);

  const sessions = formatCount(metrics.sampleSize);

  return (
    <SectionCard
      title="Audience"
      action={
        <SourceBadge
          source={countedUnless(
            metrics.sampleTruncated,
            `Tallied from ${sessions} map sessions in the period.`,
            "That is a capped sample, not every session, so shares are approximate.",
          )}
        />
      }
    >
      <div className={`grid gap-6 ${parts.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>{parts}</div>
    </SectionCard>
  );
}

function Ranked({
  title,
  rows,
  color,
}: {
  title: string;
  rows: ContentMetrics["countries"];
  color: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="an-chart" style={{ height: rows.length * BAR_ROW_PX + 16 }} aria-hidden="true">
        <LazyBarListChart rows={rows} name="sessions" color={color} />
      </div>
      <ol className="sr-only">
        {rows.map((row) => (
          <li key={row.key}>
            {row.label}: {row.value}
          </li>
        ))}
      </ol>
    </div>
  );
}
