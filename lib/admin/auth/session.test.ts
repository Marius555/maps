import { describe, expect, it } from "vitest";

import { ADMIN_SESSION_TTL_MS, signAdminSession, verifyAdminSession, type AdminConfig } from "./session";

const CONFIG: AdminConfig = {
  email: "admin@example.com",
  passwordHash: "scrypt:32768:8:1:c2FsdA:aGFzaA",
  secret: "x".repeat(48),
};

const NOW = Date.parse("2026-09-29T12:00:00Z");

describe("admin session tokens", () => {
  it("verifies a token it signed", () => {
    expect(verifyAdminSession(signAdminSession(CONFIG, NOW), CONFIG, NOW + 1000)).toBe(true);
  });

  it("refuses a missing or malformed token", () => {
    expect(verifyAdminSession(undefined, CONFIG, NOW)).toBe(false);
    expect(verifyAdminSession("", CONFIG, NOW)).toBe(false);
    expect(verifyAdminSession("no-dot", CONFIG, NOW)).toBe(false);
    expect(verifyAdminSession("a.b.c", CONFIG, NOW)).toBe(false);
  });

  it("refuses an edited payload", () => {
    const [, signature] = signAdminSession(CONFIG, NOW).split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: CONFIG.email, iat: NOW, exp: NOW + 10 ** 12, pv: "x" }),
    ).toString("base64url");

    expect(verifyAdminSession(`${forged}.${signature}`, CONFIG, NOW)).toBe(false);
  });

  it("refuses an edited signature", () => {
    const [body] = signAdminSession(CONFIG, NOW).split(".");
    expect(verifyAdminSession(`${body}.AAAA`, CONFIG, NOW)).toBe(false);
  });

  it("refuses a token signed with another secret", () => {
    const token = signAdminSession({ ...CONFIG, secret: "y".repeat(48) }, NOW);
    expect(verifyAdminSession(token, CONFIG, NOW)).toBe(false);
  });

  it("expires", () => {
    const token = signAdminSession(CONFIG, NOW);
    expect(verifyAdminSession(token, CONFIG, NOW + ADMIN_SESSION_TTL_MS - 1)).toBe(true);
    expect(verifyAdminSession(token, CONFIG, NOW + ADMIN_SESSION_TTL_MS)).toBe(false);
  });

  it("stops verifying once the password changes", () => {
    const token = signAdminSession(CONFIG, NOW);
    expect(
      verifyAdminSession(token, { ...CONFIG, passwordHash: "scrypt:32768:8:1:bmV3:bmV3" }, NOW),
    ).toBe(false);
  });

  it("stops verifying once the admin address changes", () => {
    const token = signAdminSession(CONFIG, NOW);
    expect(verifyAdminSession(token, { ...CONFIG, email: "other@example.com" }, NOW)).toBe(false);
  });
});
