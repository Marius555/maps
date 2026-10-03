"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Long enough to be seen as a change of page, short enough that the page never
 * feels held back by its own entrance. It was 0.18s, opacity only, and read as
 * nothing at all.
 */
const FADE = { duration: 0.24, ease: "easeOut" } as const;

/** How far a rising page travels. Small: it says "new page", not "look at me". */
const RISE_PX = 8;

/**
 * Whether this document has committed once. Set by a passive effect, which
 * runs after every layout effect of the same commit — so every fade mounted by
 * a document load sees `false` and stays still, and every fade mounted later,
 * by a client navigation into another route group's layout, sees `true`.
 */
let documentSettled = false;

export type RouteFadeOptions = {
  /**
   * Rise 8px as it fades. Only where the element is not a scroller and holds
   * nothing `position: fixed` — a transform makes it their containing block for
   * as long as it plays. The dashboard's and the console's `<main>` are both.
   */
  rise?: boolean;
  /**
   * Fade on mounting after a client navigation, not only on a key change.
   * Off for an element nested inside another fading one (`SettingsPane` inside
   * `PageMain`), where two fades at once would multiply into one darker dip.
   */
  onMount?: boolean;
};

/**
 * Fades `ref`'s element in whenever `routeKey` changes — the page transition.
 *
 * **A layout effect, on purpose.** `usePathname` changes in the same commit as
 * the new page (or its `loading.tsx` skeleton); a passive effect runs after that
 * commit has painted, so the page flashed in at full opacity for a frame and
 * then blinked to nothing before fading. Started here, the first frame the
 * browser paints is already the first frame of the fade.
 *
 * **On mount too, after a client navigation.** A layout that mounts because the
 * visitor crossed into its route group (/pricing → /login → /maps) has no
 * previous key, and treating that as "first mount" is what left every such
 * navigation without a transition. A document load still does not fade: it has
 * nothing to transition from (`documentSettled`).
 *
 * **Not under reduced motion**: the fade tells nobody anything the new page
 * does not already say, so its static form is no fade at all. Imperative
 * `animate` does not read `MotionConfig`, which is why this asks itself.
 *
 * A fade cut short is *completed*, never stopped: a stopped animation keeps
 * whatever opacity it had reached and would leave the page half transparent.
 * A rise ends by clearing its transform, so the element is no containing block
 * once it has arrived.
 */
export function useRouteFade(
  ref: RefObject<HTMLElement | null>,
  routeKey: string,
  { rise = false, onMount = true }: RouteFadeOptions = {},
): void {
  const reduceMotion = useReducedMotion();
  const shownKey = useRef<string | null>(null);
  const running = useRef<ReturnType<typeof animate> | null>(null);

  useLayoutEffect(() => {
    // Reduced motion switched on mid-fade: land the page where it belongs.
    if (reduceMotion) running.current?.complete();
    if (shownKey.current === routeKey) return;

    const mounting = shownKey.current === null;
    shownKey.current = routeKey;
    // A newer page cuts the older fade short rather than racing it.
    running.current?.complete();
    running.current = null;

    if (mounting && (!documentSettled || !onMount)) return;

    const element = ref.current;
    if (!element || reduceMotion) return;

    const controls = rise
      ? animate(
          element,
          { opacity: [0, 1], transform: [`translateY(${String(RISE_PX)}px)`, "none"] },
          FADE,
        )
      : animate(element, { opacity: [0, 1] }, FADE);

    if (rise) {
      void controls.finished.then(() => {
        element.style.transform = "";
      });
    }

    running.current = controls;
    /*
     * No cleanup that completes it. React's development double-run unmounts and
     * remounts every effect once on mount, so a cleanup that completed the fade
     * would end every on-mount fade on its first frame under `next dev`.
     * Completion happens above, when a newer key or reduced motion actually asks
     * for it; an unmounted element has nothing left to show.
     */
  }, [ref, routeKey, reduceMotion, rise, onMount]);

  useEffect(() => {
    documentSettled = true;
  }, []);
}
