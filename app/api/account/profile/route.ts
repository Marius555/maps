import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { updateUserName } from "@/lib/auth/account";
import { profileSchema } from "@/lib/validation/account.schema";

/** The name on the account. The email is not changed here — see docs/notes/settings.md. */
export const PATCH = withAuth(async ({ request, user }) => {
  const { name } = await parseBody(request, profileSchema);

  return ok({ user: await updateUserName(user.id, name) });
});
