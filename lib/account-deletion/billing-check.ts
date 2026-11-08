import { billingStanding } from "@/lib/billing/standing";
import type { SubscriptionDetails, SubscriptionState } from "@/lib/billing/types";

/**
 * Whether this account still has a subscription that would bill it — asked
 * before every deletion step, not only at the confirmation.
 *
 * **Why every step, and why not trust the confirmation.** The confirmation
 * (`POST /api/account/deletion`) cancels the subscription and then stamps
 * `deletionStartedAt` in the account's prefs, and the steps used to check only
 * that stamp. Prefs are writable by the user themselves: the session cookie is
 * the Appwrite session secret, and `PATCH /v1/account/prefs` takes it directly.
 * So the stamp could be forged and the cancellation skipped, deleting the account
 * while the subscription went on charging a card nobody could sign in to stop.
 * With this check the stamp is only a 24-hour window; billing is decided by the
 * provider's own answer.
 *
 * **The provider, not the row.** A cancelled subscription reads `active` on our
 * row until its period ends (docs/notes/billing.md), so only the provider can
 * say whether it was cancelled. Asked only when the row has something to cancel,
 * so an account that never paid makes no call at all. A provider failure
 * propagates, and the caller refuses the step: nothing is deleted on a guess.
 *
 * Pure over two injected reads, so it is tested without the network.
 */
export async function stillBilling(
  subscription: Pick<
    SubscriptionState,
    "plan" | "status" | "billingSubscriptionId" | "currentPeriodEnd"
  > | null,
  details: (billingSubscriptionId: string) => Promise<Pick<SubscriptionDetails, "cancelled"> | null>,
): Promise<boolean> {
  if (!subscription?.billingSubscriptionId) return false;
  if (billingStanding(subscription) === "none") return false;

  const current = await details(subscription.billingSubscriptionId);

  return current !== null && !current.cancelled;
}
