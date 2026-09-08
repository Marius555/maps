import { describe, expect, it } from "vitest";

import type { MapSession, SessionEvent } from "@/lib/repositories/types";
import { emptyFold, foldSession, type DayFold } from "./fold";
import { dayWindow, daysIn, previousWindow, readRange } from "./range";
import { buildView } from "./view";

/**
 * The page, as data — the ratios, the ordering and the two heatmaps, which are
 * the parts a merged fold does not answer on its own.
 */

function event(type: string, data: Record<string, string | number> = {}): SessionEvent {
  return { type, at: 0, data };
}

function session(overrides: Partial<MapSession> = {}): MapSession {
  return {
    id: "s1",
    mapId: "m1",
    startedAt: "2026-09-07T10:00:00.000Z",
    day: "2026-09-07",
    country: null,
    city: null,
    lat: null,
    lng: null,
    ip: null,
    host: "shop.example.com",
    path: "/find-us",
    referrer: "",
    device: "desktop",
    events: [event("view")],
    ...overrides,
  };
}

function foldOf(...sessions: MapSession[]): DayFold {
  const fold = emptyFold();
  for (const one of sessions) foldSession(fold, one);
  return fold;
}

const PLACES = [
  { id: "p1", name: "Vilnius", lat: 54.68, lng: 25.27 },
  { id: "p2", name: "Kaunas", lat: 54.89, lng: 23.9 },
];

function view(fold: DayFold, previous: DayFold[] = [], recent: MapSession[] = []) {
  return buildView({
    days: [{ day: "2026-09-07", fold }],
    previousDays: previous,
    allDays: ["2026-09-06", "2026-09-07"],
    places: PLACES,
    recent,
  });
}

describe("totals", () => {
  it("has no change to report against an empty previous period", () => {
    // "Up ∞%" is a fact about the map being new, not about the map.
    const result = view(foldOf(session()));

    expect(result.totals.sessions.value).toBe(1);
    expect(result.totals.sessions.change).toBeNull();
  });

  it("measures change against the period before", () => {
    const now = foldOf(session(), session(), session(), session());
    const before = foldOf(session(), session());

    expect(view(now, [before]).totals.sessions.change).toBe(1);
  });

  it("draws a column for a day nothing happened on", () => {
    // An empty column reads as "no data"; a flat one reads as "nobody came".
    const result = view(foldOf(session()));

    expect(result.daily).toEqual([
      { day: "2026-09-06", sessions: 0, views: 0, interactions: 0 },
      { day: "2026-09-07", sessions: 1, views: 1, interactions: 0 },
    ]);
  });
});

describe("locations", () => {
  it("ranks by cards opened and names them", () => {
    const result = view(
      foldOf(
        session({
          events: [
            event("open", { id: "p2" }),
            event("open", { id: "p2" }),
            event("open", { id: "p1" }),
          ],
        }),
      ),
    );

    expect(result.places.map((row) => row.name)).toEqual(["Kaunas", "Vilnius"]);
  });

  it("keeps a location the map no longer has, and says so", () => {
    // Dangling ids are the normal state (§0). Dropping the row would leave the
    // tiles counting opens the table cannot account for.
    const result = view(foldOf(session({ events: [event("open", { id: "gone" })] })));

    expect(result.places[0]).toMatchObject({
      id: "gone",
      exists: false,
      name: "Deleted location",
    });
  });
});

describe("interactions table", () => {
  it("leaves map loads out", () => {
    // They are the denominator and already the headline figure; leaving them in
    // would put one bar at 100% and squash the comparison.
    const result = view(
      foldOf(session({ events: [event("view"), event("pin", { id: "p1" })] })),
    );

    expect(result.interactions.map((row) => row.key)).toEqual(["pin"]);
  });
});

describe("referrers", () => {
  it("counts sessions with no referring site as their own group", () => {
    const result = view(
      foldOf(
        session({ referrer: "https://www.google.com/" }),
        session({ referrer: "" }),
        session({ referrer: "" }),
      ),
    );

    expect(result.referrers).toEqual([{ key: "www.google.com", count: 1 }]);
    // Without this the column would not add up to the visits above it.
    expect(result.direct).toBe(2);
  });
});

describe("origin heat", () => {
  it("draws the coordinates a host reported", () => {
    const result = view(
      foldOf(session({ lat: 54.68, lng: 25.27, country: "LT" })),
    );

    expect(result.origins).toEqual([{ lng: 25.3, lat: 54.7, weight: 1 }]);
  });

  it("falls back to a country centroid when only a country is known", () => {
    const result = view(
      foldOf(
        session({ country: "LT", lat: null, lng: null }),
        session({ country: "LT", lat: null, lng: null }),
      ),
    );

    expect(result.origins).toHaveLength(1);
    expect(result.origins[0].weight).toBe(2);
    expect(result.origins[0].lat).toBeGreaterThan(53);
    expect(result.origins[0].lat).toBeLessThan(57);
  });

  it("does not count a session twice when the host reports both", () => {
    // A coordinate and a country for the same session is one visitor, and the
    // centroid must only take the share nothing could place.
    const result = view(foldOf(session({ country: "LT", lat: 54.68, lng: 25.27 })));

    const total = result.origins.reduce((sum, point) => sum + point.weight, 0);
    expect(total).toBe(1);
  });

  it("draws nothing at all when the host reports no geography", () => {
    const result = view(foldOf(session({ country: null, lat: null, lng: null })));

    expect(result.origins).toEqual([]);
  });
});

