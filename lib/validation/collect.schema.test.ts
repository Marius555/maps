import { describe, expect, it } from "vitest";

import { collectSchema, MAX_EVENTS } from "./collect.schema";

/**
 * The collector is the only route in this app an anonymous stranger can write
 * through, so this file is about what happens when the payload is *not* the one
 * embed/src/track.ts sends. The tracker's own caps are a courtesy; these are the
 * real ceiling.
 */

const valid = {
  v: 1,
  m: "map123",
  s: "abc123",
  h: "shop.example.com",
  p: "/stores",
  r: "https://www.google.com/",
  e: [{ t: "view", o: 0 }],
};

describe("collectSchema", () => {
  it("accepts what the tracker sends", () => {
    const parsed = collectSchema.parse(valid);

    expect(parsed.m).toBe("map123");
    expect(parsed.e).toEqual([{ t: "view", o: 0 }]);
  });

  it("rejects a contract version it does not know", () => {
    // Guessing at an unknown version is how a field silently changes meaning.
    expect(() => collectSchema.parse({ ...valid, v: 2 })).toThrow();
  });

  it("rejects a session with no events", () => {
    expect(() => collectSchema.parse({ ...valid, e: [] })).toThrow();
  });

  it("rejects more events than a session may carry", () => {
    const many = Array.from({ length: MAX_EVENTS + 1 }, () => ({ t: "pin", o: 1 }));

    expect(() => collectSchema.parse({ ...valid, e: many })).toThrow();
  });

  it("keeps the provenance fields optional", () => {
    // A referrer policy can strip all three. A session with no provenance is
    // still a session, and refusing it would under-count the strictest sites.
    const parsed = collectSchema.parse({ v: valid.v, m: valid.m, s: valid.s, e: valid.e });

    expect([parsed.h, parsed.p, parsed.r]).toEqual(["", "", ""]);
  });
});

describe("event sanitising", () => {
  it("truncates a long string value rather than rejecting the session", () => {
    const parsed = collectSchema.parse({
      ...valid,
      e: [{ t: "search", o: 5, q: "x".repeat(500) }],
    });

    expect(parsed.e[0].q).toHaveLength(80);
  });

  it("carries unknown keys through", () => {
    // The embed and this app deploy separately. A closed shape here would turn
    // "a newer embed sent something" into a dropped session.
    const parsed = collectSchema.parse({
      ...valid,
      e: [{ t: "something_new", o: 12, whatever: "yes", count: 3 }],
    });

    expect(parsed.e[0]).toMatchObject({ whatever: "yes", count: 3 });
  });

  it("drops a number that is not one", () => {
    // Infinity survives JSON.stringify as `null`, which would read as a missing
    // field rather than as the bad value it is.
    const parsed = collectSchema.parse({
      ...valid,
      e: [{ t: "nearest_found", o: 1, km: Number.POSITIVE_INFINITY }],
    });

    expect(parsed.e[0]).not.toHaveProperty("km");
  });

  it("falls back to a zero offset rather than failing on a silly one", () => {
    const parsed = collectSchema.parse({
      ...valid,
      e: [{ t: "open", o: -5, id: "a" }],
    });

    expect(parsed.e[0].o).toBe(0);
  });

  it("will not let an extra key overwrite the validated type or offset", () => {
    // `catchall` sees `t` and `o` too, so the order the object is rebuilt in is
    // load-bearing rather than stylistic.
    const parsed = collectSchema.parse({
      ...valid,
      e: [{ t: "open", o: 9, id: "a" }],
    });

    expect(parsed.e[0].t).toBe("open");
    expect(parsed.e[0].o).toBe(9);
  });

  it("rejects an event with no type", () => {
    expect(() =>
      collectSchema.parse({ ...valid, e: [{ t: "", o: 0 }] }),
    ).toThrow();
  });
});
