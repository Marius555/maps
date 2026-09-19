"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** Long enough to read as a bill filling in, short enough to be over by the time the lines are. */
const DURATION = 1.1;

/** The house curve — `Reveal` and `SnapScroll` move on the same one. */
const EASE = [0, 0, 0.2, 1] as const;

/**
 * A money figure that counts up from nothing the first time it is shown.
 *
 * **The served HTML still has the real number, and that is the constraint that
 * shaped it.** The survey section's rule is that its figures must survive with
 * no JavaScript at all (docs/notes/marketing.md) — the chart beside them is
 * `ssr: false`, and these are what the server sends instead. Starting the motion
 * value at 0 would print "$0" into that HTML, which is the same bug ../reveal.tsx
 * records for an element that shipped invisible. So the first render prints
 * `value`; a layout effect, which runs after hydration and *before* paint, drops
 * it to 0; and the count runs once `run` turns true. By the time anybody can
 * scroll to this section the zero is what is on screen, so nothing flashes.
 *
 * **Reduced motion leaves the number alone.** `MotionConfig reducedMotion="user"`
 * governs Motion's components, not an imperative `animate()`, so it is checked
 * here — and it skips the zeroing too, or a visitor who asked for no motion would
 * be shown $0 until they scrolled.
 *
 * **The text is one motion value, set directly — not a `useTransform` of a
 * number.** A transform recomputes on Motion's next frame, and its layout-effect
 * cleanup cancels that frame; React runs every effect twice in development, so
 * the zeroing was scheduled, cancelled, and then not re-sent because the number
 * was already 0 — the figure sat at its final value until the count began and
 * then jumped to $0, measured. Setting the string itself writes `textContent`
 * synchronously, and `animate(0, value)` drives the same value from a plain
 * number.
 *
 * Once only: counting again every time the section is scrolled past would turn a
 * read-through into a flicker, which is `Reveal`'s `once: true` for the same
 * reason. The width it will end at is reserved by the caller (../reserve.tsx), so
 * a column of these does not move while it counts.
 */
export function CountUp({
  value,
  currency,
  run,
}: {
  value: number;
  currency: "$" | "€";
  /** True once the section this belongs to is on screen. */
  run: boolean;
}) {
  const reduced = useReducedMotion();
  const text = useMotionValue(money(currency, value));
  const counted = useRef(false);

  useLayoutEffect(() => {
    if (reduced || counted.current) return;

    text.set(money(currency, 0));
  }, [currency, reduced, text]);

  useEffect(() => {
    if (reduced || !run || counted.current) return;

    // Marked done on *completion*, not on start: an effect that is cleaned up
    // mid-count (React runs every effect twice in development) has to be able
    // to start again, or the figure is left stranded wherever it was stopped.
    const controls = animate(0, value, {
      duration: DURATION,
      ease: EASE,
      onUpdate: (amount) => text.set(money(currency, amount)),
      onComplete: () => {
        counted.current = true;
      },
    });

    return () => controls.stop();
  }, [currency, reduced, run, text, value]);

  return <motion.span>{text}</motion.span>;
}

function money(currency: "$" | "€", amount: number): string {
  return `${currency}${MONEY.format(amount)}`;
}
