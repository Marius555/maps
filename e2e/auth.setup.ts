import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  expect,
  request as requestFactory,
  test as setup,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";
import { createMap, deleteMap, uniqueMapName } from "./support/api";
import { HAS_ADMIN, HAS_SECOND_ACCOUNT } from "./support/env";
import { ADMIN_AUTH_FILE, AUTH_FILE, SECOND_AUTH_FILE } from "./support/paths";

/**
 * Signs each account in once and saves the session for every other test.
 *
 * **A saved session that still works is reused rather than replaced.** Logins
 * are limited to ten per account per quarter hour (lib/limits/rate.ts), so a
 * setup that signed in afresh every run locked the suite out after a handful of
 * runs in a row — the normal rhythm of writing a test. Sessions last far longer
 * than that, and the probe costs one GET.
 */

type Probe = (request: APIRequestContext) => Promise<boolean>;

const customerSession: Probe = async (request) =>
  (await request.get("/api/auth/me")).status() === 200;

/** The console's pages redirect a stranger to its login; a session gets the page. */
const adminSession: Probe = async (request) => {
  const response = await request.get("/admin", { maxRedirects: 0 });
  return response.status() === 200;
};

setup("log in as the test account", async ({ page, baseURL }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_EMAIL and E2E_PASSWORD in .env to a confirmed test account — see e2e/README.md.",
    );
  }

  if (await reusable(baseURL, AUTH_FILE, customerSession)) {
    await page.context().addCookies(await savedCookies(AUTH_FILE));
  } else {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/maps$/);
  }

  // Turn the onboarding overlays off for this account. With
  // TUTORIAL_ALWAYS_PRESENT on they come back anyway; the fixture handles that.
  const tips = await page.request.post("/api/account/tutorial");
  expect(tips.status()).toBe(204);

  await page.context().storageState({ path: AUTH_FILE });

  // Warm up. `next dev` compiles a route the first time it is asked for, and on
  // a cold server that alone can outlast a test's timeout — so the first run
  // after starting the server failed at random. Ask for each heavy page once,
  // here, where waiting is free.
  setup.setTimeout(300_000);
  const map = await createMap(page.request, uniqueMapName("warmup"));
  try {
    for (const path of [
      `/maps/${map.id}`,
      `/maps/${map.id}/places`,
      `/maps/${map.id}/places/import`,
      `/maps/${map.id}/card`,
      `/maps/${map.id}/publish`,
      `/maps/${map.id}/analytics`,
      "/settings/general",
    ]) {
      await page.goto(path, { timeout: 120_000 });
    }
  } finally {
    await deleteMap(page.request, map.id);
  }
});

/**
 * The second account, for the cross-account checks in api-security.spec.ts.
 * Through the API rather than the form: nothing about its login is under test.
 */
setup("log in as the second test account", async ({ request, baseURL }) => {
  setup.skip(!HAS_SECOND_ACCOUNT, "E2E_EMAIL_2 / E2E_PASSWORD_2 are not set");
  if (await reusable(baseURL, SECOND_AUTH_FILE, customerSession)) return;

  const response = await request.post("/api/auth/login", {
    data: { email: process.env.E2E_EMAIL_2, password: process.env.E2E_PASSWORD_2 },
  });
  expect(response.status(), await response.text()).toBe(200);
  await request.storageState({ path: SECOND_AUTH_FILE });
});

/**
 * The operator console. Its login allows five tries per address per quarter
 * hour, so every admin spec shares this one.
 */
setup("log in to the operator console", async ({ request, baseURL }) => {
  setup.skip(!HAS_ADMIN, "ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set");
  if (await reusable(baseURL, ADMIN_AUTH_FILE, adminSession)) return;

  const response = await request.post("/api/admin/login", {
    data: { email: process.env.ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(204);
  await request.storageState({ path: ADMIN_AUTH_FILE });
});

/** Whether the session saved in `file` is still accepted by the server. */
async function reusable(baseURL: string | undefined, file: string, probe: Probe): Promise<boolean> {
  if (!existsSync(file)) return false;
  const context = await requestFactory.newContext({ baseURL, storageState: file });
  try {
    return await probe(context);
  } finally {
    await context.dispose();
  }
}

async function savedCookies(file: string): Promise<Parameters<BrowserContext["addCookies"]>[0]> {
  const state = JSON.parse(await readFile(file, "utf8")) as {
    cookies: Parameters<BrowserContext["addCookies"]>[0];
  };
  return state.cookies;
}
