"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, type RefObject } from "react";

/** Short enough that the page never feels held back by its own entrance. */
const FADE = { duration: 0.18, ease: "easeOut" } as const;

/**
 * Fades `ref`'s element in whenever `routeKey` changes — the dashboard's page
 * transition.
 *
 * **Opacity only, never a transform.** The element is `<main>`, the dashboard's
 * one scroller, and a transform on it would make it the containing block of
 * every `position: fixed` descendant for the length of the animation, and nudge
 * the MapLibre canvas while it measures itself.
 *
 * **A layout effect, on purpose.** `usePathname` changes in the same commit as
 * the new page (or its `loading.tsx` skeleton); a passive effect runs after that
 * commit has painted, so the page flashed in at full opacity for a frame and
 * then blinked to nothing before fading. Started here, the first frame the
 * browser paints is already the first frame of the fade.
 *
 * **Not on first mount**, since a document load has nothing to transition from,
 * and not under reduced motion: the fade tells nobody anything the new page
 * does not already say, so its static form is no fade at all. Imperative
 * `animate` does not read `MotionConfig`, which is why this asks itself.
 *
 * The cleanup *completes* rather than stops. A stopped animation keeps whatever
 * opacity it had reached, and anything that re-runs this effect without a new
 * key — reduced motion toggled mid-fade — would leave the page half transparent.
 */
export function useRouteFade(
  ref: RefObject<HTMLElement | null>,
  routeKey: string,
): void {
  const reduceMotion = useReducedMotion();
  const shownKey = useRef(routeKey);

  useLayoutEffect(() => {
    if (shownKey.current === routeKey) return;
    shownKey.current = routeKey;

    const element = ref.current;
    if (!element || reduceMotion) return;

    const controls = animate(element, { opacity: [0, 1] }, FADE);

    return () => controls.complete();
  }, [ref, routeKey, reduceMotion]);
}
