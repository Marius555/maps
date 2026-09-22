import type { Metadata } from "next";

import { AccountHeader } from "@/components/account/account-header";
import { PlanCompare } from "@/components/account/plan-compare";
import { UsageGrid } from "@/components/account/usage-grid";
import { ActivationWatch } from "@/components/billing/activation-watch";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { requireUser } from "@/lib/auth/current-user";
import { getBilling } from "@/lib/billing";
import { fetchSubscriptionState } from "@/lib/billing/lemon";
import { paidOffer, pendingKept } from "@/lib/billing/plan-change";
import { billingStanding } from "@/lib/billing/standing";
import { repoContext } from "@/lib/repositories/context";
import { listMapSummaries } from "@/lib/repositories/map-summary.repository";
import { getUserPlan } from "@/lib/repositories/plan-limits";
import {
  getSubscription,
  upsertSubscription,
  type Subscription,
} from "@/lib/repositories/subscriptions.repository";
import { getLookupUsage } from "@/lib/repositories/usage.repository";

export const metadata: Metadata = { title: "Account" };

/**
 * The plan, what it has been used for, and the way to change it.
 *
 * **Still deliberately thin about billing.** Everything a subscription actually
 * needs doing to it — the card, the billing address, the VAT number, invoices,
 * cancelling — belongs to the merchant of record, and rebuilding any of it here
 * would be buying that service and then not using it. What this page owes is the
 * facts the provider's portal cannot tell somebody (which plan our app thinks
 * they are on, and how much of it they have used) and one link out for the rest.
 *
 * **What it is no longer thin about is the plan.** It used to state one limit out
 * of four and then send anyone who wanted the others to `/pricing` — a page
 * written for a stranger, reached by leaving the dashboard, with no connection to
 * what this account actually has in it. All four ceilings are measured here now,
 * and the three plans sit underneath with this one marked, so "should I move up?"
 * is answered on the screen that raised the question. Nothing on this page links
 * to `/pricing`.
 *
 * The portal URL is fetched per visit rather than stored. Those links are signed
 * and expire, so a column holding one would be a button that works for a week and
 * then quietly does not — and it is fetched last, with `portalUrl` swallowing its
 * own failures, so a provider hiccup costs the link and not the page.
 *
 * **The plan is changed here, not only read.** A paying account's columns move
 * the subscription it has in place (`PATCH /api/account/subscription`); only an
 * account with nothing to move is sent to `/upgrade` for a fresh checkout, which
 * for a subscriber would be a second subscription. `billingStanding` decides
 * which, from the subscription row rather than from `getUserPlan` — see its
 * docblock for why that distinction matters under `DISABLE_ALL_PLAN`.
 *
 * **`?checkout=done` is set by `/checkout/done`, the page the provider returns a
 * buyer to.** It means "somebody just paid", which is the one circumstance where
 * reading `free` off this page is more likely to be a race than a fact — the
 * webhook that grants the plan is a separate arrival and nothing orders the two.
 * See `ActivationWatch`.
 */
