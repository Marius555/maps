import type { DeviceKind, MapSession } from "@/lib/repositories/types";
import type { DayFold, PlaceCounts } from "./fold";
import { mergeFolds } from "./fold";
import { countryCentroid } from "./collect/country-centroids";

/**
 * The Analytics page, as data.
 *
 * Everything here is derived from merged `DayFold`s — the sums live in ./fold.ts
 * and the ratios live here, because a ratio cannot be merged and has to be taken
 * from the whole. Nothing in this file reads Appwrite, a clock or an environment,
 * which is what lets the whole page be tested without provisioning anything (§9).
 *
 * **No copy.** Labels, section names and links belong in
 * `components/analytics/sections.ts`. That split is the one the deleted content
 * stats already followed and it survives the rewrite for the same reason: a
 * count that disagrees with the words next to it is the failure mode here, and
 * keeping the arithmetic away from the words is what makes each testable.
 */

export type Delta = {
  /** Now. */
  value: number;
  /** The same length of time immediately before. */
  previous: number;
  /**
   * Change as a fraction, or null when there is nothing to compare against.
   *
   * Null rather than Infinity or 100% for a previous period of zero: "up ∞%"
   * is not a fact about the map, it is a fact about it being new, and the page
   * says so in words instead.
   */
  change: number | null;
};

export type PlaceRow = PlaceCounts & {
  id: string;
  /** The location's own name, or a placeholder for one since deleted. */
  name: string;
  /** Null for a location the map no longer has — see `namePlace`. */
  exists: boolean;
};

export type SearchRow = {
  query: string;
  count: number;
  matches: number;
};

export type LabelledCount = {
  key: string;
  count: number;
};

export type PageRow = {
  host: string;
  path: string;
  count: number;
};

export type HeatPoint = {
  lng: number;
  lat: number;
  weight: number;
};

/**
 * A share of something, or nothing to report.
 *
 * `null` where the denominator is zero — no sessions, or no session that
 * searched. A rate over nothing is not 0%, and drawing it as one would put "0%
 * of searches led anywhere" on a map nobody has searched yet.
 */
export type Rate = {
  /** 0–1, or null when there is nothing to divide by. */
  share: number | null;
  /** The numerator and denominator, so the page can say what the share is of. */
  of: number;
  count: number;
};

export type AnalyticsView = {
  /** Whether anything at all was recorded in this range. */
  hasData: boolean;
  /**
   * The five headline figures.
   *
   * Chosen as five *different* questions, which is harder than it sounds: map
   * loads and visits are the same number on every map with one embed per page,
   * so counting both would spend a tile saying the same thing twice. These are
   * the funnel a store locator actually has — somebody arrived, looked at a
   * shop, searched for one, and then did the thing the map exists for.
   */
  totals: {
    sessions: Delta;
    opens: Delta;
    searches: Delta;
    directions: Delta;
    calls: Delta;
  };
  /** One entry per day in the range, including the empty ones. */
  daily: { day: string; sessions: number; views: number; interactions: number }[];
  places: PlaceRow[];
  /**
   * Locations that got opened and produced nothing — no directions, no call, no
   * email, no click through to the site.
   *
   * The most actionable table on the page, and the only one that names a
   * specific thing to go and fix. Interest is not the problem for these: people
   * found them and looked. Something on the card then failed to be worth acting
   * on, and that is usually a missing phone number, hours that say closed, or an
   * address that reads wrong.
   */
  unconverted: PlaceRow[];
  searches: SearchRow[];
  /** Towns picked from the gazetteer — demand where there is no location. */
  picks: LabelledCount[];
  /** Sessions where the map loaded and nothing else happened. */
  bounce: Rate;
  /** Sessions that searched and then opened something, over sessions that searched. */
  searchConversion: Rate;
  /** Event type → count, busiest first. The "which controls get pressed" table. */
  interactions: LabelledCount[];
  countries: LabelledCount[];
  devices: { kind: DeviceKind; count: number }[];
  /** Referring sites, with direct traffic counted under an empty key. */
  referrers: LabelledCount[];
  direct: number;
  pages: PageRow[];
  /** Where visitors were, for the origin heatmap. */
  origins: HeatPoint[];
  /** Where they opened a location, for the interaction heatmap. */
  interactionPoints: HeatPoint[];
  recent: MapSession[];
};

