import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("admin password hashing", () => {
  it("round-trips, and the format has no $ for dotenv-expand to eat", async () => {
    const hash = await hashPassword("correct horse battery");

    expect(hash).toMatch(/^scrypt:32768:8:1:[\w-]+:[\w-]+$/);
    expect(hash).not.toContain("$");
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(true);
  });

  it("refuses a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse batterY", hash)).resolves.toBe(false);
  });

  it("salts, so the same password never hashes the same twice", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("answers false, never throws, for a malformed hash", async () => {
    for (const bad of ["", "scrypt", "bcrypt:1:2:3:4:5", "scrypt:3:8:1:c2FsdA:aGFzaA", "scrypt:x:8:1:a:b"]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });
});
