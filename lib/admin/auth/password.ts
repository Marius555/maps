import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * The admin password, as a scrypt hash in one string:
 * `scrypt:<N>:<r>:<p>:<salt>:<hash>`, salt and hash base64url.
 *
 * **No `$` anywhere in the format, on purpose.** The conventional
 * `$scrypt$N=…$…` shape goes through Next's dotenv-expand on its way out of
 * `.env`, which reads `$N` as a variable, substitutes nothing, and hands us a
 * different string — a password that can never match, with no error to say why.
 *
 * The parameters travel inside the value, so raising the cost later is a new
 * hash and nothing else: an old hash still verifies with the numbers it was
 * made with.
 */

/** 2^15 — about 60ms on a laptop, which is the whole brute-force defence. */
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

/**
 * scrypt needs 128·N·r bytes, which at these numbers is exactly Node's 32MB
 * default ceiling and so fails with "memory limit exceeded". Four times that
 * leaves room for a stored hash made with a higher N.
 */
const MAX_MEMORY = 128 * 1024 * 1024;

function derive(
  plain: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, length, { N, r, p, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(plain, salt, COST, BLOCK_SIZE, PARALLELISM, KEY_BYTES);

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join(":");
}

type Parsed = { N: number; r: number; p: number; salt: Buffer; key: Buffer };

function parse(stored: string): Parsed | null {
  const parts = stored.trim().split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");

  const sane =
    Number.isInteger(N) &&
    N > 1 &&
    (N & (N - 1)) === 0 &&
    Number.isInteger(r) &&
    r > 0 &&
    Number.isInteger(p) &&
    p > 0 &&
    salt.length > 0 &&
    key.length > 0;

  return sane ? { N, r, p, salt, key } : null;
}

/**
 * Whether `plain` is the password `stored` was made from.
 *
 * A malformed `stored` is `false`, never a throw: the caller is a login route,
 * and a configuration mistake there must read as "wrong password" rather than a
 * 500 that says something is different about this account.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;

  try {
    const candidate = await derive(
      plain,
      parsed.salt,
      parsed.N,
      parsed.r,
      parsed.p,
      parsed.key.length,
    );

    // Same length by construction, but checked anyway: `timingSafeEqual` throws
    // on a mismatch rather than answering it.
    return candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
  } catch {
    return false;
  }
}

/**
 * A throwaway hash with the real cost, for the login route to spend when the
 * email is wrong — so a wrong email and a wrong password take the same time and
 * the response cannot say which half was right. Made once per process.
 */
let decoy: Promise<string> | null = null;

export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  return decoy;
}
