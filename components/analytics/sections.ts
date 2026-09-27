import type { DeviceKind } from "@/lib/repositories/types";

/**
 * Every word on the Analytics page that is not a number.
 *
 * The split this file exists for: `lib/analytics/**` holds the arithmetic and no
 * copy, and this holds the copy and no arithmetic. It is the arrangement the
 * deleted content stats already used, and it survives the rewrite for the same
 * reason — a count that quietly disagrees with the label beside it is the
 * failure mode on a page like this, and keeping them apart makes each one
 * testable on its own.
 *
 * Names follow §8: what the *visitor* did, in the words the customer would use.
 * Not "click events", not "tel". "Called a location", because that is the thing
 * that happened.
 */

/**
 * What each event the embed sends is called on screen.
 *
 * **Open-ended on purpose.** The embed runs on customers' pages and updates when
 * their visitors reload, so a newer embed can send an event this build has never
 * heard of. `labelEvent` falls back to the raw key rather than dropping the row:
 * an unlabelled figure is a small ugliness, a missing one is a lie.
 */
const EVENT_LABELS: Record<string, string> = {
  view: "Map loaded",
  open: "Opened a location",
  pin: "Clicked a pin",
  row: "Picked from the results list",
  cluster: "Zoomed into a cluster",
  shape: "Opened an area or route",
  search: "Searched",
  pick: "Chose a place from the search box",
  nearest: "Pressed find nearest",
  nearest_clear: "Cleared find nearest",
  nearest_found: "Found their nearest location",
  nearest_failed: "Find nearest couldn't locate them",
  directions: "Asked for directions",
  tel: "Called a location",
  email: "Emailed a location",
  site: "Opened a location's website",
  gallery: "Stepped through the photos",
  fold: "Opened more details",
};

/**
 * The three folds a card can have, named by the class the embed reports.
 *
 * The class rather than a word, because sending the word would be sending copy
 * in every visitor's download to say something the dashboard already knows. See
 * `trackLinks` in embed/src/track.ts.
 */
const FOLD_LABELS: Record<string, string> = {
  "lm-popup__more-summary": "Opened more details",
  "lm-popup__hours-summary": "Opened opening hours",
  "lm-popup__description-summary": "Read the full description",
};

export function labelEvent(key: string): string {
  return EVENT_LABELS[key] ?? FOLD_LABELS[key] ?? key;
}

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  desktop: "Desktop",
  mobile: "Phone",
  tablet: "Tablet",
};

/**
 * A country's name from its code, using the browser's own table.
 *
 * `Intl.DisplayNames` rather than a list of two hundred names we would have to
 * carry and keep current. Pinned to `en` for the reason `formatCount` pins its
 * locale: this renders on the server and hydrates in a browser, and a name that
 * differs between the two is a hydration error.
 *
 * A code it does not know comes back as the code, which is the right answer —
 * "ZZ" tells the owner more than a blank cell.
 */
const COUNTRY_NAMES = new Intl.DisplayNames(["en"], {
  type: "region",
  fallback: "code",
});

export function labelCountry(code: string): string {
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The range picker. Plain words, because "P30D" is not one. */
export const RANGE_LABELS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
} as const;

/**
 * What a trend chip is measured against, said under every headline figure.
 * "+12%" against nothing stated is a number people invent a meaning for.
 */
export const COMPARED_WITH = {
  "7d": "vs the 7 days before",
  "30d": "vs the 30 days before",
  "90d": "vs the 90 days before",
} as const;

/**
 * The four headline figures: what each is called and, under the name, what it
 * counts. The line is there for Visitors and Visits above all — two words a
 * letter apart that measure different things, and nobody should have to guess
 * which is people and which is page loads.
 */
export const METRIC_COPY = {
  visitors: {
    label: "Visitors",
    description: "Different people, each counted once",
  },
  sessions: {
    label: "Visits",
    description: "Times your map was opened — one visitor can visit often",
  },
  opens: {
    label: "Locations opened",
    description: "Location cards visitors opened",
  },
  actions: {
    label: "Directions & calls",
    description: "Visitors who set off for or rang a location",
  },
} as const;

/**
 * The tables at the foot of the page, as tabs, in order.
 *
 * Only the tables are tabbed — the figures and charts above are always on
 * screen. A tab is drawn only when its table has rows (`detail-tabs.ts`): a
 * tab that opens on nothing is an empty table one click further away.
 */
export const DETAIL_TABS = {
  locations: "Locations",
  unconverted: "Opened, then nothing",
  searches: "Searches",
  picks: "Places instead",
  pages: "Embedded on",
  visitors: "Recent visitors",
} as const;

export type DetailTab = keyof typeof DETAIL_TABS;

/** `?tab=` as the page reads it: anything unknown is no preference. */
export function readDetailTab(value: unknown): DetailTab | null {
  return typeof value === "string" && value in DETAIL_TABS
    ? (value as DetailTab)
    : null;
}

/** What each table answers, said once above it. */
export const DETAIL_HINTS: Record<DetailTab, string> = {
  locations: "Every location visitors opened, busiest first — sort by any column",
  unconverted:
    "Opened, but no directions, call or website visit followed — usually a missing phone number, hours that read as closed, or an address that looks wrong",
  searches: "A search that found nothing is a place your customers expect you to be",
  picks: "Towns picked from the search box because no location matched",
  pages: "The pages of your own site the map is working on",
  visitors:
    "Kept for a limited time, so this reaches less far back than the figures above",
};

/** The outcomes donut, in the ring order its colours were validated in. */
export const OUTCOME_LABELS = {
  directions: "Directions",
  calls: "Calls",
  site: "Website visits",
  email: "Emails",
} as const;

/** The engagement chart's stack, bottom to top. */
export const ENGAGEMENT_SERIES = {
  opens: "Locations opened",
  searches: "Searches",
  directions: "Directions",
  calls: "Calls",
} as const;

/** The traffic chart's series switch, in the order the buttons sit. */
export const TRAFFIC_SERIES = {
  sessions: { label: "Visits", noun: ["visit", "visits"] },
  visitors: { label: "Visitors", noun: ["visitor", "visitors"] },
  opens: { label: "Opens", noun: ["location opened", "locations opened"] },
  searches: { label: "Searches", noun: ["search", "searches"] },
} as const;

export type TrafficSeries = keyof typeof TRAFFIC_SERIES;

/**
 * Where a session came from, when nothing said.
 *
 * "Direct" is the industry word and it is wrong for a store locator: most of
 * these are people already on the customer's site, whose browser simply did not
 * pass a referrer. Naming it after what we know rather than after what we guess.
 */
export const NO_REFERRER_LABEL = "No referring site";
