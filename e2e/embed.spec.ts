import { existsSync } from "node:fs";
import type { APIRequestContext, Page, Request } from "@playwright/test";
import {
  addPlace,
  createMap,
  deleteMap,
  embedTestPage,
  publishMap,
  readSnapshot,
  uniqueMapName,
  updateMap,
  updatePlace,
  type TestMap,
} from "./support/api";
import { AUTH_FILE } from "./support/paths";
import { expect, test } from "./support/fixtures";

/**
 * The published map as a visitor gets it: the real bundle (`/embed/live.html`)
 * against the real snapshot on the CDN.
 *
 * One map, published once and shared, because publishing is limited to twenty
 * per account per ten minutes (lib/limits/rate.ts) and every test here would
 * otherwise spend one. Serial, and ordered so the tests that change the map
 * (rename, design, allowlist) come after the ones that only read it.
 */
test.describe.configure({ mode: "serial" });
test.skip(!existsSync("public/embed/map.js"), "Run `npm run build:embed` first — public/embed/map.js is missing.");

const APPWRITE_HOST = new URL(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "http://appwrite.invalid").host;

let owner: APIRequestContext;
let map: TestMap;
let snapshotUrl: string;
const ids: Record<string, string> = {};

test.beforeAll(async ({ playwright }, testInfo) => {
  owner = await playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: AUTH_FILE,
  });
  map = await createMap(owner, uniqueMapName("embed"));
  await updateMap(owner, map.id, {
    tagGroups: [
      {
        id: "kind",
        label: "Kind",
        tags: [
          { id: "shop", label: "Shop", color: "#e11d48" },
          { id: "cafe", label: "Cafe", color: "#2563eb" },
        ],
      },
    ],
  });
  for (const place of [
    { name: "E2E Alpha", lat: 54.6872, lng: 25.2797, tags: ["shop"], address: "Gedimino pr. 9", phone: "+37060000000" },
    { name: "E2E Beta", lat: 54.8985, lng: 23.9036, tags: ["cafe"] },
    { name: "E2E Gamma", lat: 55.7033, lng: 21.1443 },
  ]) {
    ids[place.name] = (await addPlace(owner, map.id, place)).id;
  }
  snapshotUrl = await publishMap(owner, map.id);
});

test.afterAll(async () => {
  await deleteMap(owner, map.id);
  await owner.dispose();
});

/** Opens the harness and waits for the map, recording every request it makes. */
async function openEmbed(page: Page, tags: string[] = []): Promise<Request[]> {
  const requests: Request[] = [];
  page.on("request", (request) => requests.push(request));
  await page.goto(embedTestPage(snapshotUrl, tags));
  await expect(page.locator(".lm-root .maplibregl-canvas")).toBeVisible();
  return requests;
}

const rows = (page: Page) => page.getByRole("list", { name: "Locations" }).getByRole("listitem");

/** §2: a visitor's map may fetch static files, never our API or our database. */
function metered(requests: Request[]): string[] {
  return requests
    .map((request) => request.url())
    .filter((url) => url.includes("/api/") || new URL(url).host === APPWRITE_HOST);
}

test("the published map draws every location, credits the map data, and calls nothing metered", async ({
  page,
}) => {
  const requests = await openEmbed(page);
  await expect(rows(page)).toHaveCount(3);

  // §12: attribution on every rendered map. It is in the DOM even where a
  // floating panel covers it (CLAUDE.md §0 records that bend).
  const attribution = page.locator(".lm-root .maplibregl-ctrl-attrib-inner");
  await expect(attribution).toContainText("OpenStreetMap");
  await expect(attribution).toContainText("OpenFreeMap");

  expect(metered(requests)).toEqual([]);
});

test("search narrows by name and by tag, without asking a server", async ({ page }) => {
  const requests = await openEmbed(page);
  const before = requests.length;
  const search = page.getByRole("combobox", { name: "Search locations" });

  await search.fill("alpha");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("E2E Alpha");

  // Tag labels are in the search index; there are no filter chips (embed/src/index.ts).
  await search.fill("cafe");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("E2E Beta");

  await search.fill("");
  await expect(rows(page)).toHaveCount(3);

  expect(metered(requests.slice(before))).toEqual([]);
});

test("a snippet's tag choice shows only those locations", async ({ page }) => {
  await openEmbed(page, ["shop"]);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("E2E Alpha");
});

test("a republish updates the same live URL a snippet already carries", async ({ page }) => {
  await updatePlace(owner, map.id, ids["E2E Gamma"], { name: "E2E Gamma Renamed" });
  expect(await publishMap(owner, map.id)).toBe(snapshotUrl);

  const snapshot = await readSnapshot(owner, snapshotUrl);
  expect(snapshot.places.map((place) => place.name)).toContain("E2E Gamma Renamed");

  // The page reads it through the edge cache, which holds `live.json` for up to
  // a minute (lib/snapshot/r2-store.ts) — so only the file is asserted on, not
  // the page, which may honestly still be showing the previous copy.
  await openEmbed(page);
  await expect(rows(page)).toHaveCount(3);
});

test("the publish designer's choices reach the embed", async ({ page }) => {
  await page.goto(`/maps/${map.id}/publish`);

  const savedDesign = () =>
    page.waitForResponse(
      (response) => response.request().method() === "PATCH" && response.url().endsWith(`/api/maps/${map.id}`),
    );

  // Search off.
  await page.getByRole("button", { name: "Map controls", exact: true }).click();
  let saved = savedDesign();
  await page.getByRole("group", { name: "Map controls" }).getByRole("button", { name: "Search box" }).click();
  expect((await saved).ok()).toBe(true);

  // A row opens its card.
  await page.getByRole("button", { name: "Results panel", exact: true }).click();
  saved = savedDesign();
  await page.getByRole("group", { name: "Results panel" }).getByText("Open a card when a row is clicked").click();
  expect((await saved).ok()).toBe(true);

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible();

  const snapshot = await readSnapshot(owner, snapshotUrl);
  expect(snapshot.settings).toMatchObject({ search: false, rowCard: true });

  // Cache-busted for the same reason as readSnapshot: the edge may hold the old file.
  await page.goto(embedTestPage(`${snapshotUrl}?e2e=${Date.now()}`));
  await expect(page.locator(".lm-root .maplibregl-canvas")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search locations" })).toHaveCount(0);

  await page.getByRole("button", { name: /^E2E Alpha/ }).click();
  const card = page.locator(".lm-root .maplibregl-popup");
  await expect(card).toBeVisible();
  await expect(card).toContainText("E2E Alpha");
  await expect(card).toContainText("Gedimino pr. 9");
});

test("a site that is not on the allowlist gets no map", async ({ page }) => {
  await updateMap(owner, map.id, { allowedDomains: ["example.com"] });
  await publishMap(owner, map.id);

  const warnings: string[] = [];
  page.on("console", (message) => warnings.push(message.text()));
  await page.goto(embedTestPage(`${snapshotUrl}?e2e=${Date.now()}`));

  await expect.poll(() => warnings.some((text) => text.includes("isn't allowed on localhost"))).toBe(true);
  await expect(page.locator(".lm-root .maplibregl-canvas")).toHaveCount(0);
});
