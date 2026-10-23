import { describe, expect, it } from "vitest";

import { publishingMapIds } from "./publish-slots";

const LIVE = "2026-10-01T00:00:00.000Z";

describe("publishingMapIds", () => {
  it("gives the slot to a newer live map over an older draft", () => {
    const maps = [
      { id: "draft", publishedAt: null },
      { id: "live", publishedAt: LIVE },
    ];

    expect(publishingMapIds(maps, 1)).toEqual(["live"]);
  });

  it("keeps the oldest live map when several are live", () => {
    const maps = [
      { id: "draft", publishedAt: null },
      { id: "older-live", publishedAt: LIVE },
      { id: "newer-live", publishedAt: LIVE },
    ];

    expect(publishingMapIds(maps, 1)).toEqual(["older-live"]);
    expect(publishingMapIds(maps, 2)).toEqual(["older-live", "newer-live"]);
  });

  it("falls back to the oldest maps when none is live", () => {
    const maps = [
      { id: "first", publishedAt: null },
      { id: "second", publishedAt: null },
    ];

    expect(publishingMapIds(maps, 1)).toEqual(["first"]);
  });

  it("fills spare slots with drafts, oldest first", () => {
    const maps = [
      { id: "draft-a", publishedAt: null },
      { id: "live", publishedAt: LIVE },
      { id: "draft-b", publishedAt: null },
    ];

    expect(publishingMapIds(maps, 2)).toEqual(["live", "draft-a"]);
    expect(publishingMapIds(maps, 15)).toEqual(["live", "draft-a", "draft-b"]);
  });
});
