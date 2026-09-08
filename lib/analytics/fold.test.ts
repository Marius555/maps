import { describe, expect, it } from "vitest";

import type { MapSession, SessionEvent } from "@/lib/repositories/types";
import {
  emptyFold,
  foldByDay,
  foldSession,
  foldToTotals,
  mergeFolds,
  totalsToFold,
} from "./fold";

/**
 * The counting. Everything the Analytics page shows is a merged fold, so a bug
 * here is a number that is wrong on every section at once — and because a
 * completed day is folded *once* and stored forever, a bug here is also
 * permanent for every day it touched.
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
    country: "LT",
    city: "Vilnius",
    lat: 54.6872,
    lng: 25.2797,
    ip: "81.7.144.23",
    host: "shop.example.com",
    path: "/find-us",
    referrer: "https://www.google.com/search?q=shops",
    device: "mobile",
    events: [event("view")],
    ...overrides,
  };
}

describe("foldSession", () => {
  it("counts a view as a view and everything else as an interaction", () => {
    const fold = emptyFold();

    foldSession(
      fold,
      session({ events: [event("view"), event("pin", { id: "p1" }), event("search", { q: "a", n: 2 })] }),
    );

    expect(fold.views).toBe(1);
    expect(fold.interactions).toBe(2);
    expect(fold.sessions).toBe(1);
  });

  it("keeps the referring host and drops the rest of the URL", () => {
    const fold = emptyFold();
    foldSession(fold, session());

    // The query a visitor searched Google for is theirs, not the customer's.
    expect(fold.referrers).toEqual({ "www.google.com": 1 });
  });

  it("treats an unparseable or absent referrer as no referrer", () => {
    const fold = emptyFold();

    foldSession(fold, session({ referrer: "" }));
    foldSession(fold, session({ referrer: "not a url" }));

    expect(fold.referrers).toEqual({});
    expect(fold.sessions).toBe(2);
  });

  it("groups origins to about eleven kilometres", () => {
    const fold = emptyFold();

    // Two visitors a few streets apart are one point, which is both the honest
    // resolution and what keeps `origins` from growing with traffic.
    foldSession(fold, session({ lat: 54.6872, lng: 25.2797 }));
    foldSession(fold, session({ lat: 54.6901, lng: 25.2755 }));

    expect(Object.values(fold.origins)).toEqual([2]);
  });

  it("records no origin at all when the host gave no coordinates", () => {
    const fold = emptyFold();
    foldSession(fold, session({ lat: null, lng: null }));

    expect(fold.origins).toEqual({});
    // The country still counts, which is what lets the map fall back to a
    // centroid without inventing a coordinate on the row.
    expect(fold.countries).toEqual({ LT: 1 });
  });

  it("counts per-location events against the location", () => {
    const fold = emptyFold();

    foldSession(
      fold,
      session({
        events: [
          event("open", { id: "p1" }),
          event("open", { id: "p1" }),
          event("directions", { id: "p1" }),
          event("tel", { id: "p2" }),
        ],
      }),
    );

    expect(fold.places.p1).toMatchObject({ open: 2, directions: 1, tel: 0 });
    expect(fold.places.p2).toMatchObject({ tel: 1, open: 0 });
  });

  it("ignores a per-location event with no location", () => {
    const fold = emptyFold();
    foldSession(fold, session({ events: [event("open"), event("tel", { id: "" })] }));

    expect(fold.places).toEqual({});
    // Still counted in the totals — something happened, we just cannot say where.
    expect(fold.interactions).toBe(2);
  });

  it("keeps a search's newest match count and adds up its uses", () => {
    const fold = emptyFold();

    foldSession(
      fold,
      session({
        events: [
          event("search", { q: "kaunas", n: 0 }),
          event("search", { q: "kaunas", n: 0 }),
        ],
      }),
    );

    expect(fold.searches.kaunas).toEqual({ count: 2, matches: 0 });
  });

  it("counts an event type it has never seen", () => {
    // The embed updates when a customer's visitor reloads; this deploys
    // separately. An unknown type must be counted, not dropped.
    const fold = emptyFold();
    foldSession(fold, session({ events: [event("something_new")] }));

    expect(fold.events.something_new).toBe(1);
    expect(fold.interactions).toBe(1);
  });
});

describe("foldByDay", () => {
  it("puts each session in its own day", () => {
    const days = foldByDay([
      session({ day: "2026-09-06" }),
      session({ day: "2026-09-07" }),
      session({ day: "2026-09-07" }),
    ]);

    expect(days.get("2026-09-06")?.sessions).toBe(1);
    expect(days.get("2026-09-07")?.sessions).toBe(2);
  });
});

describe("mergeFolds", () => {
  it("adds every counter", () => {
    const a = emptyFold();
    const b = emptyFold();

    foldSession(a, session({ events: [event("view"), event("open", { id: "p1" })] }));
    foldSession(b, session({ events: [event("view"), event("open", { id: "p1" })] }));

    const total = mergeFolds([a, b]);

    expect(total.sessions).toBe(2);
    expect(total.views).toBe(2);
    expect(total.places.p1.open).toBe(2);
  });

  it("takes the later day's answer for how many a search found", () => {
    // A query that used to find nothing and now finds three is answered; showing
    // "0 found" for it would report history as a problem.
    const monday = emptyFold();
    const tuesday = emptyFold();

    foldSession(monday, session({ events: [event("search", { q: "kaunas", n: 0 })] }));
    foldSession(tuesday, session({ events: [event("search", { q: "kaunas", n: 3 })] }));

    const total = mergeFolds([monday, tuesday]);

    expect(total.searches.kaunas).toEqual({ count: 2, matches: 3 });
  });
});

describe("storage round trip", () => {
  it("comes back the same", () => {
    const fold = emptyFold();
    foldSession(
      fold,
      session({
        events: [
          event("view"),
          event("open", { id: "p1" }),
          event("search", { q: "vilnius", n: 4 }),
        ],
      }),
    );

    const back = totalsToFold(foldToTotals(fold), {
      sessions: fold.sessions,
      views: fold.views,
      interactions: fold.interactions,
    });

    expect(back).toEqual(fold);
  });

  it("survives a row written by something else", () => {
    // Never throws, exactly like the mappers in lib/repositories: a row from an
    // older build or edited in the console must not take the page down.
    const back = totalsToFold(
      {
        events: { view: "lots" },
        places: { p1: { open: 2, nonsense: "x" }, p2: null },
        searches: { a: { count: 3 }, b: "no" },
        countries: null,
        origins: { bad: Number.NaN },
      } as unknown as Record<string, unknown>,
      { sessions: 1, views: 1, interactions: 0 },
    );

    expect(back.events).toEqual({});
    expect(back.places.p1.open).toBe(2);
    expect(back.places).not.toHaveProperty("p2");
    expect(back.searches.a).toEqual({ count: 3, matches: 0 });
    expect(back.searches).not.toHaveProperty("b");
    expect(back.origins).toEqual({});
  });

  it("trims the bags that could grow without limit", () => {
    const fold = emptyFold();

    for (let i = 0; i < 400; i += 1) {
      foldSession(fold, session({ events: [event("search", { q: `q${String(i)}`, n: 1 })] }));
    }

    const totals = foldToTotals(fold) as { searches: Record<string, unknown> };

    // `mapDaily.totals` is one JSON column; the tail it drops is by definition
    // the part nobody would have scrolled to.
    expect(Object.keys(totals.searches)).toHaveLength(200);
    // The headline counters stay exact whatever is trimmed.
    expect(fold.sessions).toBe(400);
  });
});

describe("the shape of a visit", () => {
  it("counts a session that only loaded the map as a bounce", () => {
    const fold = emptyFold();
    foldSession(fold, session({ events: [event("view")] }));

    expect(fold.bounced).toBe(1);
  });

  it("counts a session with no events at all as a bounce", () => {
    // A beacon can arrive with an empty queue. Somebody still arrived.
    const fold = emptyFold();
    foldSession(fold, session({ events: [] }));

    expect(fold.bounced).toBe(1);
  });

  it("does not count a session that did anything", () => {
    const fold = emptyFold();
    foldSession(fold, session({ events: [event("view"), event("pin", { id: "p1" })] }));

    expect(fold.bounced).toBe(0);
  });

  it("counts a search that led to an open as converted", () => {
    const fold = emptyFold();
    foldSession(
      fold,
      session({
        events: [
          event("view"),
          event("search", { q: "vilnius", n: 2 }),
          event("open", { id: "p1" }),
        ],
      }),
    );

    expect(fold).toMatchObject({ searchSessions: 1, searchConverted: 1 });
  });

  it("does not count an open that happened before the search", () => {
    // Order is the whole meaning of this figure: a card opened first was not
    // opened *because* of a search that came after it.
    const fold = emptyFold();
    foldSession(
      fold,
      session({
        events: [
          event("open", { id: "p1" }),
          event("search", { q: "vilnius", n: 2 }),
        ],
      }),
    );

    expect(fold).toMatchObject({ searchSessions: 1, searchConverted: 0 });
  });

  it("leaves a session that never searched out of both figures", () => {
    const fold = emptyFold();
    foldSession(fold, session({ events: [event("view"), event("open", { id: "p1" })] }));

    expect(fold).toMatchObject({ searchSessions: 0, searchConverted: 0 });
  });
});

describe("places picked from the search box", () => {
  it("counts the town by name", () => {
    const fold = emptyFold();
    foldSession(
      fold,
      session({ events: [event("pick", { q: "Kaunas" }), event("pick", { q: "Kaunas" })] }),
    );

    expect(fold.picks).toEqual({ Kaunas: 2 });
  });

  it("still counts a bare pick as an interaction, with nothing to name", () => {
    // Every snapshot published before the name was sent. Absent means what it
    // always did — see §0.
    const fold = emptyFold();
    foldSession(fold, session({ events: [event("pick")] }));

    expect(fold.picks).toEqual({});
    expect(fold.interactions).toBe(1);
    expect(fold.events.pick).toBe(1);
  });
});
