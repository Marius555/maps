import { describe, expect, it } from "vitest";

import {
  describeSheetOwnedFields,
  describeSyncCounts,
  describeSyncResult,
} from "./describe";
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

describe("describeSyncCounts", () => {
  it("names only what changed", () => {
    expect(describeSyncCounts(report({ added: 3, removed: 2 }))).toBe(
      "3 added, 2 removed",
    );
  });

  it("says so when nothing did", () => {
    expect(describeSyncCounts(report())).toBe("Nothing changed");
  });
});

describe("describeSheetOwnedFields", () => {
  it("lists exactly the fields a column feeds", () => {
    expect(
      describeSheetOwnedFields({ name: "Name", city: "City", phone: "Tel", tags: "Tags" }),
    ).toBe("Name, address, phone and tags");
  });

  it("reads as a sentence with one field", () => {
    expect(describeSheetOwnedFields({ name: "Name" })).toBe("Name");
  });
});

describe("describeSyncResult", () => {
  it("adds the republish and the skipped rows", () => {
    expect(
      describeSyncResult(report({ updated: 1, republished: true, skippedTotal: 2 })),
    ).toBe(
      "1 updated. Your live map was republished. 2 rows were skipped — open Sheet sync to see why.",
    );
  });
});
