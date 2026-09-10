import { after } from "next/server";

import { noContent } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { findUserByEmail } from "@/lib/auth/account";
import { throttle } from "@/lib/auth/throttle";
import { createResetLink } from "@/lib/auth/tokens";
import { greetingName } from "@/lib/email/greeting";
import { sendEmail } from "@/lib/email/resend";
import { resetPasswordMessage } from "@/lib/email/templates/reset-password";
import { forgotPasswordSchema } from "@/lib/validation/auth.schema";

/**
 * Mails a reset link, and says the same thing either way.
 *
 * **204 whether or not the address has an account, always.** This route takes an
 * arbitrary email from an anonymous caller, so any difference in what it returns
 * turns it into a membership oracle: paste in a list of addresses and learn
 * which ones bank here. `authenticateUser` already makes this argument for the
 * login form, and this is the same argument one route along.
 *
 * **The status and the body were never the leak — the clock was, and it was
 * measured.** The first version awaited the token mint and the Resend call
 * before answering, so a real address took **1298ms** and an unknown one
 * **150ms**. Both were a 204 with an empty body and the difference was an order
 * of magnitude: the oracle this route exists to close, wide open, and invisible
 * to anyone reading the response.
 *
 * `after()` is the fix. The work runs once the response has been sent, so both
 * paths answer on the same short path — and Next keeps the invocation alive for
 * it, which a bare floating promise would not survive on a serverless host. The
 * form's copy already promised nothing more than "if that address has an
 * account, the link is on its way", which is exactly what this does.
 */
export const POST = withoutAuth(async (request) => {
  const { email } = await parseBody(request, forgotPasswordSchema);

  // Before the response, deliberately: a 429 is the one answer this route is
  // allowed to differ on, because it describes the *caller* rather than whether
  // the address exists. Keyed by address, so one person hammering the form
  // cannot lock everyone else out of resetting theirs.
  throttle({ key: `reset:${email.toLowerCase()}`, limit: 3, windowMs: 15 * 60 * 1000 });

  after(async () => {
    try {
      const account = await findUserByEmail(email);
      if (!account) return;

      const link = await createResetLink(account.$id);

      await sendEmail({
        to: account.email,
        ...resetPasswordMessage({
          name: greetingName(account.name, account.email),
          url: link,
        }),
      });
    } catch (error) {
      // Nothing to report to: the response has already gone. A failure here is
      // an email that does not arrive, and the user's way out is to ask again.
      console.error("Failed to send a password reset email:", error);
    }
  });

  return noContent();
});
