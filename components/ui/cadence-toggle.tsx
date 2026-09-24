"use client";

import type { PlanCadence } from "@/lib/marketing/plans";

/**
 * Monthly or yearly — two buttons in a track, not a switch.
 *
 * A `Switch` would need a label saying which way is on, and "yearly: off" is a
 * worse way to say "monthly" than the word monthly. Two radios name both states,
 * which is also what makes the control readable to somebody who arrives with
 * yearly already selected.
 *
 * `radiogroup` rather than `tablist`: these do not reveal panels, they change a
 * value, and a screen reader announcing "tab" would promise navigation that does
 * not happen.
 *
 * **In `components/ui` because two pages hold one.** It started inside
 * `components/marketing/plans/plan-grid.tsx`; Settings → Billing needs the same control
 * over its own plan columns, and a second hand-rolled radiogroup would have been
 * two keyboard behaviours to keep in step. The cadence stays the caller's state
 * and never a query parameter — on `/pricing` that is what keeps the page static
 * and stops one page having two URLs.
 */
export function CadenceToggle({
  value,
  onChange,
  className = "mx-auto",
}: {
  value: PlanCadence;
  onChange: (next: PlanCadence) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className={`flex w-fit items-center gap-1 rounded-full bg-surface-secondary p-1 ${className}`}
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
