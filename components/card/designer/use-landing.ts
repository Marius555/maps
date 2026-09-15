"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

import {
  LANDING_FROM,
  LANDING_KEYFRAMES,
  LANDING_RING_KEYFRAMES,
  LANDING_RING_TRANSITION,
  LANDING_TRANSITION,
} from "@/components/ui/list-row-motion";

/**
 * A block dropping into place: its content bounces and a ring flashes round it.
 *
 * **Started imperatively, and that was forced rather than chosen.** The first
 * version was declarative — `initial="lifted"`, `animate="landing"` — and it
 * worked for a block off the palette and did nothing at all for a block moved
 * into a pair, or back out of one. Each zone of the canvas is an
 * `AnimatePresence initial={false}`, and Motion's `PresenceChild` memoises its
 * context on `isPresent`, so a line that has been on the card since the page
 * loaded goes on saying `initial: false` for the rest of its life. A block
 * remounted into that line gets `blockInitialAnimation` and is initialised at
 * the *end* of every animation it declares: measured in the browser, the ring
 * arrived already at opacity 0 and scale 1.07, and the content already at rest.
 * The palette drop only animated because its line was brand new.
 *
 * **Plain `animate` and our own refs, not `useAnimate`, and that was forced
 * too.** `useAnimate` stops every animation in its scope from an unmount effect,
 * and the App Router runs React Strict Mode in development, which disconnects
 * and reconnects a freshly mounted component's effects. The landing started in
 * the layout effect and was stopped by that disconnect a frame later: measured,
 * the content got exactly one frame (scale 1.08 → 1.0696) and froze there, and
 * the ring's opacity never started. Its element being a hook's return value is
 * also why lint refused the first frame written by hand below.
 *
 * **Nothing here stops a landing.** Not a cleanup — the flag that starts it is
 * cleared on a timer, and a landing cut off when that fires is the bug the
 * timer's own placement was moved to fix (the effect after `onDrop`). Not an
 * unmount either: a landing is 420ms, and an element removed part-way through it
 * simply finishes on a detached node. A second landing on the same element
 * needs no stop, because Motion starts each value's animation over the last.
 *
 * A layout effect with the first frame written by hand, because Motion draws
 * its first keyframe on its next frame and the browser would otherwise paint one
 * frame of the block already at rest before it jumps up to begin the fall.
 *
 * **Reduced motion keeps the flash and loses the bounce.** A plain `animate`
 * does not see `MotionConfig`, so the preference is asked here; the ring's
 * opacity is not motion, and it is the part that says a drop landed.
 */
export function useLanding(isLanding: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const content = contentRef.current;
    const ring = ringRef.current;
    if (!isLanding || !content || !ring) return;

    if (prefersReducedMotion) {
      void animate(
        ring,
        { opacity: LANDING_RING_KEYFRAMES.opacity },
        LANDING_RING_TRANSITION,
      );
      return;
    }

    content.style.transform = LANDING_FROM;
    void animate(content, LANDING_KEYFRAMES, LANDING_TRANSITION);
    void animate(ring, LANDING_RING_KEYFRAMES, LANDING_RING_TRANSITION);
  }, [isLanding, prefersReducedMotion]);

  return { contentRef, ringRef };
}
