import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAccounts, devAdminConfig } from "./config";
import { signAdminSession, verifyAdminSession } from "./session";

/**
 * The development admin (`DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD`), tested
 * because it is a way into the operator console set by an environment variable.
 * The property that matters most is the last describe: no value opens it in a
 * production build.
 *
 * `config.ts` reads the dev values from `process.env` at call time, so they are
 * stubbed per case; the real admin comes from `lib/env`, mocked here as unset.
 */

vi.mock("@/lib/env", () => ({
  env: { adminEmail: "", adminPasswordHash: "", adminSessionSecret: "" },
}));

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("ADMIN_EMAIL", "");
  vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("DEV_ADMIN_EMAIL", "E2E-Admin@pinglide.test");
  vi.stubEnv("DEV_ADMIN_PASSWORD", "correct horse battery staple");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("devAdminConfig in development", () => {
  it("is an account under the lower-cased address", () => {
    expect(devAdminConfig()?.email).toBe("e2e-admin@pinglide.test");
    expect(adminAccounts().map((account) => account.email)).toEqual(["e2e-admin@pinglide.test"]);
  });

  it("accepts its password and nothing else", async () => {
    const account = devAdminConfig()!;
    expect(await account.checkPassword("correct horse battery staple")).toBe(true);
    expect(await account.checkPassword("correct horse battery stapl")).toBe(false);
    expect(await account.checkPassword("")).toBe(false);
  });

  it("signs sessions that verify on a later read of the config", () => {
    const token = signAdminSession(devAdminConfig()!);
    expect(verifyAdminSession(token, devAdminConfig()!)).toBe(true);
  });

  it("derives a stable secret when ADMIN_SESSION_SECRET is unset", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    vi.stubEnv("APPWRITE_API_KEY", "key");
    const token = signAdminSession(devAdminConfig()!);
    expect(devAdminConfig()!.secret.length).toBeGreaterThanOrEqual(32);
    expect(verifyAdminSession(token, devAdminConfig()!)).toBe(true);
  });

  it("signs its sessions out when the password changes", () => {
    const token = signAdminSession(devAdminConfig()!);
    vi.stubEnv("DEV_ADMIN_PASSWORD", "another password");
    expect(verifyAdminSession(token, devAdminConfig()!)).toBe(false);
  });

  it.each([
    ["DEV_ADMIN_EMAIL", ""],
    ["DEV_ADMIN_PASSWORD", ""],
  ])("is absent with %s unset", (name, value) => {
    vi.stubEnv(name, value);
    expect(devAdminConfig()).toBeNull();
    expect(adminAccounts()).toEqual([]);
  });

  it("is absent when it would share the real admin's address", () => {
    vi.stubEnv("ADMIN_EMAIL", "e2e-admin@pinglide.test");
    expect(devAdminConfig()).toBeNull();
  });
});

describe("devAdminConfig in a production build", () => {
  it("is absent whatever is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(devAdminConfig()).toBeNull();
    expect(adminAccounts()).toEqual([]);
  });
});
