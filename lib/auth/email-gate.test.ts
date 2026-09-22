import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertEmailVerified, readsAsVerified } from "./email-gate";
import type { AuthUser } from "./types";

/**
 * The confirm-your-address gate, and the development switch that opens it.
 *
 * `lib/api/route.test.ts` covers the gate through `withAuth` — which methods are
 * refused, and that an install with no Resend key is never gated. This file is
 * about the other switch: `DISABLE_EMAIL_VERIFICATION`, tested because it is a
 * gate bypass set by an environment variable. The property worth a regression
 * test is the default — absent means enforced — and the second one is that no
 * value at all opens it in a production build.
 *
 * The env is stubbed and the module is left alone, because `email-gate.ts` reads
 * `process.env` at call time. `lib/env.ts` is the one that captures at module
 * load, which is why `route.test.ts` reloads modules for every case and this only
 * does so for the one that counts a once-per-process warning.
 */

vi.mock("@/lib/env", () => ({ env: { resendApiKey: "re_test" } }));

const UNVERIFIED: AuthUser = {
  id: "user-1",
  email: "someone@example.com",
  name: "Someone",
  emailVerified: false,
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("readsAsVerified", () => {
  it("passes a confirmed address through untouched", () => {
    expect(readsAsVerified(true)).toBe(true);
  });

  it("leaves an unconfirmed one unconfirmed by default", () => {
    expect(readsAsVerified(false)).toBe(false);
  });

  it("reads an unconfirmed address as confirmed when the switch is set", () => {
    for (const value of ["1", "true", "yes", "TRUE", " yes "]) {
      vi.stubEnv("DISABLE_EMAIL_VERIFICATION", value);
      expect(readsAsVerified(false)).toBe(true);
    }
  });

  it("stays shut for anything that is not an affirmative", () => {
    for (const value of ["", "0", "false", "no", "maybe"]) {
      vi.stubEnv("DISABLE_EMAIL_VERIFICATION", value);
      expect(readsAsVerified(false)).toBe(false);
    }
  });

  it("stays shut when it is not set at all", () => {
    vi.stubEnv("DISABLE_EMAIL_VERIFICATION", undefined);
    expect(readsAsVerified(false)).toBe(false);
  });

  /*
   * The property the whole switch rests on. A note asking somebody to unset it
   * before launch is a plan; refusing to read it outside development is a
   * guarantee — the same argument `DISABLE_ALL_PLAN` makes.
   */
  it("is inert in a production build whatever it is set to", () => {
    vi.stubEnv("NODE_ENV", "production");

    for (const value of ["1", "true", "yes"]) {
      vi.stubEnv("DISABLE_EMAIL_VERIFICATION", value);
      expect(readsAsVerified(false)).toBe(false);
    }
  });

  /*
   * A fresh copy of the module, because `warned` is per process and a case above
   * has already spent it. That is the behaviour being asserted, not a nuisance:
   * `getCurrentUser` is `cache()`d per request, and a warning that printed once
   * per page load would stop being read as one.
   */
  it("says so, once, rather than skipping confirmation silently", async () => {
    vi.stubEnv("DISABLE_EMAIL_VERIFICATION", "1");
    vi.resetModules();
    const gate = await import("./email-gate");

    gate.readsAsVerified(false);
    gate.readsAsVerified(false);
    gate.readsAsVerified(false);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain(
      "DISABLE_EMAIL_VERIFICATION",
    );
  });
});

describe("assertEmailVerified", () => {
  /*
   * The switch does not reach this function and must not: it changes what
   * `emailVerified` resolves to, one level up, so every rule below keeps running
   * exactly as written. These cases are here to say that out loud.
   */

  it("refuses a write from an unconfirmed account", () => {
    expect(() => {
      assertEmailVerified(UNVERIFIED, "POST");
    }).toThrowError(expect.objectContaining({ code: "email_unverified" }));
  });

  it("never gates a read", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(() => {
        assertEmailVerified(UNVERIFIED, method);
      }).not.toThrow();
    }
  });

  it("still refuses a write with the development switch set, because the switch is not here", () => {
    vi.stubEnv("DISABLE_EMAIL_VERIFICATION", "1");

    expect(() => {
      assertEmailVerified(UNVERIFIED, "POST");
    }).toThrowError(expect.objectContaining({ code: "email_unverified" }));

    // What the switch actually does, at the one point the value is resolved.
    expect(() => {
      assertEmailVerified(
        { ...UNVERIFIED, emailVerified: readsAsVerified(false) },
        "POST",
      );
    }).not.toThrow();
  });
});
