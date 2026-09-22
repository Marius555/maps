import type { Metadata } from "next";

import { CheckoutReturn } from "@/components/billing/checkout-return";
import { Section } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Payment received",
  // A thank-you page for one buyer, reachable only from the provider.
  robots: { index: false, follow: false },
};

/**
 * Where the merchant of record sends the browser after a successful payment.
 *
 * **In the marketing group, and that is the entire reason this page exists.**
 * The group sits outside `proxy.ts`'s matcher, so it renders regardless of what
 * cookie the request carries — and this request carries none, because the
 * session cookie is `sameSite: "strict"` and the navigation arrives from
 * `lemonsqueezy.com`. Pointing the provider's `redirect_url` at `/account`
 * instead put the request through the proxy with no visible cookie and answered
 * a completed purchase with a login form.
 *
 * `app/(auth)/auth/success/page.tsx` is the same page for Google sign-in, for
 * the same reason, and `docs/notes/auth.md` collects all three arrivals.
 *
 * Static, and nothing here reads the session — it *cannot*, which is the point.
 * `CheckoutReturn` does the rest from the client, where the cookie is visible
 * again.
 */
export default function CheckoutDonePage() {
  return (
    <Section eyebrow="Plans" headingLevel="h1" title="You're all set">
      <CheckoutReturn />
    </Section>
  );
}
