import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  MeasurementOffEmpty,
  NoVisitsYetEmpty,
  NotPublishedEmpty,
} from "@/components/analytics/analytics-empty";
import { DailyChart } from "@/components/analytics/daily-chart";
import { HeatMap } from "@/components/analytics/heat-map/heat-map";
import { RangePicker } from "@/components/analytics/range-picker";
import { RateTile } from "@/components/analytics/rate-tile";
import { RANGE_LABELS } from "@/components/analytics/sections";
import { StatTile } from "@/components/analytics/stat-tile";
import {
  CountriesTable,
  DevicesTable,
  PagesTable,
  ReferrersTable,
} from "@/components/analytics/tables/audience-tables";
import { InteractionsTable } from "@/components/analytics/tables/interactions-table";
import { PicksTable } from "@/components/analytics/tables/picks-table";
import { SearchesTable } from "@/components/analytics/tables/searches-table";
import { TopLocationsTable } from "@/components/analytics/tables/top-locations-table";
import { UnconvertedTable } from "@/components/analytics/tables/unconverted-table";
import { VisitorsTable } from "@/components/analytics/tables/visitors-table";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { loadAnalytics, type AnalyticsData } from "@/lib/analytics/load";
import { readRange } from "@/lib/analytics/range";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { listAllPlaces } from "@/lib/repositories/places.repository";
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
 */
export default async function MapAnalyticsPage(
  props: PageProps<"/maps/[id]/analytics">,
) {
  const { id } = await props.params;
  const search = await props.searchParams;
  const range = readRange(search.range);

  const user = await requireUser();

  /*
   * The `try` wraps only the fetch, and the JSX is returned after it.
   * React renders children after this function returns, so a `catch` around JSX
   * never fires — the rule the lint config enforces and that
   * `maps/[id]/settings/page.tsx` documents at length.
   */
  let data: LoadedAnalytics;

  try {
    data = await load(user.id, id, range);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const { map, analytics, isMeasuring } = data;

  return (
    <Container size="centered">
      <PageTitle>Analytics</PageTitle>

      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <p className="text-sm text-muted">
          What visitors did on {map.name}
        </p>
        <RangePicker mapId={map.id} range={range} />
      </div>

      {!map.publishedAt ? (
        <NotPublishedEmpty mapId={map.id} />
      ) : !isMeasuring ? (
        <MeasurementOffEmpty mapId={map.id} />
      ) : !analytics.view.hasData ? (
        <NoVisitsYetEmpty range={RANGE_LABELS[range]} />
      ) : (
        <Report map={map} data={analytics} range={RANGE_LABELS[range]} />
      )}
    </Container>
  );
}

function Report({
  map,
  data,
  range,
}: {
  map: AppMap;
  data: AnalyticsData;
  range: string;
}) {
  const { view } = data;

  return (
    <div className="space-y-10 pb-16">
      {data.truncated ? (
        <p className="rounded-lg bg-surface-secondary px-3 py-2 text-xs text-muted">
          This map has more traffic than one page of figures covers. What follows
          is its most recent activity in the period, not all of it.
        </p>
      ) : null}

      {/*
        Five headline numbers. Tiles rather than a table, which is the one place
        this page departs from the Locations list's argument — see stat-tile.tsx.
      */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Visits" delta={view.totals.sessions} />
        <StatTile label="Locations opened" delta={view.totals.opens} />
        <StatTile label="Searches" delta={view.totals.searches} />
        <StatTile label="Directions" delta={view.totals.directions} />
        <StatTile label="Calls" delta={view.totals.calls} />
      </section>

      {/*
        Two rates, kept apart from the five tiles above rather than made a sixth
        and seventh. Those are quantities; these are proportions, and a row that
        mixes "1,284" with "38%" invites reading the second as a count of
        something. They are also the two figures on this page about the map's own
        performance rather than about the locations on it.
      */}
      <Section
        title="How well it is working"
        hint="Whether the map is doing its job, rather than how much it was used"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
          <RateTile
            label="Loaded and left"
            rate={view.bounce}
            unit="visits"
            tone="warn"
            hint="Nothing clicked, searched or opened"
          />
          <RateTile
            label="Searches that led somewhere"
            rate={view.searchConversion}
            unit="visits that searched"
            hint="A location was opened after searching"
          />
        </div>
      </Section>

      <Section title="Visits over time" hint={range}>
        <DailyChart
          data={view.daily.map((day) => ({
            day: day.day,
            sessions: day.sessions,
          }))}
        />
      </Section>

      <Section title="Where the attention is">
        <HeatMap
          origins={view.origins}
          interactions={view.interactionPoints}
          center={{ lng: map.defaultLng, lat: map.defaultLat }}
          zoom={map.defaultZoom}
          style={map.style}
          appearance={map.appearance}
        />
      </Section>

      <Section
        title="Locations they opened"
        hint="Which of your locations people actually looked at"
      >
        <TopLocationsTable mapId={map.id} rows={view.places} />
      </Section>

      {view.unconverted.length > 0 ? (
        <Section
          title="Opened, then nothing"
          hint="People looked at these and didn't call, get directions, or visit the site — usually a missing phone number, hours that read as closed, or an address that looks wrong"
        >
          <UnconvertedTable mapId={map.id} rows={view.unconverted} />
        </Section>
      ) : null}

      {view.searches.length > 0 ? (
        <Section
          title="What they searched for"
          hint="A search that found nothing is a place your customers expect you to be"
        >
          <SearchesTable rows={view.searches} />
        </Section>
      ) : null}

      {view.picks.length > 0 ? (
        <Section
          title="Places they went to instead"
          hint="Picked from the search box because no location matched — where people want you to be"
        >
          <PicksTable rows={view.picks} />
        </Section>
      ) : null}

      <Section title="What they did">
        <InteractionsTable rows={view.interactions} />
      </Section>

      <Section title="Who they are">
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Countries">
            <CountriesTable rows={view.countries} />
          </Panel>
          <Panel title="Devices">
            <DevicesTable rows={view.devices} />
          </Panel>
          <Panel title="Came from">
            <ReferrersTable rows={view.referrers} direct={view.direct} />
          </Panel>
        </div>
      </Section>

      {view.pages.length > 0 ? (
        <Section
          title="Where your map is embedded"
          hint="The pages of your own site it is working on"
        >
          <PagesTable rows={view.pages} />
        </Section>
      ) : null}

      {view.recent.length > 0 ? (
        <Section
          title="Recent visitors"
          hint="Kept for a limited time, so this shows less far back than the figures above"
        >
          <VisitorsTable rows={view.recent} />
        </Section>
      ) : null}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

type LoadedAnalytics = {
  map: AppMap;
  places: Place[];
  analytics: AnalyticsData;
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
 */
async function load(
  userId: string,
  mapId: string,
  range: ReturnType<typeof readRange>,
): Promise<LoadedAnalytics> {
  const ctx = repoContext(userId);
  const [map, places] = await Promise.all([
    // Primitives, not the context: `loadMap` memoises on argument identity and
    // an object would miss the cache the layout already warmed.
    loadMap(userId, mapId),
    listAllPlaces(ctx, mapId),
  ]);

  const analytics = await loadAnalytics(ctx, mapId, range, places, new Date());

  return {
    map,
    places,
    analytics,
    isMeasuring: readEmbedSettings(map.settings).analytics,
  };
}
