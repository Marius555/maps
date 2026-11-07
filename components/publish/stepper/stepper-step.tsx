"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { AnimatedHeight } from "@/components/ui/animated-height";
import { stepMotion } from "@/components/ui/list-row-motion";
import type { StepState } from "@/lib/publish/steps";

const EASE = [0, 0, 0.2, 1] as const;
const FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: EASE },
} as const;
const POP = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.5 },
  transition: { duration: 0.18, ease: EASE },
} as const;

/**
 * One numbered step of the Publish footer's steppers — "Your store" inside
 * Shopify (`StorefrontStepper`) and "Your website" everywhere else
 * (`WebsiteStepper`). Three of them, always the same three
 * (`lib/publish/steps.ts`).
 *
 * - `current` — the number on an accent disc with a soft accent halo, the
 *   title at full weight. The only step whose button is filled.
 * - `done` — a white check on a solid accent disc, and "(done)" for a screen
 *   reader, because the check is decoration. Accent rather than the grey disc
 *   and green check it used to be: the owner read those as washed out
 *   (2026-11-07). The halo is what still tells the current step from a
 *   finished one.
 * - `upcoming` — a grey ring and a grey title. Drawn anyway, so the whole path
 *   is in view before it is taken.
 * - `isLoading` — a pulsing grey disc and a grey title, while the stepper does
 *   not yet know where it stands. The titles are real, so the list that loads
 *   is the list that stays; only the bodies arrive.
 *
 * **Nothing here snaps** (the owner's report, 2026-11-07: "this whole section
 * jumps around"). The disc's colour and halo are a CSS transition, the check
 * pops in where the number was, the line below a finished step fills from the
 * top, a changed title cross-fades, and the body — drawn only when `bodyKey`
 * is given — cross-fades on a new key while its height eases to the new size
 * (`AnimatedHeight`). Nothing animates on the first paint, and reduced motion
 * keeps the colours and drops the travel.
 *
 * `action` sits at the end of the title row (a finished step's Remove), so a
 * finished step costs one line.
 */
export function StepperStep({
  number,
  title,
  state,
  isLoading = false,
  isLast = false,
  action,
  bodyKey,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  isLoading?: boolean;
  isLast?: boolean;
  action?: ReactNode;
  /** Which body `children` is. A new key cross-fades; none draws no body. */
  bodyKey?: string;
  children?: ReactNode;
}) {
  const isDone = state === "done" && !isLoading;

  return (
    <li className={`relative flex gap-3 ${isLast ? "" : "pb-3.5"}`}>
      {isLast ? null : (
        <span
          aria-hidden="true"
          className="absolute top-6 bottom-1 left-[9.5px] w-px overflow-hidden bg-border"
        >
          <span
            className={`absolute inset-0 origin-top bg-accent transition-transform duration-300 ease-out ${
              isDone ? "scale-y-100" : "scale-y-0"
            }`}
          />
        </span>
      )}

      <span aria-hidden="true" className={disc(state, isLoading)}>
        <AnimatePresence initial={false} mode="popLayout">
          {isLoading ? null : isDone ? (
            <motion.span key="check" {...POP} className="flex">
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span key="number" {...POP}>
              {number}
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={title}
              {...FADE}
              className={`text-sm transition-colors ${
                isLoading || state === "upcoming"
                  ? "text-muted"
                  : state === "current"
                    ? "font-medium text-foreground"
                    : "text-foreground"
              }`}
            >
              {title}
              {isDone ? <span className="sr-only"> (done)</span> : null}
              {state === "current" && !isLoading ? (
                <span className="sr-only"> (next step)</span>
              ) : null}
            </motion.p>
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {action ? (
              <motion.span key="action" {...FADE} className="flex shrink-0">
                {action}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        {/* `popLayout`, not `wait`: the leaving body is lifted out of the flow
            at once and fades over the space as it closes. With `wait` it held
            its height through its fade, so a step closing while the next one
            opened made the footer grow by both before shrinking — measured
            253 → 306 → 197px for one press of "Already added". */}
        <AnimatedHeight>
          <AnimatePresence initial={false} mode="popLayout">
            {bodyKey === undefined ? null : (
              <motion.div key={bodyKey} {...stepMotion()} className="space-y-2 pt-2">
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatedHeight>
      </div>
    </li>
  );
}

/**
 * Every state keeps a 1px border — transparent where the disc is solid — so
 * the size never changes and colour is all there is to transition. The halo is
 * a `ring`, which Tailwind draws as a box-shadow list that interpolates.
 */
function disc(state: StepState, isLoading: boolean): string {
  const base =
    "relative flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] " +
    "transition-[background-color,border-color,color,box-shadow] duration-200";

  if (isLoading) return `${base} animate-pulse border-transparent bg-default`;
  if (state === "done") return `${base} border-accent bg-accent text-accent-foreground`;
  if (state === "current") {
    return `${base} border-accent bg-accent font-medium text-accent-foreground ring-4 ring-accent-soft`;
  }
  return `${base} border-border bg-background text-muted`;
}
