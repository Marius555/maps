import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { authenticateUser } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { loginSchema } from "@/lib/validation/auth.schema";

export const POST = withoutAuth(async (request) => {
  const input = await parseBody(request, loginSchema);
  const { user, session } = await authenticateUser(input);

  await setSessionCookie(session);

  return ok({ user });
});
