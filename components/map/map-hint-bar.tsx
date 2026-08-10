"use client";

import { AnimatePresence, motion } from "motion/react";

/**
 * The "click the map" hint.
 *
 * Bottom-centre, not top-centre: the toolbar wraps onto a second line on narrow
 * viewports and used to collide with this. The bottom edge is also where the eye
 * ends up after reading the toolbar, and it clears the attribution because that
 * sits bottom-right.
 *
 * Animated because it appears and disappears in response to a mode the user just
 * switched — that is feedback, not decoration (§8). It needs `AnimatePresence`
 * rather than a CSS transition for one reason: React unmounts the element the
 * instant `isVisible` goes false, so without this there is nothing left to fade.
 * Reduced motion is handled globally by MotionConfig in app-providers.
 */
export function MapHintBar({
  isVisible,
  message = "Click the map to add a location. Press Esc to stop.",
}: {
  isVisible: boolean;
  /** Overridden while a pin is being dragged, which is a different instruction. */
  message?: string;
}) {
  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          // Matches --duration-fast / --ease-out from globals.css. Motion takes
          // numbers and a cubic-bezier array, not CSS variables.
          transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3"
        >
          <p
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground shadow-sm"
            role="status"
          >
            {message}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
