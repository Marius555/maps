import { describe, expect, it } from "vitest";

import {
  emptyHours,
  formatDay,
  isEmptyHours,
  isOpenNow,
  parseHours,
  serialiseHours,
  type OpeningHours,
} from "./hours";

/** Monday 09:00–17:00, everything else closed. */
function mondayOnly(): OpeningHours {
  const week = emptyHours();
  week[0] = { open: "09:00", close: "17:00" };
  return week;
}

/** A local Date on a known weekday. 2026-08-10 is a Monday. */
function at(day: number, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 7, 10 + day, hours, minutes);
}

describe("parseHours", () => {
  it("reads a stored week back", () => {
    expect(parseHours(serialiseHours(mondayOnly()))).toEqual(mondayOnly());
  });

  it("returns null for anything it cannot make sense of", () => {
    // A row hand-edited in the Appwrite console must not take down a list.
    expect(parseHours(null)).toBeNull();
    expect(parseHours("")).toBeNull();
    expect(parseHours("not json")).toBeNull();
    expect(parseHours('{"mon":"9-5"}')).toBeNull();
    expect(parseHours("[]")).toBeNull();
  });

  it("drops malformed days rather than the whole week", () => {
    const parsed = parseHours(
      JSON.stringify([
        { open: "09:00", close: "17:00" },
        { open: "9", close: "17" },
        { open: "25:00", close: "26:00" },
        "closed",
      ]),
    );

    expect(parsed?.[0]).toEqual({ open: "09:00", close: "17:00" });
    expect(parsed?.[1]).toBeNull();
    expect(parsed?.[2]).toBeNull();
    expect(parsed?.[3]).toBeNull();
  });

  it("always returns seven days, however many were stored", () => {
    expect(parseHours('[{"open":"09:00","close":"17:00"}]')).toHaveLength(7);
  });
});

describe("serialiseHours", () => {
  it("stores an all-closed week as nothing at all", () => {
    expect(serialiseHours(emptyHours())).toBeNull();
    expect(serialiseHours(null)).toBeNull();
    expect(isEmptyHours(emptyHours())).toBe(true);
  });
});

describe("formatDay", () => {
  it("renders a range, and says Closed when there is none", () => {
    expect(formatDay({ open: "09:00", close: "17:30" })).toBe("09:00–17:30");
    expect(formatDay(null)).toBe("Closed");
  });
});

describe("isOpenNow", () => {
  const week = mondayOnly();

  it("is open between the two times and closed either side", () => {
    expect(isOpenNow(week, at(0, "08:59"))).toBe(false);
    expect(isOpenNow(week, at(0, "09:00"))).toBe(true);
    expect(isOpenNow(week, at(0, "16:59"))).toBe(true);
    // Closing time is when it closes, not the last minute it is open.
    expect(isOpenNow(week, at(0, "17:00"))).toBe(false);
  });

  it("is closed on a day with no hours", () => {
    expect(isOpenNow(week, at(1, "12:00"))).toBe(false);
    expect(isOpenNow(null, at(0, "12:00"))).toBe(false);
  });

  it("handles a span running past midnight", () => {
    const nightly = emptyHours();
    // Saturday 22:00 through to 02:00 on Sunday.
    nightly[5] = { open: "22:00", close: "02:00" };

    expect(isOpenNow(nightly, at(5, "21:59"))).toBe(false);
    expect(isOpenNow(nightly, at(5, "23:30"))).toBe(true);
    // Sunday's small hours belong to Saturday's entry, not Sunday's.
    expect(isOpenNow(nightly, at(6, "01:00"))).toBe(true);
    expect(isOpenNow(nightly, at(6, "02:00"))).toBe(false);
    expect(isOpenNow(nightly, at(6, "12:00"))).toBe(false);
  });

  it("reads Sunday as the last day of the week, not the first", () => {
    const sunday = emptyHours();
    sunday[6] = { open: "10:00", close: "14:00" };

    expect(isOpenNow(sunday, at(6, "12:00"))).toBe(true);
    expect(isOpenNow(sunday, at(0, "12:00"))).toBe(false);
  });
});
