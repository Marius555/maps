import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RepositoryError } from "@/lib/repositories/errors";
import { resetThrottles, throttle } from "./throttle";

/**
 * The limiter in front of the two routes that will mail a stranger on request.
 *
 * Worth a test because both of its failure modes are silent: too strict and a
 * real user cannot reset their password, too loose and one person's button-press
 * becomes someone else's inbox problem. Neither shows up by looking at the page.
 */

const OPTIONS = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  resetThrottles();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("throttle", () => {
  it("allows exactly the limit within a window", () => {
    for (let attempt = 0; attempt < OPTIONS.limit; attempt += 1) {
      expect(() => throttle({ key: "a@b.co", ...OPTIONS })).not.toThrow();
    }
  });

  it("refuses the one after that", () => {
    for (let attempt = 0; attempt < OPTIONS.limit; attempt += 1) {
      throttle({ key: "a@b.co", ...OPTIONS });
    }

    expect(() => throttle({ key: "a@b.co", ...OPTIONS })).toThrow(RepositoryError);
  });

  it("refuses with rate_limited and a 429", () => {
    for (let attempt = 0; attempt < OPTIONS.limit; attempt += 1) {
      throttle({ key: "a@b.co", ...OPTIONS });
    }

    try {
      throttle({ key: "a@b.co", ...OPTIONS });
      expect.unreachable("should have thrown");
    } catch (error) {
      const repositoryError = error as RepositoryError;
      expect(repositoryError.code).toBe("rate_limited");
      expect(repositoryError.status).toBe(429);
      // CLAUDE.md §8: say what happened and what to do, so the wait is named.
      expect(repositoryError.message).toMatch(/try again in \d+ (seconds|minutes)/i);
    }
  });

  it("counts each key separately", () => {
    // The property that matters most: one person hammering the form must not be
    // able to lock everyone else out of resetting their own password.
    for (let attempt = 0; attempt < OPTIONS.limit; attempt += 1) {
      throttle({ key: "noisy@b.co", ...OPTIONS });
    }

    expect(() => throttle({ key: "quiet@b.co", ...OPTIONS })).not.toThrow();
  });

  it("forgives once the window has passed", () => {
    for (let attempt = 0; attempt < OPTIONS.limit; attempt += 1) {
      throttle({ key: "a@b.co", ...OPTIONS });
    }

    vi.advanceTimersByTime(OPTIONS.windowMs + 1);

    expect(() => throttle({ key: "a@b.co", ...OPTIONS })).not.toThrow();
  });
});
