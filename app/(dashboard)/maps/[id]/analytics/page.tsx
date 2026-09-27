import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  MeasurementOffEmpty,
  NoVisitsYetEmpty,
  NotPublishedEmpty,
  PlanRequiredEmpty,
} from "@/components/analytics/analytics-empty";
import { DetailsTabs } from "@/components/analytics/dashboard/details-tabs";
import { KpiStrip } from "@/components/analytics/dashboard/kpi-strip";
import { PairRow } from "@/components/analytics/dashboard/pair-row";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { HeatMap } from "@/components/analytics/heat-map/heat-map";
import { BreakdownGrid } from "@/components/analytics/panels/breakdown-grid";
import { detailTabs } from "@/components/analytics/panels/detail-tabs";
import {
  EngagementCard,
  engagementSeries,
} from "@/components/analytics/panels/engagement-card";
import { hasOutcomes, OutcomesCard } from "@/components/analytics/panels/outcomes-card";
import { RatesCard, ratesOf } from "@/components/analytics/panels/rates-card";
import { TrafficCard } from "@/components/analytics/panels/traffic-card";
import { RangePicker } from "@/components/analytics/range-picker";
import {
  RANGE_LABELS,
  readDetailTab,
  type DetailTab,
} from "@/components/analytics/sections";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { loadAnalytics, type AnalyticsData } from "@/lib/analytics/load";
import { readRange, type AnalyticsRange } from "@/lib/analytics/range";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError, planFeatureNote } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
import { getUserPlan, planAllows } from "@/lib/repositories/plan-limits";
import type { AppMap, Place } from "@/lib/repositories/types";
import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";

export const metadata: Metadata = { title: "Analytics" };

/**
 * What the people who use this map actually did.
 *
 * This page used to report on the customer's *own rows* — how many locations
 * wore each tag, which cards were missing a phone number. That was content
 * bookkeeping wearing the word Analytics, and it answered no question a customer
 * has. It is gone; the parts of it worth acting on were already filters on the
 * Locations page, which is where they belong.
 *
 * What replaced it needs a beacon on a stranger's website, which is the one
 * thing CLAUDE.md §2 forbids by default. The override, the cost arithmetic that
 * makes it survivable and the five things it had to answer are all in
 * `docs/notes/analytics.md`.
 *
 * Everything here comes from `mapDaily` rollups plus today's raw sessions, so a
 * ninety-day range is three reads rather than a quarter of a year of rows. The
 * folding is in `lib/analytics/**` and is pure; this file resolves, loads and
 * arranges, and holds no arithmetic of its own.
 *
 * **The layout is a dashboard, and only the tables are tabbed**: four
 * headline cards, the traffic chart beside the rates, the heat map, what
 * visitors did by day beside what it led to, a packed row of breakdowns, and
 * then the tables in one tabbed card. Every card is drawn only when it has
 * something in it, and its neighbour takes the room — `PairRow` and
 * `BreakdownGrid` hold that rule, `detail-tabs.tsx` holds it for the tables.
 */
export default async function MapAnalyticsPage(
  props: PageProps<"/maps/[id]/analytics">,
) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const range = readRange(search.range);
  const tab = readDetailTab(search.tab);

  const user = await requireUser();

  /*
   * The plan first, before anything is read.
   *
   * Not only so the tab can refuse: `load` below is the most expensive read in
   * the dashboard — every location on the map, plus a quarter of rollups — and
   * doing it to draw a locked panel would be paying the whole cost of the feature
   * to say it is not included.
   */
  const plan = await getUserPlan(user.id);
  const measured = planAllows(plan, "analytics");

  /*
   * The `try` wraps only the fetch, and the JSX is returned after it.
   * React renders children after this function returns, so a `catch` around JSX
   * never fires — the rule the lint config enforces and that
   * `maps/[id]/places/(list)/page.tsx` documents at length.
   */
  let data: LoadedAnalytics;

  try {
    data = await load(user.id, id, range, measured);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { map, analytics, isMeasuring } = data;

  return (
    // Wider than the other tabs' `centered`: a two- and three-column dashboard
    // needs the room, and capped so a 2,560px screen does not stretch a chart
    // into a flat line. `loading.tsx` uses the same width.
    <Container className="mx-auto max-w-7xl">
      <PageTitle>Analytics</PageTitle>

      {/* Only once something is being measured. Hidden rather than disabled
          on a locked, unpublished or switched-off map: a period picker over
          nothing is a control that does nothing, which reads as broken. It
          stays for "no visits yet", where the period is part of the answer. */}
      {analytics && map.publishedAt && isMeasuring ? (
        <div className="pb-5">
          <RangePicker mapId={map.id} range={range} />
        </div>
      ) : null}

      {!analytics ? (
        <PlanRequiredEmpty note={planFeatureNote("analytics", plan)} />
      ) : !map.publishedAt ? (
        <NotPublishedEmpty mapId={map.id} />
      ) : !isMeasuring ? (
        <MeasurementOffEmpty mapId={map.id} />
      ) : !analytics.view.hasData ? (
        <NoVisitsYetEmpty range={RANGE_LABELS[range]} />
      ) : (
        <Report map={map} data={analytics} range={range} tab={tab} />
      )}
    </Container>
  );
}

