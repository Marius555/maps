"use client";

import { useState } from "react";

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

/**
 * Two buttons in a track, not a switch.
 *
 * A `Switch` would need a label saying which way is on, and "yearly: off" is a
 * worse way to say "monthly" than the word monthly. Two radios name both states,
 * which is also what makes the control readable to somebody who arrives with
 * yearly already selected.
 *
 * `radiogroup` rather than `tablist`: these do not reveal panels, they change a
 * value, and a screen reader announcing "tab" would promise navigation that does
 * not happen.
 */
function CadenceToggle({
  value,
  onChange,
}: {
  value: PlanCadence;
  onChange: (next: PlanCadence) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="mx-auto flex w-fit items-center gap-1 rounded-full bg-surface-secondary p-1"
    >
      {(["monthly", "yearly"] as const).map((option) => {
        const isSelected = value === option;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => {
              onChange(option);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isSelected
                ? "bg-surface text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option === "monthly" ? "Monthly" : "Yearly"}
            {option === "yearly" ? (
              <span className="ml-1.5 text-xs text-accent">−2 months</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
