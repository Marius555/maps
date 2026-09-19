import { describe, expect, it } from "vitest";

import { contentVersion, latestOf, previewKey, RENDER_VERSION } from "./version";

const BASE = {
  mapUpdatedAt: "2026-09-01T10:00:00.000+00:00",
  places: { count: 12, last: "2026-09-02T10:00:00.000+00:00" },
  shapes: { count: 0, last: null },
  groups: { count: 1, last: "2026-08-30T10:00:00.000+00:00" },
};

describe("contentVersion", () => {
  it("is stable for the same inputs", () => {
    expect(contentVersion(BASE)).toBe(contentVersion({ ...BASE }));
  });

  it.each([
    ["the map row changes", { mapUpdatedAt: "2026-09-03T10:00:00.000+00:00" }],
    ["a location is edited", { places: { count: 12, last: "2026-09-04T00:00:00.000+00:00" } }],
    ["a location is deleted", { places: { count: 11, last: BASE.places.last } }],
    ["a shape is drawn", { shapes: { count: 1, last: "2026-09-04T00:00:00.000+00:00" } }],
    ["a group is recoloured", { groups: { count: 1, last: "2026-09-04T00:00:00.000+00:00" } }],
  ])("changes when %s", (_, change) => {
    expect(contentVersion({ ...BASE, ...change })).not.toBe(contentVersion(BASE));
  });
});

describe("previewKey", () => {
  const content = contentVersion(BASE);

  it("carries the render version, so a renderer change redraws everything", () => {
    expect(previewKey({ contentVersion: content, style: "liberty", prefersDark: false })).toContain(
      `v${RENDER_VERSION}|`,
    );
  });

  it("changes with the dashboard theme for an Auto map", () => {
    expect(previewKey({ contentVersion: content, style: "auto", prefersDark: true })).not.toBe(
      previewKey({ contentVersion: content, style: "auto", prefersDark: false }),
    );
  });

  it("ignores the dashboard theme for a pinned style", () => {
    expect(previewKey({ contentVersion: content, style: "positron", prefersDark: true })).toBe(
      previewKey({ contentVersion: content, style: "positron", prefersDark: false }),
    );
  });

  it("changes with the style", () => {
    expect(previewKey({ contentVersion: content, style: "positron", prefersDark: false })).not.toBe(
      previewKey({ contentVersion: content, style: "liberty", prefersDark: false }),
    );
  });
});

describe("latestOf", () => {
  it("picks the newest and skips empty tables", () => {
    expect(latestOf(BASE.mapUpdatedAt, null, BASE.places.last, BASE.groups.last)).toBe(
      BASE.places.last,
    );
  });

  it("keeps the first when nothing is newer", () => {
    expect(latestOf(BASE.mapUpdatedAt, null, BASE.groups.last)).toBe(BASE.mapUpdatedAt);
  });
});
