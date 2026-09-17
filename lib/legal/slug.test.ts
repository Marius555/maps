import { describe, expect, it } from "vitest";

import { headingSlug } from "./slug";

describe("headingSlug", () => {
  it("matches the anchor the documents already link to", () => {
    expect(headingSlug("Annex III — Sub-processors")).toBe(
      "annex-iii--sub-processors",
    );
  });

  it("drops punctuation and keeps numbering", () => {
    expect(headingSlug("2. What we collect, why, and on what legal basis")).toBe(
      "2-what-we-collect-why-and-on-what-legal-basis",
    );
    expect(headingSlug("5. Maps published on our customers' websites")).toBe(
      "5-maps-published-on-our-customers-websites",
    );
  });
});
