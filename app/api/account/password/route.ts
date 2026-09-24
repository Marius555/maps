import { fail, noContent } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  accountHasPassword,
  changePassword,
  PasswordRefusedError,
  WrongPasswordError,
} from "@/lib/auth/account";
import { throttle } from "@/lib/auth/throttle";
import { changePasswordSchema } from "@/lib/validation/account.schema";

/**
 * Change the password of an account that signs in with one.
 *
 * **An account made by Google sign-in is refused.** It has no password, so
 * Appwrite would accept a new one with no old one to check — a stolen session
 * could add a password and sign in with it after the session is revoked. The
 * page shows such an account no password section; this is the same rule held
 * where a hand-made request cannot skip it.
 *
 * Throttled per account because the current-password box is a guessing oracle
 * for anybody holding a session they should not have. Five tries in fifteen
 * minutes is more than somebody who has forgotten it needs before they go to
 * "Forgot password".
 *
 * Both refusals come back as field errors, so the message lands under the box it
 * is about rather than at the top of the form.
 */
export const PATCH = withAuth(async ({ request, user }) => {
  const input = await parseBody(request, changePasswordSchema);

  throttle({ key: `password:${user.id}`, limit: 5, windowMs: 15 * 60_000 });

  if (!(await accountHasPassword(user.id))) {
    return fail(
      "forbidden",
      "This account signs in with Google and has no password to change.",
      403,
    );
  }

  try {
    await changePassword({
      password: input.password,
      currentPassword: input.currentPassword,
    });
  } catch (error) {
    if (error instanceof WrongPasswordError) {
      return fail("validation_failed", error.message, 422, {
        currentPassword: [error.message],
      });
    }
    if (error instanceof PasswordRefusedError) {
      return fail("validation_failed", error.message, 422, {
        password: [error.message],
      });
    }
    throw error;
  }

  return noContent();
});
