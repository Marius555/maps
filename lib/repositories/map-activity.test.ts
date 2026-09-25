import { describe, expect, it } from "vitest";

import { latestOf } from "./map-activity";

const MAP_UPDATED_AT = "2026-09-01T10:00:00.000+00:00";
const PLACES_LAST = "2026-09-02T10:00:00.000+00:00";
const GROUPS_LAST = "2026-08-30T10:00:00.000+00:00";

describe("latestOf", () => {
  it("picks the newest and skips empty tables", () => {
    expect(latestOf(MAP_UPDATED_AT, null, PLACES_LAST, GROUPS_LAST)).toBe(PLACES_LAST);
  });

  it("keeps the first when nothing is newer", () => {
    expect(latestOf(MAP_UPDATED_AT, null, GROUPS_LAST)).toBe(MAP_UPDATED_AT);
  });
});
