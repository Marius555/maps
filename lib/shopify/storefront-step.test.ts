import { describe, expect, it } from "vitest";

import { needsPublish, progressOf, statesAt } from "@/lib/publish/steps";
import { STOREFRONT_STEPS, storefrontSteps } from "./storefront-step";

const base = {
  onStorefront: true,
  isError: false,
  themeAdded: true,
  hasPendingChanges: false,
  published: true,
};

const at = (step: number) => statesAt(STOREFRONT_STEPS, step);

describe("storefrontSteps", () => {
  it("draws no steps and fills nothing while the status loads", () => {
    expect(storefrontSteps({ ...base, onStorefront: undefined })).toEqual({
      steps: null,
      primary: null,
      quietRedeploy: false,
    });
  });

  it("waits for the browser's theme mark before drawing a state", () => {
    expect(storefrontSteps({ ...base, themeAdded: undefined, hasPendingChanges: true })).toEqual({
      steps: null,
      primary: null,
      quietRedeploy: false,
    });
  });

  it("falls back to Redeploy when the status could not be read and there are edits", () => {
    expect(
      storefrontSteps({ ...base, onStorefront: undefined, isError: true, hasPendingChanges: true }).primary,
    ).toBe("redeploy");
  });

  it("offers nothing when the status could not be read and the store is current", () => {
    expect(storefrontSteps({ ...base, onStorefront: undefined, isError: true }).primary).toBeNull();
  });

  it("starts at Show until the map is on the storefront", () => {
    expect(storefrontSteps({ ...base, onStorefront: false })).toEqual({
      steps: at(0),
      primary: "show",
      quietRedeploy: false,
    });
  });

  it("keeps edits reachable off the storefront, as words", () => {
    expect(storefrontSteps({ ...base, onStorefront: false, hasPendingChanges: true })).toEqual({
      steps: at(0),
      primary: "show",
      quietRedeploy: true,
    });
    // Show on storefront publishes a map never published, so nothing is stuck.
    expect(storefrontSteps({ ...base, onStorefront: false, published: false }).quietRedeploy).toBe(false);
  });

  it("redeploys first, inside the theme step, when there are edits to send", () => {
    expect(storefrontSteps({ ...base, themeAdded: false, hasPendingChanges: true })).toEqual({
      steps: at(1),
      primary: "redeploy",
      quietRedeploy: false,
    });
  });

  it("offers Add to theme once there is nothing to send", () => {
    expect(storefrontSteps({ ...base, themeAdded: false }).primary).toBe("theme");
  });

  it("asks to redeploy at the status step once the theme is done", () => {
    expect(storefrontSteps({ ...base, hasPendingChanges: true })).toEqual({
      steps: at(2),
      primary: "redeploy",
      quietRedeploy: false,
    });
  });

  it("treats a map never published as something to publish", () => {
    expect(storefrontSteps({ ...base, published: false }).primary).toBe("redeploy");
    expect(storefrontSteps({ ...base, themeAdded: false, published: false }).primary).toBe("redeploy");
  });

  it("marks every step done, the status included, when the store is current", () => {
    expect(storefrontSteps(base)).toEqual({ steps: at(3), primary: null, quietRedeploy: false });
  });

  it("keeps the status answer over a later failed refetch", () => {
    expect(storefrontSteps({ ...base, onStorefront: false, isError: true }).primary).toBe("show");
  });

  it("needs a publish for edits or a map never published, and only then", () => {
    expect(needsPublish({ hasPendingChanges: false, published: true })).toBe(false);
    expect(needsPublish({ hasPendingChanges: true, published: true })).toBe(true);
    expect(needsPublish({ hasPendingChanges: false, published: false })).toBe(true);
  });

  for (const onStorefront of [true, false]) {
    for (const themeAdded of [true, false]) {
      for (const published of [true, false]) {
        const label = JSON.stringify({ onStorefront, themeAdded, published });
        const run = (hasPendingChanges: boolean) =>
          storefrontSteps({ ...base, onStorefront, themeAdded, hasPendingChanges, published });

        for (const hasPendingChanges of [true, false]) {
          const { steps, primary } = run(hasPendingChanges);
          const which = `${label} edits=${hasPendingChanges}`;

          it(`draws all three steps in order, one current at most: ${which}`, () => {
            expect(steps).not.toBeNull();
            expect(Object.keys(steps ?? {})).toEqual([...STOREFRONT_STEPS]);
            expect(steps).toEqual(at(progressOf(STOREFRONT_STEPS, steps!)));
          });

          it(`fills a button only on the current step: ${which}`, () => {
            const current = STOREFRONT_STEPS.find((id) => steps?.[id] === "current");
            if (primary === "show") expect(current).toBe("show");
            if (primary === "theme") expect(current).toBe("theme");
            if (primary === "redeploy") expect(["theme", "live"]).toContain(current);
            if (primary === null) expect(current).toBeUndefined();
          });

          it(`never offers Add to theme while there is something to send: ${which}`, () => {
            if (needsPublish({ hasPendingChanges, published })) expect(primary).not.toBe("theme");
          });
        }

        // The owner's complaint, as a test: pressing Redeploy must never send
        // the path back up a step, or take a step away.
        it(`never moves back after a redeploy: ${label}`, () => {
          const before = progressOf(STOREFRONT_STEPS, run(true).steps!);
          const after = progressOf(STOREFRONT_STEPS, run(false).steps!);
          expect(after).toBeGreaterThanOrEqual(before);
        });
      }
    }
  }
});
