import { Chip } from "@heroui/react";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";

import { MARKETING_PLANS } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/repositories/plan-limits";

/**
 * Which plan this account is on, said in the chrome.
 *
 * **It is a link, not a label.** The plan is a fact somebody is most likely to
 * want to act on the moment they notice it, and the account page is where both
 * actions live — seeing what the ceilings are and moving up. A badge that could
 * not be pressed would be read as a button that does nothing.
 *
 * `import type { PlanId }` is type-only, so the `server-only` module it comes
 * from is erased before this reaches a browser. The plan itself arrives as a
 * prop, resolved once in the dashboard layout.
 *
 * The name comes from `MARKETING_PLANS` rather than being capitalised here, so
 * the chrome, the pricing page and the checkout all call a plan the same thing.
 *
 * **A verified badge before the name, on every plan**, so the chip reads as a
 * plan at a glance rather than as one more word beside the logo. The colour is
 * what moves: plain on Free (a state, never a warning — and a different icon
 * there read as something other than a plan), accent on Starter, gold on Pro.
 * Decorative either way: the link's `aria-label` already names the plan.
 */
const PLAN_COLOR = {
  free: "default",
  starter: "accent",
  pro: "warning",
} as const satisfies Record<PlanId, "default" | "accent" | "warning">;

export function PlanBadge({
  plan,
  className = "",
}: {
  plan: PlanId;
  className?: string;
}) {
  const name = MARKETING_PLANS.find((entry) => entry.id === plan)?.name ?? plan;

  return (
    <Link
      href="/settings/billing"
      aria-label={`${name} plan — see billing`}
      className={`shrink-0 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${className}`}
    >
      <Chip size="sm" variant="soft" color={PLAN_COLOR[plan]}>
        <BadgeCheck aria-hidden="true" className="size-3 shrink-0" />
        <Chip.Label>{name}</Chip.Label>
      </Chip>
    </Link>
  );
}
