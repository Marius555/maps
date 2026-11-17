import { NextResponse, type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/responses";
import { toErrorResponse } from "@/lib/api/route";
import {
  BILLING_EVENTS,
  fetchSubscription,
  subscriptionIdOfEvent,
  verifyWebhook,
} from "@/lib/billing/stripe";
import {
  findUserByBillingCustomer,
  upsertSubscription,
} from "@/lib/repositories/subscriptions.repository";

/**
 * Where the merchant of record tells us what somebody paid for.
 *
 * This is the only thing in the app that can grant a paid plan *from nothing*,
 * and everything about it is shaped by that. The other writers — the plan
 * change, cancel and resume routes and the Billing page's cadence backfill —
 * only ever write the provider's own answer about a subscription that already
 * exists, read through the same `toState`.
 *
 * **Not `withAuth`, and not `withoutAuth` either.** There is no session — the
 * caller is a machine in somebody else's data centre — and `withoutAuth` would
 * consume the body as JSON through `parseBody`, which is exactly what must not
 * happen: the signature is over the **raw bytes**, and `JSON.parse` followed by
 * `JSON.stringify` does not reproduce them. So the body is read with
 * `request.text()` and handed to the verifier as it arrived.
 *
 * **It refuses everybody while `STRIPE_WEBHOOK_SECRET` is unset**, which is the
 * same posture `app/api/cron/sheet-sync` takes with `CRON_SECRET`. An unguarded
 * endpoint that writes this table is a free Pro plan for anyone who can find the
 * URL and read this file — and this file is not secret.
 *
 * **The event names the subscription; the API says what it is.** Stripe does not
 * promise delivery order, and every event carries a snapshot from when it was
 * made — so an older `customer.subscription.updated` arriving after a newer one
 * would write yesterday's plan over today's. Reading the subscription fresh
 * makes order, duplicates and retries all harmless, at one request per event.
 * Invoice events (a renewal charged, a renewal failed) are handled the same way,
 * which is what keeps `currentPeriodEnd` current even if a subscription event
 * were ever missed.
 *
 * **2xx or the provider retries.** A non-2xx puts the event back in their queue,
 * which is right for "our database was briefly down" and wrong for everything
 * else. So an event we understand but cannot act on — an unknown price, a
 * subscription with no account — answers 200 with a note, because retrying it
 * tomorrow will produce the same nothing. Only a genuine failure of ours is
 * allowed to be a 500.
 */

/** Reads the raw body, so nothing may be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * A subscription event is a few kilobytes, a large invoice tens of them. A
 * megabyte of it is somebody else.
 *
 * Checked before the body is read rather than after, so a flood costs a header
 * parse rather than the bandwidth.
 */
const MAX_BODY_BYTES = 256 * 1024;

/** The events acted on — `BILLING_EVENTS`, which `setup:stripe` subscribes the endpoint to. */
const HANDLED = new Set<string>(BILLING_EVENTS);

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

    const event = verifyWebhook(raw, request.headers.get("stripe-signature"));

    if (!event) {
      /*
       * Deliberately says nothing about why. A caller learning whether the secret
       * is unset, whether the header was missing or whether the digest merely
       * differed is a caller being helped to guess.
       */
      return fail("unauthorized", "Not allowed.", 401);
    }

    if (!HANDLED.has(event.type)) {
      // Understood and ignored. 200, so it is not redelivered forever.
      return ok({ handled: false });
    }

    const subscriptionId = subscriptionIdOfEvent(event);

    // An invoice for something that is not a subscription — none of ours.
    if (!subscriptionId) return ok({ handled: false });

    const fetched = await fetchSubscription(subscriptionId);

    if (!fetched?.state) {
      /*
       * Two ways to get here, and the log says which because they need different
       * things done about them: the provider has no such subscription (not ours
       * to fix), or its price carries none of our lookup keys — another product
       * in the same account, or a price replaced without the key moving to it,
       * which would otherwise present as "the customer paid and nothing
       * happened". Both are 200; neither comes out differently on a retry.
       */
      console.error(
        fetched
          ? `Billing webhook ${event.type}: subscription ${subscriptionId}'s price matches no pinglide_* lookup key. Run npm run setup:stripe -- --verify.`
          : `Billing webhook ${event.type}: subscription ${subscriptionId} could not be read.`,
      );

      return ok({ handled: false });
    }

    const { state } = fetched;

    /*
     * The account, from the subscription's own metadata (written by our
     * checkout), falling back to whoever already owns this provider-side
     * customer — a subscription made some other way, in the dashboard say.
     */
    const userId =
      fetched.userId ?? (await findUserByBillingCustomer(state.billingCustomerId));

    if (!userId) {
      console.error(
        `Billing webhook ${event.type}: no account for customer ${state.billingCustomerId}.`,
      );

      return ok({ handled: false });
    }

    await upsertSubscription({ ...state, userId });

    return ok({ handled: true });
  } catch (error) {
    /*
     * A real failure of ours — Appwrite refusing a write, or the provider not
     * answering the read. This is the one path that *should* be a 5xx, because a
     * retry is exactly what we want.
     */
    console.error("Billing webhook failed:", error);

    return toErrorResponse(error);
  }
}
