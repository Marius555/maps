import { Chip } from "@heroui/react";
import { Sparkles, Sprout } from "lucide-react";
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
 * **An icon before the name**, so the chip reads as a plan at a glance rather
 * than as one more word beside the logo. `Sparkles` on a paid plan, matching the
 * accent it already wears; `Sprout` on Free — a starting point, never a warning,
 * for the same reason Free is drawn in the plain colour. Decorative either way:
 * the link's `aria-label` already names the plan.
 */
export function PlanBadge({
  plan,
  className = "",
}: {
  plan: PlanId;
  className?: string;
}) {
  const name = MARKETING_PLANS.find((entry) => entry.id === plan)?.name ?? plan;
  const Icon = plan === "free" ? Sprout : Sparkles;

  return (
    <Link
      href="/settings/billing"
      aria-label={`${name} plan — see billing`}
      className={`shrink-0 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${className}`}
    >
      <Chip
        size="sm"
        variant="soft"
        // Accent for a plan somebody is paying for, plain for the free one. The
        // badge is not a nag: Free is a state, not a warning.
        color={plan === "free" ? "default" : "accent"}
      >
        <Icon aria-hidden="true" className="size-3 shrink-0" />
        <Chip.Label>{name}</Chip.Label>
      </Chip>
    </Link>
  );
}
