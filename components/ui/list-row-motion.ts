"use client";

import type { HTMLMotionProps } from "motion/react";

/**
 * How a row of the Locations panel arrives, leaves, and moves.
 *
 * One definition for the three row kinds — locations, shapes, group headers —
 * because they share a list and any drift between them would show up as one row
 * travelling at a different speed from the one above it.
 *
 * **Height, not just opacity.** A row that only fades leaves its gap behind for
 * the length of the fade and then the list snaps shut. Collapsing the height is
 * what turns a removal into one movement instead of two.
 *
 * **`layout="position"`, not `layout`.** Position is the only thing worth
 * animating here: every row is the same height, so a size animation would have
 * nothing to say and would squash the row while it played. It is also the
 * cheaper of the two.
 */
export function listRowMotion(
  /**
   * False past the size cap in `editor-sidebar.tsx`. Rows still fade in and out,
   * they just stop travelling: layout animations measure every sibling on every
   * commit, and §6 allows 3,000 locations on one map.
   */
  animateMoves: boolean,
): HTMLMotionProps<"li"> {
  return {
    layout: animateMoves ? "position" : false,
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.15, ease: [0, 0, 0.2, 1] },
  };
}

/**
 * Clips the row while its height animates, and carries the gap between rows.
 *
 * The gap is padding *inside* the animated element rather than `space-y` on the
 * list: a margin does not collapse with the height, so a removed row would leave
 * 2px of nothing behind it.
 */
export const LIST_ROW_CLASS = "overflow-hidden pb-0.5";
