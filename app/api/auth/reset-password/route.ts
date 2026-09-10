import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { resetPasswordForUser } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { resetPasswordSchema } from "@/lib/validation/auth.schema";

/**
 * Spends a reset link and sets the new password.
 *
 * Ends signed in, and that is not a convenience: the alternative is bouncing
 * someone who has just proved control of the address to a login form to type the
 * password they set four seconds ago. `resetPasswordForUser` destroys every
 * other session for the account first — see the reasoning there.
 *
 * A POST from our own page, so the `Set-Cookie` and the navigation that follows
 * it are both same-site and `sameSite: "strict"` is no obstacle here. The emailed
 * *link* is the cross-site hop, and it lands on a page rather than on this route.
 */
export const POST = withoutAuth(async (request) => {
  const input = await parseBody(request, resetPasswordSchema);

  const { user, session } = await resetPasswordForUser(input);

  await setSessionCookie(session);

  return ok({ user });
});
