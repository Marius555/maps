import type { Metadata } from "next";

import { PlanPanel } from "@/components/account/plan-panel";
import { UsagePanel } from "@/components/account/usage-panel";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { requireUser } from "@/lib/auth/current-user";
import { getBilling } from "@/lib/billing";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";
import { getLookupUsage } from "@/lib/repositories/usage.repository";

export const metadata: Metadata = { title: "Account" };

/**
 * The plan, what it has been used for, and the way to change it.
 *
 * **Deliberately thin.** Everything a subscription actually needs doing to it —
 * the card, the billing address, the VAT number, invoices, cancelling — belongs
 * to the merchant of record, and rebuilding any of it here would be buying that
 * service and then not using it. What this page owes is the two facts the
 * provider's portal cannot tell somebody (which plan our app thinks they are on,
 * and what they have spent of it) and one link to the portal for the rest.
 *
 * The portal URL is fetched per visit rather than stored. Those links are signed
 * and expire, so a column holding one would be a button that works for a week and
 * then quietly does not — and it is fetched last, with `portalUrl` swallowing its
 * own failures, so a provider hiccup costs the link and not the page.
 */
export default async function AccountPage() {
  const user = await requireUser();

  const [plan, subscription, usage] = await Promise.all([
    getUserPlan(user.id),
    getSubscription(user.id),
    getLookupUsage(user.id),
  ]);

  /*
   * Only when there is a subscription to manage. Asking the provider about an
   * account that has never bought anything is a round trip whose answer is known.
   */
  const portalUrl = subscription?.billingSubscriptionId
    ? await getBilling().portalUrl(subscription.billingSubscriptionId)
    : null;

  return (
    <Container size="centered">
      <PageTitle>Account</PageTitle>

      <section className="rounded-xl bg-surface-secondary p-5">
        <h2 className="text-sm font-medium text-muted">Signed in as</h2>
        <p className="mt-1 truncate text-lg text-foreground">{user.email}</p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PlanPanel
          plan={plan}
          subscription={subscription}
          portalUrl={portalUrl}
        />
        <UsagePanel usage={usage} />
      </div>
    </Container>
  );
}
