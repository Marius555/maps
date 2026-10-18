"use client";

import { MousePointerClick } from "lucide-react";
import { motion } from "motion/react";

/**
 * What to do next, while "Drop a pin" is armed: where to press, and how to
 * back out.
 *
 * Bottom-left, opposite the ⓘ and inside the cards' bottom inset. "Click" for
 * a mouse, "Tap" where there is no hover, chosen in CSS so the markup is right
 * on both; a touch screen has no Escape, so it is only offered with "Click".
 */
export function HeroDropHint() {
  return (
    <motion.p
      aria-live="polite"
      className="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-full bg-[var(--map-chrome)] px-2.5 py-1 text-xs text-foreground backdrop-blur-md"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
    >
      <MousePointerClick aria-hidden="true" className="size-3.5 text-accent" />
      <span className="[@media(hover:none)]:hidden">
        Click the map to place your pin · Esc to cancel
      </span>
      <span className="hidden [@media(hover:none)]:inline">
        Tap the map to place your pin
      </span>
    </motion.p>
  );
}
