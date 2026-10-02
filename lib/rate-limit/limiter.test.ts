import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMITS } from "@/lib/limits/rate";
import { RateLimitError, RepositoryError } from "@/lib/repositories/errors";
import { inFlight, rateLimit, resetRateLimits } from "./limiter";

/**
 * The limiter in front of every route.
 *
 * Worth a test because both of its failure modes are silent: too strict and a
 * real user cannot import a file or reset a password, too loose and one script
 * becomes everybody's outage. Neither shows up by looking at the page.
 */

beforeEach(() => {
  resetRateLimits();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const { limit, windowMs } = RATE_LIMITS.signup;

describe("rateLimit", () => {
  it("lets the policy's limit through", () => {
    for (let i = 0; i < limit; i += 1) {
      expect(() => rateLimit("signup", "1.2.3.4")).not.toThrow();
    }
  });

  it("refuses the next one with rate_limited, a 429 and how long to wait", () => {
    for (let i = 0; i < limit; i += 1) rateLimit("signup", "1.2.3.4");

    try {
      rateLimit("signup", "1.2.3.4");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error).toBeInstanceOf(RepositoryError);

      const refused = error as RateLimitError;
      expect(refused.code).toBe("rate_limited");
      expect(refused.status).toBe(429);
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
      expect(refused.retryAfterSeconds).toBeLessThanOrEqual(windowMs / 1000);
      expect(refused.message).toMatch(/Try again in \d+ (seconds?|minutes?)\./);
    }
  });

  it("counts each caller separately", () => {
    for (let i = 0; i < limit; i += 1) rateLimit("signup", "noisy");

    expect(() => rateLimit("signup", "noisy")).toThrow(RateLimitError);
    expect(() => rateLimit("signup", "quiet")).not.toThrow();
  });

  it("counts each policy separately for the same caller", () => {
    for (let i = 0; i < limit; i += 1) rateLimit("signup", "same");

    expect(() => rateLimit("signup", "same")).toThrow(RateLimitError);
    expect(() => rateLimit("login", "same")).not.toThrow();
  });

  it("forgives once the window has passed", () => {
    for (let i = 0; i < limit; i += 1) rateLimit("signup", "1.2.3.4");

    vi.advanceTimersByTime(windowMs + 1);

    expect(() => rateLimit("signup", "1.2.3.4")).not.toThrow();
  });
});

describe("inFlight", () => {
  it("refuses past the maximum until a slot is released", () => {
    const release = inFlight("metered:user-1", 1);

    expect(() => inFlight("metered:user-1", 1)).toThrow(RateLimitError);

    release();

    expect(() => inFlight("metered:user-1", 1)).not.toThrow();
  });

  it("releases once, however many times release is called", () => {
    const first = inFlight("k", 2);
    const second = inFlight("k", 2);

    first();
    first();

    // Only one slot came back: a second is still held.
    expect(() => inFlight("k", 2)).not.toThrow();
    expect(() => inFlight("k", 2)).toThrow(RateLimitError);

    second();
  });

  it("keeps callers apart", () => {
    inFlight("metered:a", 1);

    expect(() => inFlight("metered:b", 1)).not.toThrow();
  });
});

describe("RATE_LIMITS", () => {
  /*
   * A 3,000-row import is 120 geocode batches and 15 bulk writes, sent one after
   * another. If the defaults ever tighten past that, the biggest customer we have
   * is the first one refused.
   */
  it("leaves room for a full Pro import", () => {
    expect(RATE_LIMITS.write.limit).toBeGreaterThanOrEqual(60);
    expect(RATE_LIMITS.metered.limit).toBeGreaterThanOrEqual(30);
  });
});
