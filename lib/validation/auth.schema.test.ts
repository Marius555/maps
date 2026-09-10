import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  oauthSessionSchema,
  resetPasswordSchema,
  signupSchema,
} from "./auth.schema";

/**
 * The schemas the auth routes parse every request through.
 *
 * Worth testing where UI layout is not (CLAUDE.md §9): these run on the server as
 * well as in the form, they are the only validation an API caller meets, and the
 * one assertion below about *where* an error lands is a real bug this catches —
 * a mismatch reported at the form level renders at the top of the page pointing
 * at nothing.
 */

const RESET_BASE = {
  userId: "user-1",
  secret: "a-secret",
  password: "correct horse",
  confirmPassword: "correct horse",
};

describe("loginSchema", () => {
  it("accepts an address and any non-empty password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password without imposing the signup rules on it", () => {
    // Login must never enforce a length: an account created before the rule
    // changed still has to be able to log in.
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true);
  });

  it("rejects a malformed address", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(
      false,
    );
  });
});

describe("signupSchema", () => {
  it("trims the name", () => {
    const result = signupSchema.parse({
      name: "  Ada  ",
      email: "ada@example.com",
      password: "12345678",
    });

    expect(result.name).toBe("Ada");
  });

  it("rejects a name that is only whitespace", () => {
    const result = signupSchema.safeParse({
      name: "   ",
      email: "ada@example.com",
      password: "12345678",
    });

    expect(result.success).toBe(false);
  });

  it("holds the password to Appwrite's own minimum of 8", () => {
    const short = signupSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "1234567",
    });

    expect(short.success).toBe(false);
    expect(short.error?.issues[0]?.message).toBe("Use at least 8 characters.");
  });
});

describe("oauthSessionSchema", () => {
  it("takes whatever shape of token Appwrite issues", () => {
    // Deliberately no format assertion: a regex here would be a second
    // definition of Appwrite's token and would fail closed the day they change
    // its length or alphabet.
    const result = oauthSessionSchema.safeParse({
      userId: "68f1b0c900112233",
      secret: "x".repeat(64),
    });

    expect(result.success).toBe(true);
  });

  it("rejects a half-copied callback URL", () => {
    expect(oauthSessionSchema.safeParse({ userId: "abc", secret: "" }).success).toBe(false);
    expect(oauthSessionSchema.safeParse({ userId: "", secret: "abc" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("wants one valid address and nothing else", () => {
    expect(forgotPasswordSchema.safeParse({ email: "ada@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "ada@" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a matching pair", () => {
    expect(resetPasswordSchema.safeParse(RESET_BASE).success).toBe(true);
  });

  it("reports a mismatch on confirmPassword, not on the form", () => {
    const result = resetPasswordSchema.safeParse({
      ...RESET_BASE,
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);

    const issue = result.error!.issues[0]!;
    expect(issue.path).toEqual(["confirmPassword"]);
    expect(issue.message).toBe("Both passwords need to match.");
  });

  it("applies the same length rule signup uses", () => {
    const result = resetPasswordSchema.safeParse({
      ...RESET_BASE,
      password: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues.some((issue) => issue.path[0] === "password")).toBe(true);
  });

  it("refuses a request with no link credentials in it", () => {
    expect(
      resetPasswordSchema.safeParse({ ...RESET_BASE, userId: "", secret: "" }).success,
    ).toBe(false);
  });
});
