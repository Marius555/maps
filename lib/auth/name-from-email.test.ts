import { describe, expect, it } from "vitest";

import { nameFromEmail } from "./name-from-email";

describe("nameFromEmail", () => {
  it("takes the part before the @", () => {
    expect(nameFromEmail("maria@gmail.com")).toBe("maria");
  });

  it("keeps the local part as typed", () => {
    expect(nameFromEmail("Maria.Smith+maps@example.com")).toBe("Maria.Smith+maps");
  });

  it("splits on the last @", () => {
    expect(nameFromEmail('"a@b"@example.com')).toBe('"a@b"');
  });

  it("falls back to the address when nothing precedes the @", () => {
    expect(nameFromEmail("@example.com")).toBe("@example.com");
  });

  it("stays within Appwrite's 128 characters", () => {
    expect(nameFromEmail(`${"a".repeat(200)}@example.com`)).toHaveLength(128);
  });
});
