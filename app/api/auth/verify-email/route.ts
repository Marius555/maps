import { after, NextResponse } from "next/server";

import { noContent } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { findUserByEmail } from "@/lib/auth/account";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { RateLimitError } from "@/lib/repositories/errors";
import { createVerificationLink } from "@/lib/auth/tokens";
import { mayResendVerification, stampVerificationSent } from "@/lib/auth/verify-throttle";
import { greetingName } from "@/lib/email/greeting";
import { sendEmail } from "@/lib/email/resend";
import { verifyEmailMessage } from "@/lib/email/templates/verify-email";
import { env } from "@/lib/env";
import { forgotPasswordSchema } from "@/lib/validation/auth.schema";

/**
 * Where confirmation links pointed until 2026-11-01, and the button that sends a
 * fresh one.
 *
 * **GET confirms nothing any more; it forwards to the page.** It used to spend
 * the token and confirm the address on the spot, and company mail scanners —
 * which open every link in a message to check it — confirmed bot signups for
 * strangers that way, who then got a Welcome email as well. New links point at
 * `/verify-email` itself, where a Confirm button posts to
 * `/api/auth/verify-email/confirm`; this forward keeps links already sitting in
 * inboxes (they last 24 hours) working, and costs nothing to keep.
 *
 * **It redirects to `/verify-email`, never to `/maps`.** The click arrives from a
 * mail client, a cross-site navigation that browsers carry through a redirect
 * chain, so the Strict session cookie is not visible on it; `/verify-email` is
 * outside `proxy.ts`'s matcher and renders regardless (docs/notes/auth.md, *The
 * SameSite trap*).
 */
export const GET = withoutAuth(async (request) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");

  const target = new URL("/verify-email", env.appUrl);

  if (userId && secret) {
    target.searchParams.set("userId", userId);
    target.searchParams.set("secret", secret);
  } else {
    target.searchParams.set("status", "expired");
  }

  return NextResponse.redirect(target);
}, { rateLimit: "authToken" });

/**
 * Link checkers ask with HEAD, and Next answers a HEAD by running GET. Nothing
 * is spent by either now, but a HEAD has no use for the redirect.
 */
export function HEAD() {
  return new Response(null, { status: 200 });
}

/**
 * Send a new confirmation email.
 *
 * Takes an address rather than reading the session, because the state this
 * exists for is "my link expired" — and that person may well be looking at
 * `/verify-email` in a browser that has never been signed in.
 *
 * Answers 204 whether or not the address has an account, and whether or not it
 * is already verified. Same anti-enumeration reasoning as
 * `authenticateUser`'s single message: a route that says "no such user" is a
 * membership oracle for anyone who wants to walk a list of addresses.
 */
export const POST = withoutAuth(async (request) => {
  const { email } = await parseBody(request, forgotPasswordSchema);

  // The minute first: a second press inside it is refused without spending one
  // of the quarter hour's three. Its refusal is the only thing that tells the
  // button how long is left — the button has no countdown of its own any more
  // (components/verify-email/resend-link-button.tsx) — so it says so in words.
  try {
    rateLimit("authEmailCooldown", `verify:${email.toLowerCase()}`);
  } catch (error) {
    if (!(error instanceof RateLimitError)) throw error;
    // Always seconds: the wait is at most the minute, and `waitPhrase` rounds
    // 59.6s up to "1 minute", which reads oddly after "less than a minute ago".
    const seconds = Math.min(60, Math.max(1, Math.ceil(error.retryAfterSeconds)));
    throw new RateLimitError(
      error.retryAfterSeconds,
      `A link went out less than a minute ago. You can ask for another in ${String(seconds)} ${seconds === 1 ? "second" : "seconds"}.`,
    );
  }
  rateLimit("authEmailAddress", `verify:${email.toLowerCase()}`);

  // After the response, for the reason forgot-password documents at length: an
  // awaited lookup-and-send answers a real address about a second slower than an
  // unknown one, which is the same membership oracle the identical 204 exists to
  // close. Measured, not theorised — 1298ms against 150ms.
  after(async () => {
    try {
      const account = await findUserByEmail(email);
      if (!account || account.emailVerification) return;

      // The counters above live in memory; this one is on the account and holds
      // across a restart and a second instance. Refused silently, because the
      // 204 has already been written and must not differ by account anyway.
      if (!mayResendVerification(account.prefs, new Date())) return;

      const link = await createVerificationLink(account.$id);

      const { sent } = await sendEmail({
        template: "verify",
        to: account.email,
        ...verifyEmailMessage({
          name: greetingName(account.name, account.email),
          url: link,
        }),
      });

      if (sent) await stampVerificationSent(account.$id);
    } catch (error) {
      console.error("Failed to resend a confirmation email:", error);
    }
  });

  return noContent();
}, { rateLimit: "authEmail" });
