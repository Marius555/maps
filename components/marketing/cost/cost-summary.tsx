import {
  LOCATOR_MONTHLY_USD,
  METERED_USD_PER_1000,
  SETUP_ONCE_USD,
} from "@/lib/marketing/compare";

import { Reserve } from "../reserve";

/**
 * What the two cards above add up to, in one sentence, then where every figure
 * in them came from.
 *
 * **The sentence is held at the height of the longest one it can be.** It has
 * three shapes (`verdictOf`), and on an ordinary laptop the "about the same" one
 * is a line taller than the other two — so dragging the slider through the
 * crossover grew this block 24px and, because the section centres what is in it,
 * moved both cards 12px up while the reader was still dragging. `sizers` are the
 * three, rendered invisibly in the same grid cell; components/marketing/reserve.tsx
 * has the mechanism and lib/marketing/cost.ts the measurements.
 *
 * **The sources paragraph is short and every number in it is load bearing.** It
 * was five lines and is now three, because the section has to hold one screen —
 * but nothing was dropped that a figure on this page depends on. The three
 * assumptions the charts are built from are all still named: $7 per 1,000 loads,
 * the $49 mid-tier subscription, and a $500 day of setup spread over a year.
 * The rule this serves is the page's own — every figure is either a published
 * list price or is written down as an assumption, and no product is named.
 *
 * **The two buttons used to live here and are now at the foot of the page.**
 * There is a section under this one, and a call to action in the middle of a
 * scroll is an ask made before the case is finished.
 */
export function CostSummary({
  verdict,
  sizers,
}: {
  verdict: string;
  /** Every sentence `verdict` can be, so its height is reserved once. */
  sizers: readonly string[];
}) {
  return (
    <div className="border-t border-foreground/[0.08] pt-4">
      <p className="max-w-2xl text-base/6 font-medium text-pretty text-foreground">
        <Reserve sizers={sizers}>{verdict}</Reserve>
      </p>
      <p className="mt-1.5 max-w-4xl text-[0.6875rem]/4 text-pretty text-muted">
        Metered at ${METERED_USD_PER_1000} per 1,000 loads before any free
        allowance; ${LOCATOR_MONTHLY_USD} is a published mid-tier locator
        subscription, which still asks you to connect your own map key and pay
        its loads; setup assumes a ${SETUP_ONCE_USD} day spread over a year, and
        your number will differ. We never count views, on any plan.
      </p>
    </div>
  );
}
