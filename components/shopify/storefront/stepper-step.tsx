import { Check } from "lucide-react";
import type { ReactNode } from "react";

import type { StepState } from "@/lib/shopify/storefront-step";

/**
 * One numbered step of the storefront stepper (`StorefrontStepper`).
 *
 * - `current` — the number on an accent disc, the title at full weight. The
 *   only step whose button is filled.
 * - `done` — a check in place of the number, and "(done)" for a screen reader,
 *   because the check is decoration.
 * - `upcoming` — a grey ring and a grey title, waiting for the step before it.
 *   Drawn anyway, so the merchant can see the whole path before taking it.
 *
 * A thin line joins each disc to the next, which is what makes three rows read
 * as one path from top to bottom. `action` sits at the end of the title row —
 * a finished step's Remove — so a finished step costs one line.
 */
export function StepperStep({
  number,
  title,
  state,
  isLast = false,
  action,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  isLast?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={`relative flex gap-3 ${isLast ? "" : "pb-3.5"}`}>
      {isLast ? null : (
        <span
          aria-hidden="true"
          className={`absolute top-6 bottom-1 left-[9.5px] w-px ${
            state === "done" ? "bg-success/40" : "bg-border"
          }`}
        />
      )}

      <span aria-hidden="true" className={disc(state)}>
        {state === "done" ? <Check className="size-3" strokeWidth={3} /> : number}
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <p
            className={
              state === "upcoming"
                ? "text-sm text-muted"
                : state === "current"
                  ? "text-sm font-medium text-foreground"
                  : "text-sm text-foreground"
            }
          >
            {title}
            {state === "done" ? <span className="sr-only"> (done)</span> : null}
            {state === "current" ? <span className="sr-only"> (next step)</span> : null}
          </p>
          {action}
        </div>
        {children}
      </div>
    </li>
  );
}

function disc(state: StepState): string {
  const base = "relative flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]";

  if (state === "done") return `${base} bg-success text-success-foreground`;
  if (state === "current") return `${base} bg-accent font-medium text-accent-foreground`;
  return `${base} border border-border bg-background text-muted`;
}
