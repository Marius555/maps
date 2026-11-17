import { NextResponse } from "next/server";

import { fail } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { BillingError, getBilling } from "@/lib/billing";
import { refuseShopifyBilled } from "@/lib/billing/shopify-billed";
import { env } from "@/lib/env";
import { ownWorkspace } from "@/lib/repositories/context";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";

/**
 * Open the provider's billing portal for this account: `?flow=payment` lands
 * on the card form, nothing lands on the portal's home (address, invoices).
 *
 * **A link here, not a link in the page.** A portal session lives minutes, so a
 * URL rendered into Settings → Billing would be dead by the time somebody who
 * left the tab open pressed it. This mints one per press and answers with a 303
 * to it — a plain `<a>` in the page, opening in a new tab, does the rest.
 *
 * A GET, so it is open to an unconfirmed account like every read: it changes
 * nothing of ours, and a card that needs updating should not wait on an email.
 *
 * **The portal's back link goes to `/billing/return`, never to Settings.** It
 * arrives from Stripe's domain, the session cookie is `sameSite: "strict"`, and
 * a Strict cookie is withheld on a cross-site navigation — the bug
 * `/checkout/done` exists for (docs/notes/auth.md).
 */
export const GET = withPersonalAuth(async ({ request, user }) => {
  const subscription = await getSubscription(ownWorkspace(user.id));

  const shopify = refuseShopifyBilled(subscription);
  if (shopify) return shopify;

  if (!subscription?.billingCustomerId) {
    return fail("conflict", "There's no payment on this account to manage yet.", 409);
  }

  try {
    const url = await getBilling().portalSession(subscription.billingCustomerId, {
      flow: request.nextUrl.searchParams.get("flow") === "payment" ? "payment" : null,
      returnUrl: `${env.appUrl}/billing/return`,
    });

    return NextResponse.redirect(url, 303);
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return fail("internal_error", "Couldn't open the billing portal. Try again in a moment.", 502);
  }
}, { rateLimit: "billing" });
