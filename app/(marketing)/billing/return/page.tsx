import type { Metadata } from "next";

import { PortalReturn } from "@/components/billing/portal-return";
import { Section } from "@/components/marketing/section";

export const metadata: Metadata = {
  title: "Back to billing",
  // Reachable only from the provider's billing portal.
  robots: { index: false, follow: false },
};

/**
 * Where the provider's billing portal sends its "back" link.
 *
 * **In the marketing group for the reason `/checkout/done` is**: outside
 * `proxy.ts`'s matcher, so a request from Stripe's domain — which carries no
 * `sameSite: "strict"` session cookie — is not answered with a login form.
 * `PortalReturn` hops on to Settings → Billing from the client, where the
 * cookie is visible again. docs/notes/auth.md collects every such arrival.
 */
export default function BillingReturnPage() {
  return (
    <Section eyebrow="Billing" headingLevel="h1" title="Back to billing">
      <PortalReturn />
    </Section>
  );
}