export default async function AccountPage(props: PageProps<"/account">) {
  const user = await requireUser();
  const { checkout } = await props.searchParams;

  /*
   * `listMapSummaries` rather than a count query per table: it is already
   * owner-scoped through `listMaps`, already returns the two counts, and is
   * exactly what `/maps` fetches on every visit. It costs three reads per map, one
   * of which (groups) this page does not use — accepted, because the alternative
   * is a second near-identical repository function to save one request on a page
   * nobody sits on. If it ever measures slow, that function is the fix.
   */
  const [plan, stored, usage, summaries] = await Promise.all([
    getUserPlan(user.id),
    getSubscription(user.id),
    getLookupUsage(user.id),
    listMapSummaries(repoContext(user.id)),
  ]);

  /*
   * Only when there is a subscription to manage. Asking the provider about an
   * account that has never bought anything is a round trip whose answer is known.
   * Both provider reads run together, and the second only for a row recorded
   * before the cadence was — once per such account, since it writes the answer
   * back.
   */
  const [portalUrl, subscription] = await Promise.all([
    stored?.billingSubscriptionId
      ? getBilling().portalUrl(stored.billingSubscriptionId)
      : null,
    withKnownCadence(stored, user.id),
  ]);

  const standing = billingStanding(subscription);
  const switchable = standing === "switchable" && subscription ? subscription : null;

  /*
   * The plan the columns mark. For a subscription that can be moved it is the
   * one *paid for this period* — the kept plan while a downgrade waits for the
   * renewal, which is also what `getUserPlan` grants. Not `getUserPlan` itself:
   * under `DISABLE_ALL_PLAN` that answers "pro" for everybody, and marking it
   * would offer a developer a switch away from a plan their subscription is not
   * on.
   */
  const paid = switchable ? paidOffer(switchable) : null;
  const kept = switchable ? pendingKept(switchable) : null;

  /*
   * The fullest map, per limit, because both ceilings are per map — the map
   * nearest to one is the map that will refuse something first, and it is the one
   * worth naming. Two separate answers rather than one "biggest map": the map with
   * the most locations is often not the one with the most shapes.
   */
  const places = fullest(summaries, (summary) => summary.placeCount);
  const shapes = fullest(summaries, (summary) => summary.shapeCount);

  return (
    <Container size="centered">
      <PageTitle>Account</PageTitle>

      <AccountHeader
        email={user.email}
        subscription={subscription}
        portalUrl={portalUrl}
      />

      {checkout === "done" && plan === "free" ? (
        <ActivationWatch email={user.email} />
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          What you&apos;re using
        </h2>
        <p className="mt-1 text-sm text-muted">
          Against what this plan allows. Everything here is enforced when you save,
          not just drawn.
        </p>

        <div className="mt-5">
          <UsageGrid
            plan={plan}
            mapCount={summaries.length}
            places={places}
            shapes={shapes}
            lookups={usage}
          />
        </div>
      </section>

      <PlanCompare
        plan={paid?.plan ?? plan}
        currentCadence={paid?.cadence ?? null}
        standing={standing}
        pending={
          switchable && kept
            ? { next: { plan: switchable.plan, cadence: switchable.cadence }, until: kept.until }
            : null
        }
        renewsOn={switchable?.currentPeriodEnd ?? null}
        portalUrl={portalUrl}
      />
    </Container>
  );
}

/**
 * The map with the most of something, and its name, or null when there are no
 * maps at all.
 *
 * Null rather than zero-with-a-blank-name, so the caller has to decide what an
 * empty account says rather than printing "0 of 25 on ''".
 */
function fullest(
  summaries: { map: { name: string }; summary: { placeCount: number; shapeCount: number } }[],
  count: (summary: { placeCount: number; shapeCount: number }) => number,
): { count: number; mapName: string } | null {
  let best: { count: number; mapName: string } | null = null;

  for (const entry of summaries) {
    const value = count(entry.summary);
    if (!best || value > best.count) {
      best = { count: value, mapName: entry.map.name };
    }
  }

  return best;
}

/**
 * The subscription with its cadence known, asking the provider once if the row
 * predates the column.
 *
 * Without this, every account that subscribed before the cadence was recorded
 * would be offered no monthly↔yearly switch until its next renewal event — up to
 * a year away. The provider's answer is read through the same `toState` the
 * webhook uses and written back through the same idempotent upsert, so this is
 * the webhook's own write arriving early rather than a second opinion.
 *
 * Every failure is swallowed to the row as stored: this is a repair on a page
 * that also shows somebody their usage, and a provider hiccup should cost the
 * repair, not the page.
 */
async function withKnownCadence(
  subscription: Subscription | null,
  userId: string,
): Promise<Subscription | null> {
  if (!subscription?.billingSubscriptionId || subscription.cadence) {
    return subscription;
  }

  try {
    const state = await fetchSubscriptionState(subscription.billingSubscriptionId);
    if (!state) return subscription;

    await upsertSubscription({ ...state, userId });

    return { ...subscription, ...state };
  } catch (error) {
    console.error("Couldn't backfill the subscription's cadence:", error);

    return subscription;
  }
}
