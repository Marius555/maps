"use client";

import { useState } from "react";

import { CadenceToggle } from "@/components/ui/cadence-toggle";
import {
  MARKETING_PLANS,
  RECOMMENDED_PLAN,
  type PlanCadence,
} from "@/lib/marketing/plans";

import { Reveal } from "../reveal";
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
 */
export function PlanGrid() {
  const [cadence, setCadence] = useState<PlanCadence>("monthly");

  return (
    <>
      <CadenceToggle value={cadence} onChange={setCadence} />

      <ul className="mt-7 grid gap-5 lg:grid-cols-3">
        {MARKETING_PLANS.map((plan, index) => (
          <li key={plan.id}>
            <Reveal delay={index * 0.06} className="h-full">
              <PlanCard
                plan={plan}
                recommended={plan.id === RECOMMENDED_PLAN}
                cadence={cadence}
              />
            </Reveal>
          </li>
        ))}
      </ul>
    </>
  );
}
