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
 * Development only: read every account as confirmed.
 *
 * **This is the second bypass in the app and it is deliberately shaped like the
 * first.** `DISABLE_ALL_PLAN` does not disable the plan checks — it makes
 * `getUserPlan` answer `pro`, so every check in every repository still runs, just
 * about a different plan (`lib/repositories/plan-limits.ts`). This does the same
 * one level up: it does not touch `assertEmailVerified`, it changes the answer to
 * "has this address been confirmed". The invariant that the gate lives in
 * `withAuth` and nowhere else stays literally true, and there is no second copy of
 * the rule to drift.
 *
 * **Resolving the value rather than the gate is also what keeps the screen
 * honest.** Three places in the UI explain the freeze, and all three read
 * `emailVerified` off `useMe()` — the banner in the shell, the note under Create
 * map and Publish, and `useEmailUnverified()`. A switch that only silenced the
 * server would leave a banner saying "nothing will save" above a dashboard where
 * everything saved, and leave two buttons greyed for no reason anybody could see.
 *
 * **Inert in a production build**, by the same argument
 * `planChecksDisabled()` makes: a switch that skips address confirmation, set by
 * an environment variable, on a host where that is a form field. A note asking
 * somebody to unset it is a plan; refusing to read it outside development is a
 * guarantee.
 *
 * Read at call time rather than at module load, so a test can set it per case.
 */
function verificationDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const raw = process.env.DISABLE_EMAIL_VERIFICATION;
  if (!raw || !/^(1|true|yes)$/i.test(raw.trim())) return false;

  warnOnce();
  return true;
}

/**
 * Once per process. `getCurrentUser` is `cache()`d per request, but a request is
 * not a process — a warning inside the resolver would print on every page load
 * until it stopped being read as a warning.
 */
let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;

  console.warn(
    "DISABLE_EMAIL_VERIFICATION is set: every account reads as confirmed, so the email gate is bypassed. Testing only — unset it before this is in front of anyone.",
  );
}

/**
 * Whether an account counts as having confirmed its address.
 *
 * The one place the raw `emailVerification` flag from Appwrite is turned into the
 * value the rest of the app believes. Both places that build an `AuthUser` go
 * through it — `lib/auth/current-user.ts`, which feeds `withAuth` and
 * `GET /api/auth/me`, and `toAuthUser` in `lib/auth/account.ts`, which feeds the
 * user a fresh signup or login is seeded with.
 */
export function readsAsVerified(verified: boolean): boolean {
  return verified || verificationDisabled();
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