export type BuildViewInput = {
  /** This range's folds, **in day order** — see `mergeFolds`. */
  days: { day: string; fold: DayFold }[];
  /** The previous range's folds, for the deltas. Order does not matter here. */
  previousDays: DayFold[];
  /** Every day the range covers, so empty ones still draw a column. */
  allDays: string[];
  /** The map's locations, for naming rows and placing the interaction heat. */
  places: { id: string; name: string; lat: number; lng: number }[];
  /** The newest sessions, for the visitors table. */
  recent: MapSession[];
};

export function buildView(input: BuildViewInput): AnalyticsView {
  const total = mergeFolds(input.days.map((entry) => entry.fold));
  const previous = mergeFolds(input.previousDays);

  const byDay = new Map(input.days.map((entry) => [entry.day, entry.fold]));

  return {
    hasData: total.sessions > 0,
    totals: {
      sessions: delta(total.sessions, previous.sessions),
      opens: delta(total.events.open ?? 0, previous.events.open ?? 0),
      searches: delta(total.events.search ?? 0, previous.events.search ?? 0),
      directions: delta(
        total.events.directions ?? 0,
        previous.events.directions ?? 0,
      ),
      calls: delta(total.events.tel ?? 0, previous.events.tel ?? 0),
    },
    daily: input.allDays.map((day) => {
      const fold = byDay.get(day);

      return {
        day,
        sessions: fold?.sessions ?? 0,
        views: fold?.views ?? 0,
        interactions: fold?.interactions ?? 0,
      };
    }),
    places: placeRows(total, input.places),
    unconverted: unconvertedRows(placeRows(total, input.places)),
    searches: searchRows(total),
    picks: sortedCounts(total.picks),
    bounce: rate(total.bounced, total.sessions),
    searchConversion: rate(total.searchConverted, total.searchSessions),
    interactions: sortedCounts(total.events).filter(
      // Views are the denominator, not an interaction — they are already the
      // headline figure above, and leaving them in this table would put one bar
      // at 100% and squash everything the table exists to compare.
      (entry) => entry.key !== "view",
    ),
    countries: sortedCounts(total.countries),
    devices: deviceRows(total),
    referrers: sortedCounts(total.referrers),
    direct: Math.max(0, total.sessions - sum(total.referrers)),
    pages: pageRows(total),
    origins: originPoints(total),
    interactionPoints: interactionPoints(total, input.places),
    recent: input.recent,
  };
}

function delta(value: number, previous: number): Delta {
  return {
    value,
    previous,
    change: previous > 0 ? (value - previous) / previous : null,
  };
}

function sum(bag: Record<string, number>): number {
  return Object.values(bag).reduce((total, count) => total + count, 0);
}

