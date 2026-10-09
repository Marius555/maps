import { expect, test } from "@playwright/test";

// Signed out: these are what a stranger sees.
test.use({ storageState: { cookies: [], origins: [] } });

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    // "locations" is its own span, so the accessible name reads "locations ,".
    page.getByRole("heading", { level: 1, name: /All your locations\s*, on your own site\./ }),
  ).toBeVisible();
});

test("pricing page renders", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveTitle(/Pricing/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("login and signup pages render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();

  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { level: 1, name: "Create your account" }),
  ).toBeVisible();
});

test("the dashboard sends a signed-out visitor to log in", async ({ page }) => {
  await page.goto("/maps");
  await expect(page).toHaveURL(/\/login\?next=%2Fmaps$/);
});

/**
 * Every static page a stranger can reach from the footer or the docs index.
 * One test walking the list rather than one each: what it catches is a page
 * that no longer renders at all, and that needs no more than a status and a
 * heading.
 */
const PUBLIC_PAGES = [
  "/docs",
  "/docs/getting-started",
  "/docs/importing-locations",
  "/docs/managing-locations",
  "/docs/map-editor",
  "/docs/tags-pins-and-groups",
  "/docs/shapes-and-routes",
  "/docs/designing-the-card",
  "/docs/publishing-and-embedding",
  "/docs/google-sheets-sync",
  "/docs/visitor-analytics",
  "/docs/plans-and-billing",
  "/docs/your-account",
  "/news",
  "/privacy",
  "/terms",
  "/cookies",
  "/dpa",
];

test("every docs, news and legal page renders", async ({ page }) => {
  test.setTimeout(240_000);
  for (const path of PUBLIC_PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
  }
});
