import { afterEach, describe, expect, it, vi } from "vitest";

import { directionsUrl } from "./directions";

/**
 * Where "Directions" sends a visitor.
 *
 * The half worth testing is the *origin*, which is new: a link with none is what
 * every card published so far emits and what the dashboard still emits, so the
 * without-origin strings below are a promise about live customer sites rather
 * than a description of today's code (CLAUDE.md §7).
 */

const SHOP = { name: "Central store", lat: 54.687, lng: 25.28 };

/**
 * Which maps app the link is for is read off `navigator.userAgent`, so the two
 * branches have to be asked separately. Unstubbed, the runner's own `navigator`
 * names neither an iPhone nor a Macintosh, which is the Google branch — the same
 * answer every non-Apple visitor gets.
 */
function asIPhone(): void {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("directionsUrl", () => {
  it("sends only a destination when nothing knows where the visitor is", () => {
    expect(directionsUrl(SHOP)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=54.687,25.28&travelmode=driving",
    );
  });

  it("sends the visitor's own position as the origin when there is one", () => {
    expect(directionsUrl(SHOP, { lat: 54.7, lng: 25.3 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=54.687,25.28" +
        "&origin=54.7,25.3&travelmode=driving",
    );
  });

  /*
   * The bug this whole parameter exists for: with no origin Google resolves one
   * itself, from the IP address where it has nothing better — which is how a
   * route to a shop two streets away starts forty kilometres out.
   */
  it("never emits an empty origin, which is not the same as none", () => {
    expect(directionsUrl(SHOP, null)).not.toContain("origin=");
    expect(directionsUrl(SHOP, undefined)).not.toContain("origin=");
  });

  it("uses Apple's spelling on an iPhone, with and without a start", () => {
    asIPhone();

    expect(directionsUrl(SHOP)).toBe(
      "https://maps.apple.com/?daddr=54.687,25.28&q=Central%20store",
    );
    expect(directionsUrl(SHOP, { lat: 54.7, lng: 25.3 })).toBe(
      "https://maps.apple.com/?daddr=54.687,25.28&saddr=54.7,25.3&q=Central%20store",
    );
  });

  it("orders the pair latitude first, which is what both apps read", () => {
    // The one mistake that produces a plausible wrong answer rather than an
    // error: a swapped pair is a real place, just not this one.
    expect(directionsUrl(SHOP, { lat: 1, lng: 2 })).toContain("origin=1,2");
  });
});
