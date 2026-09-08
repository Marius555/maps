import type { MapSession, SessionEvent } from "@/lib/repositories/types";

/**
 * One day's visitor activity, counted.
 *
 * This is the unit the whole page is built from, and it exists because **Appwrite
 * cannot count**: there is no aggregate query and no atomic increment, so a
 * ninety-day range would otherwise mean paging every session row of every day on
 * every page load. A day that is over never changes, so it is folded once and
 * read from `mapDaily` forever after (lib/repositories/analytics.repository.ts).
 *
 * Two consequences shape everything here:
 *
 * - **A fold must be mergeable.** The page adds ninety of them together, so
 *   every field is a counter or a bag of counters. Nothing here may be an
 *   average, a maximum or a ratio — those are derived in ./view.ts, from the
 *   merged whole, where they are still correct.
 * - **A fold must survive a round trip through JSON.** What is stored is what is
 *   read back, so the caps below are applied on the way *out* and the reader
 *   assumes nothing about what it finds.
 *
 * Pure and client-safe. No clock, no environment, no `server-only`.
 */

export type PlaceCounts = {
  /** Cards opened, however they were reached. The headline per-location figure. */
  open: number;
  /** Reached by clicking the map itself. */
  pin: number;
  /** Reached from the results list. */
  row: number;
  directions: number;
  tel: number;
  email: number;
  site: number;
};

export type SearchCount = {
  count: number;
  /**
   * How many locations that query found, the last time anyone ran it.
   *
   * The **last**, not the smallest or an average, and that is the useful one: a
   * query that used to find nothing and now finds three is answered, and a page
   * showing "0 matches" for it would be reporting history as a problem.
   */
  matches: number;
};

export type DayFold = {
  sessions: number;
  views: number;
  /** Every event that is not a view — everything a visitor actually did. */
  interactions: number;
  /**
   * Sessions where the map loaded and nothing else happened.
   *
   * A count rather than a rate, because a fold has to be mergeable — the rate is
   * `./view.ts`'s to derive, over the whole range, where it is still correct.
   * This is a fact about the *map*, not about the locations on it: people
   * arrived and it did not invite them in.
   */
  bounced: number;
  /**
   * Sessions containing at least one search, and the subset of those where a
   * location was opened *after* one.
   *
   * Two counters rather than a ratio, for the same reason as `bounced`. The pair
   * answers the question the searches table cannot: a query with five matches
   * that nobody follows up is worse news than one with none, because the zero at
   * least explains itself.
   */
  searchSessions: number;
  searchConverted: number;
  /** Event type → how many. The open-ended one; see `SessionEvent`. */
  events: Record<string, number>;
  places: Record<string, PlaceCounts>;
  searches: Record<string, SearchCount>;
  /**
   * Towns picked out of the gazetteer → how many times.
   *
   * A visitor only reaches this list when the map had no location to offer for
   * what they typed, so every entry is somebody asking for a shop somewhere
   * there is not one. It is the one table here that answers a question about
   * the *business* rather than about the map.
   */
  picks: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
  /** Where visitors came from before the customer's page, by host. */
  referrers: Record<string, number>;
  /** Which of the customer's own pages the map is on, as `host<TAB>path`. */
  pages: Record<string, number>;
  /** Rounded `lng,lat` → sessions, for the origin heatmap. */
  origins: Record<string, number>;
};

/**
 * Which events carry a location id worth counting per location.
 *
 * A closed list on purpose, unlike `events` above: this drives a table with a
 * column per entry, and a new event type should add a row to "Interactions"
 * without silently growing that table a column nobody designed.
 */
const PLACE_EVENTS = new Set<keyof PlaceCounts>([
  "open",
  "pin",
  "row",
  "directions",
  "tel",
  "email",
  "site",
]);

/**
 * How precisely a visitor's position is grouped for the heatmap: one decimal
 * place, about 11km.
 *
 * It bounds the cardinality of `origins` — which is stored as JSON, so it cannot
 * be allowed to grow with traffic — and it is also the honest resolution. Most
 * of these coordinates *are* a city centroid or a country centroid already, and
 * drawing them to five decimal places would suggest we know a street.
 */
