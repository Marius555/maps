import { describe, expect, it } from "vitest";

import { progressOf, statesAt } from "./steps";
import { WEBSITE_STEPS, websiteSteps } from "./website-step";

const base = { published: true, hasPendingChanges: false, embedAdded: true, canPublish: true };

const at = (step: number) => statesAt(WEBSITE_STEPS, step);

describe("statesAt / progressOf", () => {
  it("marks everything before the step done and everything after it upcoming", () => {
    expect(at(1)).toEqual({ publish: "done", embed: "current", live: "upcoming" });
    expect(at(3)).toEqual({ publish: "done", embed: "done", live: "done" });
    expect(progressOf(WEBSITE_STEPS, at(1))).toBe(1);
    expect(progressOf(WEBSITE_STEPS, at(3))).toBe(3);
  });
});

describe("websiteSteps", () => {
  it("starts at Publish for a map never published, without waiting for the browser", () => {
    expect(websiteSteps({ ...base, published: false, embedAdded: undefined })).toEqual({
      steps: at(0),
      primary: "publish",
    });
  });

  it("waits for the browser's embed mark once published", () => {
    expect(websiteSteps({ ...base, embedAdded: undefined })).toEqual({ steps: null, primary: null });
  });

  it("offers Get embed code once published with nothing to send", () => {
    expect(websiteSteps({ ...base, embedAdded: false })).toEqual({ steps: at(1), primary: "embed" });
  });

  it("redeploys first, inside the embed step, when there are edits to send", () => {
    expect(websiteSteps({ ...base, embedAdded: false, hasPendingChanges: true })).toEqual({
      steps: at(1),
      primary: "redeploy",
    });
  });

  it("asks to redeploy at the status step once the snippet is on the site", () => {
    expect(websiteSteps({ ...base, hasPendingChanges: true })).toEqual({
      steps: at(2),
      primary: "redeploy",
    });
  });

  it("marks every step done, the status included, when the site is current", () => {
    expect(websiteSteps(base)).toEqual({ steps: at(3), primary: null });
  });

  it("never puts Redeploy in front of a team viewer's snippet", () => {
    expect(
      websiteSteps({ ...base, embedAdded: false, hasPendingChanges: true, canPublish: false }),
    ).toEqual({ steps: at(1), primary: "embed" });
  });

  it("tells a viewer the site is behind, with nothing to press", () => {
    expect(websiteSteps({ ...base, hasPendingChanges: true, canPublish: false })).toEqual({
      steps: at(2),
      primary: null,
    });
  });

  it("fills nothing for a viewer before the first publish", () => {
    expect(websiteSteps({ ...base, published: false, canPublish: false }).primary).toBeNull();
  });

  for (const published of [true, false]) {
    for (const embedAdded of [true, false]) {
      for (const canPublish of [true, false]) {
        const label = JSON.stringify({ published, embedAdded, canPublish });
        const run = (hasPendingChanges: boolean) =>
          websiteSteps({ published, hasPendingChanges, embedAdded, canPublish });

        for (const hasPendingChanges of [true, false]) {
          const { steps, primary } = run(hasPendingChanges);
          const which = `${label} edits=${hasPendingChanges}`;

          it(`draws all three steps in order, one current at most: ${which}`, () => {
            expect(steps).not.toBeNull();
            expect(Object.keys(steps ?? {})).toEqual([...WEBSITE_STEPS]);
            expect(steps).toEqual(at(progressOf(WEBSITE_STEPS, steps!)));
          });

          it(`fills a button only on the current step: ${which}`, () => {
            const current = WEBSITE_STEPS.find((id) => steps?.[id] === "current");
            if (primary === "publish") expect(current).toBe("publish");
            if (primary === "embed") expect(current).toBe("embed");
            if (primary === "redeploy") expect(["embed", "live"]).toContain(current);
          });

          it(`never offers Get embed code first while there is something to send: ${which}`, () => {
            if (published && canPublish && hasPendingChanges) expect(primary).not.toBe("embed");
          });
        }

        // The owner's complaint, as a test: pressing Redeploy must never send
        // the path back up a step, or take a step away.
        it(`never moves back after a redeploy: ${label}`, () => {
          const before = progressOf(WEBSITE_STEPS, run(true).steps!);
          const after = progressOf(WEBSITE_STEPS, run(false).steps!);
          expect(after).toBeGreaterThanOrEqual(before);
        });
      }
    }
  }
});
