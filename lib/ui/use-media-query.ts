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

/**
 * Below Tailwind's `md` — the range where the app has a mobile header and the
 * card designer's sidebar is an off-canvas panel rather than a column.
 *
 * The range syntax mirrors the `max-md:` utilities it has to agree with exactly;
 * a hand-written `(max-width: 47.99rem)` is a rounding error waiting to put the
 * attribute and the layout on different sides of one pixel.
 *
 * Phrased so that `false` is the safe answer on the server, per the note above:
 * its one caller asks "is this narrow enough that the panel is an overlay?", and
 * answering no leaves the panel reachable, which is what every wider screen
 * wants anyway.
 */
export const MD_DOWN = "(width < 48rem)";

/**
 * Tablet width: the designer's sidebar is a column of the page again, but still
 * stacked *under* the card rather than beside it.
 *
 * The band exists because it is the one place with neither of the two ways of
 * reaching the panel — no off-canvas trigger (the mobile header is `md:hidden`)
 * and no side-by-side column (that starts at `lg`). Selecting a block therefore
 * has to scroll it into view; see `DesignerSidePanel`.
 *
 * Range syntax for the same reason `MD_DOWN` uses it: these two numbers have to
 * be the same two Tailwind's `md:` and `lg:` are, not a rounding of them.
 */
export const MD_TO_LG = "(48rem <= width < 64rem)";

/**
 * Below Tailwind's `lg` — the range where the map editor stacks.
 *
 * The editor's own breakpoint, and the one the locations sheet uses: above it
 * the panel is a column beside the map, below it the same element is a bottom
 * sheet over it. Range syntax for the reason the two above give — these have to
 * be the same number Tailwind's `lg:` is, not a rounding of it.
 *
 * Phrased so the server's `false` is the safe answer: its caller asks "is the
 * panel a sheet?", and answering no leaves the list reachable, which is what
 * every wider screen wants anyway.
 */
export const LG_DOWN = "(width < 64rem)";
