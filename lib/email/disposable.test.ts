import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/env.ts` calls `required()` at module load, so importing anything that
 * reaches it throws under vitest. Same three placeholders `resend.test.ts` sets,
 * for the same reason: nothing here uses them, they exist so the import resolves.
 */
process.env.APPWRITE_API_KEY ||= "test-key";
process.env.DATABASE_ID ||= "test-database";
process.env.STORAGE_ID ||= "test-storage";

const ORIGINAL_ALLOWLIST = process.env.EMAIL_DOMAIN_ALLOWLIST;

/**
 * The list itself is somebody else's data and is regenerated on a schedule, so
 * nothing here asserts a count or a particular entry beyond the handful that have
 * been on every version of it for a decade. What is tested is the *matching*:
 * a rule that is wrong about a subdomain, or about case, refuses a real customer
 * or waves a throwaway through, and neither shows up in a type check.
 */
describe("isDisposableDomain", () => {
  let isDisposableDomain: typeof import("./disposable").isDisposableDomain;

  beforeEach(async () => {
    ({ isDisposableDomain } = await import("./disposable"));
  });

  it("matches a domain on the list", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("yopmail.com")).toBe(true);
  });

  it("matches a subdomain of one, so a provider is one entry and not thousands", () => {
    expect(isDisposableDomain("inbox.mailinator.com")).toBe(true);
    expect(isDisposableDomain("a.b.c.mailinator.com")).toBe(true);
  });

  it("ignores case, whitespace and a fully-qualified trailing dot", () => {
    expect(isDisposableDomain("  MailInator.COM. ")).toBe(true);
  });

  it("lets the real providers our customers actually use through", () => {
    for (const domain of [
      "gmail.com",
      "outlook.com",
      "hotmail.com",
      "yahoo.com",
      "icloud.com",
      "proton.me",
      "gmx.de",
      "web.de",
      "qq.com",
    ]) {
      expect(isDisposableDomain(domain), domain).toBe(false);
    }
  });

  it("does not judge a plus-addressed mailbox by its tag", async () => {
    // The tag is in the local part and never reaches here, but the point is
    // worth pinning: `ada+throwaway@gmail.com` is an ordinary Gmail address and
    // refusing one would be refusing the people who are most careful — including
    // when the tag itself names a domain on the list.
    const { emailDomain } = await import("./disposable");

    expect(emailDomain("ada+mailinator.com@gmail.com")).toBe("gmail.com");
    expect(isDisposableDomain(emailDomain("ada+throwaway@gmail.com"))).toBe(false);
  });

  it("stops at two labels, so nothing is ever matched on a bare TLD", () => {
    expect(isDisposableDomain("com")).toBe(false);
    expect(isDisposableDomain("")).toBe(false);
  });

  it("takes EMAIL_DOMAIN_ALLOWLIST over the list, including for subdomains", async () => {
    process.env.EMAIL_DOMAIN_ALLOWLIST = "mailinator.com, example.test";
    const fresh = await freshModule();

    expect(fresh.isDisposableDomain("mailinator.com")).toBe(false);
    expect(fresh.isDisposableDomain("inbox.mailinator.com")).toBe(false);
    // Un-blocking one domain must not un-block the rest of the list.
    expect(fresh.isDisposableDomain("yopmail.com")).toBe(true);
  });
});

describe("emailDomain", () => {
  it("takes the part after the last @, normalised", async () => {
    const { emailDomain } = await import("./disposable");

    expect(emailDomain("Ada@Example.COM")).toBe("example.com");
    // A quoted local part may legally contain an @; the last one wins.
    expect(emailDomain('"a@b"@example.com')).toBe("example.com");
  });

  it("is empty for anything without one, rather than guessing", async () => {
    const { emailDomain } = await import("./disposable");

    expect(emailDomain("not-an-address")).toBe("");
    expect(emailDomain("")).toBe("");
  });
});

/** `env` is read at module load, so a changed variable needs a re-import. */
async function freshModule() {
  vi.resetModules();

  return import("./disposable");
}

afterEach(() => {
  if (ORIGINAL_ALLOWLIST === undefined) delete process.env.EMAIL_DOMAIN_ALLOWLIST;
  else process.env.EMAIL_DOMAIN_ALLOWLIST = ORIGINAL_ALLOWLIST;
});
