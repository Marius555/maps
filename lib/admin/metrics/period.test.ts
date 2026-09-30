import { describe, expect, it } from "vitest";

import { countByDay, deltaOf, periodOf, tallyBy, withinDays } from "./period";

const NOW = new Date("2026-09-29T15:00:00Z");

describe("periodOf", () => {
  it("ends today and is preceded by an equal previous period", () => {
    const period = periodOf(7, NOW);

    expect(period.days).toHaveLength(7);
    expect(period.days.at(-1)).toBe("2026-09-29");
    expect(period.fromDay).toBe("2026-09-23");
    expect(period.previousDays).toHaveLength(7);
    expect(period.previousDays.at(-1)).toBe("2026-09-22");
    expect(period.previousFromDay).toBe("2026-09-16");
  });

  it("crosses a month boundary", () => {
    expect(periodOf(3, new Date("2026-10-01T00:30:00Z")).days).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
  });
});

describe("countByDay", () => {
  it("buckets by UTC day, zero-fills, and ignores days outside the range", () => {
    const days = ["2026-09-28", "2026-09-29"];

    expect(
      countByDay(
        ["2026-09-28T23:59:00.000Z", "2026-09-29T00:00:01.000+00:00", "2026-09-29T10:00:00Z", "2026-09-01T00:00:00Z"],
        days,
      ),
    ).toEqual([
      { day: "2026-09-28", value: 1 },
      { day: "2026-09-29", value: 2 },
    ]);
  });
});

describe("deltaOf", () => {
  it("is null against a zero previous period rather than infinite", () => {
    expect(deltaOf(5, 0).change).toBeNull();
    expect(deltaOf(15, 10).change).toBeCloseTo(0.5);
    expect(deltaOf(5, 10).change).toBeCloseTo(-0.5);
  });
});

describe("tallyBy", () => {
  it("counts, folds blanks into the fallback, and sorts biggest first", () => {
    expect(tallyBy(["GB", "", "DE", "GB", null], (value) => value)).toEqual([
      { key: "GB", count: 2 },
      { key: "Unknown", count: 2 },
      { key: "DE", count: 1 },
    ]);
  });
});

describe("withinDays", () => {
  it("is false for never-active accounts", () => {
    expect(withinDays("", 7, NOW)).toBe(false);
    expect(withinDays("2026-09-25T00:00:00Z", 7, NOW)).toBe(true);
    expect(withinDays("2026-09-01T00:00:00Z", 7, NOW)).toBe(false);
  });
});
