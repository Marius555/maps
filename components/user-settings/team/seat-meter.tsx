import Link from "next/link";

import { MARKETING_PLANS } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/limits/plans";

/**
 * "3 of 10 seats used", with the plan named — the sentence the Invite button
 * owes before it is pressed, the way the maps list says "1 of 1 maps".
 */
export function SeatMeter({
  used,
  seats,
  plan,
  isOwner,
}: {
  used: number;
  seats: number;
  plan: PlanId;
  isOwner: boolean;
}) {
  const planName = MARKETING_PLANS.find((entry) => entry.id === plan)?.name ?? plan;

  return (
    <p className="text-sm text-muted">
      <span className="font-medium text-foreground tabular-nums">
        {used} of {seats}
      </span>{" "}
      {seats === 1 ? "seat" : "seats"} used on the {planName} plan.
      {isOwner && used >= seats ? (
        <>
          {" "}
          <Link href="/settings/billing" className="text-foreground underline underline-offset-2">
            Compare plans
          </Link>{" "}
          for more.
        </>
      ) : null}
    </p>
  );
}
