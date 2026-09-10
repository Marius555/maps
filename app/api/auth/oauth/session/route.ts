import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { createOAuthSession } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { oauthSessionSchema } from "@/lib/validation/auth.schema";

/**
 * The server half of Google sign-in.
 *
 * `/auth/success` posts here with what Appwrite appended to its callback URL, and
 * this is where the session actually comes into existence — because the cookie it
 * produces is httpOnly, and the browser cannot write one of those.
 *
 * `withoutAuth` for the obvious reason: nobody is signed in yet. That is the whole
 * point of the request.
 */
export const POST = withoutAuth(async (request) => {
  const input = await parseBody(request, oauthSessionSchema);

  const { user, session } = await createOAuthSession(
    input,
    request.headers.get("user-agent") ?? undefined,
  );

  await setSessionCookie(session);

  return ok({ user });
});
