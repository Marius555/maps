"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

import { MIN_SHARE } from "../min-share";

const SPRING = { stiffness: 170, damping: 26 } as const;

/**
 * One bill: a name, a monthly amount, and a bar.
 *
 * Both bars share one scale — the larger of the two bills at this traffic — so
 * their lengths are honest against each other at every position of the slider,
 * including the ones where the metered bill is the shorter.
 *
 * The amount counts to its new value and the bar springs to its new length, so
 * dragging reads as the bill *growing* rather than being replaced. The server
 * renders both at rest (`initial={false}`, and a spring's first value is its
 * target), so the numbers are on the page before any script runs.
 */
export function CostBar({
  label,
  amount,
  currency,
  share,
  emphasis,
}: {
  label: string;
  amount: number;
  currency: "$" | "€";
  /** This bill against the larger one, 0–1. */
  share: number;
  /** The one bar the chart is about wears the accent; the other the muted ink. */
  emphasis: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className={emphasis ? "font-semibold text-foreground" : "text-muted"}>
          {label}
        </span>
        <span className="text-foreground tabular-nums">
          <Amount value={amount} currency={currency} />
          <span className="text-muted"> / month</span>
        </span>
      </div>

      <div className="mt-2 h-3 overflow-hidden rounded-full bg-foreground/[0.08]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: emphasis ? "var(--accent)" : "var(--muted)" }}
          initial={false}
          animate={{ width: `${(Math.max(share, MIN_SHARE) * 100).toFixed(2)}%` }}
          transition={{ type: "spring", ...SPRING }}
        />
      </div>
    </div>
  );
}

const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * A money figure that counts to its new value rather than being replaced.
 *
 * Exported because the worth chart beside this one is driven by the same slider
 * and has to move the same way; two counters with two springs on one panel read
 * as two panels.
 */
export function Amount({ value, currency }: { value: number; currency: "$" | "€" }) {
  const spring = useSpring(value, SPRING);
  const text = useTransform(spring, (current) => `${currency}${MONEY.format(current)}`);

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className="font-semibold">{text}</motion.span>;
}
