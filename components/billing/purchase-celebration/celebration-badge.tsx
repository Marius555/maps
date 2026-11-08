"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const EASE = [0.2, 0.9, 0.3, 1.2] as const;

/**
 * The check at the top of the post-purchase dialog: a disc that pops in, the
 * check drawn after it, and one soft ring that spreads out and fades — the
 * moment the plan is confirmed, once.
 *
 * Under `prefers-reduced-motion` it is the finished disc and check and no ring,
 * which still tells the whole story (CLAUDE.md: a state told only in motion is
 * told to nobody).
 */
export function CelebrationBadge() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto flex size-16 items-center justify-center" aria-hidden="true">
      {reduce ? null : (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent"
          initial={{ opacity: 0.35, scale: 1 }}
          animate={{ opacity: 0, scale: 1.9 }}
          transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
        />
      )}

      <motion.span
        className="relative flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg"
        initial={reduce ? false : { opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <motion.span
          className="flex"
          initial={reduce ? false : { opacity: 0, scale: 0.4, rotate: -25 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.35, delay: 0.2, ease: EASE }}
        >
          <Check className="size-8" strokeWidth={3} />
        </motion.span>
      </motion.span>
    </div>
  );
}
