"use client";

import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { useRowDragSource } from "@/components/groups/use-row-drag";
import {
  landedBlockMotion,
  movingBlockTravel,
} from "@/components/ui/list-row-motion";
import {
  hasControl,
  isSelfSized,
  type CardBlock,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";
import { BLOCK_LABELS } from "./block-labels";
import {
  BlockCornerHandle,
  BlockResizeHandle,
  resizeEdges,
  type BlockResize,
} from "./block-resize-handle";

/**
 * One block on the designer canvas: the real block, selectable and draggable,
 * with — where the block can be resized — a handle on each edge that moves.
 *
 * The gesture is `useRowDragSource`, the same hook the Locations panel's rows
 * use. Not a similar one: the 8px mouse threshold, the 250ms touch hold that
 * lets a finger scroll the page instead, the ghost, Escape-to-abort and the edge
 * autoscroll are all things that took real work to get right, and a second copy
 * would be a second copy to keep in step.
 *
 * Removing a block is dragging it onto the strip down the right of the
 * workspace (`block-remove-strip.tsx`), and nothing else; there is deliberately
 * no remove control on the block itself, which used to add a hover toolbar to
 * every block on the canvas for a gesture the drag already covers. This used to
 * delete on `onDroppedOutside` — released over nothing registered at all —
 * which fired just as readily on a drag someone had thought better of.
 *
 * **This element, and not the line around it, is what travels.** A line has no
 * identity that survives an edit — `cardRows` pairs narrowed blocks by
 * adjacency, so swapping two of them, or pulling one out of a pair, tears down
 * one row and builds another, which React reconciles as an exit and an entrance
 * however it is keyed. That is why a narrowed block used to snap into place
 * while a full-width one glided: the animation was on the wrapper, and the
 * wrapper was the thing that had stopped existing. A block id is stable for the
 * block's whole life (`newCardBlockId`), so a `layoutId` carries it from the old
 * row's position to the new one's however the tree was rebuilt around it — and
 * `layout="position"` covers the moves that happen *inside* a row that survived:
 * a lone narrowed block crossing its own line, a pair swapping columns.
 *
 * `layout="position"` rather than a bare `layout`, because the height handle
 * reports continuously while it is held — animating size as well would make the
 * one drag control on the canvas feel like rubber.
 *
 * A `motion.div` in place of this `div`, never one wrapped around it. An extra
 * level would put `data-block-id` and a narrowed block's `flex` basis on
 * different elements, and both are load-bearing — see the note on
 * `data-block-id` below.
 */
export function DesignerBlock({
  block,
  layout,
  zone,
  isSelected,
  onRow = false,
  justLanded = false,
  onSelect,
  onResize,
  style,
  children,
}: {
  block: CardBlock;
  layout: CardLayout;
  /** Which zone it is in, which is what decides where its handles go. */
  zone: CardZone;
  isSelected: boolean;
  /**
   * Whether this block shares its line — `row.shared`. Only the corner grip
   * reads it, and only to know whether the block's left edge is pinned by a
   * neighbour or free to move with its own alignment.
   */
  onRow?: boolean;
  /**
   * Whether this block has just arrived from the palette, and should settle
   * into place rather than simply be there. See `landedBlockMotion`.
   */
  justLanded?: boolean;
  onSelect: () => void;
  onResize: (patch: BlockResize, commit: boolean) => void;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { isDragging, rowProps } = useRowDragSource({
    self: { type: "card-block", id: block.id },
  });

  const { label } = BLOCK_LABELS[block.type];

  return (
    <motion.div
      {...rowProps}
      {...movingBlockTravel(block.id)}
      /*
       * **Which renders count as layout changes.**
       *
       * `movingBlockTravel` asks for `layout` and `layoutId`, and Motion
       * re-measures every block on *every* commit unless it is told what to
       * watch. The layout object is the honest answer: `commit` in
       * card-designer.tsx builds a new one for each drop, resize and property
       * change, and nothing else replaces it — so selecting a block, or opening
       * a disclosure inside one, no longer costs a measure-and-project pass over
       * the whole card.
       *
       * **It is not what makes the card move smoothly when a week of hours
       * opens**, which is worth writing down because it is the obvious guess.
       * Measured across sixteen frames with and without this line, the blocks
       * below a disclosure keep a constant gap between them either way: that
       * movement belongs to the disclosure animating its own height, and Motion
       * is not involved in it at all. Removing this line would cost the wasted
       * measurements and change nothing anyone can see.
       */
      layoutDependency={layout}
      /*
       * What the drop geometry finds this block by.
       *
       * On the block rather than on the `motion.div` wrapping it, because that
       * wrapper carries the reorder animation's own `overflow-hidden` and a
       * couple of pixels of gap — so its box is not this block's box, and the
       * seams either side of it would sit slightly off what is drawn. See
       * use-drop-bands.ts.
       */
      data-block-id={block.id}
      style={style}
      onClick={(event) => {
        // A block click must not also reach the backdrop's own onClick, which
        // deselects on anything that isn't a block — without this, selecting a
        // block would select it and immediately deselect it in the same click.
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-selected={isSelected || undefined}
      // select-none is load-bearing, not cosmetic: most blocks are mostly
      // text (name, address, category…), and without it a press that starts
      // on that text races the browser's own text-selection gesture against
      // useRowDragSource's threshold check — selection can win before our own
      // pointermove handler ever calls preventDefault, so the block picks up
      // sometimes and just highlights its text other times. The one place
      // that trades away for it, the gallery's file-picker label, already
      // opts back in — see NO_DRAG_PROPS there.
      // `group/block` is what the resize handle's own hover state keys off.
      // Without it that handle is invisible and `pointer-events: none` for the
      // whole life of the page — it was written against a group nothing
      // declared, so the one drag control on the canvas never appeared.
      //
      // The ring is always two pixels wide and only ever changes colour.
      // `inset-ring` is a box-shadow so a width change would not reflow either,
      // but a selection that swaps 1px for 2px still reads as the block
      // twitching under the click that selected it.
      // The ring says *selected*, and now only that. It used to also light for
      // the block a drop was about to split a line with — a solid accent edge
      // drawn underneath the two dashed column marks already promising the same
      // thing, in a second vocabulary. The marks are the better answer: they are
      // the size and position of the columns the line is about to become.
      className={`group/block relative min-w-0 cursor-pointer rounded-md inset-ring-2 transition-shadow select-none ${
        isDragging ? "opacity-35" : ""
      } ${
        isSelected
          ? "inset-ring-accent"
          : "inset-ring-transparent hover:inset-ring-border"
      }`}
    >
      {/* `rounded-md` repeated rather than inherited, so the clip mask lines up
          with the selection ring drawn on the root around it.

          It is a `motion.div` so a block that has just landed can grow into
          place. The scale belongs here rather than on the root, because the
          root's transform is `movingBlockTravel`'s and two animators on one
          property is a fight neither wins — see `landedBlockMotion`. */}
      <motion.div
        className="h-full w-full overflow-hidden rounded-md"
        {...(justLanded ? landedBlockMotion() : {})}
      >
        {children}
      </motion.div>

      {/* Only where there is a height worth dragging. A block that grows with its
          content has nothing for a handle to change.

          A mark is one square, so it gets one grip on its corner; everything
          else grows from whichever edge its zone actually moves — see
          `resizeEdges`. */}
      {hasControl(block.type, "height") ? (
        isSelfSized(block.type) ? (
          <BlockCornerHandle
            block={block}
            layout={layout}
            onRow={onRow}
            isSelected={isSelected}
            onResize={onResize}
          />
        ) : (
          resizeEdges(zone).map(({ edge, takesOffset }) => (
            <BlockResizeHandle
              key={edge}
              block={block}
              layout={layout}
              edge={edge}
              isSelected={isSelected}
              takesOffset={takesOffset}
              onResize={onResize}
            />
          ))
        )
      ) : null}
    </motion.div>
  );
}
