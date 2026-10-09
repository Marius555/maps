import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { HAS_ADMIN } from "./support/env";
import { ADMIN_AUTH_FILE, AUTH_FILE } from "./support/paths";

/**
 * The operator console (`/admin`). Its session is its own signed cookie, never
 * a customer's (docs/notes/admin.md), and the first two tests are about that
 * line holding. The console exists only while all three ADMIN_* variables are
 * set; without them every page 404s, which is checked instead.
 */
const CONSOLE_EXISTS = !!(
  process.env.ADMIN_EMAIL &&
  process.env.ADMIN_PASSWORD_HASH &&
  process.env.ADMIN_SESSION_SECRET
);

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
    test.skip(!CONSOLE_EXISTS, "The console is not configured (ADMIN_* unset)");
    // Five tries per address per quarter hour: this spends one.
    const response = await request.post("/api/admin/login", {
      data: { email: process.env.ADMIN_EMAIL, password: "definitely-not-the-password" },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("with an admin session", () => {
  test.skip(!HAS_ADMIN, "Set E2E_ADMIN_PASSWORD to the console's password to run these");
  test.use({ storageState: existsSync(ADMIN_AUTH_FILE) ? ADMIN_AUTH_FILE : { cookies: [], origins: [] } });

  test("the overview renders", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("the users list finds the test account", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const search = page.getByRole("searchbox").or(page.getByRole("textbox", { name: /search/i })).first();
    if (await search.isVisible().catch(() => false)) await search.fill(process.env.E2E_EMAIL!);
    await expect(page.getByText(process.env.E2E_EMAIL!).first()).toBeVisible();
  });
});
