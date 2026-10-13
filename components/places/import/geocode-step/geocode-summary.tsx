import { CircleAlert, Copy, MapPin, Rows3, type LucideIcon } from "lucide-react";

import { formatCount } from "@/lib/format/number";
import type { GeocodePlan, GeocodeScope } from "@/lib/import/geocode-plan";

/**
 * The cost, before the wait rather than after it, and where the rest went.
 *
 * The duplicate count is here because it is the only place the user learns
 * their file repeats an address. The scope is here because the bar counts only
 * the rows being looked up, and "0 of 3" on a 40-row file otherwise reads as the
 * import having lost the other 37.
 *
 * One fact per line, with an icon, the way the Source step lists its limits
 * (`source-facts.tsx`). It was a single run-on paragraph, and four numbers in
 * one grey sentence is a thing nobody reads.
 */
export function GeocodeSummary({
  plan,
  scope,
}: {
  plan: GeocodePlan;
  scope: GeocodeScope | null;
}) {
  const facts: { icon: LucideIcon; text: string }[] = [
    {
      icon: Rows3,
      text:
        scope && scope.totalCount > plan.rowCount
          ? `${formatCount(plan.rowCount)} of your ${formatCount(scope.totalCount)} rows ${
              plan.rowCount === 1 ? "needs" : "need"
            } an address looked up`
          : `${formatCount(plan.rowCount)} ${
              plan.rowCount === 1 ? "row needs" : "rows need"
            } an address looked up`,
    },
  ];

  if (scope && scope.placedCount > 0) {
    facts.push({
      icon: MapPin,
      text: `${formatCount(scope.placedCount)} already ${
        scope.placedCount === 1 ? "has" : "have"
      } a pin`,
    });
  }

  if (scope && scope.skippedCount > 0) {
    facts.push({
      icon: CircleAlert,
      text: `${formatCount(scope.skippedCount)} ${
        scope.skippedCount === 1 ? "has" : "have"
      } no address or name — you'll see ${
        scope.skippedCount === 1 ? "it" : "them"
      } on Review`,
    });
  }

  if (plan.savedCount > 0) {
    facts.push({
      icon: Copy,
      text: `${formatCount(plan.savedCount)} repeated ${
        plan.savedCount === 1 ? "address is" : "addresses are"
      } looked up once`,
    });
  }

  return (
    <ul className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
      {facts.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-3.5 shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  );
}
