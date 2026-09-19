"use client";

import { motion } from "motion/react";

/**
 * The page's only scroll animation.
 *
 * One wrapper rather than a `whileInView` written at each call site, because a
 * landing page whose sections each arrive slightly differently reads as several
 * pages stapled together. The transition is the app's house one — 150ms on
 * `[0, 0, 0.2, 1]`, the same curve `--duration-fast` and
 * `components/ui/list-row-motion.ts` already use — so the marketing pages move
 * the way the product does.
 *
 * `once: true` matters: a section that re-animates every time it is scrolled
 * past turns a read-through into a flicker.
 *
 * **It moves and does not fade, and that is a correctness rule rather than a
 * taste one.** Motion renders `initial` as an inline style during SSR, so a
 * reveal that started at `opacity: 0` shipped nineteen elements to the browser
 * already invisible — and with scripts blocked, an IntersectionObserver that
 * never runs leaves them that way. Measured on the served HTML, not guessed:
 * everything below the hero was a blank page. A transform-only reveal ships
 * `translateY(12px)` instead, which is a paragraph twelve pixels low and
 * nothing else.
 *
 * Reduced motion then needs nothing. `AppProviders` wraps the app in
 * `<MotionConfig reducedMotion="user">`, and transform is exactly the kind of
 * animation that setting disables — so the element lands at its resting
 * position with no movement at all, which is the finished state.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className={className}
      initial={{ y: 12 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
