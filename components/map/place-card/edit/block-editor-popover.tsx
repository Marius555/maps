"use client";

import { Popover, popoverVariants } from "@heroui/react";
import { useMemo, type RefObject } from "react";

import { BLOCK_LABELS } from "@/components/card/designer/block-labels";
import type { AppMap, Place } from "@/lib/repositories/types";
import { findBlock, type CardLayout } from "@/packages/shared/card-layout";
import {
  mergeCardBlocks,
  type CardBlockOverrides,
} from "@/packages/shared/card-overrides";
import { BlockEditorForm } from "./block-editor-form";

/**
 * One block's settings, in a panel beside the card.
 *
 * ### Why it lives here and not in the block
 *
 * It used to be a `Popover.Root` inside `CardEditTarget`, which put it inside
 * the block it edits -- and a block is the one place on this card that the panel
 * itself can move. Two mechanisms, both measured:
 *
 * - **It chased the block.** React Aria positions from the trigger and watches
 *   it: `useResizeObserver({ref: targetRef})` plus `targetRef.current` in the
 *   position effect's own dependencies. Drag the block's Width control and the
 *   pencil travels with the block's corner, so the panel travelled after it.
 * - **It closed and reopened.** `cardRows` gives a block at 100% its own line
 *   and anything narrower a shared row, and `CardView` renders those through
 *   different DOM parents -- so crossing that threshold reparents the block,
 *   React unmounts the subtree, and the popover inside it goes. `openPanel`
 *   still named the block, so a new one mounted open. Between 75% and 100% on a
 *   Button block that fired on every press.
 *
 * Anchoring to the **card** fixes both at once, and it is the fix `TagPicker`
 * already documents for the milder version of the same failure -- anchored to
 * the field, not to the button that opens it. Nothing an edit can do moves the
 * card: its width and height are the design's, and the panel is above the
 * layout rather than inside it. The trade is that the panel no longer points at
 * the block it is about; it sits in one place and stays there while you move
 * between blocks, which is the same property said the other way round.
 *
 * ### A standalone popover
 *
 * `Popover.Content` with no `Popover.Root` above it, which React Aria supports
 * directly: its `Popover` takes its own state whenever `isOpen` is passed, and
 * `Overlay` sets `restoreFocus` itself -- so outside-press dismissal, Escape,
 * focus containment and focus restoration all still work. A `Popover.Root` is
 * `DialogTrigger`, whose whole job is to bind a *trigger*, and the trigger is
 * three components away inside the card; given no pressable child it also logs
 * "A PressResponder was rendered without a pressable child" on every open.
 *
 * What that costs is HeroUI's slot classes, which `Popover.Root` supplies
 * through a context of its own, so they are passed explicitly from
 * `popoverVariants()` -- a public export, and the slots are the plain
 * `popover` / `popover__dialog` class names its own components would have used.
 */
export function BlockEditorPopover({
  map,
  place,
  layout,
  overrides,
  blockId,
  cardRef,
  onPreview,
  onClose,
}: {
  map: AppMap;
  place: Place;
  /** The account's design, which is what a patch is applied against. */
  layout: CardLayout;
  /** This pin's overrides as the card is drawing them -- preview included. */
  overrides: CardBlockOverrides;
  /** The block being edited. */
  blockId: string;
  /** What the panel is anchored to -- see the docblock. */
  cardRef: RefObject<HTMLDivElement | null>;
  /** Repaint the card now, before anything is saved. */
  onPreview: (overrides: CardBlockOverrides | null) => void;
  onClose: () => void;
}) {
  const slots = useMemo(() => popoverVariants(), []);

  // The design could have changed under an open panel — a second tab saving the
  // card, say. A guard rather than a case: the badge that opened this only
  // exists on a block the layout has.
  const found = findBlock(mergeCardBlocks(layout, overrides), blockId);
  if (!found) return null;

  const title = `${BLOCK_LABELS[found.block.type].label} on this card`;

  return (
    /*
      Beside the card, and wider than a slot's: this is the designer's own
      properties panel, which is a 24rem column in the studio. `end top` so a
      tall panel grows downward from the top of the card rather than centring
      itself across it, and React Aria flips it for a card sitting near the
      right edge of the map.

      **Bounded, and scrolling inside its own bound.** React Aria computes a
      `maxHeight` from the room actually there and writes it inline; nothing
      honoured it until this clipped, because the cap we had was a `dvh` on an
      element *inside* the dialog and `.popover` has no `overflow` of its own. A
      tall panel therefore overflowed a body-level absolutely positioned
      element, which extends the document -- so opening the Logo panel gave the
      whole page a scrollbar, and closing it took the scrollbar away again. A
      flex column that clips is what hands that height down to the form's own
      scroller.
    */
    <Popover.Content
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      triggerRef={cardRef}
      placement="end top"
      className={`${slots.base()} flex flex-col overflow-hidden`}
    >
      <Popover.Dialog
        aria-label={title}
        className={`${slots.dialog()} flex min-h-0 flex-col`}
      >
        {/*
          Deliberately **not** keyed on the block. Moving between blocks with
          the panel open keeps `useDeferredOverrides` mounted, so a change still
          on its 400ms timer rides along with the next one into a single PATCH
          rather than being flushed by an unmount the moment you look at
          something else.
        */}
        <BlockEditorForm
          map={map}
          place={place}
          block={found.block}
          layout={layout}
          overrides={overrides}
          onPreview={onPreview}
          onDone={onClose}
        />
      </Popover.Dialog>
    </Popover.Content>
  );
}
