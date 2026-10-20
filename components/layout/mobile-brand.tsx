import { PlanBadge } from "@/components/billing/plan-badge";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { PlanId } from "@/lib/repositories/plan-limits";

/**
 * The product name and the plan badge, as the mobile header draws them.
 *
 * The badge follows the product name wherever it is drawn. Below `md` the
 * sidebar is a drawer you have to open first, so leaving it off this line would
 * make the plan invisible on a phone — and that holds in the map editor's
 * locations sheet too, which carries this in the header's place.
 */
export function MobileBrand({ plan }: { plan: PlanId }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate text-sm font-semibold tracking-tight text-foreground">
        <BrandLogo />
      </span>
      <PlanBadge plan={plan} />
    </span>
  );
}
