import { existsSync } from "node:fs";
import { addPlace, listPlaces } from "./support/api";
import { mockAddressSearch, mockReverseGeocode } from "./support/geocode-mock";
import { expect, test } from "./support/fixtures";

/**
 * The editor on a phone (the `mobile-editor` project, Pixel 7). The layout is
 * what is under test here, so no drag gestures: the sheet, a location added by
 * search, and a publish — the whole core loop at 412px.
 */

test("the Locations sheet opens and closes", async ({ page, request, testMap }) => {
  await addPlace(request, testMap.id, { name: "E2E Pocket", lat: 54.6872, lng: 25.2797 });
  await page.goto(`/maps/${testMap.id}`);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();

  await page.getByRole("button", { name: "Expand Locations" }).click();
  const collapse = page.getByRole("button", { name: "Collapse Locations" });
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Actions for E2E Pocket" })).toBeVisible();

  await collapse.click();
  await expect(page.getByRole("button", { name: "Expand Locations" })).toBeVisible();
});

test("add a location by searching for its address", async ({ page, request, testMap }) => {
  await mockReverseGeocode(page);
  await mockAddressSearch(page, {
    lat: 54.6872,
    lng: 25.2797,
    label: "Gedimino pr. 9, 01103 Vilnius, Lithuania",
    title: "Gedimino pr. 9, Vilnius",
  });
  await page.goto(`/maps/${testMap.id}`);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();

  await page.getByRole("button", { name: "Find an address" }).click();
  const search = page.getByRole("textbox", { name: /Find an address/ });
  await search.fill("Gedimino pr. 9");
  await search.press("Enter");

  const matches = page.getByRole("list", { name: "Address matches" });
  await expect(matches.getByRole("listitem")).toHaveCount(1);

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith(`/api/maps/${testMap.id}/places`),
  );
  await matches.getByRole("button", { name: "Add a location here" }).click();
  expect((await created).status()).toBe(201);

  await expect.poll(async () => (await listPlaces(request, testMap.id)).length).toBe(1);
  const [place] = await listPlaces(request, testMap.id);
  expect(place.lat).toBeCloseTo(54.6872, 3);
  expect(place.lng).toBeCloseTo(25.2797, 3);
});

test("publish from a phone", async ({ page, request, testMap }) => {
  test.skip(!existsSync("public/embed/map.js"), "Run `npm run build:embed` first — the Publish preview needs it.");
  await addPlace(request, testMap.id, { name: "E2E Mobile Pub", lat: 54.6872, lng: 25.2797 });

  await page.goto(`/maps/${testMap.id}/publish`);
  // On a phone the designer is a sheet under the preview, shut until opened.
  await page.getByRole("button", { name: "Expand Design" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();
});
