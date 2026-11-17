import type { Metadata } from "next";

import { CheckoutReturn } from "@/components/billing/checkout-return";

export const metadata: Metadata = {
  title: "Payment received",
  // A thank-you page for one buyer, reachable only from the provider.
  robots: { index: false, follow: false },
};

/**
 * Where the merchant of record sends the browser after a successful payment.
 *
 * **Outside `proxy.ts`'s matcher, and that is the entire reason this page
 * exists.** It renders regardless of what cookie the request carries — and this
 * request carries none, because the session cookie is `sameSite: "strict"` and
 * the navigation arrives from `checkout.stripe.com`. Pointing the provider's
 * `success_url` at `/account` instead put the request through the proxy with no
 * visible cookie and answered a completed purchase with a login form.
 *
 * `app/(auth)/auth/success/page.tsx` is the same page for Google sign-in, for
 * the same reason, and `docs/notes/auth.md` collects all three arrivals.
 *
 * **In the bare `(handoff)` group, not the marketing one**: it stays on screen
 * until the map arrives, and with the marketing navbar around it, it looked like
 * the buyer had been sent somewhere random.
 *
 * Static, and nothing here reads the session — it *cannot*, which is the point.
 * `CheckoutReturn` does the rest from the client, where the cookie is visible
 * again.
 */
export default function CheckoutDonePage() {
  return <CheckoutReturn />;
}
