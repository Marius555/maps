import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_ENTRIES,
  TTL_MS,
  clearIdentityCache,
  forgetSession,
  forgetUser,
  identityCacheKeys,
  readCachedUser,
  rememberUser,
} from "./identity-cache";
import type { AuthUser } from "./types";

function user(id: string): AuthUser {
  return { id, email: `${id}@example.com`, name: id, emailVerified: true };
}

describe("identity cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearIdentityCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers a remembered secret until the TTL runs out", () => {
    rememberUser("secret-a", user("a"));

    vi.advanceTimersByTime(TTL_MS - 1);
    expect(readCachedUser("secret-a")).toEqual(user("a"));

    vi.advanceTimersByTime(1);
    expect(readCachedUser("secret-a")).toBeNull();
  });

  it("knows nothing about a secret it was never given", () => {
    rememberUser("secret-a", user("a"));

    expect(readCachedUser("secret-b")).toBeNull();
  });

  it("forgets one session without touching the account's others", () => {
    rememberUser("phone", user("a"));
    rememberUser("laptop", user("a"));

    forgetSession("phone");

    expect(readCachedUser("phone")).toBeNull();
    expect(readCachedUser("laptop")).toEqual(user("a"));
  });

  it("forgets every session of one account and nobody else's", () => {
    rememberUser("phone", user("a"));
    rememberUser("laptop", user("a"));
    rememberUser("other", user("b"));

    forgetUser("a");

    expect(readCachedUser("phone")).toBeNull();
    expect(readCachedUser("laptop")).toBeNull();
    expect(readCachedUser("other")).toEqual(user("b"));
  });

  it("never stores the secret itself", () => {
    rememberUser("the-raw-secret", user("a"));

    const keys = identityCacheKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("the-raw-secret");
  });

  it("stays bounded: expired entries are swept, then the oldest goes", () => {
    for (let i = 0; i < MAX_ENTRIES; i += 1) rememberUser(`s${i}`, user(`u${i}`));
    expect(identityCacheKeys()).toHaveLength(MAX_ENTRIES);

    // All live: the oldest makes room.
    rememberUser("newest", user("n"));
    expect(identityCacheKeys()).toHaveLength(MAX_ENTRIES);
    expect(readCachedUser("s0")).toBeNull();
    expect(readCachedUser("newest")).toEqual(user("n"));

    // All expired: one sweep empties the lot.
    vi.advanceTimersByTime(TTL_MS);
    rememberUser("after", user("x"));
    expect(identityCacheKeys()).toHaveLength(1);
  });
});
