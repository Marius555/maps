import { expect, test } from "@playwright/test";
import { dismissTutorials } from "./support/tutorial";

// Each of these starts signed out. Logout in particular must not use the shared
// session: logging out deletes it on the server, and every later test with it.
test.use({ storageState: { cookies: [], origins: [] } });

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(page.getByText("Couldn't log in").first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("signup refuses a throwaway address without creating an account", { tag: "@smoke" }, async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`e2e-${Date.now()}@mailinator.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-long-enough-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByText("We can't create an account with this email. Try a different one."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup/);
});

test("log in, then log out", { tag: "@smoke" }, async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL, "E2E_EMAIL is not set");

  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/maps$/);

  // The onboarding overlay may cover the menu.
  await dismissTutorials(page);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // And the session is really gone, not just the page.
  await page.goto("/maps");
  await expect(page).toHaveURL(/\/login\?next=/);
});
