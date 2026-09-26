/**
 * Every word the embed says to a visitor, in English.
 *
 * The one table the embed falls back to and the dashboard translates from. A
 * snapshot carries `strings` only for the keys whose value differs from this —
 * so a map published in English, or before this existed, carries nothing, and
 * the embed reads a missing key as exactly the words it always drew (§7).
 *
 * The language presets are **not** here. They live in lib/embed/languages, on
 * the dashboard side of the seam, because whatever this directory holds the
 * embed ships to every visitor: a French map would otherwise download German.
 * Publish resolves the owner's language and their own edits into the one table
 * that map needs.
 *
 * `{place}` and `{distance}` are the only placeholders, and only in
 * `nearestFound` — word order is the part of that sentence that differs between
 * languages, so it cannot be built by concatenation.
 */
export const EMBED_STRINGS = {
  searchLabel: "Search locations",
  searchPlaceholder: "Search locations or a postcode",
  nearest: "Nearest to me",
  nearestStop: "Stop measuring from here",
  nearestFound: "{place} — {distance} away",
  locating: "Finding your location…",
  locationOff:
    "Location is off for this site. Turn it on in your browser, then try again.",
  locationTimeout: "Couldn't find you in time. Try again.",
  locationUnsupported: "This browser can't share a location.",
  locationFailed: "Couldn't get your location.",
  locations: "Locations",
  noMatch: "No locations match.",
  directions: "Directions",
  email: "Email",
  website: "Website",
  moreDetails: "More details",
  openNow: "Open now",
  closedNow: "Closed now",
  closed: "Closed",
  previousPhoto: "Previous photo",
  nextPhoto: "Next photo",
  dismiss: "Dismiss",
} as const;

export type EmbedStringKey = keyof typeof EMBED_STRINGS;

/** What a snapshot carries: only the words that differ from `EMBED_STRINGS`. */
export type EmbedStrings = Partial<Record<EmbedStringKey, string>>;

export const EMBED_STRING_KEYS = Object.keys(EMBED_STRINGS) as EmbedStringKey[];
