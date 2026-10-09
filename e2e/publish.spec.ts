import { existsSync } from "node:fs";
import { addPlace } from "./support/api";
import { expect, test } from "./support/fixtures";

const EMBED_BUILT = existsSync("public/embed/map.js");

test("publish a map, then the embed loads it", { tag: "@smoke" }, async ({ page, request, testMap }) => {
  test.skip(!EMBED_BUILT, "Run `npm run build:embed` first — public/embed/map.js is missing.");

  await addPlace(request, testMap.id, { name: "E2E Pub One", lat: 54.6872, lng: 25.2797 });
  await addPlace(request, testMap.id, { name: "E2E Pub Two", lat: 54.8985, lng: 23.9036 });

  // Publish
  await page.goto(`/maps/${testMap.id}/publish`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();

  // The snippet
  await page.getByRole("button", { name: "Embed code and domains" }).click();
  const shareDialog = page.getByRole("dialog").filter({ hasText: "Put this map on your site" });
  await expect(shareDialog.locator("pre code")).toContainText("data-snapshot=");

  // The real embed bundle, against the snapshot that was just written. The
  // snapshot is the only thing it fetches about the map, so it is what to check.
  // The test page takes the snapshot URL as everything after `snapshot=`
  // (embedTestPageUrl in lib/embed/snippet.ts keeps it last). Read it from the
  // link first, so the wait is in place before the page can fetch it.
  const testPageLink = shareDialog.getByRole("link", { name: /Open test page/ });
  const href = (await testPageLink.getAttribute("href")) ?? "";
  const snapshotUrl = decodeURIComponent(href.match(/[?&]snapshot=(.+)$/)?.[1] ?? "");
  expect(snapshotUrl, "test page link carries no snapshot URL").not.toBe("");

  const snapshotPromise = page
    .context()
    .waitForEvent("response", (response) => response.url() === snapshotUrl);
  const popupPromise = page.waitForEvent("popup");
  await testPageLink.click();
  const embed = await popupPromise;
  const snapshot = await snapshotPromise;

  expect(snapshot.ok()).toBe(true);
  const body = (await snapshot.json()) as { places: { name: string }[] };
  expect(body.places.map((place) => place.name).sort()).toEqual(["E2E Pub One", "E2E Pub Two"]);

  await expect(embed.locator(".lm-root .maplibregl-canvas")).toBeVisible();
});
