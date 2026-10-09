import { existsSync } from "node:fs";
import { test as base, expect, type APIRequestContext } from "@playwright/test";
import { createMap, deleteMap, uniqueMapName, type TestMap } from "./api";
import { HAS_ADMIN, HAS_SECOND_ACCOUNT } from "./env";
import { ADMIN_AUTH_FILE, SECOND_AUTH_FILE } from "./paths";
import { dismissTutorials } from "./tutorial";

/**
 * The `test` every authenticated spec imports.
 *
 * - The onboarding overlay ("Getting started") is cleared whenever it appears
 *   (`./tutorial.ts`). With `TUTORIAL_ALWAYS_PRESENT=true` it comes back on
 *   every load, and its scrim takes the clicks a test is about to make.
 * - `testMap` is a fresh, empty map made through the API, deleted afterwards.
 * - `secondUser` and `admin` are API contexts signed in as the second test
 *   account and the operator console, saved by `auth.setup.ts`. Asking for one
 *   skips the test when its env is unset (see `./env.ts`).
 *
 * The fixture callback is `provide`, not Playwright's usual `use`: ESLint's
 * React rules read a function called `use` as a hook.
 */
export const test = base.extend<{
  testMap: TestMap;
  secondUser: APIRequestContext;
  admin: APIRequestContext;
}>({
  page: async ({ page }, provide) => {
    await dismissTutorials(page);
    await provide(page);
  },

  testMap: async ({ request }, provide, testInfo) => {
    const map = await createMap(request, uniqueMapName(testInfo.project.name));
    await provide(map);
    await deleteMap(request, map.id);
  },

  secondUser: async ({ playwright, baseURL }, provide) => {
    base.skip(!HAS_SECOND_ACCOUNT || !existsSync(SECOND_AUTH_FILE), "No second account — set E2E_EMAIL_2 / E2E_PASSWORD_2");
    const context = await playwright.request.newContext({ baseURL, storageState: SECOND_AUTH_FILE });
    await provide(context);
    await context.dispose();
  },

  admin: async ({ playwright, baseURL }, provide) => {
    base.skip(!HAS_ADMIN || !existsSync(ADMIN_AUTH_FILE), "No admin session — set E2E_ADMIN_PASSWORD");
    const context = await playwright.request.newContext({ baseURL, storageState: ADMIN_AUTH_FILE });
    await provide(context);
    await context.dispose();
  },
});

export { expect };