const ORIGIN_PRECISION = 1;

export function emptyFold(): DayFold {
  return {
    sessions: 0,
    views: 0,
    interactions: 0,
    bounced: 0,
    searchSessions: 0,
    searchConverted: 0,
    events: {},
    places: {},
    searches: {},
    picks: {},
    countries: {},
    devices: {},
    referrers: {},
    pages: {},
    origins: {},
  };
}

function bump(bag: Record<string, number>, key: string, by = 1): void {
  if (!key) return;
  bag[key] = (bag[key] ?? 0) + by;
}

/**
 * The site a referrer URL names, or nothing.
 *
 * Host only, never the path: a customer wants to know that visitors arrive from
 * a search engine or from their own newsletter, and the full URL a visitor came
 * from is both unbounded and more about that person than about the map.
 *
 * Anything unparseable — and `document.referrer` is empty far more often than it
 * is malformed — answers empty, which `foldSession` reads as direct traffic.
 */
function hostOf(referrer: string): string {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname;
  } catch {
    return "";
  }
}

/** Count one session into a fold. Mutates, because it runs per row of a page. */
export function foldSession(fold: DayFold, session: MapSession): void {
  fold.sessions += 1;

  if (session.country) bump(fold.countries, session.country);
  bump(fold.devices, session.device);

  const referrer = hostOf(session.referrer);
  // A session with no referrer is direct traffic, and "direct" is an answer
  // rather than a missing one — but it is `view.ts`'s to name, not this file's.
  if (referrer) bump(fold.referrers, referrer);

  if (session.host) bump(fold.pages, `${session.host}\t${session.path}`);

  if (session.lat !== null && session.lng !== null) {
    bump(
      fold.origins,
      `${session.lng.toFixed(ORIGIN_PRECISION)},${session.lat.toFixed(ORIGIN_PRECISION)}`,
    );
  }

  for (const event of session.events) foldEvent(fold, event);

  foldJourney(fold, session);
}

/**
 * The two things about a session that no single event can say.
 *
 * `foldEvent` above counts events, and these are facts about the *shape* of a
 * visit — did anything happen at all, and did a search lead anywhere. They have
 * to be read over the session as a whole, which is why they are here rather than
 * folded in beside their event.
 *
 * Order is what makes the second one mean anything: an open *before* the only
 * search was not caused by it. The events arrive in the order they happened,
 * because the tracker appends and the collector stores the array as it came, so
 * one pass in order is enough — no timestamps to compare.
 */
function foldJourney(fold: DayFold, session: MapSession): void {
  let searched = false;
  let converted = false;
  let acted = false;

  for (const event of session.events) {
    if (event.type === "view") continue;

    acted = true;

    if (event.type === "search") {
      searched = true;
    } else if (event.type === "open" && searched) {
      converted = true;
    }
  }

  // A session that did nothing but load. Counted even when it carried no `view`
  // at all — a beacon with an empty event list is still somebody who arrived.
  if (!acted) fold.bounced += 1;

  if (searched) {
    fold.searchSessions += 1;
    if (converted) fold.searchConverted += 1;
  }
}

function foldEvent(fold: DayFold, event: SessionEvent): void {
  bump(fold.events, event.type);

  if (event.type === "view") {
    fold.views += 1;
    return;
  }

  fold.interactions += 1;

  if (event.type === "search") {
    const query = typeof event.data.q === "string" ? event.data.q.trim() : "";
    if (!query) return;

    const existing = fold.searches[query];
    const matches = typeof event.data.n === "number" ? event.data.n : 0;

    fold.searches[query] = {
      count: (existing?.count ?? 0) + 1,
      matches,
    };

    return;
  }

  if (event.type === "pick") {
    // Snapshots published before the town's name was sent carry a bare `pick`.
    // Those still count as an interaction above; they just have nothing to name,
    // which is what an absent field has always meant here (§0).
    const town = typeof event.data.q === "string" ? event.data.q.trim() : "";
    if (town) bump(fold.picks, town);

    return;
  }

  const id = typeof event.data.id === "string" ? event.data.id : "";
  if (!id || !PLACE_EVENTS.has(event.type as keyof PlaceCounts)) return;

  const counts = (fold.places[id] ??= {
    open: 0,
    pin: 0,
    row: 0,
    directions: 0,
    tel: 0,
    email: 0,
    site: 0,
  });

  counts[event.type as keyof PlaceCounts] += 1;
}

