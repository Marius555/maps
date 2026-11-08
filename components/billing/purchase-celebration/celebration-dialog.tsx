"use client";

import { Button, Spinner } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";

import { LinkButton } from "@/components/ui/link-button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { MarketingPlan } from "@/lib/marketing/plans";
import { CelebrationBadge } from "./celebration-badge";
import { UnlockedList } from "./unlocked-list";

export type CelebrationState =
  | { kind: "activating" }
  | { kind: "late" }
  | { kind: "active"; plan: MarketingPlan };

/**
 * The dialog a buyer meets on their map straight after paying.
 *
 * Three states, because the webhook that grants the plan and the browser coming
 * back are not ordered (`useActivationPoll`):
 *
 * - **activating** — paid, plan not landed yet. Says so, with a spinner.
 * - **active** — the badge pops in, "Welcome to Starter", and what it unlocked.
 * - **late** — half a minute and still nothing. The same sentence the Billing
 *   page's `ActivationWatch` gives up with: the card is fine, get in touch.
 */
export function CelebrationDialog({
  isOpen,
  state,
  email,
  onClose,
}: {
  isOpen: boolean;
  state: CelebrationState;
  email: string;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      dialogClassName="sm:max-w-[420px]"
    >
      {state.kind === "active" ? (
        <Active plan={state.plan} />
      ) : (
        <Waiting late={state.kind === "late"} email={email} />
      )}
    </ResponsiveDialog>
  );
}

function Active({ plan }: { plan: MarketingPlan }) {
  const reduce = useReducedMotion();

  return (
    <>
      <ResponsiveDialog.Body className="space-y-5 pt-6 text-center">
        <CelebrationBadge />

        <motion.div
          className="space-y-1.5"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3, ease: [0, 0, 0.2, 1] }}
        >
          <ResponsiveDialog.Heading className="text-xl">
            Welcome to {plan.name}
          </ResponsiveDialog.Heading>
          <p className="text-sm text-muted">
            Your plan is active. Here&apos;s what&apos;s now switched on.
          </p>
        </motion.div>

        <div className="rounded-xl bg-surface-secondary px-4 py-3.5">
          <UnlockedList plan={plan} />
        </div>
      </ResponsiveDialog.Body>

      <ResponsiveDialog.Footer className="flex-wrap">
        <LinkButton href="/settings/billing" variant="tertiary">
          View billing
        </LinkButton>
        <Button slot="close">Start building</Button>
      </ResponsiveDialog.Footer>
    </>
  );
}

function Waiting({ late, email }: { late: boolean; email: string }) {
  return (
    <>
      <ResponsiveDialog.Body className="space-y-4 pt-6 text-center" aria-live="polite">
        <div className="flex justify-center">
          {late ? null : <Spinner aria-hidden="true" size="lg" />}
        </div>

        <div className="space-y-1.5">
          <ResponsiveDialog.Heading className="text-xl">
            {late ? "Your plan hasn't arrived yet" : "Activating your plan"}
          </ResponsiveDialog.Heading>
          <p className="text-sm text-pretty text-muted">
            {late
              ? `Your payment went through and nothing is wrong with your card. If Settings → Billing still shows the free plan in a few minutes, get in touch from ${email} and we'll put it right.`
              : "Payment received. This usually takes a few seconds."}
          </p>
        </div>
      </ResponsiveDialog.Body>

      <ResponsiveDialog.Footer className="flex-wrap">
        {late ? (
          <LinkButton href="/settings/billing" variant="tertiary">
            View billing
          </LinkButton>
        ) : null}
        <Button slot="close" variant="secondary">
          Keep working
        </Button>
      </ResponsiveDialog.Footer>
    </>
  );
}
