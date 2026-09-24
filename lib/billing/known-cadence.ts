import "server-only";

import {
  upsertSubscription,
  type Subscription,
} from "@/lib/repositories/subscriptions.repository";
import type { SubscriptionDetails } from "./types";

/**
 * The subscription with its cadence known, written back from a read the Billing
 * page has already made.
 *
 * Without this, every account that subscribed before the cadence was recorded
 * would be offered no monthly↔yearly switch until its next renewal event — up to
 * a year away. The provider's answer is read through the same `toState` the
 * webhook uses and written back through the same idempotent upsert, so this is
 * the webhook's own write arriving early rather than a second opinion.
 *
 * It used to make its own request for this. It takes the page's
 * `subscriptionDetails` now, which carries the same state from the same GET.
 *
 * Every failure is swallowed to the row as stored: this is a repair on a page
 * that also shows somebody their plan, and a database hiccup should cost the
 * repair, not the page.
 */
export async function withKnownCadence(
  subscription: Subscription | null,
  details: SubscriptionDetails | null,
  userId: string,
): Promise<Subscription | null> {
  if (!subscription?.billingSubscriptionId || subscription.cadence || !details?.state) {
    return subscription;
  }

  try {
    await upsertSubscription({ ...details.state, userId });

    return { ...subscription, ...details.state };
  } catch (error) {
    console.error("Couldn't backfill the subscription's cadence:", error);

    return subscription;
  }
}
