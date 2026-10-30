import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashInviteToken, isInviteToken, mintInviteToken } from "./token";

describe("invite tokens", () => {
  it("are 43 URL-safe characters — 32 random bytes", () => {
    const { token } = mintInviteToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isInviteToken(token)).toBe(true);
  });

  it("are never the same twice", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => mintInviteToken().token));

    expect(tokens.size).toBe(50);
  });

  it("come with the sha256 that is all the table keeps", () => {
    const { token, hash } = mintInviteToken();

    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(hashInviteToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("are recognised before anything is read, so junk never reaches the database", () => {
    for (const junk of ["", "short", "x".repeat(44), "../../etc/passwd", null, 42]) {
      expect(isInviteToken(junk)).toBe(false);
    }
  });
});
