import { expect, test } from "@playwright/test";
import { VERIFICATION_DISABLED } from "./support/env";

/**
 * An account that has not confirmed its address can read and cannot write —
 * one check in `withAuth`, no exemption list (docs/notes/auth.md).
 *
 * Needs an account that has signed up and **never** clicked its link
 * (`E2E_UNVERIFIED_EMAIL` / `E2E_UNVERIFIED_PASSWORD`), and a server without
 * `DISABLE_EMAIL_VERIFICATION`, which reads every account as confirmed. The gate
 * also switches itself off when `RESEND_API_KEY` is unset.
 */
const email = process.env.E2E_UNVERIFIED_EMAIL;
const password = process.env.E2E_UNVERIFIED_PASSWORD;

test.skip(!email || !password, "E2E_UNVERIFIED_EMAIL / E2E_UNVERIFIED_PASSWORD are not set");
test.skip(VERIFICATION_DISABLED, "DISABLE_EMAIL_VERIFICATION is on — see e2e/README.md");
test.use({ storageState: { cookies: [], origins: [] } });

test("an unconfirmed account reads, sees why, and cannot write", async ({ page }) => {
  const login = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(login.status(), await login.text()).toBe(200);

  // Reads stay open, so the page explaining the freeze can render.
  expect((await page.request.get("/api/maps")).status()).toBe(200);
  await page.goto("/maps");
  await expect(page.getByText("Confirm your email to start building")).toBeVisible();

  // Every write is refused, by the same code.
  const create = await page.request.post("/api/maps", { data: { name: "e2e-unverified" } });
  expect(create.status()).toBe(403);
  const { error } = (await create.json()) as { error: { code: string } };
  expect(error.code).toBe("email_unverified");

  const profile = await page.request.patch("/api/account/profile", { data: { name: "e2e" } });
  expect(profile.status()).toBe(403);
});
