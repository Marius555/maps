import type { Metadata } from "next";

import { SourceBadge } from "@/components/admin/kpi/source-badge";
import { StatStrip } from "@/components/admin/kpi/stat-strip";
import { AudienceCard } from "@/components/admin/sections/content/audience-card";
import { ContentTraffic } from "@/components/admin/sections/content/content-traffic";
import { MapsTable } from "@/components/admin/sections/content/maps-table";
import { AdminToolbar } from "@/components/admin/shell/admin-toolbar";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { formatPercent } from "@/lib/admin/format";
import { loadContentMetrics } from "@/lib/admin/metrics/content";
import { api } from "@/lib/admin/source";
import { formatCount } from "@/lib/format/number";
import { parseAdminRange } from "@/lib/validation/admin.schema";

export const metadata: Metadata = { title: "Maps & traffic" };

/**
 * What exists, how the period moved, who visited, and the newest maps. Each
 * block below the figures drops out when it has nothing to show.
 */
export default async function AdminContentPage(props: PageProps<"/admin/content">) {
  await requireAdminPage();

  const range = parseAdminRange((await props.searchParams).range);
  const metrics = await loadContentMetrics(range);
  const { totals } = metrics;

  return (
    <>
      <AdminToolbar range={range} />

      <StatStrip
        label="Content"
        stats={[
          {
            label: "Maps",
            value: formatCount(totals.maps),
            source: api("Appwrite's row totals for maps, and for maps with a publish date."),
            note:
              totals.maps > 0
                ? `${formatCount(totals.published)} published · ${formatPercent(totals.published / totals.maps)}`
                : "None yet",
          },
          {
            label: "Locations",
            value: formatCount(totals.places),
            source: api("Appwrite's row totals for locations and shapes."),
            note: `${formatCount(totals.shapes)} shapes and routes`,
          },
          {
            label: "Linked sheets",
            value: formatCount(totals.sheetLinks),
            source: api("Appwrite's row total for sheet links."),
            note: "Maps kept in step with a Google Sheet",
          },
        ]}
      />

      <ContentTraffic metrics={metrics} />

      <AudienceCard metrics={metrics} />

      {metrics.maps.length > 0 ? (
        <SectionCard
          title="Newest maps"
          action={<SourceBadge source={api("The 60 most recent maps in Appwrite, with their location counts.")} />}
        >
          <MapsTable rows={metrics.maps} />
        </SectionCard>
      ) : null}
    </>
  );
}
