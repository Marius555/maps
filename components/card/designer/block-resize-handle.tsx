"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { NO_DRAG_PROPS } from "@/components/groups/use-row-drag";
import {
  CARD_BLOCKS,
  type CardBlock,
  type CardBlockAlign,
  type CardLayout,
} from "@/packages/shared/card-layout";

/** What a drag of this handle changes about the block. */
export type BlockResize = {
  heightPct: number;
  /** The block's leading space, where the handle spends it. See `edge`. */
  offset?: number;
};

/**
 * Which edge of the block a handle grips, and therefore which way it grows.
 *
 * Not a style choice: it is which edge actually *moves* when the block is
 * resized, and that depends on the zone. See `resizeEdges` below.
 */
export type ResizeEdge = "top" | "bottom";

/**
 * A grab bar on a block's edge.
 *
 * The clamp is the feature. A block cannot be dragged past what its type allows
 * or past the card, and the way that is enforced is that the *number stops
 * changing* — there is no rubber band and no snap back, because a handle that
 * lets you drag somewhere and then refuses has told you the rule too late.
 *
 * **The edge the handle sits on is the edge that moves.** A block in the top
 * zone grows downwards, so its handle is on the bottom. A block in the bottom
 * zone grows *upwards* — the zone is auto-height at the foot of a fixed-height
 * card, so making the block taller pushes the middle zone down and the block's
 * own top edge rises — which is why a bottom handle there stayed pinned to the
 * card's edge while the block grew away from the pointer, and the gesture read
 * as broken. The middle zone gets both, and its top one spends the block's own
 * leading space (`takesOffset`): there the zone is a fixed-height scroller that
 * stacks from the top, so the only way the top edge can rise is if the room
 * above it shrinks by the same amount. When there is no room left above, the
 * number stops changing, exactly like every other limit here.
 *
 * `NO_DRAG_PROPS` is what stops this also picking the block up. The block's own
 * source listens in the capture phase and asks what the press landed on, so an
 * attribute is enough and there is no hover state to get stuck.
 *
 * One PATCH, on release — the same rule a shape's radius handle follows. A save
 * per frame would be sixty writes for one gesture.
 */
