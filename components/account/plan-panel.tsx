import Link from "next/link";

import type { Subscription } from "@/lib/repositories/subscriptions.repository";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { MARKETING_PLANS } from "@/lib/marketing/plans";

/**
 * What this account is on, and what to press next.
 *
 * One panel and not three, because "which plan", "what it costs" and "how do I
 * change it" are one question asked three ways. The only thing that varies is the
 * action: somebody on Free needs a way up, somebody paying needs a way to their
 * card and their invoices, and the provider owns that second screen entirely — we
 * link to it rather than rebuild cancellation, VAT numbers and receipts, which is
 * the whole reason a merchant of record is being paid.
 */

/**
 * What each status means to the person on it, in their words rather than the
 * provider's.
 *
 * `canceled` is absent on purpose: `getUserPlan` reads such an account as free,
 * so the panel it draws is the free one and a line saying "cancelled" underneath
 * it would be describing a subscription that is no longer doing anything.
 */
const STATUS_NOTE: Partial<Record<Subscription["status"], string>> = {
  past_due: "Your last payment didn't go through. Update your card to keep this plan.",
  paused: "This subscription is paused, so the plan's limits don't apply right now.",
  trialing: "You're on a trial. It becomes a paid subscription when the trial ends.",
};

export function PlanPanel({
  plan,
  subscription,
  portalUrl,
}: {
  plan: PlanId;
  subscription: Subscription | null;
  portalUrl: string | null;
}) {
  const marketing = MARKETING_PLANS.find((entry) => entry.id === plan);
  const note = subscription ? STATUS_NOTE[subscription.status] : undefined;

  return (
    <section className="rounded-xl bg-surface-secondary p-5">
      <h2 className="text-sm font-medium text-muted">Plan</h2>

      <p className="mt-1 text-2xl font-semibold text-foreground">
        {marketing?.name ?? plan}
      </p>

      {marketing ? (
        <p className="mt-1 text-sm text-muted">{marketing.pitch}</p>
      ) : null}

      {note ? (
        <p className="mt-3 rounded-lg bg-default px-3 py-2 text-sm text-foreground">
          {note}
        </p>
      ) : null}

      {/*
       * Renews or ends, and the wording turns on the status rather than on the
       * date. They are the same column: a running subscription's next charge and a
       * cancelled one's last day. Calling a final day a renewal is the kind of
       * small lie somebody discovers on the day it matters.
       */}
      {subscription?.currentPeriodEnd ? (
        <p className="mt-3 text-sm text-muted">
          {subscription.status === "active" && portalUrl
            ? "Renews "
            : "Access continues until "}
          <time dateTime={subscription.currentPeriodEnd}>
            {formatDate(subscription.currentPeriodEnd)}
          </time>
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {portalUrl ? (
          <a
            href={portalUrl}
            className="rounded-lg bg-surface px-3 py-2 text-sm font-medium text-foreground"
          >
            Manage subscription
          </a>
        ) : null}

        <Link
          href="/pricing"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            plan === "free"
              ? "bg-accent text-accent-foreground"
              : "bg-surface text-foreground"
          }`}
        >
          {plan === "free" ? "See plans" : "Compare plans"}
        </Link>
      </div>
    </section>
  );
}

/**
 * A plain date, in the one place this app prints one for a person.
 *
 * `en-GB` and explicit parts rather than a locale default, because a date that
 * renders one way on the server and another in the browser is a hydration
 * mismatch — the same trap CLAUDE.md records for `Intl.NumberFormat`'s compact
 * notation. Day-month-year with the month spelled out cannot be misread as
 * month-day either way round.
 */
function formatDate(iso: string): string {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) return iso;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
