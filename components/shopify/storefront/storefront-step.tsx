import { Check } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One numbered row of the storefront steps (`StorefrontSteps`).
 *
 * - `current` — the number, at full strength.
 * - `done` — a check in place of the number, and "(done)" for a screen reader,
 *   because the check is decoration.
 * - `inactive` — greyed, waiting for the step before it. Drawn anyway, with no
 *   body, so the merchant can see there are two steps before taking the first.
 *
 * `action` sits at the end of the title row — a done step's Remove — so a
 * finished step costs one line rather than three.
 */
export function StorefrontStep({
  number,
  title,
  state,
  action,
  children,
}: {
  number: number;
  title: string;
  state: "current" | "done" | "inactive";
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden="true"
        className={
          state === "done"
            ? "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
            : state === "inactive"
              ? "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted"
              : "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-foreground text-[11px] font-medium text-foreground"
        }
      >
        {state === "done" ? <Check className="size-3" /> : number}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <p className={state === "inactive" ? "text-sm text-muted" : "text-sm font-medium text-foreground"}>
            {title}
            {state === "done" ? <span className="sr-only"> (done)</span> : null}
          </p>
          {action}
        </div>
        {children}
      </div>
    </li>
  );
}
