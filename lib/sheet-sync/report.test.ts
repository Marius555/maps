import { describe, expect, it } from "vitest";

import {
  FAILED_LOOKUP_TTL_MS,
  freshFailedLookups,
  mergeStepReports,
  reportChangedMap,
} from "./report";
import type { SheetSyncReport } from "./types";

const report = (overrides: Partial<SheetSyncReport> = {}): SheetSyncReport => ({
  added: 0,
  updated: 0,
  removed: 0,
  skipped: [],
  skippedTotal: 0,
  republished: false,
  ...overrides,
});

describe("mergeStepReports", () => {
  it("adds up what each step changed", () => {
    const merged = mergeStepReports(
      report({ added: 10, updated: 2, removed: 1 }),
      report({ added: 5, updated: 1 }),
    );

    expect(merged).toMatchObject({ added: 15, updated: 3, removed: 1 });
  });

  it("takes the latest step's skipped rows, which already include earlier ones", () => {
    const skip = { row: 4, name: "Kiosk", reason: "We couldn't find this address." };

    const merged = mergeStepReports(
      report({ skipped: [skip], skippedTotal: 1 }),
      report({ skipped: [skip, { ...skip, row: 9 }], skippedTotal: 2 }),
    );

    expect(merged.skipped.map((entry) => entry.row)).toEqual([4, 9]);
    expect(merged.skippedTotal).toBe(2);
  });

  it("keeps the fact that an earlier step republished", () => {
    expect(
      mergeStepReports(report({ republished: true }), report()).republished,
    ).toBe(true);
  });
});

describe("reportChangedMap", () => {
  it("is false for a sync that found nothing to do", () => {
    expect(reportChangedMap(report())).toBe(false);
    expect(reportChangedMap(report({ removed: 1 }))).toBe(true);
  });
});

describe("freshFailedLookups", () => {
  it("forgets failures older than a week, and anything unreadable", () => {
    const now = Date.parse("2026-09-16T12:00:00Z");

    const fresh = freshFailedLookups(
      {
        recent: { at: new Date(now - 60_000).toISOString(), status: "failed" },
        stale: {
          at: new Date(now - FAILED_LOOKUP_TTL_MS - 1).toISOString(),
          status: "low",
        },
        broken: { at: "not a date", status: "failed" },
      },
      now,
    );

    expect(Object.keys(fresh)).toEqual(["recent"]);
  });
});
