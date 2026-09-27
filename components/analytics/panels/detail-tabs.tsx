import type { ReactNode } from "react";

import { formatCount } from "@/lib/format/number";
import type { AnalyticsView } from "@/lib/analytics/view";
import type { DetailEntry } from "../dashboard/details-tabs";
import { formatShare } from "../format";
import { DETAIL_HINTS, type DetailTab } from "../sections";
import { PagesTable } from "../tables/pages-table";
import { PicksTable } from "../tables/picks-table";
import { SearchesTable } from "../tables/searches-table";
import { TopLocationsTable } from "../tables/top-locations-table";
import { UnconvertedTable } from "../tables/unconverted-table";
import { VisitorsTable } from "../tables/visitors-table";

/**
 * The table tabs this view has, in order, each with its table.
 *
 * The rule the page follows, in one place: **a table with no rows is not a
 * tab.** The count on each tab is the table's row count, so a tab reading "0"
 * cannot exist.
 */
export function detailTabs(mapId: string, view: AnalyticsView): DetailEntry[] {
  const all: (DetailEntry | null)[] = [
    view.places.length > 0
      ? {
          id: "locations",
          count: view.places.length,
          panel: (
            <Panel tab="locations">
              <TopLocationsTable mapId={mapId} rows={view.places} />
            </Panel>
          ),
        }
      : null,
    view.unconverted.length > 0
      ? {
          id: "unconverted",
          count: view.unconverted.length,
          warn: true,
          panel: (
            <Panel tab="unconverted">
              <UnconvertedTable mapId={mapId} rows={view.unconverted} />
            </Panel>
          ),
        }
      : null,
    view.searches.length > 0
      ? {
          id: "searches",
          count: view.searches.length,
          panel: (
            <Panel tab="searches">
              <SearchStats view={view} />
              <SearchesTable rows={view.searches} />
            </Panel>
          ),
        }
      : null,
    view.picks.length > 0
      ? {
          id: "picks",
          count: view.picks.length,
          panel: (
            <Panel tab="picks">
              <PicksTable rows={view.picks} />
            </Panel>
          ),
        }
      : null,
    view.pages.length > 0
      ? {
          id: "pages",
          count: view.pages.length,
          panel: (
            <Panel tab="pages">
              <PagesTable rows={view.pages} />
            </Panel>
          ),
        }
      : null,
    view.recent.length > 0
      ? {
          id: "visitors",
          count: view.recent.length,
          panel: (
            <Panel tab="visitors">
              <VisitorsTable rows={view.recent} />
            </Panel>
          ),
        }
      : null,
  ];

  return all.filter((entry) => entry !== null);
}

/** A table with the one line saying what it answers. */
function Panel({ tab, children }: { tab: DetailTab; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted text-pretty">{DETAIL_HINTS[tab]}</p>
      {children}
    </div>
  );
}

/**
 * The three figures a search table cannot say by itself, in one line above it.
 *
 * **The zero leads.** "Sixty people searched Kaunas" is a statistic; "sixty
 * people searched Kaunas and found nothing" is the customer's next shop, so the
 * count of searches that found nothing is in warning ink when there are any.
 */
function SearchStats({ view }: { view: AnalyticsView }) {
  const searches = view.totals.searches.value;
  const conversion = view.searchConversion;

  return (
    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-secondary p-3 sm:grid-cols-3">
      <Stat label="Searches" value={formatCount(searches)} />
      <Stat
        label="Found nothing"
        value={formatCount(view.searchesUnmatched)}
        detail={
          searches > 0 ? `${formatShare(view.searchesUnmatched / searches)} of searches` : undefined
        }
        warn={view.searchesUnmatched > 0}
      />
      {conversion.share !== null ? (
        <Stat
          label="Led to a location"
          value={formatShare(conversion.share)}
          detail={`${formatCount(conversion.count)} of ${formatCount(conversion.of)} visits that searched`}
        />
      ) : null}
    </dl>
  );
}

function Stat({
  label,
  value,
  detail,
  warn = false,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`text-lg font-semibold tracking-tight tabular-nums ${
          warn ? "text-warning-ink" : "text-foreground"
        }`}
      >
        {value}
      </dd>
      {detail ? <dd className="truncate text-xs text-muted">{detail}</dd> : null}
    </div>
  );
}