describe("interaction heat", () => {
  it("weights a location by how much attention it got", () => {
    const result = view(
      foldOf(
        session({
          events: [
            event("open", { id: "p1" }),
            event("open", { id: "p1" }),
            event("directions", { id: "p1" }),
            event("open", { id: "p2" }),
          ],
        }),
      ),
    );

    expect(result.interactionPoints).toEqual([
      { lng: 25.27, lat: 54.68, weight: 3 },
      { lng: 23.9, lat: 54.89, weight: 1 },
    ]);
  });

  it("skips a location that no longer exists", () => {
    // It keeps its row in the table, where it is named as missing — but it has
    // no coordinates, so there is nowhere to draw it.
    const result = view(foldOf(session({ events: [event("open", { id: "gone" })] })));

    expect(result.interactionPoints).toEqual([]);
  });
});

describe("ranges", () => {
  const NOW = new Date("2026-09-07T12:00:00.000Z");

  it("falls back rather than throwing on a range somebody typed", () => {
    expect(readRange("nonsense")).toBe("30d");
    expect(readRange(undefined)).toBe("30d");
    expect(readRange("7d")).toBe("7d");
  });

  it("counts today as one of the days", () => {
    // "7 days" is today and the six before it — seven columns, not eight.
    const window = dayWindow("7d", NOW);

    expect(window).toEqual({ from: "2026-09-01", to: "2026-09-07" });
    expect(daysIn(window)).toHaveLength(7);
  });

  it("puts the previous period immediately before, without overlapping", () => {
    const window = dayWindow("7d", NOW);
    const before = previousWindow(window, "7d");

    expect(before).toEqual({ from: "2026-08-25", to: "2026-08-31" });
  });

  it("crosses a month boundary", () => {
    expect(dayWindow("30d", new Date("2026-03-02T00:00:00.000Z"))).toEqual({
      from: "2026-02-01",
      to: "2026-03-02",
    });
  });
});

describe("headline tiles", () => {
  it("counts five different things", () => {
    // Map loads and visits are the same number on a map with one embed per
    // page, so a tile for each would spend one saying the other's number.
    const result = view(
      foldOf(
        session({
          events: [
            event("view"),
            event("open", { id: "p1" }),
            event("open", { id: "p2" }),
            event("search", { q: "a", n: 1 }),
            event("directions", { id: "p1" }),
            event("tel", { id: "p1" }),
          ],
        }),
      ),
    );

    expect({
      sessions: result.totals.sessions.value,
      opens: result.totals.opens.value,
      searches: result.totals.searches.value,
      directions: result.totals.directions.value,
      calls: result.totals.calls.value,
    }).toEqual({ sessions: 1, opens: 2, searches: 1, directions: 1, calls: 1 });
  });
});

describe("rates", () => {
  it("reports a share of a stated whole", () => {
    const result = view(
      foldOf(
        session({ events: [event("view")] }),
        session({ events: [event("view")] }),
        session({ events: [event("view"), event("pin", { id: "p1" })] }),
        session({ events: [event("view"), event("pin", { id: "p1" })] }),
      ),
    );

    expect(result.bounce).toEqual({ count: 2, of: 4, share: 0.5 });
  });

  it("has no share to report when nothing could be divided", () => {
    // A rate over nothing is not 0%. "0% of searches led anywhere" on a map
    // nobody has searched is a claim about the map that is not true.
    const result = view(foldOf(session({ events: [event("view")] })));

    expect(result.searchConversion.share).toBeNull();
    expect(result.searchConversion.of).toBe(0);
  });

  it("measures search conversion against sessions that searched, not all of them", () => {
    const result = view(
      foldOf(
        session({ events: [event("search", { q: "a", n: 1 }), event("open", { id: "p1" })] }),
        session({ events: [event("search", { q: "b", n: 0 })] }),
        // Never searched — must not dilute the figure.
        session({ events: [event("view")] }),
      ),
    );

    expect(result.searchConversion).toEqual({ count: 1, of: 2, share: 0.5 });
  });
});

describe("opened but never acted on", () => {
  it("lists a location that produced nothing", () => {
    const result = view(
      foldOf(session({ events: [event("open", { id: "p1" }), event("open", { id: "p1" })] })),
    );

    expect(result.unconverted.map((row) => row.id)).toEqual(["p1"]);
  });

  it("leaves out a location that produced any action at all", () => {
    for (const action of ["directions", "tel", "email", "site"]) {
      const result = view(
        foldOf(
          session({ events: [event("open", { id: "p1" }), event(action, { id: "p1" })] }),
        ),
      );

      expect(result.unconverted, `${action} should count as acting`).toEqual([]);
    }
  });

  it("leaves out a location nobody opened", () => {
    const result = view(foldOf(session({ events: [event("pin", { id: "p1" })] })));

    expect(result.unconverted).toEqual([]);
  });

  it("leaves out a location the map no longer has", () => {
    // It keeps its row in the table above, named as missing — but "go and fix
    // this card" is not advice about a location that is gone.
    const result = view(foldOf(session({ events: [event("open", { id: "gone" })] })));

    expect(result.unconverted).toEqual([]);
  });

  it("ranks by opens, so the biggest problem is first", () => {
    const result = view(
      foldOf(
        session({ events: [event("open", { id: "p1" })] }),
        session({ events: [event("open", { id: "p2" })] }),
        session({ events: [event("open", { id: "p2" })] }),
      ),
    );

    expect(result.unconverted.map((row) => row.id)).toEqual(["p2", "p1"]);
  });
});

describe("places picked from the search box", () => {
  it("ranks the towns visitors wanted", () => {
    const result = view(
      foldOf(
        session({ events: [event("pick", { q: "Kaunas" })] }),
        session({ events: [event("pick", { q: "Kaunas" })] }),
        session({ events: [event("pick", { q: "Klaipėda" })] }),
      ),
    );

    expect(result.picks).toEqual([
      { key: "Kaunas", count: 2 },
      { key: "Klaipėda", count: 1 },
    ]);
  });
});
