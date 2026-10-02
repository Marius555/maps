import { ok } from "@/lib/api/responses";
import { parseBody, withoutAuth } from "@/lib/api/route";
import { authenticateUser } from "@/lib/auth/account";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { loginSchema } from "@/lib/validation/auth.schema";

export const POST = withoutAuth(async (request) => {
  const input = await parseBody(request, loginSchema);

  // Per account as well as per address (the wrapper's `login`), so guesses
  // spread across many addresses at one account still meet a ceiling. Counted
  // whether or not the password is right — a limit that only counted failures
  // would say which attempt succeeded.
  rateLimit("loginAccount", input.email.trim().toLowerCase());
  const { user, session } = await authenticateUser(
    input,
    request.headers.get("user-agent") ?? undefined,
  );

  await setSessionCookie(session);

  return ok({ user });
}, { rateLimit: "login" });
