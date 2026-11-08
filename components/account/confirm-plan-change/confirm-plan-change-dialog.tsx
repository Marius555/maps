"use client";

import { Button } from "@heroui/react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { MarketingPlan, PlanCadence } from "@/lib/marketing/plans";

/** One press of a plan column's button, waiting to be confirmed. */
export type PlanChangeRequest = {
  plan: MarketingPlan;
  cadence: PlanCadence;
  /** The button's own words — "Upgrade to Pro", "Switch to yearly billing". */
  label: string;
  /** What the press does to the money, from `planNoteFor`. */
  note: string | null;
  /** A move down, which waits for the renewal rather than charging now. */
  down: boolean;
};

/**
 * The step between pressing a plan and the subscription moving.
 *
 * A plan change is charged the moment it is made (an upgrade is prorated onto
 * the next bill straight away), so one press used to move money with nothing
 * in between. This repeats what the column already says — the new price and
 * when it starts — and asks once. The safe choice is the one Escape takes.
 *
 * **No exact amount.** The provider offers no preview of a proration, so the
 * dialog says *when* the difference is billed, never a figure we would be
 * guessing at.
 *
 * **`steady` on the backdrop**, because it portals out of the settings page —
 * the same rule as `CancelPlanButton`.
 */
export function ConfirmPlanChangeDialog({
  request,
  currentName,
  isPending,
  onConfirm,
  onClose,
}: {
  /** The change to confirm, or null while closed. */
  request: PlanChangeRequest | null;
  /** The plan paid for now, for the safe choice's label. */
  currentName: string;
  isPending: boolean;
  onConfirm: (request: PlanChangeRequest) => void;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={request !== null}
      onOpenChange={(open) => {
        // Not while the request is in flight: closing then would hide whether
        // it went through.
        if (!open && !isPending) onClose();
      }}
      className="steady"
      dialogClassName="sm:max-w-[420px]"
    >
      {request ? (
        <>
          <ResponsiveDialog.Header>
            <ResponsiveDialog.Heading>{request.label}?</ResponsiveDialog.Heading>
          </ResponsiveDialog.Header>

          <ResponsiveDialog.Body className="space-y-4 text-sm text-muted">
            <PriceLine plan={request.plan} cadence={request.cadence} />

            {request.note ? <p>{request.note}</p> : null}

            {request.down ? (
              <p>
                Everything you&apos;ve built stays. A map over the new
                plan&apos;s limits stays live on your site, but can&apos;t be
                republished until it fits.
              </p>
            ) : null}
          </ResponsiveDialog.Body>

          <ResponsiveDialog.Footer className="flex-wrap">
            <Button slot="close" variant="tertiary" isDisabled={isPending}>
              Keep {currentName}
            </Button>
            <Button
              variant={request.down ? "secondary" : "primary"}
              isPending={isPending}
              onPress={() => onConfirm(request)}
            >
              {request.label}
            </Button>
          </ResponsiveDialog.Footer>
        </>
      ) : null}
    </ResponsiveDialog>
  );
}

/** "Pro · €390 a year", drawn the way the column draws its price. */
function PriceLine({ plan, cadence }: { plan: MarketingPlan; cadence: PlanCadence }) {
  const yearly = cadence === "yearly" && plan.priceYearly !== undefined;
  const price = yearly ? plan.priceYearly : plan.price;

  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl bg-surface-secondary px-4 py-3">
      <span className="font-medium text-foreground">
        {plan.name}, {yearly ? "yearly" : "monthly"}
      </span>
      <span>
        <span className="text-lg font-semibold text-foreground">{price}</span>{" "}
        {yearly ? "a year" : "a month"}
      </span>
    </div>
  );
}
