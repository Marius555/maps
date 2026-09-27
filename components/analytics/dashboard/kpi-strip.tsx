import { Eye, MapPin, Navigation, Users } from "lucide-react";

import { formatCount } from "@/lib/format/number";
import type { AnalyticsView, DailyRow } from "@/lib/analytics/view";
import type { AnalyticsRange } from "@/lib/analytics/range";
import { METRIC_COLOR } from "../charts/chart-colors";
import { plural } from "../format";
import { COMPARED_WITH, METRIC_COPY } from "../sections";
import { KpiCard } from "./kpi-card";

/**
 * The four headline figures, at the top of the page.
 *
 * Four rather than the six tiles this replaced: searches are counted beside
 * what they found, in the Searches table, and directions and calls are one card
 * — the outcome a store locator exists for, reached two ways — with the split
 * written under it.
 *
 * Visitors leads because it is the one figure about people rather than page
 * loads, and Visits beside it — each with a line saying what it counts — is
 * what makes the difference legible.
 */
export function KpiStrip({
  view,
  range,
}: {
  view: AnalyticsView;
  range: AnalyticsRange;
}) {
  const { totals, daily } = view;
  const compared = COMPARED_WITH[range];

  return (
    <section
      aria-label="Headline figures"
      className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4"
    >
      <KpiCard
        icon={Users}
        {...METRIC_COPY.visitors}
        color={METRIC_COLOR.visitors}
        delta={totals.visitors}
        series={series(daily, "visitors")}
        seriesName="visitors"
        footer={
          view.visitorsPartial ? "Only visits since visitor counting began" : compared
        }
      />
      <KpiCard
        icon={Eye}
        {...METRIC_COPY.sessions}
        color={METRIC_COLOR.sessions}
        delta={totals.sessions}
        series={series(daily, "sessions")}
        seriesName="visits"
        footer={compared}
      />
      <KpiCard
        icon={MapPin}
        {...METRIC_COPY.opens}
        color={METRIC_COLOR.opens}
        delta={totals.opens}
        series={series(daily, "opens")}
        seriesName="locations opened"
        footer={compared}
      />
      <KpiCard
        icon={Navigation}
        {...METRIC_COPY.actions}
        color={METRIC_COLOR.directions}
        delta={totals.actions}
        series={series(daily, "actions")}
        seriesName="directions and calls"
        footer={`${formatCount(totals.directions.value)} ${plural(
          totals.directions.value,
          ["direction", "directions"],
        )} · ${formatCount(totals.calls.value)} ${plural(totals.calls.value, [
          "call",
          "calls",
        ])} · ${compared}`}
      />
    </section>
  );
}

function series(daily: DailyRow[], key: "visitors" | "sessions" | "opens" | "actions") {
  return daily.map((row) => ({ day: row.day, value: row[key] }));
}
