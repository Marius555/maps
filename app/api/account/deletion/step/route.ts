import { fail, ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { runDeletionStep } from "@/lib/account-deletion/step";
import { deletionStoreFor } from "@/lib/account-deletion/store";
import { deletionStartedAt } from "@/lib/auth/account";
import { clearSessionCookie } from "@/lib/auth/session-cookie";

/** How long a confirmation opens the steps for. A deletion left overnight is confirmed again. */
const CONFIRMATION_MS = 24 * 60 * 60_000;

/**
 * One bounded step of deleting the account. The dialog calls it until `done`.
 *
 * The order, and why it is safe to stop between any two operations, is
 * `runDeletionStep`'s docblock. This route checks that the deletion was
 * confirmed (see `markDeletionStarted`), runs one step, and on the last one
 * clears the cookie. By then the login it names no longer exists.
 */
export const POST = withAuth(
  async ({ user, ctx }) => {
    const started = await deletionStartedAt(user.id);
    const age = started ? Date.now() - Date.parse(started) : Number.POSITIVE_INFINITY;

    if (!(age >= 0 && age < CONFIRMATION_MS)) {
      return fail(
        "conflict",
        "Confirm the deletion first: open Delete account and type your email address.",
        409,
      );
    }

    const progress = await runDeletionStep(deletionStoreFor(ctx));

    if (!progress.done) return ok(progress);

    await clearSessionCookie();

    const response = ok(progress);
    // The same eviction logout does, for the same reason: Back must not
    // restore a dashboard page for an account that no longer exists.
    response.headers.set("Clear-Site-Data", '"cache"');

    return response;
  },
  { allowUnverified: true },
);
