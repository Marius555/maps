/**
 * Where "Directions" goes.
 *
 * Here rather than in the embed, and rather than in /lib, for the reason
 * `card-layout.ts` and `shapes.ts` are here (CLAUDE.md §4): three things now
 * draw this link — the embed's popup and results list, the editor's own place
 * card, and the designer canvas that is a preview of both — and two copies of
 * "which maps app does this visitor have" is one bug away from a card that
 * routes correctly in the studio and not on the customer's site. Zero
 * dependencies, vanilla TS, as that rule requires.
 *
 * Linked out rather than drawn — step-by-step navigation is out of scope
 * (CLAUDE.md §11), and a link costs us nothing per visitor, which a routing API
 * would not (§2).
 *
 * §12 bans the Google Maps *SDK* and the terms that come with it: storing their
 * business data, caching their coordinates, showing their Places results on our
 * map. An outbound link does none of those, and §11 names it as the intended
 * answer. This was OpenStreetMap's directions page, which is a worse destination
 * for a real customer's visitor than the app already on their phone.
 *
 * Coordinates, never the name. A name is resolved by whoever receives it, and a
 * stockist inside a department store resolves to the department store — the one
 * place a visitor standing outside does not need directions to. Apple takes both
 * and treats `q` as the label only, so there it can have the name as well.
 */

/**
 * The least a thing must be to be routable to.
 *
 * Structural rather than `SnapshotPlace`, which is what it used to take: the
 * dashboard hands it a domain `Place` and the embed hands it a snapshot one.
 * Both have these three, and neither should have to be converted into the other
 * to ask for a link.
 */
export type DirectionsTarget = {
  name: string;
  lat: number;
  lng: number;
};

export function directionsUrl(place: DirectionsTarget): string {
  const to = `${String(place.lat)},${String(place.lng)}`;

  if (isApplePlatform()) {
    return `https://maps.apple.com/?daddr=${to}&q=${encodeURIComponent(place.name)}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${to}&travelmode=driving`;
}

/**
 * iOS and iPadOS only, deliberately — not macOS.
 *
 * On an iPhone, Apple Maps is the app that exists; Google Maps may not be
 * installed at all, and its web page then asks the visitor to install it instead
 * of giving them a route. On a Mac the browser is as likely to be Chrome as
 * Safari and Google Maps opens in the tab they are already in, so the default
 * stays there.
 *
 * iPadOS 13+ reports itself as a Macintosh, which is why the touch count is part
 * of the test: no real Mac reports more than one touch point.
 *
 * Guarded on `navigator` existing at all, which the embed's copy did not have to
 * be: this now runs in the dashboard too, where a card can be rendered on the
 * server. Absent, the answer is the same one every non-Apple visitor gets.
 */
function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}