export function BlockResizeHandle({
  block,
  layout,
  edge,
  isSelected,
  takesOffset = false,
  onResize,
}: {
  block: CardBlock;
  layout: CardLayout;
  edge: ResizeEdge;
  /**
   * Whether the block this grips is the selected one, which is the only thing
   * that colours it.
   *
   * A grip appears on hover and used to appear *in the accent*, which is the one
   * colour the canvas already spends on saying "this block is selected" — so a
   * hovered block wore the selected block's colour on its corner while its ring
   * stayed grey. Grey until the ring is accent, accent with it: one rule, and a
   * handle's colour never says something the block's own edge is not saying.
   */
  isSelected: boolean;
  /**
   * Whether growing upward is paid for out of the block's leading space.
   *
   * True only for a top handle in the middle zone — see the note above. False
   * everywhere else, where the block's own box is what moves.
   */
  takesOffset?: boolean;
  /** `commit` is false while the pointer is down, true once on release. */
  onResize: (patch: BlockResize, commit: boolean) => void;
}) {
  const drag = useRef<{ y: number; height: number; offset: number } | null>(null);

  const state = useRef({ block, layout, edge, takesOffset, onResize });
  useEffect(() => {
    state.current = { block, layout, edge, takesOffset, onResize };
  });

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    drag.current = {
      y: event.clientY,
      height:
        state.current.block.heightPct ??
        CARD_BLOCKS[state.current.block.type].defaultHeightPct ??
        0,
      offset: state.current.block.offset ?? 0,
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const from = drag.current;
      if (!from) return;

      event.preventDefault();
      report(event.clientY - from.y, from, false);
    };

    const onPointerUp = (event: PointerEvent) => {
      const from = drag.current;
      if (!from) return;

      drag.current = null;
      report(event.clientY - from.y, from, true);
    };

    /** Pixels dragged, as a change to the block the owner is designing. */
    const report = (
      dy: number,
      from: { height: number; offset: number },
      commit: boolean,
    ) => {
      const current = state.current;
      const perPct = current.layout.maxHeight / 100;

      if (current.edge === "bottom") {
        current.onResize({ heightPct: from.height + dy / perPct }, commit);
        return;
      }

      if (!current.takesOffset) {
        current.onResize({ heightPct: from.height - dy / perPct }, commit);
        return;
      }

      /*
       * Growing upward out of the room above, and only as far as there is room.
       *
       * `-dy` is how far the top edge wants to rise; the block can only take
       * what its leading space actually holds, so the two move together and the
       * edge stays under the pointer right up to the moment there is nothing
       * left — where the number stops rather than the block carrying on growing
       * downwards in the opposite direction to the hand.
       *
       * Dragging the other way is unbounded in the same terms: the space above
       * simply gives back what the block gives up.
       */
      const taken = Math.min(-dy, from.offset);

      current.onResize(
        {
          heightPct: from.height + taken / perPct,
          offset: from.offset - taken,
        },
        commit,
      );
    };

    /** Escape abandons the drag, matching every other gesture in the app. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;

      const { height, offset } = drag.current;
      drag.current = null;
      state.current.onResize({ heightPct: height, offset }, true);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const spec = CARD_BLOCKS[block.type];
  const height = block.heightPct ?? spec.defaultHeightPct ?? 0;
  const offset = block.offset ?? 0;

  /** One keyboard step, in the same terms the pointer works in. */
  const step = (grow: number) => {
    if (edge === "bottom" || !takesOffset) {
      onResize({ heightPct: height + grow }, true);
      return;
    }

    const takenPct = Math.min(grow, offset / (layout.maxHeight / 100));

    onResize(
      {
        heightPct: height + takenPct,
        offset: offset - takenPct * (layout.maxHeight / 100),
      },
      true,
    );
  };

  return (
    <div
      {...NO_DRAG_PROPS}
      role="slider"
      tabIndex={0}
      aria-label="Height"
      aria-valuemin={1}
      aria-valuemax={spec.maxHeightPct ?? 100}
      aria-valuenow={height}
      aria-valuetext={`${String(height)}% of the card`}
      onPointerDown={onPointerDown}
      // Keyboard reaches the same clamp, because the clamp is in the layout
      // edit rather than in this gesture. Up always grows and Down always
      // shrinks, on either edge — the arrow keys mean bigger and smaller, not a
      // direction on screen.
      onKeyDown={(event) => {
        const grow =
          event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
        if (grow === 0) return;

        event.preventDefault();
        step(grow * (event.shiftKey ? 5 : 1));
      }}
      // pointer-events follows the same hover/focus states as the opacity —
      // otherwise the handle intercepts a press across ~12px of the block while
      // it is still invisible, silently starting a resize where the user meant
      // to pick the block up and move it.
      //
      // **As wide as the grip, not as wide as the block**, and that is the
      // difference between a spacer you can move and one you can only resize. A
      // Space block is 6% of the card — about 26px — so a full-width strip 12px
      // tall was half its surface, and every press on it was excluded from the
      // move gesture outright by `NO_DRAG_PROPS`. Now the bar you can see is the
      // bar that resizes, and the rest of the edge belongs to the block.
      //
      // **And when the block is selected, which is the only way in on a
      // touchscreen.** Hover and focus-within are both pointer-and-keyboard
      // states; neither exists on a phone, so these handles were invisible and
      // `pointer-events: none` for the whole life of the page there — block
      // height and logo size simply could not be changed. Selection is a tap,
      // and `DesignerBlock` already publishes it as `data-selected` on the group
      // root. The grip beside them opens on the same state, so the two controls
      // on a block appear together or not at all.
      className={`pointer-events-none absolute left-1/2 z-10 flex h-3 w-10 -translate-x-1/2 cursor-ns-resize touch-none justify-center opacity-0 transition-opacity group-hover/block:pointer-events-auto group-hover/block:opacity-100 group-focus-within/block:pointer-events-auto group-focus-within/block:opacity-100 group-data-selected/block:pointer-events-auto group-data-selected/block:opacity-100 ${
        edge === "top" ? "top-0 items-start" : "bottom-0 items-end"
      }`}
    >
      {/* Grey until the block is selected — see `isSelected`. The colour
          transitions on its own because the wrapper only animates opacity, and
          the two changes are answers to two different things: the grip appearing
          under the pointer, and the block becoming the selected one. */}
      <span
        className={`h-1 w-8 rounded-full transition-colors ${isSelected ? "bg-accent" : "bg-muted"} ${edge === "top" ? "mt-0.5" : "mb-0.5"}`}
      />
    </div>
  );
}

