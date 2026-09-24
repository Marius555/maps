import { describe, expect, it } from "vitest";

import { changePasswordSchema, deleteAccountSchema, profileSchema } from "./account.schema";

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "old-secret", password: "new-secret-1", confirmPassword: "new-secret-1" };

  it("accepts a change with the current password", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses a change with no current password", () => {
    const result = changePasswordSchema.safeParse({ ...valid, currentPassword: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["currentPassword"]);
    expect(
      changePasswordSchema.safeParse({ password: valid.password, confirmPassword: valid.confirmPassword }).success,
    ).toBe(false);
  });

  it("holds the new password to the same rule signup does", () => {
    const result = changePasswordSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });

  it("puts a mismatch on the confirmation field, where it is fixed", () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: "new-secret-2" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("profileSchema", () => {
  it("trims the name and refuses an empty one", () => {
    expect(profileSchema.parse({ name: "  Ada Lovelace " }).name).toBe("Ada Lovelace");
    expect(profileSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});

describe("deleteAccountSchema", () => {
  it("wants something typed; whether it matches is the server's check", () => {
    expect(deleteAccountSchema.safeParse({ email: "" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ email: "someone@example.com" }).success).toBe(true);
  });
});
