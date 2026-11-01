import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { bearerToken, verifyIdToken } from "./id-token";

const keys = { clientId: "client-123", clientSecret: "shh-secret" };
const NOW = 1_800_000_000;

function sign(
  payload: Record<string, unknown>,
  { secret = keys.clientSecret, alg = "HS256" }: { secret?: string; alg?: string } = {},
): string {
  const header = Buffer.from(JSON.stringify({ alg, typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

function claims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://demo-shop.myshopify.com/admin",
    dest: "https://demo-shop.myshopify.com",
    aud: keys.clientId,
    sub: "42",
    exp: NOW + 60,
    nbf: NOW - 1,
    iat: NOW - 1,
    jti: "abc",
    sid: "def",
    ...overrides,
  };
}

describe("verifyIdToken", () => {
  it("accepts a token Shopify would issue and names its shop", () => {
    const verified = verifyIdToken(sign(claims()), keys, NOW);

    expect(verified?.shop).toBe("demo-shop.myshopify.com");
    expect(verified?.claims.sub).toBe("42");
  });

  it("lower-cases the shop", () => {
    const token = sign(
      claims({ iss: "https://Demo-Shop.myshopify.com/admin", dest: "https://Demo-Shop.myshopify.com" }),
    );

    expect(verifyIdToken(token, keys, NOW)?.shop).toBe("demo-shop.myshopify.com");
  });

  it("refuses a token signed with another secret", () => {
    expect(verifyIdToken(sign(claims(), { secret: "other" }), keys, NOW)).toBeNull();
  });

  it("refuses any algorithm but HS256, including none", () => {
    expect(verifyIdToken(sign(claims(), { alg: "HS512" }), keys, NOW)).toBeNull();

    const [header, body] = sign(claims(), { alg: "none" }).split(".");
    expect(verifyIdToken(`${header}.${body}.`, keys, NOW)).toBeNull();
  });

  it("refuses a token for another app", () => {
    expect(verifyIdToken(sign(claims({ aud: "someone-else" })), keys, NOW)).toBeNull();
  });

  it("refuses an expired token, allowing ten seconds of clock skew", () => {
    expect(verifyIdToken(sign(claims({ exp: NOW - 5 })), keys, NOW)).not.toBeNull();
    expect(verifyIdToken(sign(claims({ exp: NOW - 10 })), keys, NOW)).toBeNull();
  });

  it("refuses a token that is not valid yet, allowing ten seconds of clock skew", () => {
    expect(verifyIdToken(sign(claims({ nbf: NOW + 5 })), keys, NOW)).not.toBeNull();
    expect(verifyIdToken(sign(claims({ nbf: NOW + 11 })), keys, NOW)).toBeNull();
  });

  it("refuses a token whose issuer and destination are different shops", () => {
    const token = sign(claims({ iss: "https://other-shop.myshopify.com/admin" }));

    expect(verifyIdToken(token, keys, NOW)).toBeNull();
  });

  it("refuses a destination that is not a myshopify domain", () => {
    const token = sign(
      claims({ iss: "https://evil.example/admin", dest: "https://evil.example" }),
    );

    expect(verifyIdToken(token, keys, NOW)).toBeNull();
  });

  it("refuses tampered payloads and malformed tokens", () => {
    const [header, , signature] = sign(claims()).split(".");
    const forged = Buffer.from(JSON.stringify(claims({ dest: "https://x.myshopify.com" }))).toString(
      "base64url",
    );

    expect(verifyIdToken(`${header}.${forged}.${signature}`, keys, NOW)).toBeNull();
    expect(verifyIdToken("not-a-jwt", keys, NOW)).toBeNull();
    expect(verifyIdToken("a.b.c", keys, NOW)).toBeNull();
    expect(verifyIdToken("", keys, NOW)).toBeNull();
  });

  it("refuses everything while the app is not configured", () => {
    expect(verifyIdToken(sign(claims()), { clientId: "", clientSecret: "" }, NOW)).toBeNull();
  });
});

describe("bearerToken", () => {
  it("reads the token from an Authorization header", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer abc")).toBe("abc");
  });

  it("is null for anything else", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic opr:xyz")).toBeNull();
    expect(bearerToken("Bearer")).toBeNull();
  });
});
