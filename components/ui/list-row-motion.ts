"use client";

import type { HTMLMotionProps } from "motion/react";

import { findBlock, type CardLayout } from "@/packages/shared/card-layout";

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
/**
 * The same arrival and departure with the height left alone — for the card
 * designer, where the space a block leaves behind is closed by its neighbours
 * moving rather than by the block folding shut. See `movingBlockMotion`.
 */
const FADED = { opacity: 0 } as const;
const OPAQUE = { opacity: 1 } as const;
const TRANSITION = { duration: 0.15, ease: [0, 0, 0.2, 1] } as const;
/**
 * No transition at all — for the exit of something that was never leaving.
 *
 * A duration rather than removing the animation, because `AnimatePresence` waits
 * for the exit to *finish* before it unmounts the child. Zero is the shortest
 * way to say "already done". See `movingBlockMotion`.
 */
const AT_ONCE = { duration: 0 } as const;

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
 * One line of the card designer: no gap of its own, and **no clip**.
 *
 * The gap is not this wrapper's to carry: `CardZoneBox` is a flex column that
 * already pays `gap-[var(--card-gap)]`, so `LIST_ROW_CLASS` would add two
 * pixels on top of a number the owner chose. That made the studio draw every
 * boundary slightly wider than `CardView` and the embed draw it — and once the
 * drop slots became arithmetic over those same gaps, two pixels a slot between
 * where an outline is drawn and where the block actually lands.
 *
 * **`overflow-hidden` had to go, and that is the whole of why the height
 * animation went with it.** Travel now belongs to the block rather than to the
 * line (`movingBlockMotion` below, and `DesignerBlock`'s own `layoutId`), and a
 * block travelling *into* a line begins that animation at its old position —
 * outside this box. Clipped, it played as a block appearing at the edge of its
 * new row rather than as one arriving from where it was. Nothing spills without
 * the clip either, because nothing here animates its height any more: each
 * block still clips its own content to its own rounded corners.
 */
export const CARD_BLOCK_ROW_CLASS = "min-w-0";

/**
 * How a *line* of the card designer arrives and leaves. Not how it travels.
 *
 * **The travel is deliberately not here any more**, and neither is the height
 * collapse that used to make a removal read as one movement. Both moved down a
 * level, to `DesignerBlock`, and the reason is that a line has no stable
 * identity to animate: lines are paired by adjacency (`cardRows`), so swapping
 * two halves, or pulling one out of a pair, tears a row down and builds another
 * one — which React reconciles as an exit and an entrance, however it is keyed.
 * A block's id, by contrast, is stable for its whole life, which is exactly what
 * `layoutId` needs. So the block travels and this only fades.
 *
 * The gap a removed line leaves is closed by its surviving neighbours' own
 * `layout="position"`, which is the better animation anyway: the block that is
 * going fades where it stands while the rest of the card slides up, rather than
 * the card folding shut around it.
 *
 * Same 150ms and same curve as every list row, so a block still settles at the
 * speed the Locations panel settles at.
 *
 * **And it fades for its block's sake, not its own**, which is the whole of the
 * two arguments. Because a row is torn down and rebuilt whenever the lines are
 * re-paired, `AnimatePresence` saw an entrance and an exit for blocks that had
 * merely changed lines: dragging a name off the logo's line made the logo's new
 * row *fade in* under it, and dragging it back faded a copy of the name out at
 * the position it had already left. Neither block arrived on the card or left
 * it. A line is not something anyone made, so it has nothing of its own to
 * announce — it announces the block it is keyed on.
 *
 * `isArriving` answers the entrance and is the caller's to know: only a block
 * off the palette is new to the card (`justLanded` in card-designer.tsx), and
 * `initial` is read once at mount, so the flag being cleared later cannot reach
 * it.
 *
 * The exit is a **label** rather than a target, and that is the one thing here
 * that is not a free choice. A removed component's props can never be updated
 * again, so an exit that has to ask a question about the card *after* the edit
 * can only be a dynamic variant — `AnimatePresence`'s own `custom` is the
 * documented way to reach one, and this file's contract is therefore that the
 * caller passes the current layout there. `findBlock` is the question: a block
 * still on the card was re-homed, and its old line should go at once rather
 * than leave a second copy of it fading for 150ms; a block that is really gone
 * fades exactly as it always did.
 */
export function movingBlockMotion(
  /** The block this line is keyed on — whose arrival or departure this is. */
  id: string,
  /** Whether a block that is new to the *card* is on this line. */
  isArriving: boolean,
): HTMLMotionProps<"div"> {
  return {
    // `false` is "start where `animate` ends, without animating", which is what
    // a line inheriting a block that was already on screen has to do.
    initial: isArriving ? FADED : false,
    animate: OPAQUE,
    variants: {
      gone: (layout: CardLayout) => ({
        ...FADED,
        ...(findBlock(layout, id) ? { transition: AT_ONCE } : {}),
      }),
    },
    exit: "gone",
    transition: TRANSITION,
  };
}

/**
 * How a block that has **just landed** from the palette settles into the card.
 *
 * The one arrival that is not a travel. A block being *moved* is already on
 * screen, so `movingBlockTravel` glides it from where it was and that is the
 * whole story; a block coming off the palette has no previous position on the
 * card at all, and used to simply be there at full size the moment the pointer
 * came up — the row's opacity fade underneath it says something arrived, but not
 * that it arrived *here*.
 *
 * A little scale is what says it. Same 150ms and same curve as everything else,
 * so it reads as the block settling rather than as a separate flourish, and the
 * neighbours sliding down to make room for it are their own `layout="position"`.
 *
 * **It goes on the block's inner content box, never on the block itself.** That
 * element's transform belongs to `movingBlockTravel`'s `layoutId` projection,
 * and two animators on one property is the bug `card-drop-overlay.tsx` spells
 * out at length. `scale` is also a transform, so Motion's own reduced-motion
 * handling covers it without an opt-out here.
 *
 * No `exit`: a block that is leaving is either being dragged away — where the
 * ghost under the pointer is the thing that moves — or removed, where the row's
 * own fade is the whole animation.
 */
export function landedBlockMotion(): HTMLMotionProps<"div"> {
  return {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    transition: TRANSITION,
  };
}

/**
 * How one block of the card designer travels, and the only thing that does.
 *
 * Two props, and each answers a different move:
 *
 * - `layout="position"` is for a block whose element survives the edit — a lone
 *   half crossing to the other column of its own line, two halves swapping
 *   sides. Position only, because the height handle reports continuously while
 *   it is held and animating size as well would make it feel like rubber.
 * - `layoutId` is for a block whose element does *not* survive it. Lines are
 *   paired by adjacency, so pulling a half out of a pair rebuilds the rows
 *   around it and React reconciles that as an exit and an entrance — there is no
 *   key that avoids it. A block id is stable for the block's whole life, so
 *   Motion matches the two elements across the rebuild and animates the new one
 *   from where the old one was.
 *
 * The id is namespaced because `layoutId` matches across the whole tree, and a
 * block id is only unique within one card.
 */
export function movingBlockTravel(id: string): HTMLMotionProps<"div"> {
  return {
    layout: "position",
    layoutId: `card-block:${id}`,
    transition: TRANSITION,
  };
}

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
 * How something that arrives *because a gesture started* moves.
 *
 * The one spring in the app, and deliberately not the 150ms curve everything
 * else uses. A drop target that appears mid-drag is competing for the attention
 * of someone already watching their own pointer, and a spring's slight overshoot
 * is what catches that eye where a linear decelerate does not. The numbers are
 * `ungroup-drop-zone.tsx`'s, which is where this feel was arrived at; it is
 * exported so the card designer's removal wall is the same spring rather than a
 * second one that happens to match today.
 */
export const GESTURE_SPRING = {
  type: "spring",
  stiffness: 520,
  damping: 30,
  mass: 0.6,
} as const;

/**
 * A wall that slides in from the right while a gesture is live, and back out
 * when it ends.
 *
 * The card designer's removal target is the case this exists for. It began as a
 * bare early return — no transition either way, so a target the user is meant to
 * aim at blinked into existence beside the card — and then as a pill that scaled
 * up in place, which reads as a panel appearing rather than as something the
 * hand summoned.
 *
 * Travel, not scale, and travel from off-screen: the thing is flush to the
 * workspace's right edge (`.card-remove-zone`), so coming in from beyond that
 * edge is the only entrance with a direction to it. `x: "100%"` is the element's
 * own width, so it starts exactly outside the frame whatever the workspace is.
 *
 * **Movement only, and the caller must clip it.** A `translateX(100%)` on an
 * element that already reaches the right edge of a scrollable box extends that
 * box's scrollable width — which is a horizontal scrollbar appearing, and the
 * page shifting under it, every time a block is picked up. So this belongs on an
 * element inside a stationary `overflow: hidden` parent, and the fade that says
 * "this is arriving" belongs on that parent rather than here. Two elements, one
 * property each.
 */
export function wallMotion(): HTMLMotionProps<"div"> {
  return {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: GESTURE_SPRING,
  };
}

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
