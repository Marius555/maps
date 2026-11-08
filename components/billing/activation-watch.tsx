"use client";

import { Spinner } from "@heroui/react";

import { useActivationPoll } from "./purchase-celebration/use-activation-poll";

/**
 * The gap between paying and the plan appearing.
 *
 * A payment produces **two independent arrivals** at our server — the buyer's
 * browser, redirected back by the provider, and the webhook that actually grants
 * the plan — and nothing orders them. So a buyer can reach this page a moment
 * before the row exists, be told they are on Free, and reasonably conclude their
 * money went nowhere.
 *
 * This says what is true instead, and re-asks — `useActivationPoll`, shared with
 * the post-purchase dialog (`PurchaseCelebration`).
 *
 * **The polling is free at the provider.** The Billing page only asks the
 * provider anything when there is already a `billingSubscriptionId`, which during
 * activation there is not — so each pass is Appwrite reads and nothing else. And the
 * component is not rendered at all once the plan is paid, so there is no "stop"
 * state to keep: the parent stopping is the stop.
 *
 * **It gives up out loud.** A spinner that never ends is worse than a sentence
 * saying what to do, and the one failure this cannot distinguish — a webhook
 * that never arrives because the endpoint is misconfigured — is precisely the
 * one where somebody needs to be told to get in touch rather than kept waiting.
 */

export function ActivationWatch({ email }: { email: string }) {
  const { waiting } = useActivationPoll(true);

  return (
    <section
      className="mb-8 rounded-xl bg-surface-secondary p-5"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {waiting ? (
          <Spinner aria-hidden="true" className="mt-0.5 shrink-0" size="sm" />
        ) : null}

        <div>
          <h2 className="text-sm font-medium text-foreground">
            {waiting ? "Activating your plan" : "Your plan hasn't arrived yet"}
          </h2>

          <p className="mt-1 text-sm text-muted">
            {waiting
              ? "Payment received. This usually takes a few seconds."
              : `Your payment went through and nothing is wrong with your card. If this page still shows the free plan in a few minutes, get in touch from ${email} and we'll put it right.`}
          </p>
        </div>
      </div>
    </section>
  );
}
