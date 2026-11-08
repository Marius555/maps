import { fail, ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { stillBilling } from "@/lib/account-deletion/billing-check";
import { runDeletionStep } from "@/lib/account-deletion/step";
import { deletionStoreFor } from "@/lib/account-deletion/store";
import { deletionStartedAt } from "@/lib/auth/account";
import { clearSessionCookie } from "@/lib/auth/session-cookie";
import { BillingError, getBilling } from "@/lib/billing";
import { ownWorkspace } from "@/lib/repositories/context";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";

/** How long a confirmation opens the steps for. A deletion left overnight is confirmed again. */
const CONFIRMATION_MS = 24 * 60 * 60_000;

const CONFIRM_FIRST = "Confirm the deletion first: open Delete account and type your email address.";

/**
 * One bounded step of deleting the account. The dialog calls it until `done`.
 *
 * The order, and why it is safe to stop between any two operations, is
 * `runDeletionStep`'s docblock. This route checks that the deletion was
 * confirmed (see `markDeletionStarted`), runs one step, and on the last one
 * clears the cookie. By then the login it names no longer exists.
 *
 * **The confirmation stamp is not what keeps billing safe.** It lives in the
 * account's prefs, which the user can write straight through Appwrite's API, so
 * every step also asks the provider whether a subscription is still billing
 * (`stillBilling`) and refuses while one is. That is what makes "the
 * subscription is cancelled before anything is deleted" true whoever sends the
 * request.
 */
export const POST = withPersonalAuth(
  async ({ user, ctx }) => {
    // A shop's workspace ends with its uninstall, never here — the confirmation
    // route says why. Refused at this end too, so the rule holds for both.
    if (user.shopify) return fail("conflict", CONFIRM_FIRST, 409);

    const started = await deletionStartedAt(user.id);
    const age = started ? Date.now() - Date.parse(started) : Number.POSITIVE_INFINITY;

    if (!(age >= 0 && age < CONFIRMATION_MS)) return fail("conflict", CONFIRM_FIRST, 409);

    try {
      const subscription = await getSubscription(ownWorkspace(user.id));

      if (await stillBilling(subscription, (id) => getBilling().subscriptionDetails(id))) {
        return fail("conflict", CONFIRM_FIRST, 409);
      }
    } catch (error) {
      if (!(error instanceof BillingError)) throw error;

      return fail(
        "internal_error",
        "Couldn't check your subscription, so nothing was deleted. Try again in a moment.",
        502,
      );
    }

    const progress = await runDeletionStep(deletionStoreFor(ctx));

    if (!progress.done) return ok(progress);

    await clearSessionCookie();

    // Back to a dashboard page for an account that no longer exists is
    // `RestoreAuthGuard`'s, as after a logout — not `Clear-Site-Data`, which
    // Chrome holds the response for.
    return ok(progress);
  },
  { allowUnverified: true },
);
