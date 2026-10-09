import type { Locator, Page } from "@playwright/test";
import { listShapes } from "./support/api";
import { mockReverseGeocode } from "./support/geocode-mock";
import { expect, test } from "./support/fixtures";

/**
 * Shapes are the one thing the editor draws as style layers rather than DOM, so
 * there is no element to find: they are checked through the API, and through
 * what a click inside one does (it opens that shape's card — the canvas asks
 * MapLibre which shape layer is under the pointer).
 */

type Box = { x: number; y: number; width: number; height: number };

async function pickTool(page: Page, tool: "Circle" | "Polygon" | "Line") {
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose a drawing tool" })
    .getByRole("button", { name: new RegExp(`^${tool}`) })
    .click();
}

/** A point as a fraction of the map, clear of the toolbar along its top. */
function at(box: Box, fx: number, fy: number) {
  return { x: box.x + box.width * fx, y: box.y + box.height * fy };
}

async function drawPolygon(page: Page, box: Box) {
  await pickTool(page, "Polygon");
  for (const [fx, fy] of [
    [0.3, 0.35],
    [0.6, 0.35],
    [0.6, 0.65],
    [0.3, 0.65],
  ]) {
    const p = at(box, fx, fy);
    await page.mouse.click(p.x, p.y);
  }
  await page.keyboard.press("Enter");
}

async function drawCircle(page: Page, box: Box) {
  await pickTool(page, "Circle");
  const centre = at(box, 0.78, 0.5);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 30, centre.y, { steps: 4 });
  await page.mouse.move(centre.x + 60, centre.y, { steps: 4 });
  await page.mouse.up();
}

/**
 * Clicks a point until the card it should open is up.
 *
 * Saving a shape fits the camera to it, and a style change reloads the map; a
 * click that lands while the camera is still easing stops the animation rather
 * than selecting anything. So the press is repeated until the map is settled
 * enough to take it — bounded, so a shape that is really gone still fails.
 */
async function clickUntilOpen(page: Page, point: { x: number; y: number }, card: Locator) {
  await expect(async () => {
    await page.mouse.click(point.x, point.y);
    await expect(card).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

async function mapBox(page: Page): Promise<{ canvas: Locator; box: Box }> {
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  return { canvas, box: (await canvas.boundingBox())! };
}

test("draw a polygon and a circle, and both are saved", async ({ page, request, testMap }) => {
  await mockReverseGeocode(page);
  await page.goto(`/maps/${testMap.id}`);
  const { box } = await mapBox(page);

  const saved = () =>
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/maps/${testMap.id}/shapes`),
    );

  let created = saved();
  await drawPolygon(page, box);
  expect((await created).status()).toBe(201);
  await page.keyboard.press("Escape");

  created = saved();
  await drawCircle(page, box);
  expect((await created).status()).toBe(201);

  const kinds = (await listShapes(request, testMap.id)).map((shape) => shape.geometry.kind).sort();
  expect(kinds).toEqual(["circle", "polygon"]);

  await page.reload();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  expect(await listShapes(request, testMap.id)).toHaveLength(2);
});

test("a shape survives a change of basemap", async ({ page, request, testMap }) => {
  await mockReverseGeocode(page);
  await page.goto(`/maps/${testMap.id}`);
  const { box } = await mapBox(page);

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/maps/${testMap.id}/shapes`),
  );
  await drawPolygon(page, box);
  expect((await created).status()).toBe(201);
  const [shape] = await listShapes(request, testMap.id);
  await page.keyboard.press("Escape");

  // A click inside opens the shape's card — so the layer is there before. Off
  // centre: the centroid carries the "Move this shape" handle, a DOM button.
  const inside = at(box, 0.36, 0.42);
  const card = page.getByRole("dialog", { name: shape.name });
  await clickUntilOpen(page, inside, card);
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  // `setStyle` discards every source and layer; the shapes must be put back.
  await page.getByRole("button", { name: "Map appearance" }).click();
  // The radio is visually hidden inside its swatch; press the swatch.
  const appearance = page.getByRole("dialog", { name: "Map appearance" });
  await appearance.getByTitle("Dark", { exact: true }).click();
  await expect(appearance.getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.keyboard.press("Escape");

  // The switch really happened: it is saved as the map's style.
  await expect
    .poll(async () => {
      const response = await request.get(`/api/maps/${testMap.id}`);
      return ((await response.json()) as { data: { map: { style: string } } }).data.map.style;
    })
    .toBe("dark");
  // Let the new style finish loading; the shapes come back on its `styledata`.
  await page.waitForTimeout(1500);

  await clickUntilOpen(page, inside, card);
});
