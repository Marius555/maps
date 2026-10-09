import { existsSync } from "node:fs";
import type { Page, Request } from "@playwright/test";
import { addPlace, embedTestPage, publishMap } from "./support/api";
import { expect, test } from "./support/fixtures";

/**
 * Visitor analytics end to end: switched on in the Publish designer, baked into
 * the snapshot, sent by the real embed, read back on the Analytics tab.
 *
 * The cost of this feature rests on one request per visitor *session*, never
 * one per event (CLAUDE.md §0), so that is asserted, not assumed.
 *
 * **The session is flushed by hiding the tab, not by leaving the page.** Both
 * are real triggers (embed/src/track.ts listens for `pagehide` and for
 * `visibilitychange`), but a beacon a headless browser sends while unloading
 * goes out under its own "HeadlessChrome" identity rather than the page's, and
 * the collector rightly drops that as a bot — so the unload path cannot be
 * observed honestly from here. Hiding the tab sends the same beacon from a live
 * page, which Playwright sees as an ordinary request.
 *
 * Needs a plan with analytics — the test account on Starter or Pro, or the run
 * under `DISABLE_ALL_PLAN`.
 */
test.skip(!existsSync("public/embed/map.js"), "Run `npm run build:embed` first — public/embed/map.js is missing.");

/** What the browser does when the visitor switches tab or minimises it. */
async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test("a visitor's session is sent once and shows on the Analytics tab", async ({
  page,
  request,
  testMap,
}) => {
  test.setTimeout(150_000);
  await addPlace(request, testMap.id, { name: "E2E Lighthouse", lat: 54.6872, lng: 25.2797 });
  await addPlace(request, testMap.id, { name: "E2E Harbour", lat: 54.8985, lng: 23.9036 });

  // Switch measuring on where an owner does, then publish so it is baked in.
  await page.goto(`/maps/${testMap.id}/publish`);
  await page.getByRole("button", { name: "Visitor analytics", exact: true }).click();
  const saved = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().endsWith(`/api/maps/${testMap.id}`),
  );
  await page.getByRole("group", { name: "Visitor analytics" }).getByText("Measure how visitors use this map").click();
  expect((await saved).ok()).toBe(true);
  const snapshotUrl = await publishMap(request, testMap.id);

  const beacons: Request[] = [];
  page.on("request", (sent) => {
    if (sent.method() === "POST" && sent.url().includes("/api/collect")) beacons.push(sent);
  });

  // Keep each beacon's body in the page: Playwright reports the request but
  // not a Blob body, so it is read back from here.
  await page.addInitScript(() => {
    const send = navigator.sendBeacon.bind(navigator);
    const sent: Blob[] = [];
    Object.assign(window, { e2eBeacons: sent });
    navigator.sendBeacon = (url, data) => {
      if (data instanceof Blob) sent.push(data);
      return send(url, data);
    };
  });

  // A visitor: search, open a location. Cache-busted, because the edge may
  // still hold the copy published before measuring was on.
  await page.goto(embedTestPage(`${snapshotUrl}?e2e=${Date.now()}`));
  await expect(page.locator(".lm-root .maplibregl-canvas")).toBeVisible();
  await page.getByRole("combobox", { name: "Search locations" }).fill("lighthouse");
  await page.getByRole("button", { name: /^E2E Lighthouse/ }).click();
  await page.waitForTimeout(1000);
  expect(beacons, "nothing is sent while the visitor is still using the map").toHaveLength(0);

  // Then they switch away: the whole session goes, in one request.
  const sent = page.waitForResponse((response) => response.url().includes("/api/collect"));
  await hideTab(page);
  expect((await sent).status()).toBe(204);

  const [text] = await page.evaluate(() =>
    Promise.all((window as unknown as { e2eBeacons: Blob[] }).e2eBeacons.map((blob) => blob.text())),
  );
  const body = JSON.parse(text) as { m: string; e: { t: string; q?: string }[] };
  expect(body.m).toBe(testMap.id);
  expect(body.e.length).toBeGreaterThan(1);
  expect(body.e.some((event) => event.q?.toLowerCase().includes("lighthouse"))).toBe(true);

  // Hidden again with nothing new to say: nothing more is sent.
  await hideTab(page);
  await page.waitForTimeout(1500);
  expect(beacons).toHaveLength(1);

  // The owner's view of it.
  await page.goto(`/maps/${testMap.id}/analytics`);
  await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
  await expect(page.getByText("No visits in the last 30 days")).toHaveCount(0);
  await expect(page.getByText(/lighthouse/i).first()).toBeVisible();
});
