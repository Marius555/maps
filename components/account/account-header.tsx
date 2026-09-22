import { Alert, buttonVariants } from "@heroui/react";
import { ExternalLink } from "lucide-react";

import { formatDate } from "@/lib/format/date";
import type { Subscription } from "@/lib/repositories/subscriptions.repository";

/**
 * Who you are, until when, and the one button that is not ours.
 *
 * **Deliberately thin, and that has not changed.** Everything a subscription
 * actually needs doing to it — the card, the billing address, the VAT number,
 * invoices, cancelling — belongs to the merchant of record, and rebuilding any of
 * it here would be buying that service and then not using it. What this owes is
 * the one fact the provider's portal cannot tell somebody at a glance (until
 * when) and one link out for the rest.
 *
 * **A strip, not a card, and with no plan name in it.** It used to be a ringed
 * card leading with the plan at `text-3xl` and the plan's pitch under it — and
 * `PlanCompare`, further down, draws the same plan marked "Your plan" with every
 * number beside it. Two blocks saying one thing, the first of them saying less.
 * The plan is the columns' to state; the badge in the sidebar says it in the
 * chrome.
 */

/**
 * What each status means to the person on it, in their words rather than the
 * provider's.
 *
 * `canceled` is absent on purpose: `getUserPlan` reads such an account as free,
 * and a line saying "cancelled" would be describing a subscription that is no
 * longer doing anything.
 */
const STATUS_NOTE: Partial<
  Record<Subscription["status"], { status: "danger" | "warning"; title: string; body: string }>
> = {
  past_due: {
    status: "danger",
    title: "Your last payment didn't go through",
    body: "Update your card to keep this plan. Nothing you've built is affected in the meantime.",
  },
  paused: {
    status: "warning",
    title: "This subscription is paused",
    body: "The plan's limits don't apply while it is, and your published maps keep working.",
  },
  trialing: {
    status: "warning",
    title: "You're on a trial",
    body: "It becomes a paid subscription when the trial ends.",
  },
};

export function AccountHeader({
  email,
  subscription,
  portalUrl,
}: {
  email: string;
  subscription: Subscription | null;
  portalUrl: string | null;
}) {
  const note = subscription ? STATUS_NOTE[subscription.status] : undefined;

  return (
    <header className="border-b border-border pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="truncate text-base text-foreground">{email}</p>

          {/*
           * Renews or ends, and the wording turns on the status rather than on
           * the date. They are the same column: a running subscription's next
           * charge and a cancelled one's last day. Calling a final day a renewal
           * is the kind of small lie somebody discovers on the day it matters.
           */}
          {subscription?.currentPeriodEnd ? (
            <p className="mt-1 text-sm text-muted">
              {subscription.status === "active" && portalUrl
                ? "Renews "
                : "Access continues until "}
              <time dateTime={subscription.currentPeriodEnd}>
                {formatDate(subscription.currentPeriodEnd)}
              </time>
            </p>
          ) : null}
        </div>

        {portalUrl ? (
          /*
           * A plain anchor, not `LinkButton`: this leaves our app for a signed,
           * expiring URL on the provider's domain, and prefetching one would be
           * spending a signature nobody pressed.
           */
          <a
            href={portalUrl}
            className={buttonVariants({ variant: "secondary", size: "sm", className: "shrink-0 self-start sm:self-auto" })}
          >
            Manage subscription
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        ) : null}
      </div>

      {note ? (
        <Alert status={note.status} className="mt-4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{note.title}</Alert.Title>
            <Alert.Description>{note.body}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
    </header>
  );
}
