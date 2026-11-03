import { describe, expect, it } from "vitest";

import { needsPublish, storefrontSteps } from "./storefront-step";

const base = {
  onStorefront: true,
  isError: false,
  themeAdded: true,
  hasPendingChanges: false,
  published: true,
};

describe("storefrontSteps", () => {
  it("draws no steps and fills nothing while the status loads", () => {
    expect(storefrontSteps({ ...base, onStorefront: undefined })).toEqual({ steps: null, primary: null });
  });

  it("falls back to Redeploy when the status could not be read and there are edits", () => {
    expect(
      storefrontSteps({ ...base, onStorefront: undefined, isError: true, hasPendingChanges: true }),
    ).toEqual({ steps: null, primary: "publish" });
  });

  it("offers nothing when the status could not be read and the store is current", () => {
    expect(storefrontSteps({ ...base, onStorefront: undefined, isError: true })).toEqual({
      steps: null,
      primary: null,
    });
  });

  it("starts at step 1 until the map is on the storefront, whatever else is true", () => {
    expect(storefrontSteps({ ...base, onStorefront: false, hasPendingChanges: true })).toEqual({
      steps: { show: "current", theme: "upcoming", publish: "upcoming" },
      primary: "show",
    });
  });

  it("moves to step 2 until Add to theme has been pressed, even with edits to publish", () => {
    expect(storefrontSteps({ ...base, themeAdded: false, hasPendingChanges: true })).toEqual({
      steps: { show: "done", theme: "current", publish: "upcoming" },
      primary: "theme",
    });
  });

  it("moves to step 3 when the store is behind the editor", () => {
    expect(storefrontSteps({ ...base, hasPendingChanges: true })).toEqual({
      steps: { show: "done", theme: "done", publish: "current" },
      primary: "publish",
    });
  });

  it("treats a map never published as something to publish", () => {
    expect(storefrontSteps({ ...base, published: false }).primary).toBe("publish");
  });

  it("marks all three done and fills nothing when the store is current", () => {
    expect(storefrontSteps(base)).toEqual({
      steps: { show: "done", theme: "done", publish: "done" },
      primary: null,
    });
  });

  it("keeps the status answer over a later failed refetch", () => {
    expect(storefrontSteps({ ...base, onStorefront: false, isError: true }).primary).toBe("show");
  });

  it("needs a publish for edits or a map never published, and only then", () => {
    expect(needsPublish({ hasPendingChanges: false, published: true })).toBe(false);
    expect(needsPublish({ hasPendingChanges: true, published: true })).toBe(true);
    expect(needsPublish({ hasPendingChanges: false, published: false })).toBe(true);
  });

  it("never has more than one current step", () => {
    for (const onStorefront of [true, false]) {
      for (const themeAdded of [true, false]) {
        for (const hasPendingChanges of [true, false]) {
          const { steps } = storefrontSteps({ ...base, onStorefront, themeAdded, hasPendingChanges });
          expect(Object.values(steps ?? {}).filter((s) => s === "current").length).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
