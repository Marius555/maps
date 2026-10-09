import type { Page } from "@playwright/test";
import { addPlace, listShapes, publishMap, readSnapshot } from "./support/api";
import { mockReverseGeocode } from "./support/geocode-mock";
import { mockRouting } from "./support/routing-mock";
import { expect, test } from "./support/fixtures";

/**
 * The route tool, with the router answered locally (`support/routing-mock.ts`):
 * a run spends no lookups and no upstream credit. What is under test is the
 * editor — arming, picking stops, saving, publishing — not the routing engine.
 */

function pin(page: Page, name: string) {
  return page.locator(".map-pin").and(page.getByRole("button", { name, exact: true }));
}

async function drawRoute(page: Page, stops: string[]) {
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose a drawing tool" })
    .getByRole("button", { name: /^Route/ })
    .click();
  // While the tool is armed the pins let clicks through to the canvas, which
  // snaps each one to the location under it — so click where the pin is drawn.
  for (const stop of stops) {
    const box = (await pin(page, stop).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.keyboard.press("Enter");
}

/** Two locations a few hundred metres apart, the editor open on them, routing mocked. */
async function twoStops(
  page: Page,
  request: Parameters<typeof addPlace>[0],
  mapId: string,
  names: [string, string],
) {
  const routing = await mockRouting(page);
  await addPlace(request, mapId, { name: names[0], lat: 54.6872, lng: 25.2797 });
  await addPlace(request, mapId, { name: names[1], lat: 54.69, lng: 25.29 });
  await page.goto(`/maps/${mapId}`);
  await expect(page.locator(".map-pin")).toHaveCount(2);

  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith(`/api/maps/${mapId}/shapes`),
  );
  await drawRoute(page, names);
  expect((await saved).status()).toBe(201);

  return routing;
}

test.beforeEach(async ({ page }) => {
  await mockReverseGeocode(page);
});

test("draw a route between two locations; it is saved, and pins still open after", async ({
  page,
  request,
  testMap,
}) => {
  const routing = await twoStops(page, request, testMap.id, ["E2E Depot", "E2E Store"]);
  expect(routing.directionsCalls()).toBe(1);

  const [route] = await listShapes(request, testMap.id);
  expect(route.geometry.kind).toBe("line");
  expect((route.geometry.route as { stops: unknown[] } | undefined)?.stops).toHaveLength(2);

  // Its row reads the route back: distance, time and stops.
  await expect(
    page.getByRole("button", { name: new RegExp("^" + route.name + " Route · .+ · 2 stops$") }),
  ).toBeVisible();

  // A route gesture once left the editor believing it was still drawing, and a
  // click on a pin did nothing (CLAUDE.md: auditing every `drawMode` read).
  await page.keyboard.press("Escape");
  await pin(page, "E2E Depot").click();
  await expect(page.getByRole("dialog", { name: "E2E Depot" })).toBeVisible();

  await page.reload();
  await expect(page.locator(".map-pin")).toHaveCount(2);
  expect(await listShapes(request, testMap.id)).toHaveLength(1);
});

test("a route reaches the published snapshot", async ({ page, request, testMap }) => {
  await twoStops(page, request, testMap.id, ["E2E From", "E2E To"]);

  const snapshot = await readSnapshot(request, await publishMap(request, testMap.id));
  expect(snapshot.shapes).toHaveLength(1);
  expect(snapshot.shapes?.[0]).toMatchObject({ kind: "line" });
});

test("delete a route from its row menu", async ({ page, request, testMap }) => {
  await twoStops(page, request, testMap.id, ["E2E Here", "E2E There"]);
  const [route] = await listShapes(request, testMap.id);

  await page.getByRole("button", { name: `Actions for ${route.name}` }).click();
  await page.getByRole("menuitem", { name: /^Delete/ }).click();
  await page
    .getByRole("dialog", { name: `Delete ${route.name}?` })
    .getByRole("button", { name: /^Delete/ })
    .click();
  await expect(page.getByRole("button", { name: `Actions for ${route.name}` })).toHaveCount(0);

  await expect.poll(async () => (await listShapes(request, testMap.id)).length).toBe(0);
});
