import { fail, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { markDeletionStarted } from "@/lib/auth/account";
import { BillingError, getBilling } from "@/lib/billing";
import { billingStanding } from "@/lib/billing/standing";
import { listOwnedMapIds } from "@/lib/repositories/account-deletion.repository";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";
import { deleteAccountSchema } from "@/lib/validation/account.schema";

/**
 * Start deleting the account: confirm it, and stop the billing.
 *
 * **The subscription is cancelled first, and a failure there stops
 * everything.** Deleting the account and then failing to cancel would leave
 * somebody being charged every month for an account that no longer exists,
 * with no way to sign in and stop it. So the provider is asked before anything
 * is deleted, and if it cannot be reached, nothing is deleted.
 *
 * `allowUnverified`, and this is the route that flag was written for
 * (`lib/api/route.ts`): somebody who mistyped their address at signup cannot
 * confirm it, and without this they could not delete the account either.
 *
 * The steps that do the deleting are `./step/route.ts`. This one marks the
 * account as confirmed, and they refuse without that mark.
 */
export const POST = withAuth(
  async ({ request, user, ctx }) => {
    const { email } = await parseBody(request, deleteAccountSchema);

    if (email.toLowerCase() !== user.email.toLowerCase()) {
      const message = `That isn't this account's address. Type ${user.email} to confirm.`;

      return fail("validation_failed", message, 422, { email: [message] });
    }

    const subscription = await getSubscription(user.id);

    if (subscription?.billingSubscriptionId && billingStanding(subscription) !== "none") {
      try {
        const billing = getBilling();
        const details = await billing.subscriptionDetails(subscription.billingSubscriptionId);

        if (details && !details.cancelled) {
          await billing.cancelSubscription(subscription.billingSubscriptionId);
        }
      } catch (error) {
        if (!(error instanceof BillingError)) throw error;

        return fail(
          "internal_error",
          "Couldn't cancel your subscription, so nothing was deleted. Try again in a moment.",
          502,
        );
      }
    }

    await markDeletionStarted(user.id);

    return ok({ mapsLeft: (await listOwnedMapIds(ctx)).length });
  },
  { allowUnverified: true },
);
