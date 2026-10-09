import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./e2e/support/paths";

/**
 * End-to-end tests: the flows CLAUDE.md §3 names (signup, CSV import, publish,
 * embed loads) plus cheap smoke checks. Unit tests stay in Vitest.
 *
 * They run against `next dev` and the real Appwrite project in `.env`, signed in
 * as a dedicated test account (`E2E_EMAIL` / `E2E_PASSWORD`). Every map a test
 * makes is named `e2e-…` and deleted afterwards; `globalTeardown` sweeps any a
 * crashed run left behind. Setup steps: `e2e/README.md`.
 */
if (existsSync(".env")) process.loadEnvFile(".env");

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // A cold `next dev` compiles each route on first visit, which routinely
  // takes longer than Playwright's 30s default.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Two, not one per core: every worker is another tab compiling routes on the
  // same dev server, and the account shares one write rate limit.
  workers: 2,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  globalTeardown: "./e2e/support/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /mobile-editor\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
    {
      // Mobile layout only where it is the thing being tested: the public pages
      // and the maps list. The editor's drag-and-drop is a desktop gesture.
      name: "mobile",
      testMatch: /(public|maps)\.spec\.ts/,
      use: { ...devices["Pixel 7"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
    {
      // The editor at phone width: its sheet, search-to-add and publish. No
      // drag gestures — those are desktop-shaped and covered there.
      name: "mobile-editor",
      testMatch: /mobile-editor\.spec\.ts/,
      use: { ...devices["Pixel 7"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