/**
 * How far a self-sized block's **right** edge travels for each pixel its bottom
 * edge does, keyed on where the block sits across its line.
 *
 * A mark pinned at the start of its line grows only rightwards and downwards, so
 * its corner moves diagonally. A centred one grows both ways at once, so its
 * right edge moves half as fast as its bottom. One pinned at the end grows
 * *leftwards*, so its right edge does not move at all and the corner slides
 * straight down. There is no fourth case: `align` has three words.
 */
const CORNER_TRAVEL: Record<CardBlockAlign, number> = {
  start: 1,
  center: 0.5,
  end: 0,
};

/**
 * How much bigger the block gets for a pointer that moved `dx, dy`.
 *
 * The corner under the hand travels along `(travel, 1)` — see `CORNER_TRAVEL` —
 * so the honest reading of a drag is its **projection** onto that direction
 * rather than either axis on its own. For a left-aligned mark that is
 * `(dx + dy) / 2`, which is the diagonal everyone expects; for a right-aligned
 * one it is plain `dy`, because dragging sideways there moves the corner
 * nowhere. Taking `dy` alone in every case would make a left-aligned mark lag
 * the pointer by half a diagonal, and taking the larger of the two would make it
 * run ahead of one.
 */
function cornerGrowth(dx: number, dy: number, travel: number): number {
  return (travel * dx + dy) / (travel * travel + 1);
}

/**
 * The grip on a self-sized block's bottom-right corner — the logo, and the only
 * block that has one.
 *
 * A mark is a square: one number is both its width and its height, so the two
 * edge bars a gallery gets would be two controls for one value, and neither of
 * them is the gesture anyone reaches for on something that size. A corner is.
 *
 * Everything else here is `BlockResizeHandle`'s, deliberately: the clamp lives
 * in `resizeCardBlock` so the number simply stops rather than rubber-banding,
 * the listeners are registered once and read a ref, Escape abandons the drag,
 * the arrow keys reach the same clamp, `NO_DRAG_PROPS` stops the press also
 * picking the block up, and `pointer-events` follows the opacity so an invisible
 * grip cannot steal a press. One PATCH, on release.
 *
 * No `offset` spend, unlike the middle zone's top bar: a corner only ever grows
 * downwards and to one side, so there is no room above it to pay out of.
 */
