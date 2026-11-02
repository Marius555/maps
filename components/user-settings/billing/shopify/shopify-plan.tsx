import { Alert } from "@heroui/react";

import { SHOPIFY_PRICES } from "@/lib/billing/shopify-pricing";
import type { BillingCadence } from "@/lib/billing/types";
import { MARKETING_PLANS } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { ChangePlanButton } from "./change-plan-button";

/**
 * Settings → Billing for a shop inside the Shopify admin (docs/notes/shopify.md,
 * "Billing"): which plan, what Shopify charges for it, and one button to
 * Shopify's plan page.
 *
 * **Nothing here is Lemon Squeezy's.** No checkout link, no cancel, no card, no
 * invoices: Shopify bills the shop, so every one of those is on Shopify's side,
 * and showing ours would be off-platform billing (App Store requirement 1.2.1).
 * **Change plan is offered on every plan, Pro included**, because downgrading
 * has to be possible without contacting us (1.2.3).
 *
 * No renewal date: the stored end carries a two-day margin for a renewing plan
 * (`RENEWAL_MARGIN_MS`) and we cannot tell a renewing plan from one set to
 * cancel, so any date printed here could be wrong. Shopify's page has the real one.
 */
export function ShopifyPlan({
  plan,
  cadence,
  isPaused,
  pricingUrl,
}: {
  /** The plan the shop pays for — while frozen, the one Shopify is holding. */
  plan: PlanId;
  cadence: BillingCadence | null;
  /** Shopify froze the subscription over an unpaid store bill. */
  isPaused: boolean;
  pricingUrl: string;
}) {
  const entry = MARKETING_PLANS.find((candidate) => candidate.id === plan) ?? MARKETING_PLANS[0];

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-foreground">{entry.name} plan</p>
          <p className="mt-1 text-sm text-muted tabular-nums">{priceLine(plan, cadence, entry.pitch)}</p>
        </div>

        <ChangePlanButton pricingUrl={pricingUrl} />
      </div>

      {isPaused ? (
        <Alert status="warning" className="mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Shopify has paused this plan</Alert.Title>
            <Alert.Description>
              Usually because a Shopify bill is unpaid. Settle it in your Shopify admin to get the
              plan&apos;s limits back. Your published maps keep working.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <p className="mt-4 text-sm text-muted">
        Billed by Shopify, on your Shopify bill. Upgrade, downgrade or cancel under Change plan;
        your invoices are in your Shopify admin under Settings → Billing.
      </p>
    </div>
  );
}

function priceLine(plan: PlanId, cadence: BillingCadence | null, pitch: string): string {
  if (plan === "free") return pitch;

  // Unknown, not monthly: see `SubscriptionState.cadence`.
  return cadence ? SHOPIFY_PRICES[plan][cadence] : "Paid plan";
}
