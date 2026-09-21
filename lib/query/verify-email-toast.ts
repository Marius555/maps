"use client";

import { toast } from "@heroui/react";

import { ApiError } from "./fetcher";

/**
 * Say out loud that the account is frozen, when the user has just found out the
 * hard way.
 *
 * The standing explanation is the banner in the dashboard shell
 * (`components/verify-email/verify-email-banner.tsx`), and the two controls that
 * grey out carry a note of their own. This covers the rest — every write behind a
 * gesture that was never disabled, which is most of the editor. Without it,
 * dragging a pin on an unconfirmed account does nothing at all, and a control
 * that only goes quiet is indistinguishable from a broken one. That exact mistake
 * is on the record in `plan-limit-toast.ts`, which exists because of it.
 *
 * **Raised once, centrally, from the `MutationCache` in `client.ts`** rather than
 * from each mutation's `onError`. The gate is on `withAuth`, so *any* mutation in
 * the app can return this — including one written next month by someone who has
 * never read this file. A per-hook toast would cover the hooks somebody
 * remembered.
 *
 * The description is the server's own sentence, unedited: `emailUnverifiedMessage`
 * is the only place that knows the address, and a paraphrase here would be a
 * second copy to keep in step with the note under the buttons.
 *
 * No action button. The banner already on screen carries **Send a new link**, and
 * a second copy of it inside a toast that expires would compete with the one that
 * doesn't.
 */

const EMAIL_UNVERIFIED = "email_unverified";

/**
 * True when this error is the email gate and nothing else.
 *
 * Exported separately from the toast for the reason `isPlanLimit` is: a surface
 * that already renders `mutation.error` inline needs to ask without also raising
 * a toast, because saying the same thing twice is the habit `publish-action.tsx`
 * declines.
 */
export function isEmailUnverified(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === EMAIL_UNVERIFIED;
}

/** Raise the toast if the error is the email gate. Returns whether it did. */
export function toastEmailUnverified(error: unknown): boolean {
  if (!isEmailUnverified(error)) return false;

  toast.danger("Confirm your email to make changes", {
    description: error.message,
    timeout: 8000,
  });

  return true;
}
