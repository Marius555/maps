import { NextResponse, type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/responses";
import { toErrorResponse } from "@/lib/api/route";
import {
  fetchSubscriptionState,
  readWebhook,
  subscriptionIdOf,
  verifyWebhook,
} from "@/lib/billing/lemon";
import {
  findUserByBillingCustomer,
  upsertSubscription,
} from "@/lib/repositories/subscriptions.repository";

/**
 * Where the merchant of record tells us what somebody paid for.
 *
 * This is the only writer of the `subscriptions` table, and therefore the only
 * thing in the app that can grant a paid plan. Everything about it is shaped by
 * that.
 *
 * **Not `withAuth`, and not `withoutAuth` either.** There is no session — the
 * caller is a machine in somebody else's data centre — and `withoutAuth` would
 * consume the body as JSON through `parseBody`, which is exactly what must not
 * happen: the signature is over the **raw bytes**, and `JSON.parse` followed by
 * `JSON.stringify` does not reproduce them. Key order, number formatting and
 * whitespace all differ, and the digest would never match. So the body is read
 * with `request.text()` and parsed afterwards, the same shape `app/api/collect`
 * uses for its own reasons.
 *
 * **It refuses everybody while `LEMON_WEBHOOK_SECRET` is unset**, which is the
 * same posture `app/api/cron/sheet-sync` takes with `CRON_SECRET`. An unguarded
 * endpoint that writes this table is a free Pro plan for anyone who can find the
 * URL and read this file — and this file is not secret.
 *
 * **2xx or the provider retries.** A non-2xx puts the event back in their queue,
 * which is right for "our database was briefly down" and wrong for everything
 * else. So an event we understand but cannot act on — an unknown variant, a
 * payload with no account in it — answers 200 with a note, because retrying it
 * tomorrow will produce the same nothing. Only a genuine failure of ours is
 * allowed to be a 500.
 */

/** Reads the raw body, so nothing may be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * A subscription payload is a few kilobytes. A megabyte of it is somebody else.
 *
 * Checked before the body is read rather than after, so a flood costs a header
 * parse rather than the bandwidth.
 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * The events that carry a **subscription** object.
 *
 * Listed rather than matched by prefix, because the set is small, stable and
 * documented — and because a provider adding a new `subscription_*` event should
 * be a deliberate decision here rather than something that silently starts
 * rewriting rows.
 *
 * Every one of them carries the subscription's *current* state, not a delta, so
 * they are all applied the same way: replace the row with what the event says.
 * That is what makes a retry, a duplicate and an out-of-order delivery all safe.
 */
const LIFECYCLE = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_resumed",
  "subscription_paused",
  "subscription_unpaused",
]);

/**
 * The events that carry a **subscription-invoice** object instead.
 *
 * They are a different shape and they must not be read as the set above: an
 * invoice has no `variant_id`, and its `status` is an invoice status (`paid`,
 * `void`, `refunded`) that means nothing about whether the subscription is
 * running. Reading one that way would match no plan and log a configuration
 * error on the most routine event in the system.
 *
 * They are still handled, rather than ignored, because these are the events that
 * fire when a renewal is actually *charged*. Ignoring them would rest the whole
 * renewal path on `subscription_updated` always firing alongside — and if it ever
 * did not, `currentPeriodEnd` would go stale and `getUserPlan` would quietly
 * downgrade somebody whose card had just been charged. So the subscription id is
 * taken out of the invoice and the API is asked what the subscription now says.
 */
const PAYMENT = new Set([
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
  "subscription_payment_refunded",
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const declared = Number(request.headers.get("content-length") ?? "0");

    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return fail("validation_failed", "That payload is too large.", 413);
    }

    const raw = await request.text();

    if (raw.length > MAX_BODY_BYTES) {
      return fail("validation_failed", "That payload is too large.", 413);
    }

    if (!verifyWebhook(raw, request.headers.get("x-signature"))) {
      /*
       * Deliberately says nothing about why. A caller learning whether the secret
       * is unset, whether the header was missing or whether the digest merely
       * differed is a caller being helped to guess.
       */
      return fail("unauthorized", "Not allowed.", 401);
    }

    let body: unknown;

    try {
      body = JSON.parse(raw);
    } catch {
      return fail("validation_failed", "That body isn't JSON.", 400);
    }

    const event = readWebhook(body);

    if (!event || (!LIFECYCLE.has(event.name) && !PAYMENT.has(event.name))) {
      // Understood and ignored. 200, so it is not redelivered forever.
      return ok({ handled: false });
    }

    /*
     * A payment event carries an invoice, so its state has to be fetched rather
     * than read. `readWebhook` already returned null state for it — that is the
     * expected path here, not a failure.
     */
    const state = PAYMENT.has(event.name)
      ? await fetchSubscriptionState(subscriptionIdOf(body) ?? "")
      : event.state;

    if (!state) {
      /*
       * A variant that is not one of ours — another product in the same store, or
       * a price that was replaced without the environment being updated. Logged,
       * because the second of those is a configuration error that would otherwise
       * present as "the customer paid and nothing happened".
       */
      console.error(
        `Billing webhook ${event.name}: no plan matches that subscription's variant. Check LEMON_VARIANT_*.`,
      );

      return ok({ handled: false });
    }

    /*
     * The account, from the checkout's own custom data, falling back to whoever
     * already owns this provider-side customer.
     *
     * Both are needed. The first is the only link that exists for a brand-new
     * subscription; the second is what keeps renewals attached a year later, when
     * the event descends from a charge rather than from a checkout and may carry
     * no custom data at all.
     */
    const userId =
      event.userId ??
      (await findUserByBillingCustomer(state.billingCustomerId));

    if (!userId) {
      console.error(
        `Billing webhook ${event.name}: no account for customer ${state.billingCustomerId}.`,
      );

      return ok({ handled: false });
    }

    await upsertSubscription({ ...state, userId });

    return ok({ handled: true });
  } catch (error) {
    /*
     * A real failure of ours — Appwrite refusing a write, most likely. This is
     * the one path that *should* be a 5xx, because a retry is exactly what we
     * want: the provider will bring the event back and the write will succeed.
     */
    console.error("Billing webhook failed:", error);

    return toErrorResponse(error);
  }
}