function sortedCounts(bag: Record<string, number>): LabelledCount[] {
  return Object.entries(bag)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * One row per location a visitor touched, busiest first.
 *
 * Only locations that were touched: a three-hundred-row table of zeroes answers
 * nothing, and "which locations does nobody look at" is the *inverse* of this
 * table rather than a longer version of it — it belongs on the Locations page,
 * beside the locations themselves.
 *
 * A location the map no longer has still appears, named as missing. Dangling ids
 * are the normal state in this codebase, not an error, and dropping the row
 * would quietly reduce a total that the tiles above still count.
 */
function placeRows(
  fold: DayFold,
  places: BuildViewInput["places"],
): PlaceRow[] {
  const byId = new Map(places.map((place) => [place.id, place]));

  return Object.entries(fold.places)
    .map(([id, counts]) => ({
      id,
      name: byId.get(id)?.name ?? "Deleted location",
      exists: byId.has(id),
      ...counts,
    }))
    .sort((a, b) => b.open - a.open || b.directions - a.directions);
}

/**
 * Locations opened at least once that produced no action at all.
 *
 * Ranked by opens, because a shop opened ninety times with nothing to show for
 * it is a bigger problem than one opened twice — the second is a sample size,
 * not a signal.
 *
 * A deleted location is left out. Its row is still in the table above, named as
 * missing, but "go and fix the card" is not advice about a location the map no
 * longer has.
 */
function unconvertedRows(rows: PlaceRow[]): PlaceRow[] {
  return rows.filter(
    (row) =>
      row.exists &&
      row.open > 0 &&
      row.directions + row.tel + row.email + row.site === 0,
  );
}

function rate(count: number, of: number): Rate {
  return { count, of, share: of > 0 ? count / of : null };
}

function searchRows(fold: DayFold): SearchRow[] {
  return Object.entries(fold.searches)
    .map(([query, count]) => ({ query, ...count }))
    .sort((a, b) => b.count - a.count || a.query.localeCompare(b.query));
}

function deviceRows(fold: DayFold): AnalyticsView["devices"] {
  const order: DeviceKind[] = ["desktop", "mobile", "tablet"];

  return order
    .map((kind) => ({ kind, count: fold.devices[kind] ?? 0 }))
    .filter((row) => row.count > 0);
}

function pageRows(fold: DayFold): PageRow[] {
  return Object.entries(fold.pages)
    .map(([key, count]) => {
      const [host, path = ""] = key.split("\t");
      return { host, path, count };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Where visitors were, as heat.
 *
 * Two sources, and the fallback is the point. A host that sets geo headers gives
 * real coordinates and this draws cities; a host that sets only a country — or
 * none, with the country recovered from nothing at all — draws one blob per
 * country from a static table. Neither costs a request (./collect/geo-headers.ts).
 *
 * Country blobs are only added for sessions that produced **no** coordinate, so
 * a map whose host reports both is not counted twice.
 */
function originPoints(fold: DayFold): HeatPoint[] {
  const points: HeatPoint[] = [];

  for (const [key, weight] of Object.entries(fold.origins)) {
    const [lng, lat] = key.split(",").map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      points.push({ lng, lat, weight });
    }
  }

  const located = points.reduce((total, point) => total + point.weight, 0);
  const unlocated = Math.max(0, fold.sessions - located);

  if (unlocated > 0) {
    const countryTotal = sum(fold.countries);

    for (const [code, count] of Object.entries(fold.countries)) {
      const centroid = countryCentroid(code);
      if (!centroid) continue;

      /*
       * The country's share of the sessions we could not place, not its own
       * count — otherwise a host reporting both coordinates and a country would
       * draw every session twice, once precisely and once at the centroid.
       */
      const weight = Math.round((count / countryTotal) * unlocated);
      if (weight > 0) points.push({ lng: centroid[0], lat: centroid[1], weight });
    }
  }

  return points;
}

/**
 * Where the attention is, as heat — a location's own coordinates, weighted by
 * how often its card was opened.
 *
 * A different question from the coverage map the content stats used to draw, and
 * the difference is the whole point of this page: that one showed where the
 * owner put their pins, this one shows which of them anybody looked at.
 */
function interactionPoints(
  fold: DayFold,
  places: BuildViewInput["places"],
): HeatPoint[] {
  const byId = new Map(places.map((place) => [place.id, place]));
  const points: HeatPoint[] = [];

  for (const [id, counts] of Object.entries(fold.places)) {
    const place = byId.get(id);
    // A deleted location still has a row in the table above, where it is named
    // as missing — but it has no coordinates, so it cannot be drawn.
    if (!place) continue;

    const weight = counts.open + counts.directions;
    if (weight > 0) points.push({ lng: place.lng, lat: place.lat, weight });
  }

  return points;
}
