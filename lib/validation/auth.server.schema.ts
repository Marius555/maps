import "server-only";

import { emailDomain, isAllowlistedDomain, isDisposableDomain } from "@/lib/email/disposable";
import { liveSaysDisposable } from "@/lib/email/disposable-live";
import { isDisposableMailHost } from "@/lib/email/disposable-mx";
import { inspectMail } from "@/lib/email/mx";
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
/**
 * Deliberately says nothing about why. Somebody signing up with a throwaway
 * address is told only that this one will not do — naming the check ("that looks
 * temporary") just teaches them to try the next service on the list.
 */
const THROWAWAY = "We can't create an account with this email. Try a different one.";

export const signupServerSchema = signupSchema.superRefine(async (values, ctx) => {
  const domain = emailDomain(values.email);

  // `z.email()` has already run and rejected anything without one. A miss here
  // is not a second opinion on the format, it is a guard against reading `""`.
  if (!domain) return;
  if (isAllowlistedDomain(domain)) return;

  if (isDisposableDomain(domain)) {
    ctx.addIssue({ code: "custom", path: ["email"], message: THROWAWAY });
    return;
  }

  // Only once the list has passed: a round trip to a resolver buys nothing about
  // a domain we already know the answer for. The two lookups run side by side,
  // so the slower of them (each capped near two seconds) is the whole wait.
  const [mail, live] = await Promise.all([
    inspectMail(domain),
    liveSaysDisposable(domain),
  ]);

  if (!mail.accepts) {
    ctx.addIssue({
      code: "custom",
      path: ["email"],
      message:
        "We couldn't find a mail server for that address. Check the spelling of " +
        "the part after the @.",
    });
    return;
  }

  // A domain nobody has listed yet, betrayed by where its mail goes
  // (`lib/email/disposable-mx.ts`), or by a list updated this morning.
  if (mail.exchanges.some(isDisposableMailHost) || live) {
    ctx.addIssue({ code: "custom", path: ["email"], message: THROWAWAY });
  }
});
