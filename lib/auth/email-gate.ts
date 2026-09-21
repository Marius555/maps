import "server-only";

import { env } from "@/lib/env";
import { EmailUnverifiedError } from "@/lib/repositories/errors";
import type { AuthUser } from "./types";

/**
 * Until an account confirms its address, it can read and it cannot write.
 *
 * The rule lives here rather than inline in `withAuth` so it has somewhere to be
 * argued, and so the two facts it depends on — which methods are safe, and
 * whether email works at all — are named rather than spelled out at the call
 * site.
 *
 * **Reads stay open on purpose.** A frozen account still has to render: the
 * banner that explains the freeze asks `GET /api/auth/me` for the address to put
 * in it, and someone who signed up months ago and let a session lapse should be
 * able to look at what they built while they go and find the email. Nothing on a
 * GET costs us anything a visitor to a published map does not already cost.
 *
 * Every route that must answer an unconfirmed account is `withoutAuth` already —
 * signup, login, logout, both halves of verify-email, forgot and reset password,
 * the OAuth exchange — so this needs no exemption list. That is not luck; those
 * routes are unauthenticated because they run before or across a session, and it
 * happens to mean the one way out of this gate can never be inside it.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether the gate is switched on at all, which is the same question as whether
 * we can send the mail that opens it.
 *
 * With no `RESEND_API_KEY`, `sendEmail` warns once and resolves `{ sent: false }`
 * — so a confirmation link is never delivered and a gated account could never be
 * un-gated by anyone. A fresh clone with no `.env` would create accounts that are
 * permanently unusable, and the person hitting it would have no way to tell that
 * from a bug. `lib/env.ts` already takes the position that the optional email
 * values mean "it still works without them"; this keeps that true.
 *
 * Read through `env` on every call rather than captured at module load, so a test
 * can re-import with the variable set either way.
 */
export function emailGateActive(): boolean {
  return Boolean(env.resendApiKey);
}

/**
 * Throws unless this request is allowed to change something.
 *
 * `user` comes from `requireUser()`, which asks Appwrite — so `emailVerified` is
 * a fact about the account and not a claim carried on a cookie. That is the whole
 * reason this can live at the route layer and be trusted there.
 */
export function assertEmailVerified(user: AuthUser, method: string): void {
  if (SAFE_METHODS.has(method)) return;
  if (user.emailVerified) return;
  if (!emailGateActive()) return;

  throw new EmailUnverifiedError(user.email);
}
