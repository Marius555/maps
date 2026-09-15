"use client";

import type {
  HTMLMotionProps,
  TargetAndTransition,
  Transition,
} from "motion/react";

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
 * The row's own surface — the box that highlights, lifts and takes the drop.
 *
 * One string, because it was four copies: the locations panel draws places,
 * shapes, group headers and route stops, and the four had drifted only in the
 * extras each one needs (`min-w-0 flex-1` everywhere but a group header,
 * `relative` on a stop, which has two drop bands laid over it). Those stay at
 * the call sites; everything they share is here.
 *
 * **`transition-colors` was not enough, and that is the bug this constant was
 * extracted to fix once.** Tailwind v4 draws `inset-ring` as a `box-shadow`, and
 * `transition-colors` resolves to `color, background-color, border-color,
 * outline-color, text-decoration-color, fill, stroke` — no `box-shadow` in it.
 * So the accent ring that says "this row will take the drop" snapped on and off
 * with no animation at all. Measured in the browser: `getComputedStyle(row)
 * .transitionProperty` listed seven properties and none of them was the one
 * being changed. Naming the properties explicitly is the only fix; there is no
 * Tailwind utility that means "colours *and* shadow".
 *
 * `opacity` is in the list for `.row-lifted`, which dims the row a drag was
 * started from and declares no transition of its own.
 */
export const LIST_ROW_SURFACE_CLASS =
  "group flex h-12 items-center gap-1 rounded-xl px-2 " +
  "transition-[color,background-color,border-color,box-shadow,opacity] duration-150 " +
  "hover:bg-default data-drop-target:inset-ring-2 data-drop-target:inset-ring-accent " +
  "data-selected:bg-accent-soft";

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
 * How a block **drops into place** on the card designer — off the palette, or
 * moved across the card — like a piece set down in a game.
 *
 * It starts a little large and a little high, lands past its own size, and
 * settles: scale 1.08 → 0.96 → 1 with an 8px fall. The squash is what reads as
 * weight, where the fade-and-grow this replaced read as something appearing. By
 * the time it plays the copy in the hand is already sitting on the slot
 * (components/groups/ghost-magnet.ts) and fading out over it, so the block is
 * not arriving from anywhere: it is being put down.
 *
 * Keyframes rather than a spring, because a spring has two ends and a squash
 * needs three.
 *
 * **Plain keyframes for an imperative `animate`, not variants**, and
 * `components/card/designer/use-landing.ts` has the reason at length: a block
 * remounted into a line the canvas has had since page load inherits
 * `initial: false` from that line's `AnimatePresence` and skips every mount
 * animation it declares.
 *
 * **It goes on the block's inner content box, never on the block itself.** That
 * element's transform belongs to `movingBlockTravel`'s `layoutId` projection,
 * and two animators on one property is a fight neither wins.
 *
 * `LANDING_FROM` is the first keyframe as a transform string, written by hand
 * before the animation starts so no frame paints the block at rest first. Motion
 * composes `y` before `scale`, which is the order it is written in here.
 */
export const LANDING_FROM = "translateY(-8px) scale(1.08)";
export const LANDING_KEYFRAMES = { scale: [1.08, 0.96, 1], y: [-8, 1, 0] };
export const LANDING_TRANSITION = {
  duration: 0.38,
  times: [0, 0.55, 1],
  ease: "easeOut" as const,
};

/**
 * The ring that flashes round a block at the moment it lands.
 *
 * It peaks at the squash rather than at the release — 45% of the way through,
 * where the bounce bottoms out — and spreads as it fades, so it reads as the
 * impact. Opacity keyframes, so reduced motion still gets the flash without the
 * spread.
 */
