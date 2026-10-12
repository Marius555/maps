import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { ADMIN_LOGIN, HAS_ADMIN } from "./support/env";
import { ADMIN_AUTH_FILE, AUTH_FILE } from "./support/paths";

/**
 * The operator console (`/admin`). Its session is its own signed cookie, never
 * a customer's (docs/notes/admin.md), and the first two tests are about that
 * line holding. The console exists while all three ADMIN_* variables are set,
 * or under `next dev` while the development admin (DEV_ADMIN_*) is; without
 * either every page 404s, which is checked instead.
 */
const CONSOLE_EXISTS =
  !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_SESSION_SECRET) ||
  !!(process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD);

test.describe("without an admin session", () => {
  test("a stranger is sent to the console's own login", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const response = await page.goto("/admin");
    if (CONSOLE_EXISTS) {
      await expect(page).toHaveURL(/\/login\/admin$/);
    } else {
      expect(response?.status()).toBe(404);
    }
    await context.close();
  });

  test("a customer's session opens nothing in the console", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_FILE });
    const page = await context.newPage();
    const response = await page.goto("/admin/users");
    if (CONSOLE_EXISTS) {
      await expect(page).toHaveURL(/\/login\/admin$/);
    } else {
      expect(response?.status()).toBe(404);
    }

    // And its API refuses the customer cookie outright.
    const write = await page.request.post("/api/admin/notifications", { data: {} });
    expect([401, 404]).toContain(write.status());
    await context.close();
  });

  test("a wrong password is refused", async ({ request }) => {
    test.skip(!CONSOLE_EXISTS || !ADMIN_LOGIN, "The console is not configured (ADMIN_* / DEV_ADMIN_* unset)");
    // Five tries per address per quarter hour: this spends one.
    const response = await request.post("/api/admin/login", {
      data: { email: ADMIN_LOGIN!.email, password: "definitely-not-the-password" },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("with an admin session", () => {
  test.skip(!HAS_ADMIN, "Set E2E_ADMIN_PASSWORD to the console's password to run these");
  test.use({ storageState: existsSync(ADMIN_AUTH_FILE) ? ADMIN_AUTH_FILE : { cookies: [], origins: [] } });

  // The console's pages have no h1: each opens on a labelled region of figures.
  test("the overview renders", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Right now" })).toBeVisible();
    // The account menu names who is signed in, not the configured admin.
    await expect(page.getByRole("button", { name: "Account menu" })).toContainText(ADMIN_LOGIN!.email.toLowerCase());
  });

  test("the users list finds the test account", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("region", { name: "Accounts" })).toBeVisible();
    const search = page.getByRole("searchbox").or(page.getByRole("textbox", { name: /search/i })).first();
    if (await search.isVisible().catch(() => false)) await search.fill(process.env.E2E_EMAIL!);
    await expect(page.getByText(process.env.E2E_EMAIL!).first()).toBeVisible();
  });

  // A copy of the saved session, in a context of its own: logging out clears the
  // cookie there and leaves the file every other admin spec reads untouched.
  // Not a fresh login — the login allows five tries per quarter hour, and two
  // runs in a row spending one here each was enough to see a 429.
  test("logging out ends the session", async ({ playwright, baseURL }) => {
    const context = await playwright.request.newContext({ baseURL, storageState: ADMIN_AUTH_FILE });
    try {
      expect((await context.get("/admin", { maxRedirects: 0 })).status()).toBe(200);

      const logout = await context.post("/api/admin/logout");
      expect(logout.status()).toBe(204);

      const after = await context.get("/admin", { maxRedirects: 0 });
      expect(after.status()).toBeGreaterThanOrEqual(300);
      expect(after.status()).toBeLessThan(400);
      expect(after.headers().location).toMatch(/\/login\/admin$/);
      expect((await context.post("/api/admin/notifications", { data: {} })).status()).toBe(401);
    } finally {
      await context.dispose();
    }
  });
});
