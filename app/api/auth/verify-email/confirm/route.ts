import { after } from "next/server";

import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { isEmailVerified, markEmailVerified, revokeSession } from "@/lib/auth/account";
import { consumeToken } from "@/lib/auth/tokens";
import { greetingName } from "@/lib/email/greeting";
import { sendEmail } from "@/lib/email/resend";
import { welcomeMessage } from "@/lib/email/templates/welcome";
import { env } from "@/lib/env";
import { confirmEmailSchema } from "@/lib/validation/auth.schema";

/**
 * Confirms an address: what the Confirm button on `/verify-email` posts.
 *
 * **A POST from a button, never a GET from a link.** Company mail scanners open
 * every link in an incoming message, and while the emailed link confirmed on
 * GET they confirmed bot signups for strangers who never asked — and the
 * confirmation then mailed each of them a Welcome as well. A scanner loads the
 * page; it does not press the button. `GET /api/auth/verify-email` now only
 * forwards an older link to the page.
 *
 * **It answers with where to go, never an error.** `{ status: "ok" | "expired" }`
 * is the page's whole vocabulary, so the button navigates to
 * `/verify-email?status=…` either way — a same-site navigation, which carries
 * the session cookie, unlike the cross-site click that brought them here.
 *
 * **A spent token on an already-confirmed account answers "ok", not
 * "expired".** The person pressing twice, or confirming in a second tab, has a
 * confirmed account; the link already names the user, so saying so tells its
 * holder nothing new.
 */
export const POST = withoutAuth(async (request) => {
  const { userId, secret } = await parseBody(request, confirmEmailSchema);

  try {
    const session = await consumeToken(
      userId,
      secret,
      request.headers.get("user-agent") ?? undefined,
    );
    const user = await markEmailVerified(userId);

    // Confirming does **not** sign this browser in, and the session the token
    // bought is thrown away. A link is a credential for whoever holds it, and
    // anybody can get one for their own account — so a link that signed in
    // whoever pressed it would let a stranger send theirs to someone else and
    // have that person working, unknowingly, inside the stranger's account
    // (login CSRF). Whoever signed up in this browser still holds the cookie
    // signup set; a different browser lands signed out and logs in once.
    await revokeSession(session.secret);

    // The welcome only now — at signup it would have arrived alongside the
    // confirmation email saying overlapping things and competing for the click.
    // `after`, so the answer is not held up by the send and the invocation is
    // kept alive for it.
    after(() =>
      sendEmail({
        template: "welcome",
        to: user.email,
        ...welcomeMessage({
          name: greetingName(user.name, user.email),
          // Not `/maps`: a press in a mail client is cross-site, the Strict
          // session cookie stays behind, and `proxy.ts` answers with the login
          // form. This page is outside its matcher and links on same-site.
          url: `${env.appUrl}/verify-email?status=ok`,
        }),
      }),
    );

    return ok({ status: "ok" as const });
  } catch {
    return ok({ status: (await isEmailVerified(userId)) ? ("ok" as const) : ("expired" as const) });
  }
}, { rateLimit: "authToken" });