/** Sessions → one fold per UTC day they belong to. */
export function foldByDay(sessions: MapSession[]): Map<string, DayFold> {
  const days = new Map<string, DayFold>();

  for (const session of sessions) {
    let fold = days.get(session.day);

    if (!fold) {
      fold = emptyFold();
      days.set(session.day, fold);
    }

    foldSession(fold, session);
  }

  return days;
}

/**
 * Add folds together. The page does this over every day in its range.
 *
 * **Pass them in day order.** Everything here is a sum except `SearchCount.matches`,
 * which is "how many that query found last time" and therefore takes the later
 * day's answer — which is only the later day's answer if the days arrive in
 * order.
 */
export function mergeFolds(folds: Iterable<DayFold>): DayFold {
  const total = emptyFold();

  for (const fold of folds) {
    total.sessions += fold.sessions;
    total.views += fold.views;
    total.interactions += fold.interactions;
    total.bounced += fold.bounced;
    total.searchSessions += fold.searchSessions;
    total.searchConverted += fold.searchConverted;

    mergeCounts(total.events, fold.events);
    mergeCounts(total.picks, fold.picks);
    mergeCounts(total.countries, fold.countries);
    mergeCounts(total.devices, fold.devices);
    mergeCounts(total.referrers, fold.referrers);
    mergeCounts(total.pages, fold.pages);
    mergeCounts(total.origins, fold.origins);

    for (const [id, counts] of Object.entries(fold.places)) {
      const target = (total.places[id] ??= {
        open: 0,
        pin: 0,
        row: 0,
        directions: 0,
        tel: 0,
        email: 0,
        site: 0,
      });

      for (const key of PLACE_EVENTS) target[key] += counts[key] ?? 0;
    }

    for (const [query, count] of Object.entries(fold.searches)) {
      const existing = total.searches[query];

      total.searches[query] = {
        count: (existing?.count ?? 0) + count.count,
        // The later day's answer wins, which is what makes `matches` mean "the
        // last time anyone ran it" across a whole range. Folds are merged in
        // day order for exactly this reason.
        matches: count.matches,
      };
    }
  }

  return total;
}

function mergeCounts(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [key, value] of Object.entries(source)) bump(target, key, value);
}

/*
 * Storage caps.
 *
 * `mapDaily.totals` is one JSON column, so every bag in it has to be bounded or
 * a map with heavy traffic writes a row that grows without limit. Cutting to the
 * busiest entries is the right cut: the page draws a top-twenty table off each
 * of these, and the tail it discards is by definition the part nobody would have
 * scrolled to.
 *
 * The counters above them — sessions, views, interactions — are exact whatever
 * happens here, so no headline figure is ever affected by a trim.
 */
const CAPS = {
  places: 500,
  searches: 200,
  origins: 300,
  referrers: 100,
  pages: 100,
  events: 100,
  picks: 200,
} as const;

/** A fold, trimmed and ready to store in `mapDaily.totals`. */
export function foldToTotals(fold: DayFold): Record<string, unknown> {
  return {
    // The three scalars that are not already their own column on the row. They
    // are exact — only the bags below are ever trimmed.
    bounced: fold.bounced,
    searchSessions: fold.searchSessions,
    searchConverted: fold.searchConverted,
    events: topCounts(fold.events, CAPS.events),
    places: topPlaces(fold.places, CAPS.places),
    searches: topSearches(fold.searches, CAPS.searches),
    picks: topCounts(fold.picks, CAPS.picks),
    countries: fold.countries,
    devices: fold.devices,
    referrers: topCounts(fold.referrers, CAPS.referrers),
    pages: topCounts(fold.pages, CAPS.pages),
    origins: topCounts(fold.origins, CAPS.origins),
  };
}

