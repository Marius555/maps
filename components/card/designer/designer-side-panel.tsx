"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LG_DOWN, useMediaQuery } from "@/lib/ui/use-media-query";

/**
 * The designer's sidebar, and where it goes on a phone.
 *
 * **It is the editor's bottom sheet, and it used to be its own thing.** Below
 * `md` this was `position: fixed` down the right edge, behind a scrim, opened
 * from a trigger portalled into the app's mobile header — and between `md` and
 * `lg` it had neither, so it stacked under the card and a selection had to
 * `scrollIntoView` to be reachable at all. `components/ui/bottom-sheet.tsx` is
 * the one answer now, at one breakpoint: a 4rem strip along the bottom that
 * drags open, the same box the locations panel and the publish designer are.
 *
 * **`lg` and not `md`, and the reason the old breakpoint existed is gone.** It
 * was `md` because the trigger lived on the one row of chrome that exists below
 * `md`, so a panel that went off-canvas between `md` and `lg` would have had
 * nowhere to be opened from. A grab rail is its own trigger at every width, so
 * that band gets the sheet too — and the header trigger, the scrim, the focus
 * restore and the scroll-into-view all went with it.
 *
 * ## Dragging a block out of it
 *
 * The gesture that puts a block on the card starts in here and ends out there,
 * which is the first of the two reasons `BottomSheet` is not a modal — see its
 * docblock. The rest of what a modal would have done is done here:
 *
 * 1. **It retracts; it does not close.** `useRowDragSource` lives on the tile
 *    being dragged, and its cleanup tears the ghost down on unmount — closing the
 *    sheet at the start of the gesture would end the gesture. It parks at its
 *    peek and stops taking pointers for the length of the drag, and closes once
 *    the drop has landed.
 * 2. **Nothing of it is under the pointer.** That is `isRetracted`, which also
 *    means the hit test reaches the card during the quarter second the sheet is
 *    still moving.
 * 3. **Escape means "abandon the drag"**, which is what it means for every drag
 *    in this app. It is ignored here while carrying, so the two listeners cannot
 *    both fire.
 */
export function DesignerSidePanel({
  isOpen,
  onOpenChange,
  peek,
  children,
}: {
  /** Only meaningful below `lg`; above it the panel is simply there. */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** What the shut strip says — the open tab's name, and the unsaved dot. */
  peek: ReactNode;
  children: ReactNode;
}) {
  const { dragged } = useRowDragState();
  /*
   * `card-new` only. `card-block` is a block already on the card being moved
   * around it — that drag belongs to the canvas, never started in here, and has
   * no business moving this panel.
   */
  const isCarrying = dragged?.type === "card-new";

  const isSheet = useMediaQuery(LG_DOWN);

  const wasCarrying = useRef(false);
  useEffect(() => {
    if (isCarrying) {
      wasCarrying.current = true;
      return;
    }

    if (!wasCarrying.current) return;
    wasCarrying.current = false;

    /*
     * The gesture is over, so the sheet goes — whether the block landed, was
     * released over nothing, or was abandoned. Leaving it open would slide it
     * back over the card at the moment the card has just changed, and the strip
     * behind it has already switched to Modify to show what landed.
     */
    onOpenChange(false);
  }, [isCarrying, onOpenChange]);

  /*
   * On the window rather than on the sheet, because focus may legitimately be
   * outside it — this is not a modal, and a drag takes the pointer across the
   * card.
   */
  useEffect(() => {
    if (!isOpen || !isSheet) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCarrying) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSheet, isCarrying, onOpenChange]);

  return (
    <BottomSheet
      contentId="card-sheet-content"
      label="Card panel"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isRetracted={isCarrying}
      peek={peek}
      // No `lg` form at all: up there the panel's own header is the tab strip,
      // and a second title row above it would be the panel naming itself twice.
      peekClassName="lg:hidden"
      // Edges below `lg` only. At `lg` this box is a grid column and the
      // `SectionPanel` inside draws the border — two would be a hairline a
      // millimetre in from another.
      className="max-lg:rounded-t-xl max-lg:border max-lg:border-border"
    >
      {children}
    </BottomSheet>
  );
}
