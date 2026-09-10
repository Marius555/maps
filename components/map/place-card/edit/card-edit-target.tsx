"use client";

import { BLOCK_LABELS } from "@/components/card/designer/block-labels";
import type { CardBlock } from "@/packages/shared/card-layout";

/**
 * The press target that opens one block's own settings, on a card in edit mode.
 *
 * **A trigger and nothing else.** The panel it opens is not here and must not
 * be: it used to be a `Popover.Root` rendered inside this element, which put a
 * portalled dialog inside the block being edited -- and a block is not a stable
 * place to keep one. `cardRows` gives a block at 100% width its own line and a
 * narrower one a shared row, and `CardView` draws those through *different DOM
 * parents*, so nudging a Button block from 75% to 100% changed the block's
 * parent, React unmounted the subtree, and the open panel died with it. It came
 * straight back, because `PlaceCard` still held the block as open -- which is
 * what the flicker was, and most of the lag with it, since every remount made
 * React Aria measure and place the panel again from scratch.
 *
 * So `PlaceCard` owns the panel now (`BlockEditorPopover`) and this owns the
 * target. Remounting a target costs nothing.
 *
 * **The whole block, not a badge in its corner.** It was a corner badge with a
 * pencil in it, for one honest reason: an empty block gives its whole box to the
 * dashed `+` that fills it in (`CardSlot`), and two press targets stacked on one
 * 24px line is how you get a control nobody can hit on purpose. What that cost
 * was a card in edit mode covered in six pencils -- the chrome became the card,
 * on the one screen whose whole job is showing the design underneath it.
 *
 * The stack is gone instead of being worked around: everything this target
 * covers is `inert` while edit mode is on (see `renderOverlay` in
 * `CardView`), so there is exactly one thing to press on a block and it is this.
 * That is the same answer to the `tel:` link, the Links row and the week's fold,
 * which were all live under the old badge and all took presses meant for the
 * block. **Adding content moved out of edit mode with them** -- the `+` is
 * pressable on the card as it normally stands, and edit mode is about how a
 * block is drawn rather than what is in it.
 *
 * **The card moves and the pointer stops it.** Every block breathes for as long
 * as edit mode is on -- a 1.2% swell on its own box, `.card-block-editable` in
 * app/globals.css -- because edit mode changes nothing else about the card, and
 * a card that looks identical in and out of the mode has to say which one it is
 * in somehow. The block under the pointer goes still and outlines itself in a
 * dashed accent rectangle, which is the shape `CardSlot` already uses for a
 * block about to be filled in. The two halves are one message: everything moving
 * means all of these can be changed, and the one that stopped is the one that
 * will open.
 *
 * Empty and filled blocks draw the same thing. It used to split on `isEmpty` --
 * an outline for a block that was already dashed, a lift for one with content in
 * it -- which answered a question the pointer never asks. Under
 * `prefers-reduced-motion` neither runs, and the target wears its dashed
 * rectangle at rest instead (CLAUDE.md's invariant: a state told only in motion
 * is told to nobody).
 *
 * A plain `<button>` rather than a HeroUI one, and it is the one control on this
 * card that should be: `usePress` ends its `onPointerDown` with
 * `stopPropagation()`, and this element sits over content the card's own
 * handlers are watching. Its ground, border and padding are reset by
 * `.card-edit-target`, which is unlayered and so beats Tailwind's utilities.
 *
 * `data-open` because HeroUI leaves `aria-expanded` stale on a `Pressable`
 * wrapper (`CardSlot` documents the measurement) and the panel this opens is
 * not a `Popover.Root` trigger at all, so the stylesheet keys off our own flag
 * and the block being edited stays marked while its panel is open.
 */
export function CardEditTarget({
  block,
  isOpen,
  onOpen,
}: {
  /** The block **as this location draws it** -- already overridden. */
  block: CardBlock;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const label = BLOCK_LABELS[block.type].label;

  return (
    <button
      type="button"
      className="card-edit-target"
      // The block's own name, because the card is a column of these and "Edit
      // block" six times over says which control you are on and nothing about
      // what it edits.
      aria-label={`Edit ${label.toLowerCase()} on this card`}
      data-open={isOpen || undefined}
      onClick={onOpen}
    />
  );
}
