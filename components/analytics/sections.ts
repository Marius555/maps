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
 * Where a session came from, when nothing said.
 *
 * "Direct" is the industry word and it is wrong for a store locator: most of
 * these are people already on the customer's site, whose browser simply did not
 * pass a referrer. Naming it after what we know rather than after what we guess.
 */
export const NO_REFERRER_LABEL = "No referring site";