export function BlockCornerHandle({
  block,
  layout,
  onRow,
  isSelected,
  onResize,
}: {
  block: CardBlock;
  layout: CardLayout;
  /**
   * Whether the block this grips is the selected one, which is the only thing
   * that colours it.
   *
   * A grip appears on hover and used to appear *in the accent*, which is the one
   * colour the canvas already spends on saying "this block is selected" — so a
   * hovered block wore the selected block's colour on its corner while its ring
   * stayed grey. Grey until the ring is accent, accent with it: one rule, and a
   * handle's colour never says something the block's own edge is not saying.
   */
  isSelected: boolean;
  /**
   * Whether the mark shares its line. It does not read `align` when it does —
   * the block's left edge is pinned by whatever sits before it in the row, so
   * the corner travels diagonally however the block is aligned.
   */
  onRow: boolean;
  /** `commit` is false while the pointer is down, true once on release. */
  onResize: (patch: BlockResize, commit: boolean) => void;
}) {
  const drag = useRef<{ x: number; y: number; height: number } | null>(null);

  const state = useRef({ block, layout, onRow, onResize });
  useEffect(() => {
    state.current = { block, layout, onRow, onResize };
  });

  const onPointerDown = useCallback((event: ReactPointerEvent) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    drag.current = {
      x: event.clientX,
      y: event.clientY,
      height:
        state.current.block.heightPct ??
        CARD_BLOCKS[state.current.block.type].defaultHeightPct ??
        0,
    };
  }, []);

  useEffect(() => {
    const report = (
      event: PointerEvent,
      from: { x: number; y: number; height: number },
      commit: boolean,
    ) => {
      const current = state.current;
      const travel = current.onRow
        ? 1
        : CORNER_TRAVEL[current.block.align ?? "start"];
      const grown = cornerGrowth(
        event.clientX - from.x,
        event.clientY - from.y,
        travel,
      );

      current.onResize(
        { heightPct: from.height + grown / (current.layout.maxHeight / 100) },
        commit,
      );
    };

    const onPointerMove = (event: PointerEvent) => {
      const from = drag.current;
      if (!from) return;

      event.preventDefault();
      report(event, from, false);
    };

    const onPointerUp = (event: PointerEvent) => {
      const from = drag.current;
      if (!from) return;

      drag.current = null;
      report(event, from, true);
    };

    /** Escape abandons the drag, matching every other gesture in the app. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;

      const { height } = drag.current;
      drag.current = null;
      state.current.onResize({ heightPct: height }, true);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const spec = CARD_BLOCKS[block.type];
  const height = block.heightPct ?? spec.defaultHeightPct ?? 0;

  return (
    <div
      {...NO_DRAG_PROPS}
      role="slider"
      tabIndex={0}
      aria-label="Size"
      aria-valuemin={1}
      aria-valuemax={spec.maxHeightPct ?? 100}
      aria-valuenow={height}
      aria-valuetext={`${String(height)}% of the card`}
      onPointerDown={onPointerDown}
      // Right and Up both grow, Left and Down both shrink. The corner is a
      // diagonal, so both axes mean the same thing here and a keyboard user
      // should not have to guess which of them this control listens to.
      onKeyDown={(event) => {
        const grow =
          event.key === "ArrowUp" || event.key === "ArrowRight"
            ? 1
            : event.key === "ArrowDown" || event.key === "ArrowLeft"
              ? -1
              : 0;
        if (grow === 0) return;

        event.preventDefault();
        onResize({ heightPct: height + grow * (event.shiftKey ? 5 : 1) }, true);
      }}
      // Inside the corner rather than hanging off it: the card is
      // `overflow: hidden`, so a grip that overhung would be sliced in half on a
      // mark sitting against the card's own edge.
      //
      // The border is what keeps it visible on top of the pin itself, whose
      // colour is the customer's and could be the accent.
      //
      // Grey until the block is selected, and then the accent — see
      // `isSelected`. Both properties transition, because the grip appearing
      // under the pointer and the block becoming the selected one are two
      // different things happening to it.
      //
      // `--muted` rather than `--border`, which is the grey the block's own
      // hover ring uses: that one is 92% lightness, and a 12px square of it
      // inside a white ring on a white card is nothing at all. A grip is
      // non-text content someone has to find and hit, so it is held to the same
      // 3:1 floor the rest of this surface is.
      //
      // **And when the block is selected, which is the only way in on a
      // touchscreen.** Hover and focus-within are both pointer-and-keyboard
      // states; neither exists on a phone, so these handles were invisible and
      // `pointer-events: none` for the whole life of the page there — block
      // height and logo size simply could not be changed. Selection is a tap,
      // and `DesignerBlock` already publishes it as `data-selected` on the group
      // root. The grip beside them opens on the same state, so the two controls
      // on a block appear together or not at all.
      className={`pointer-events-none absolute right-0 bottom-0 z-10 size-3 cursor-nwse-resize touch-none rounded-[3px] border border-surface ${isSelected ? "bg-accent" : "bg-muted"} opacity-0 transition-[opacity,background-color] group-hover/block:pointer-events-auto group-hover/block:opacity-100 group-focus-within/block:pointer-events-auto group-focus-within/block:opacity-100 group-data-selected/block:pointer-events-auto group-data-selected/block:opacity-100`}
    />
  );
}

/**
 * Which edges of a block in this zone can be dragged, and which of them pays for
 * the growth out of the block's leading space.
 *
 * The zones are not interchangeable, because `zoneClass` in card-frame.tsx makes
 * them different boxes: `top` and `bottom` are auto-height and sit at the two
 * ends of a card whose height is fixed, while `middle` is the `flex-1` scroller
 * between them. So the edge that moves when a block grows is the bottom one in
 * the top zone, the top one in the bottom zone, and the bottom one in the middle
 * — where the top edge can be moved too, but only by spending the room above it.
 */
export function resizeEdges(
  zone: "top" | "middle" | "bottom",
): readonly { edge: ResizeEdge; takesOffset: boolean }[] {
  switch (zone) {
    case "top":
      return [{ edge: "bottom", takesOffset: false }];
    case "middle":
      return [
        { edge: "top", takesOffset: true },
        { edge: "bottom", takesOffset: false },
      ];
    case "bottom":
      return [{ edge: "top", takesOffset: false }];
  }
}