function Report({
  map,
  data,
  range,
  tab,
}: {
  map: AppMap;
  data: AnalyticsData;
  range: AnalyticsRange;
  tab: DetailTab | null;
}) {
  const { view } = data;
  const rangeLabel = RANGE_LABELS[range];
  const hasEngagement = engagementSeries(view).length > 0;

  return (
    <div className="space-y-4 pb-16">
      {data.truncated ? (
        <p className="rounded-lg bg-surface-secondary px-3 py-2 text-xs text-muted">
          This map has more traffic than one page of figures covers. What follows
          is its most recent activity in the period, not all of it.
        </p>
      ) : null}

      <KpiStrip view={view} range={range} />

      <PairRow
        main={
          <TrafficCard
            daily={view.daily}
            totals={{
              sessions: view.totals.sessions.value,
              visitors: view.totals.visitors.value,
              opens: view.totals.opens.value,
              searches: view.totals.searches.value,
            }}
            range={rangeLabel}
          />
        }
        side={ratesOf(view).length > 0 ? <RatesCard view={view} /> : null}
      />

      {/* Always drawn, whichever table is open below: the heat map is the
          page's one picture of *where*, and it has its own empty state. */}
      <SectionCard title="Where the attention is">
        <HeatMap
          origins={view.origins}
          interactions={view.interactionPoints}
          center={{ lng: map.defaultLng, lat: map.defaultLat }}
          zoom={map.defaultZoom}
          style={map.style}
          appearance={map.appearance}
        />
      </SectionCard>

      {hasEngagement ? (
        <PairRow
          main={<EngagementCard view={view} range={rangeLabel} />}
          side={hasOutcomes(view) ? <OutcomesCard view={view} /> : null}
        />
      ) : null}

      <BreakdownGrid view={view} />

      <DetailsTabs initial={tab} tabs={detailTabs(map.id, view)} />
    </div>
  );
}

type LoadedAnalytics = {
  map: AppMap;
  places: Place[];
  /** Null when the plan does not include this tab — see `load`'s `measured`. */
  analytics: AnalyticsData | null;
  /** The owner's switch, as stored — not as last published. */
  isMeasuring: boolean;
};

/**
 * Everything the page needs, in one place at the bottom of the file — the shape
 * `places/(list)/page.tsx` uses.
 *
 * The locations are loaded for two reasons and neither is a list of them: the
 * top-locations table needs their names, and the interaction heatmap needs their
 * coordinates. Only those three fields cross to the client.
 *
 * `measured` false skips both the locations and the rollups and returns the map
 * alone. The page still wants the map — it names it in the header and a locked
 * tab that cannot say *which* map it is locked for is worse than no header — but
 * nothing else here is worth reading to draw a panel that says "not on this
 * plan". It also matters for a reason beyond speed: a free map records no
 * sessions at all (`loadCollectGate`), so there is nothing for these reads to
 * find.
 */
async function load(
  userId: string,
  mapId: string,
  range: ReturnType<typeof readRange>,
  measured: boolean,
): Promise<LoadedAnalytics> {
  const ctx = repoContext(userId);

  if (!measured) {
    const map = await loadMap(userId, mapId);

    return {
      map,
      places: [],
      analytics: null,
      isMeasuring: readEmbedSettings(map.settings).analytics,
    };
  }

  /*
   * All three at once. `loadAnalytics` takes the locations as a promise and
   * only awaits them to build the view, so its own reads no longer wait out a
   * paged read of every location first. The promise is in this `Promise.all`
   * too, which is what keeps a failed read from becoming an unhandled rejection.
   */
  const placesRead = listAllPlaces(ctx, mapId);

  const [map, places, analytics] = await Promise.all([
    // Primitives, not the context: `loadMap` memoises on argument identity.
    loadMap(userId, mapId),
    placesRead,
    loadAnalytics(ctx, mapId, range, placesRead, new Date()),
  ]);

  return {
    map,
    places,
    analytics,
    isMeasuring: readEmbedSettings(map.settings).analytics,
  };
}
