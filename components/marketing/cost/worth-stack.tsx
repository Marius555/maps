"use client";

import { motion } from "motion/react";

import type { Segment } from "@/lib/marketing/compare";

import { MIN_SHARE } from "../min-share";

/**
 * The three greys, brightest first — the order the segments are listed in.
 *
 * Brighter than they look like they need to be: the track under them is 8% of
 * the page's ink, and a segment near that weight is a gap rather than a part.
 */
const TONES = ["0.55", "0.38", "0.24"] as const;

const SPRING = { type: "spring", stiffness: 170, damping: 26 } as const;

/**
 * One bill made of several, drawn as a single track split into its parts.
 *
 * A stack rather than three bars, because the claim is about the *total* a flat
 * plan stands in for: three separate bars invite the reader to compare them
 * with each other, which is not the comparison being made.
 *
 * The segments are tones of the page's own ink rather than three hues. Nothing
 * here is a category that wants its own colour — they are parts of one number,
 * and the only thing on this chart that earns the accent is the bar underneath.
 *
 * **An assumed figure is drawn as stripes and says so in the list.** A pattern
 * alone would be a state told only in colour; the word "assumed" beside the
 * amount is the form that survives a screenshot, a printer and a screen reader.
 */
export function WorthStack({ segments, total }: { segments: Segment[]; total: number }) {
  return (
    /* A 2px seam between segments: three tones of one ink on a dark ground are
       hard to tell apart, and a stack nobody can read the parts of is a bar.
       The track clips the extra width the gaps add. */
    <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-foreground/[0.08]">
      {segments.map((segment, index) => (
        <motion.div
          key={segment.id}
          className="h-full"
          style={{
            background: segment.assumed
              ? `repeating-linear-gradient(135deg, color-mix(in oklch, var(--foreground) ${Number(TONES[index]) * 100}%, transparent) 0 3px, transparent 3px 6px)`
              : `color-mix(in oklch, var(--foreground) ${Number(TONES[index]) * 100}%, transparent)`,
          }}
          initial={false}
          animate={{
            width: `${(Math.max(share(segment.amountUsd, total), MIN_SHARE) * 100).toFixed(2)}%`,
          }}
          transition={SPRING}
        />
      ))}
    </div>
  );
}

function share(amount: number, total: number): number {
  return total > 0 ? amount / total : 0;
}
