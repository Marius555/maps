import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HumanCheckError } from "@/lib/repositories/errors";
import { TURNSTILE_HEADER } from "./header";

/**
 * When the check runs, and what it refuses.
 *
 * `lib/env.ts` captures at module load, so the mocked `env` is a mutable object
 * and each case sets it before calling; the site key is read from `process.env`
 * at call time and stubbed per case.
 */

const mockEnv = vi.hoisted(() => ({ turnstileSecretKey: "" }));
vi.mock("@/lib/env", () => ({ env: mockEnv }));

const { assertHuman, turnstileActive } = await import("./human-check");

const request = (token?: string) =>
  new Request("https://pinglide.com/api/auth/signup", {
    method: "POST",
    headers: token ? { [TURNSTILE_HEADER]: token } : {},
  });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  mockEnv.turnstileSecretKey = "";
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("turnstileActive", () => {
  it("is off with neither half configured", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(turnstileActive()).toBe(false);
  });

  it("is off with only one half, so a missing site key can never refuse every signup", () => {
    mockEnv.turnstileSecretKey = "secret";
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    expect(turnstileActive()).toBe(false);

    mockEnv.turnstileSecretKey = "";
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "sitekey");
    expect(turnstileActive()).toBe(false);
  });

  it("is on with both", () => {
    mockEnv.turnstileSecretKey = "secret";
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "sitekey");
    expect(turnstileActive()).toBe(true);
  });
});

describe("assertHuman", () => {
  it("lets everything through, without asking Cloudflare, while the check is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");

    await expect(assertHuman(request())).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("while on", () => {
    beforeEach(() => {
      mockEnv.turnstileSecretKey = "secret";
      vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "sitekey");
    });

    it("refuses a request with no token", async () => {
      await expect(assertHuman(request())).rejects.toBeInstanceOf(HumanCheckError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a token Cloudflare rejects, with a 403 the form can show", async () => {
      fetchMock.mockResolvedValue(
        Response.json({ success: false, "error-codes": ["invalid-input-response"] }),
      );

      const refusal = await assertHuman(request("forged")).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(HumanCheckError);
      expect(refusal).toMatchObject({ code: "human_check_failed", status: 403 });
    });

    it("accepts a token Cloudflare accepts", async () => {
      fetchMock.mockResolvedValue(Response.json({ success: true }));

      await expect(assertHuman(request("good"))).resolves.toBeUndefined();
    });

    it("lets the request through when Cloudflare is down", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      await expect(assertHuman(request("any"))).resolves.toBeUndefined();
    });
  });
});
