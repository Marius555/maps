import { afterEach, describe, expect, it } from "vitest";

import { drain, tally } from "./counter";

afterEach(() => {
  drain();
});

describe("the API call tally", () => {
  it("folds calls into one entry per day, provider and kind", () => {
    const day = new Date("2026-09-29T10:00:00Z");

    tally({ provider: "geoapify", kind: "geocode", ok: true }, day);
    tally({ provider: "geoapify", kind: "geocode", ok: true }, day);
    tally({ provider: "geoapify", kind: "geocode", ok: false }, day);
    tally({ provider: "osrm", kind: "route", ok: true }, day);
    tally({ provider: "geoapify", kind: "geocode", ok: true }, new Date("2026-09-30T00:00:01Z"));

    expect(drain()).toEqual([
      { day: "2026-09-29", provider: "geoapify", kind: "geocode", ok: 2, failed: 1 },
      { day: "2026-09-29", provider: "osrm", kind: "route", ok: 1, failed: 0 },
      { day: "2026-09-30", provider: "geoapify", kind: "geocode", ok: 1, failed: 0 },
    ]);
  });

  it("empties on drain, so a flush never writes the same calls twice", () => {
    tally({ provider: "photon", kind: "reverse", ok: true });
    expect(drain()).toHaveLength(1);
    expect(drain()).toEqual([]);
  });
});