export const LANDING_RING_KEYFRAMES = {
  opacity: [0, 0.85, 0],
  scale: [0.98, 1, 1.07],
};
export const LANDING_RING_TRANSITION = {
  duration: 0.42,
  times: [0, 0.45, 1],
  ease: "easeOut" as const,
};

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
export function movingBlockTravel(
  id: string,
  /**
   * Whether a drag just put this block down. Its own travel is then instant.
   *
   * At release the copy in the hand is already sitting on the slot, so a glide
   * in from the block's old place would be a second block crossing the card
   * towards the first. Its neighbours still slide, on their own `layout`.
   *
   * **The transition is what changes, never `layout` or `layoutId`.** Taking
   * the id off for a commit and putting it back leaves Motion's shared-layout
   * stack holding a snapshot of the block where it used to be, and the next
   * element to claim the id can animate from there.
   */
  isLanding = false,
): HTMLMotionProps<"div"> {
  return {
    layout: "position",
    layoutId: `card-block:${id}`,
    transition: isLanding ? LANDING_TRAVEL : TRANSITION,
  };
}

/** `TRANSITION` for everything but the block's own layout, which is instant. */
const LANDING_TRAVEL: Transition = { ...TRANSITION, layout: { duration: 0 } };

/**
 * How each area a dragged block could go into arrives: it pops up to full size
 * on the magnet's spring, so picking something up reads as the card opening its
 * places to it.
 *
 * On an element of its own, outside the one that breathes
 * (`dropRegionBreathMotion`) — two elements, one property each, the rule
 * `wallMotion` states — so the pop and the loop never fight over `scale`.
 */
const REGION_HIDDEN: TargetAndTransition = { scale: 0.85 };
const REGION_SHOWN: TargetAndTransition = { scale: 1 };

export function dropRegionMotion(): HTMLMotionProps<"div"> {
  return { initial: REGION_HIDDEN, animate: REGION_SHOWN, transition: MAGNET_SPRING };
}

/**
 * The breathing an area does for as long as a block is in the air — 3% and
 * back, every 1.2s, all of them together.
 *
 * Motion for the length of a gesture only: the layer it is on is unmounted when
 * the drag ends. `MotionConfig reducedMotion="user"` stops it, and
 * `.card-drop-region`'s own weight and tint are the static form that is left.
 */
const BREATH: TargetAndTransition = { scale: [1, 1.03, 1] };
const BREATH_TRANSITION: Transition = {
  duration: 1.2,
  ease: "easeInOut",
  repeat: Infinity,
};

export function dropRegionBreathMotion(): HTMLMotionProps<"div"> {
  return { animate: BREATH, transition: BREATH_TRANSITION };
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
 * The line that says a dragged thing will land *here*, between two rows.
 *
 * The route's insertion line was a bare conditional render — it appeared and
 * disappeared in one frame while everything else in the panel moved at 150ms, so
 * the one mark that answers "where exactly" was the one mark with no arrival.
 *
 * It grows from its own centre rather than fading alone: a 2px rule that only
 * fades reads as a rendering artefact at the moment it is thinnest, and the
 * widening is what makes it read as a gap being opened. `scaleX` and `opacity`
 * are both transforms as far as Motion's reduced-motion handling is concerned,
 * so there is nothing to opt out of here.
 *
 * The caller must give the element `transform-origin: center` — which is the
 * default — and must not also animate its width, or the two fight.
 */
export function insertLineMotion(): HTMLMotionProps<"span"> {
  return {
    initial: { opacity: 0, scaleX: 0.6 },
    animate: { opacity: 1, scaleX: 1 },
    exit: { opacity: 0, scaleX: 0.6 },
    transition: TRANSITION,
  };
}

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
 * How the card designer's drag pulls things onto a place — the copy in the hand
 * jumping into a slot, and the outline travelling with it.
 *
 * `GESTURE_SPRING`'s family, deliberately less damped: that one settles with a
 * barely visible overshoot, which is right for a wall arriving and too polite
 * for a magnet. At a damping ratio of about 0.7 the copy passes its slot by a
 * few percent and comes back, and that small *thunk* is what says it caught.
 *
 * One definition for both the ghost (`components/groups/ghost-magnet.ts`) and
 * the bold mark under it (`SlotMark`), so the two cannot drift apart mid-hop.
 */
export const MAGNET_SPRING = {
  type: "spring",
  stiffness: 600,
  damping: 26,
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