/**
 * A stored day, read back.
 *
 * Never throws and assumes nothing: a row written by an older build, or one
 * hand-edited in the console, must produce a usable fold rather than take the
 * page down. Same contract as the mappers in lib/repositories.
 */
export function totalsToFold(
  totals: Record<string, unknown>,
  counters: { sessions: number; views: number; interactions: number },
): DayFold {
  const fold = emptyFold();

  fold.sessions = counters.sessions;
  fold.views = counters.views;
  fold.interactions = counters.interactions;

  /*
   * Absent means zero, which is what a day rolled up before these existed has.
   * That day genuinely has no answer for them — not a zero we measured — but a
   * missing counter cannot be told apart from a real one once it is summed, and
   * the alternative is refusing to draw a rate for any range containing an old
   * day. The rates are shown against `sessions`, which is exact for every day,
   * so an old day dilutes them toward zero rather than inventing anything.
   */
  fold.bounced = readCount(totals.bounced);
  fold.searchSessions = readCount(totals.searchSessions);
  fold.searchConverted = readCount(totals.searchConverted);

  fold.events = readCounts(totals.events);
  fold.picks = readCounts(totals.picks);
  fold.countries = readCounts(totals.countries);
  fold.devices = readCounts(totals.devices);
  fold.referrers = readCounts(totals.referrers);
  fold.pages = readCounts(totals.pages);
  fold.origins = readCounts(totals.origins);
  fold.places = readPlaces(totals.places);
  fold.searches = readSearches(totals.searches);

  return fold;
}

function readCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readCounts(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;

  for (const [key, count] of Object.entries(value)) {
    if (typeof count === "number" && Number.isFinite(count)) out[key] = count;
  }

  return out;
}

function readPlaces(value: unknown): Record<string, PlaceCounts> {
  const out: Record<string, PlaceCounts> = {};
  if (!value || typeof value !== "object") return out;

  for (const [id, counts] of Object.entries(value)) {
    if (!counts || typeof counts !== "object") continue;

    const source = counts as Record<string, unknown>;
    const place: PlaceCounts = {
      open: 0,
      pin: 0,
      row: 0,
      directions: 0,
      tel: 0,
      email: 0,
      site: 0,
    };

    for (const key of PLACE_EVENTS) {
      const count = source[key];
      if (typeof count === "number" && Number.isFinite(count)) place[key] = count;
    }

    out[id] = place;
  }

  return out;
}

function readSearches(value: unknown): Record<string, SearchCount> {
  const out: Record<string, SearchCount> = {};
  if (!value || typeof value !== "object") return out;

  for (const [query, count] of Object.entries(value)) {
    if (!count || typeof count !== "object") continue;

    const source = count as Record<string, unknown>;
    const total = source.count;
    if (typeof total !== "number" || !Number.isFinite(total)) continue;

    out[query] = {
      count: total,
      matches:
        typeof source.matches === "number" && Number.isFinite(source.matches)
          ? source.matches
          : 0,
    };
  }

  return out;
}

function topCounts(
  bag: Record<string, number>,
  limit: number,
): Record<string, number> {
  const entries = Object.entries(bag);
  if (entries.length <= limit) return bag;

  return Object.fromEntries(
    entries.sort(([, a], [, b]) => b - a).slice(0, limit),
  );
}

function topPlaces(
  bag: Record<string, PlaceCounts>,
  limit: number,
): Record<string, PlaceCounts> {
  const entries = Object.entries(bag);
  if (entries.length <= limit) return bag;

  // Ranked by opens, because that is the column the table sorts on by default.
  return Object.fromEntries(
    entries.sort(([, a], [, b]) => b.open - a.open).slice(0, limit),
  );
}

function topSearches(
  bag: Record<string, SearchCount>,
  limit: number,
): Record<string, SearchCount> {
  const entries = Object.entries(bag);
  if (entries.length <= limit) return bag;

  return Object.fromEntries(
    entries.sort(([, a], [, b]) => b.count - a.count).slice(0, limit),
  );
}
