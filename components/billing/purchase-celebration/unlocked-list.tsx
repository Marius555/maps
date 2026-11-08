"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import type { MarketingPlan } from "@/lib/marketing/plans";

/**
 * What the plan just bought, one line each, arriving one after another.
 *
 * Read from `MARKETING_PLANS` — the same numbers the pricing page and the plan
 * columns print — rather than from the enforcing table, which is server-only.
 * Only what the plan actually has is listed: a line saying "not included" has
 * no place in a thank-you.
 */
export function UnlockedList({ plan }: { plan: MarketingPlan }) {
  const reduce = useReducedMotion();

  const lines = [
    `${count(plan.maps)} maps, ${count(plan.places)} locations on each`,
    plan.routes ? "Routes with drive times" : null,
    plan.sheetSync ? "Google Sheets sync" : null,
    plan.analytics ? "Visitor analytics" : null,
    plan.seats > 1 ? `${count(plan.seats)} people on the team` : null,
    plan.noBadge ? "No “Made with” badge on your map" : null,
  ].filter((line): line is string => line !== null);

  return (
    <ul className="space-y-2 text-left text-sm">
      {lines.map((line, index) => (
        <motion.li
          key={line}
          className="flex items-center gap-2.5 text-foreground"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.45 + index * 0.07, ease: [0, 0, 0.2, 1] }}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
          </span>
          {line}
        </motion.li>
      ))}
    </ul>
  );
}

/**
 * Written out with a thousands separator rather than `Intl`'s compact form,
 * which renders differently on the server and in Chrome (CLAUDE.md).
 */
function count(value: number): string {
  return value.toLocaleString("en-US");
}
