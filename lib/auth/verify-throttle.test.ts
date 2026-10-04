import { describe, expect, it, vi } from "vitest";

// Only the pure halves are tested; the stamp is two SDK calls.
vi.mock("@/lib/appwrite/admin", () => ({ admin: {} }));

import { mayResendVerification, withSendStamped } from "./verify-throttle";

const NOW = new Date("2026-10-04T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("mayResendVerification", () => {
  it("allows the first link", () => {
    expect(mayResendVerification({}, NOW)).toBe(true);
    expect(mayResendVerification(undefined, NOW)).toBe(true);
  });

  it("refuses a second link inside a minute", () => {
    expect(mayResendVerification({ verifyEmailSentAt: [ago(30_000)] }, NOW)).toBe(false);
  });

  it("allows one once the minute has passed", () => {
    expect(mayResendVerification({ verifyEmailSentAt: [ago(61_000)] }, NOW)).toBe(true);
  });

  it("refuses a sixth link in a day", () => {
    const five = [5, 4, 3, 2, 1].map((h) => ago(h * HOUR));
    expect(mayResendVerification({ verifyEmailSentAt: five }, NOW)).toBe(false);
  });

  it("forgets sends older than a day", () => {
    const old = [30, 29, 28, 27, 26].map((h) => ago(h * HOUR));
    expect(mayResendVerification({ verifyEmailSentAt: old }, NOW)).toBe(true);
  });

  it("ignores a pref it cannot read", () => {
    expect(mayResendVerification({ verifyEmailSentAt: "yesterday" }, NOW)).toBe(true);
    expect(mayResendVerification({ verifyEmailSentAt: [42, "nope"] }, NOW)).toBe(true);
  });
});

describe("withSendStamped", () => {
  it("appends this send", () => {
    expect(withSendStamped({}, NOW)).toEqual([NOW.toISOString()]);
  });

  it("keeps the last five and drops anything a day old", () => {
    const stamps = [30, 5, 4, 3, 2, 1].map((h) => ago(h * HOUR));
    const next = withSendStamped({ verifyEmailSentAt: stamps }, NOW);

    expect(next).toHaveLength(5);
    expect(next.at(-1)).toBe(NOW.toISOString());
    expect(next).not.toContain(ago(30 * HOUR));
    expect(next).not.toContain(ago(5 * HOUR));
  });
});
