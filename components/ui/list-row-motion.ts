"use client";

import type { HTMLMotionProps } from "motion/react";

/**
 * How something arrives, leaves, and moves in a list or a panel.
 *
 * One definition for every row kind of the Locations panel — locations, shapes,
 * group headers — because they share a list and any drift between them would
 * show up as one row travelling at a different speed from the one above it. And
 * one definition for the blocks that come and go elsewhere, so a warning
 * appearing under the import table moves the way the app already moves.
 *
 * **Height, not just opacity.** A row that only fades leaves its gap behind for
 * the length of the fade and then the list snaps shut. Collapsing the height is
 * what turns a removal into one movement instead of two.
 */
const HIDDEN = { opacity: 0, height: 0 } as const;
const SHOWN = { opacity: 1, height: "auto" } as const;
const TRANSITION = { duration: 0.15, ease: [0, 0, 0.2, 1] } as const;

/**
 * A row of a list.
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
    initial: HIDDEN,
    animate: SHOWN,
    exit: HIDDEN,
    transition: TRANSITION,
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

/**
 * The same arrival and departure, for a block that is not a list row.
 *
 * No `layout`: these are one or two blocks in a fixed slot, not siblings that
 * reorder, so there is no position to animate and nothing to pay for measuring.
 *
 * The same margin trap applies and bites harder, because the slots this goes in
 * are usually `space-y-*`: put the animated element inside one stable wrapper
 * and carry any gap as padding *within* it, via `COLLAPSE_CLASS`. A `space-y`
 * margin on the animated element itself does not collapse with the height, so an
 * exiting block leaves its full gap behind and then the page snaps shut.
 */
export function collapseMotion(): HTMLMotionProps<"div"> {
  return {
    initial: HIDDEN,
    animate: SHOWN,
    exit: HIDDEN,
    transition: TRANSITION,
  };
}

/** Clips the block while its height animates, and carries the gap below it. */
export const COLLAPSE_CLASS = "overflow-hidden pb-2 last:pb-0";

/**
 * How one whole screen of a flow replaces another.
 *
 * The import wizard's four steps used to hard-cut, which read as a page
 * navigation rather than as progress through one task — and now that the steps
 * are different widths as well as different heights, the cut is two changes at
 * once with nothing tying them together.
 *
 * The vocabulary is the app's own: 150ms and the same curve as every list row,
 * with the fade-plus-4px lift `map-hint-bar.tsx` already uses. It leaves
 * *upwards* and arrives from below, so the movement reads as one screen making
 * way for the next rather than two unrelated fades.
 *
 * No `layout` and no height animation. Animating the height needs a clipping
 * parent, and clipping the import wizard breaks the review step's sticky map. So
 * the container's height simply changes under the cross-fade — see the note on
 * `mode` in import-wizard.tsx, which is the part of this that took a decision.
 */
export function stepMotion(): HTMLMotionProps<"div"> {
  return {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: TRANSITION,
  };
}
