import { after } from "next/server";

import { created } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { registerUser } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { createVerificationLink } from "@/lib/auth/tokens";
import { greetingName } from "@/lib/email/greeting";
import { sendEmail } from "@/lib/email/resend";
import { verifyEmailMessage } from "@/lib/email/templates/verify-email";
import { signupServerSchema } from "@/lib/validation/auth.server.schema";

export const POST = withoutAuth(async (request) => {
  const input = await parseBody(request, signupServerSchema);
  const { user, session } = await registerUser(
    input,
    request.headers.get("user-agent") ?? undefined,
  );

  await setSessionCookie(session);

  /**
   * The account exists and the cookie is written; from here nothing may fail the
   * request, and nothing may delay it either.
   *
   * **Nothing may fail it:** a Resend outage, an unverified sending domain or no
   * key at all would otherwise turn a successful signup into a 500 — which tells
   * the user the opposite of what happened and invites them to sign up again
   * with an address that now has an account. `sendEmail` swallows its own
   * failures; the `try` covers the token mint, which talks to Appwrite and can
   * throw.
   *
   * **Nothing may delay it:** measured against the real Resend key, minting a
   * token and posting a message costs about a second. Awaited, that second sits
   * between pressing "Create account" and the dashboard appearing, buying the
   * user nothing — `after` spends it once they are already there, and Next keeps
   * the invocation alive for it where a floating promise would be cut off on a
   * serverless host.
   *
   * **An unsent confirmation is not free any more, and that is the reason for
   * every line above.** Until this address is confirmed the account is read-only
   * — `withAuth` refuses every write — so a message that silently fails to send
   * leaves a person signed in to something that does nothing. The recoveries are
   * that the link can be asked for again from `/verify-email` and from the
   * banner on every dashboard page, and that the gate switches itself off
   * entirely when there is no `RESEND_API_KEY` to send with
   * (`lib/auth/email-gate.ts`). Neither covers a key that is present and broken,
   * which is what the `console.error` below is for.
   */
  after(async () => {
    try {
      const link = await createVerificationLink(user.id);

      await sendEmail({
        to: user.email,
        ...verifyEmailMessage({ name: greetingName(user.name, user.email), url: link }),
      });
    } catch (error) {
      console.error("Signup succeeded but the confirmation email did not send:", error);
    }
  });

  return created({ user });
});
