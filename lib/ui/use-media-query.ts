"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query as a boolean.
 *
 * Almost everything in this app branches in CSS, which is the right default —
 * `hidden md:flex` needs no JavaScript and cannot be wrong on the first render.
 * This exists for the one case CSS cannot cover: choosing between two *different
 * components* rather than two layouts of one. A dialog and a bottom sheet are
 * separate React Aria overlays with separate focus traps, and rendering both and
 * hiding one would put two of them in the DOM at once.
 *
 * `useSyncExternalStore` rather than an effect and a `useState`, so the value is
 * read during render instead of one paint late.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);

      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * No `window` on the server. False for every query, which is why callers should
 * phrase theirs so that false is the safe answer — and why the only caller here
 * asks "is this a wide screen?" from inside a dialog that cannot open until the
 * client has taken over anyway.
 */
function getServerSnapshot(): boolean {
  return false;
}

/** Tailwind's `sm`, the breakpoint every other dialog in the app sizes against. */
export const SM_BREAKPOINT = "(min-width: 40rem)";
