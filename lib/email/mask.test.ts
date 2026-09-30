import { describe, expect, it } from "vitest";

import { maskEmail } from "./mask";

describe("maskEmail", () => {
  it("keeps two characters and the whole domain", () => {
    expect(maskEmail("wanmarius@Gmail.com")).toBe("wa•••@gmail.com");
  });

  it("never reveals a short local part whole", () => {
    expect(maskEmail("ab@example.com")).toBe("a•••@example.com");
    expect(maskEmail("a@example.com")).toBe("a•••@example.com");
  });

  it("copes with something that is not an address", () => {
    expect(maskEmail("nonsense")).toBe("•••");
  });
});
