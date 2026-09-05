"use client";

import { Button } from "@heroui/react";
import { Pencil } from "lucide-react";

import { BLOCK_LABELS } from "@/components/card/designer/block-labels";
import type { CardBlock } from "@/packages/shared/card-layout";

/**
 * The pencil that opens one block's own settings, on a card in edit mode.
 *
 * **A trigger and nothing else.** The panel it opens is not here and must not
 * be: it used to be a `Popover.Root` rendered inside this span, which put a
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
 * badge. Remounting a badge costs nothing.
 *
 * **A badge in the block's corner, not the whole block.** Clicking anywhere on
 * the block would be the nicer gesture on its own, and it is not available: an
 * empty block already gives its whole box to the dashed `+` that fills it in
 * (`CardSlot`), and stacking a second press target on a 24px line is how you get
 * a control nobody can hit on purpose. One rule for every block instead --
 * hovering outlines it, the badge opens it -- so a filled block and an empty one
 * behave the same way and the `+` keeps the box it needs.
 *
 * The outline is the parent's, drawn by `.card-edit-target` on hover and focus
 * (app/globals.css): the target is stretched over the block's content box, so
 * its own hover state *is* the block's, and there is no second element to keep
 * in sync. That same rule is what positions the badge, as a one-cell grid --
 * which is why the two exceptions below are class names rather than styles.
 *
 * `data-open` because HeroUI leaves `aria-expanded` stale on a `Pressable`
 * wrapper (`CardSlot` documents the measurement), so the stylesheet keys off our
 * own flag and the block being edited stays marked while its panel is open.
 */
export function CardEditTarget({
  block,
  hasSlot,
  isOpen,
  onOpen,
}: {
  /** The block **as this location draws it** -- already overridden. */
  block: CardBlock;
  /** Whether the block is drawing its dashed `+` rather than content. */
  hasSlot: boolean;
  isOpen: boolean;
  onOpen: () => void;
}) {
  const title = `${BLOCK_LABELS[block.type].label} on this card`;

  /*
   * The gallery is the one block whose badge leaves the corner, because it is
   * the one block that reaches the card's own chrome -- and it leaves it two
   * different ways. With a picture the middle of the block is free. With none,
   * the middle belongs to the dashed `+` that adds one and the corner still
   * belongs to the X, so the badge goes to the bottom instead. Both halves are
   * argued in `.card-edit-target--center` / `--bottom`; everything else keeps
   * the corner, where nothing is in its way.
   */
  const placement =
    block.type !== "gallery"
      ? ""
      : hasSlot
        ? " card-edit-target--bottom"
        : " card-edit-target--center";

  return (
    <span
      className={`card-edit-target${placement}`}
      data-open={isOpen || undefined}
    >
      <Button
        variant="tertiary"
        aria-label={title}
        data-open={isOpen || undefined}
        className="card-edit-target__badge"
        onPress={onOpen}
      >
        <Pencil aria-hidden="true" className="size-3" />
      </Button>
    </span>
  );
}
