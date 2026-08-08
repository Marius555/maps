import { created } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { registerUser } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { signupSchema } from "@/lib/validation/auth.schema";

export const POST = withoutAuth(async (request) => {
  const input = await parseBody(request, signupSchema);
  const { user, session } = await registerUser(input);

  await setSessionCookie(session);

  return created({ user });
});
