import type { Metadata } from "next";

import { PlanCompare } from "@/components/account/plan-compare";
import { ActivationWatch } from "@/components/billing/activation-watch";
import { CurrentPlan } from "@/components/user-settings/billing/current-plan";
import { InvoiceTable } from "@/components/user-settings/billing/invoice-table";
import { PaymentMethod } from "@/components/user-settings/billing/payment-method";
import { SettingsSection } from "@/components/user-settings/section/settings-section";
import { requireUser } from "@/lib/auth/current-user";
import { getBilling } from "@/lib/billing";
import { withKnownCadence } from "@/lib/billing/known-cadence";
import { paidOffer, pendingKept } from "@/lib/billing/plan-change";
import { billingStanding } from "@/lib/billing/standing";
import { LEGAL_DETAILS } from "@/lib/legal/values";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";

export const metadata: Metadata = { title: "Billing" };

/**
 * The plan, how it is paid, and every invoice — where the old account page
 * showed the plan and linked out for the rest.
 *
 * **The merchant of record still does all of it.** Cancelling calls its cancel,
 * the card form and billing address are its pages (opened in a new tab), and
 * each invoice row is its PDF. What moved is where a customer finds them: here,
 * without having to know that a portal on another site exists.
 *
 * **Two provider reads, both only for an account with a subscription, both in
 * parallel**, and neither can take the page down. `subscriptionDetails` is one
 * GET for the plan state, the cancellation, the card and both signed links;
 * `listInvoices` is page one of the table. A provider hiccup costs those
 * sections their contents, and each says so, while the plan and the plan
 * columns — read from our own row — still render.
 *
 * **Section order is chosen for layout stability.** Invoices, the one section
 * whose height depends on the provider's answer, are last. Nothing sits below
 * them to be pushed down when the page arrives or a page of them is swapped.
 *
 * **`?checkout=done` is set by `/checkout/done`**, the page the provider
 * returns a buyer to. It means "somebody just paid", which is the one
 * circumstance where reading `free` here is more likely a race than a fact. See
 * `ActivationWatch`.
 */
export default async function BillingSettingsPage(props: PageProps<"/settings/billing">) {
  const user = await requireUser();
  const { checkout } = await props.searchParams;

  const [plan, stored] = await Promise.all([getUserPlan(user.id), getSubscription(user.id)]);
  const subscriptionId = stored?.billingSubscriptionId ?? "";

  const [details, firstPage] = subscriptionId
    ? await Promise.all([
        getBilling()
          .subscriptionDetails(subscriptionId)
          .catch(logged("Couldn't read the subscription for the Billing page")),
        getBilling()
          .listInvoices(subscriptionId, 1)
          .catch(logged("Couldn't list invoices for the Billing page")),
      ])
    : [null, null];

  const subscription = await withKnownCadence(stored, details, user.id);
  const standing = billingStanding(subscription);
  const switchable = standing === "switchable" && subscription ? subscription : null;

  /*
   * The plan the page marks. For a subscription that can be moved it is the one
   * *paid for this period* — the kept plan while a downgrade waits for the
   * renewal. For one the provider is holding (past due, paused) it is the plan
   * on the subscription, which `getUserPlan` reads as free while it is held. Not
   * `getUserPlan` for either: under `DISABLE_ALL_PLAN` that answers "pro" for
   * everybody.
   */
  const paid = switchable ? paidOffer(switchable) : null;
  const kept = switchable ? pendingKept(switchable) : null;
  const shown =
    paid?.plan ?? (standing === "held" && subscription ? subscription.plan : plan);

  const cancelled = standing !== "none" && details?.cancelled === true;
  const endsOn = cancelled ? (details?.endsAt ?? subscription?.currentPeriodEnd ?? null) : null;
  const renewsOn = cancelled
    ? null
    : (details?.renewsAt ?? subscription?.currentPeriodEnd ?? null);

  const issuer = LEGAL_DETAILS.billing.merchantOfRecord || "our payment provider";

  return (
    <>
      {checkout === "done" && plan === "free" ? <ActivationWatch email={user.email} /> : null}

      <SettingsSection title="Plan">
        <CurrentPlan
          plan={shown}
          cadence={paid?.cadence ?? subscription?.cadence ?? null}
          status={standing === "none" ? null : (subscription?.status ?? null)}
          cancelled={cancelled}
          renewsOn={renewsOn}
          endsOn={endsOn}
          canCancel={standing !== "none"}
        />
      </SettingsSection>

      <PlanCompare
        plan={shown}
        currentCadence={paid?.cadence ?? null}
        standing={standing}
        pending={
          switchable && kept
            ? { next: { plan: switchable.plan, cadence: switchable.cadence }, until: kept.until }
            : null
        }
        renewsOn={switchable?.currentPeriodEnd ?? null}
        endsOn={endsOn}
      />

      {subscriptionId ? (
        <SettingsSection title="Payment">
          <PaymentMethod
            payment={details?.payment ?? null}
            updatePaymentUrl={details?.updatePaymentUrl ?? null}
            portalUrl={details?.portalUrl ?? null}
          />
        </SettingsSection>
      ) : null}

      {subscriptionId ? (
        <SettingsSection
          title="Invoices"
          description={`Issued by ${issuer}, which handles the payment and the tax on it. Invoices from an earlier subscription are in the billing portal, under Billing details.`}
        >
          {firstPage ? (
            <InvoiceTable firstPage={firstPage} />
          ) : (
            <p className="text-sm text-muted">
              Couldn&apos;t load your invoices just now. Refresh the page to try again.
            </p>
          )}
        </SettingsSection>
      ) : null}
    </>
  );
}

/** A `.catch` that logs and answers null, so one provider call cannot fail the page. */
function logged(message: string) {
  return (error: unknown) => {
    console.error(`${message}:`, error);

    return null;
  };
}
