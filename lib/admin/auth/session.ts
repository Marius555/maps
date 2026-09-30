import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The admin session token: `<payload>.<signature>`, both base64url, signed with
 * HMAC-SHA256 under `ADMIN_SESSION_SECRET`.
 *
 * Pure — no cookies, no env — so every way a token can be wrong is testable:
 * `lib/admin/auth/session.test.ts`. The cookie half is `cookie.ts`.
 *
 * Stateless on purpose. There is one admin and no table to hold sessions in, and
 * a signed token needs none. What a stateless token cannot do on its own is be
 * revoked, so two things revoke it instead:
 *
 * - **`exp`** — eight hours, then it is worth nothing whatever the cookie says.
 * - **`pv`** — a fingerprint of the password hash. Changing the password (a new
 *   `ADMIN_PASSWORD_HASH`) changes it, and every token issued before stops
 *   verifying. Rotating `ADMIN_SESSION_SECRET` does the same, harder.
 */

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type AdminConfig = {
  email: string;
  passwordHash: string;
  secret: string;
};

type Payload = {
  sub: string;
  iat: number;
  exp: number;
  pv: string;
};

function sign(data: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

function passwordVersion(config: AdminConfig): string {
  return createHmac("sha256", config.secret)
    .update(`pv:${config.passwordHash}`)
    .digest("base64url")
    .slice(0, 16);
}

export function signAdminSession(config: AdminConfig, now: number = Date.now()): string {
  const payload: Payload = {
    sub: config.email,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_MS,
    pv: passwordVersion(config),
  };

  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${body}.${sign(body, config.secret).toString("base64url")}`;
}

/**
 * Whether `token` is a live session for the configured admin. Every failure is
 * `false` — a malformed token, a forged signature, an expired one, one issued
 * for another address or under an old password.
 *
 * The signature is checked before the payload is parsed, so nothing an attacker
 * wrote is ever read as JSON.
 */
export function verifyAdminSession(
  token: string | undefined,
  config: AdminConfig,
  now: number = Date.now(),
): boolean {
  if (!token) return false;

  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return false;

  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = sign(body, config.secret);

  // Length first: `timingSafeEqual` throws on a mismatch rather than answering.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return false;
  }

  let payload: Partial<Payload>;

  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<Payload>;
  } catch {
    return false;
  }

  return (
    payload.sub === config.email &&
    typeof payload.exp === "number" &&
    payload.exp > now &&
    typeof payload.iat === "number" &&
    payload.iat <= now + 60_000 &&
    payload.pv === passwordVersion(config)
  );
}
