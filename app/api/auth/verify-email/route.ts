import { after, NextResponse } from "next/server";

import { noContent } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { findUserByEmail, markEmailVerified } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { throttle } from "@/lib/auth/throttle";
import { consumeToken, createVerificationLink } from "@/lib/auth/tokens";
import { greetingName } from "@/lib/email/greeting";
import { sendEmail } from "@/lib/email/resend";
import { verifyEmailMessage } from "@/lib/email/templates/verify-email";
import { welcomeMessage } from "@/lib/email/templates/welcome";
import { env } from "@/lib/env";
import { forgotPasswordSchema } from "@/lib/validation/auth.schema";

/**
 * The target of the link in the confirmation email, and the button that sends a
 * fresh one.
 *
 * **GET redirects to a page and never renders an error itself.** The person
 * clicking has no idea they are hitting an API route, so a JSON envelope here
 * would be the flow's one dead end; `/verify-email` owns every outcome the user
 * sees, and this handler's whole vocabulary is a `status` query parameter.
 *
 * **It redirects to `/verify-email`, not to `/maps`, and that is deliberate.**
 * The session cookie is `sameSite: "strict"` and the click arrives from a mail
 * client, which makes it a cross-site navigation — a classification browsers
 * carry through a server redirect chain. Sending them straight to `/maps` would
 * hand `proxy.ts` a request with no cookie visible on it and bounce a
 * just-verified user to the login page. `/verify-email` is outside the proxy's
 * matcher, so it renders, and the button on it is a same-site navigation that
 * does carry the cookie.
 */
export const GET = withoutAuth(async (request) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");

  const landing = (status: "ok" | "expired") =>
    NextResponse.redirect(new URL(`/verify-email?status=${status}`, env.appUrl));

  if (!userId || !secret) return landing("expired");

  try {
    const session = await consumeToken(userId, secret);
    const user = await markEmailVerified(userId);

    // Confirming signs you in. The token proved control of the address, the
    // account is this browser's, and asking for a password immediately after
    // clicking "confirm" is a step that answers no question.
    await setSessionCookie(session);

    // The welcome only now — at signup it would have arrived alongside the
    // confirmation email saying overlapping things and competing for the click.
    //
    // `after` rather than a floating promise: this is a redirect, so the user is
    // gone the instant it is written, and on a serverless host a bare `void`
    // send would be cut off with the invocation.
    after(() =>
      sendEmail({
        to: user.email,
        ...welcomeMessage({
          name: greetingName(user.name, user.email),
          url: `${env.appUrl}/maps`,
        }),
      }),
    );

    return landing("ok");
  } catch {
    return landing("expired");
  }
});

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

  throttle({ key: `verify:${email.toLowerCase()}`, limit: 3, windowMs: 15 * 60 * 1000 });

  // After the response, for the reason forgot-password documents at length: an
  // awaited lookup-and-send answers a real address about a second slower than an
  // unknown one, which is the same membership oracle the identical 204 exists to
  // close. Measured, not theorised — 1298ms against 150ms.
  after(async () => {
    try {
      const account = await findUserByEmail(email);
      if (!account || account.emailVerification) return;

      const link = await createVerificationLink(account.$id);

      await sendEmail({
        to: account.email,
        ...verifyEmailMessage({
          name: greetingName(account.name, account.email),
          url: link,
        }),
      });
    } catch (error) {
      console.error("Failed to resend a confirmation email:", error);
    }
  });

  return noContent();
});
