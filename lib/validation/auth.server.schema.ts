import "server-only";

import { emailDomain, isDisposableDomain } from "@/lib/email/disposable";
import { domainAcceptsMail } from "@/lib/email/mx";
import { signupSchema } from "./auth.schema";

/**
 * Signup, with the two checks a browser must not be asked to make.
 *
 * **Why this is not a `.refine` on `signupSchema` itself.** That schema is the
 * resolver behind `components/auth/signup-form.tsx`, so anything reachable from
 * it is shipped to every browser — and `lib/email/disposable.ts` reaches a
 * megabyte of vendored domains. The shared schema stays exactly as it is, and
 * stays client-safe; this one extends it on the server and is what the route
 * parses with. The two can never disagree, because one is built from the other.
 *
 * **Why a schema and not a check inside `registerUser`.** §6's "enforce in the
 * repositories" is about plan limits — quantities a client could otherwise talk
 * us out of. This is validation, and expressed as one it inherits the whole path
 * that already exists: `parseBody` throws `ZodError`, `toErrorResponse` turns it
 * into a 422 carrying `fields.email`, and `applyFieldErrors` renders the sentence
 * under the Email field. No UI, no new error code, no new envelope.
 *
 * Neither check runs for Google sign-in, which never reaches this route.
 * Appwrite creates that account during the OAuth exchange, so refusing one would
 * mean deleting a user we had just been handed — and a Google account is already
 * an address somebody proved they control. See `docs/notes/auth.md`.
 */
export const signupServerSchema = signupSchema.superRefine(async (values, ctx) => {
  const domain = emailDomain(values.email);

  // `z.email()` has already run and rejected anything without one. A miss here
  // is not a second opinion on the format, it is a guard against reading `""`.
  if (!domain) return;

  if (isDisposableDomain(domain)) {
    ctx.addIssue({
      code: "custom",
      path: ["email"],
      message:
        "That looks like a temporary email address. Use one you'll still have " +
        "access to — you'll need it to confirm your account.",
    });
    return;
  }

  // Only once the list has passed: a round trip to a resolver buys nothing about
  // a domain we already know the answer for.
  if (!(await domainAcceptsMail(domain))) {
    ctx.addIssue({
      code: "custom",
      path: ["email"],
      message:
        "We couldn't find a mail server for that address. Check the spelling of " +
        "the part after the @.",
    });
  }
});
