"use client";

import { useRef, useState } from "react";

import { CadenceToggle } from "@/components/ui/cadence-toggle";
import { MARKETING_PLANS, type PlanCadence } from "@/lib/marketing/plans";
import type { PublicDiscount } from "@/lib/billing/types";
import { cadenceForDiscount, recommendedPlan } from "@/lib/marketing/recommended-plan";

import { DiscountCodeRow } from "./discount/discount-code-row";
import { usePricingOffer } from "./discount/use-pricing-offer";
import { PlanCard } from "./plan-card";

/**
 * The three cards and the monthly/yearly switch above them.
 *
 * **A client component, and the page above it is still static.** Nothing here
 * reads a cookie, a header or a database — `MARKETING_PLANS` is a plain module —
 * so the whole grid is prerendered into the HTML and hydration only takes over
 * the toggle. That is the property `/pricing` has to keep: it loads for strangers
 * and is the last page before somebody pays.
 *
 * The cadence is state and not a query parameter on purpose. A `?cadence=yearly`
 * would make the page dynamic, and it would also make two URLs for one page —
 * which is a canonical-tag problem on the page we most want indexed cleanly.
 *
 * The toggle itself lives in `components/ui/cadence-toggle.tsx`, because
 * Settings → Billing holds the same control over its own plan columns.
 *
 * The discount is asked for after hydration (`usePricingOffer`), for the same
 * reason: a page that knew it on the server would not be static.
 */
export function PlanGrid() {
  const [cadence, setCadence] = useState<PlanCadence>("monthly");
  const discount = usePricingOffer();
  // The ring follows the discount, so the plan it lowers is the one marked.
  const recommended = recommendedPlan(discount.applied, cadence);

  /*
   * The first code typed brings the cards to a cadence it covers — a
   * yearly-only code entered on Monthly otherwise lowers no price on screen and
   * reads as refused. Once per visit: a visitor who toggles back has chosen, and
   * a second code must not undo that. A code in the link is not "entered", so
   * it waits for the visitor like every other control on the page.
   */
  const switchedForCode = useRef(false);
  const onApplied = (applied: PublicDiscount) => {
    if (switchedForCode.current) return;
    switchedForCode.current = true;
    setCadence((current) => cadenceForDiscount(applied, current));
  };

  return (
    <>
      {/*
        The discount control shares the toggle's row rather than taking one of
        its own under the cards: /pricing has to fit one screen, and a row
        under three 480px cards was what pushed it past a laptop's. The empty
        first column keeps the toggle centred over the middle card.
      */}
      <div className="grid items-start gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <div aria-hidden="true" className="hidden lg:block" />
        <CadenceToggle value={cadence} onChange={setCadence} />
        <DiscountCodeRow discount={discount} onApplied={onApplied} />
      </div>

      {/*
        Hidden, not unmounted, until the discount is known: the static HTML has
        no discount in it, and drawing it first moved the ring and the prices
        under the visitor once the answer came. No `Reveal` on the cards
        either — arriving by a link, the page already fades in with its <main>;
        on a reload nothing should move at all.
      */}
      <ul className={`mt-5 grid gap-5 lg:grid-cols-3 ${discount.settled ? "" : "pricing-pending"}`}>
        {MARKETING_PLANS.map((plan) => (
          <li key={plan.id}>
            <PlanCard
              plan={plan}
              recommended={plan.id === recommended}
              cadence={cadence}
              discount={discount.applied}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
