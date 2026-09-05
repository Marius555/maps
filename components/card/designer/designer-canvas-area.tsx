"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, type CSSProperties, type ReactNode } from "react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import { BlockRemoveZone, REMOVE_DROP_ID } from "./block-remove-zone";

/**
 * The workspace the card sits in, and the one place a block can be thrown away.
 *
 * **Why this is its own component and not part of `CardDesigner`.** It reads
 * `useRowDragState`, and the provider it needs is rendered *by* `CardDesigner`
 * — a hook called in that component would read the no-op default and never see
 * a drag at all.
 *
 * **Removal is a place, not the absence of one.** It used to be "released over
 * nothing at all", which is a gesture with no edges: it had to be spelled out in
 * words on a pill and outlined in red round the whole workspace, and it still
 * fired on a drag someone had simply thought better of. Now it is
 * `BlockRemoveZone` down the right of the card and nothing else — a release
 * anywhere else puts the block back where it was, which is what every other drag
 * in the app does.
 *
 * The wall's *left* edge is anchored to the card rather than to this box, which
 * is why the card's own box is published here as `--card-w` and `--card-h`: the
 * card is centred by symmetric padding, so its right edge is arithmetic that
 * element can do in CSS without measuring anything. See `BlockRemoveZone`.
 *
 * `AnimatePresence` around it is not decoration. The wall is a target the user
 * is asked to aim at, and it used to blink in and out with a bare early return —
 * appearing with no relationship to the gesture that summoned it. Now it slides
 * in from beyond the right edge on the app's one gesture spring, and its icon
 * pulses while it is live.
 *
 * The ghost under the hand still turns red, because the pointer may be a long
 * way from the pill's own colour change by then. That is a class on `<body>`
 * rather than a prop, since the ghost is plain DOM moved sixty times a second
 * and styling it from React would be a render per pointer sample.
 */
export function DesignerCanvasArea({
  cardWidth,
  cardHeight,
  isTranslucent,
  onBackdropClick,
  onRemove,
  children,
}: {
  /** The card's own width in px, for anchoring the removal strip beside it. */
  cardWidth: number;
  /** The card's own height in px — the strip is exactly as tall. */
  cardHeight: number;
  /**
   * Whether the card being designed is see-through.
   *
   * The workspace is one flat tone, so a glass card drawn on it looks exactly
   * like a solid one and the Transparency control appears to do nothing — the
   * failure this panel's own rules are written against. A checkerboard is the
   * standard idiom for "there is nothing behind this" and is honest in a way a
   * fake basemap would not be: it says see-through, it does not pretend to be
   * the map the card will actually float over.
   *
   * Only while the setting is on, so the studio is unchanged for anyone who
   * never reaches for it.
   */
  isTranslucent: boolean;
  /** Clicking the backdrop deselects — a way out that isn't a small X. */
  onBackdropClick: () => void;
  /** A block released over the removal strip. */
  onRemove: (id: string) => void;
  children: ReactNode;
}) {
  const { dragged, overId } = useRowDragState();
  const isRemoving = overId === REMOVE_DROP_ID;

  useEffect(() => {
    if (!isRemoving) return;

    const { body } = document;
    body.classList.add("is-drop-remove");

    // One cleanup covers all four exits — a release, an Escape, a pointercancel
    // and this component unmounting mid-drag.
    return () => body.classList.remove("is-drop-remove");
  }, [isRemoving]);

  return (
    <div
      onClick={onBackdropClick}
      style={
        {
          "--card-w": `${String(cardWidth)}px`,
          "--card-h": `${String(cardHeight)}px`,
        } as CSSProperties
      }
      /* `overflow-hidden` is what clips the removal wall to this box's own
         rounded corners: the wall is flush to the top, right and bottom edges
         and square, so without it its corners poke past the radius below `lg`,
         where nothing else was clipping. At `lg` the scroller takes over. */
      className={`relative min-h-64 overflow-hidden rounded-xl bg-default/40 lg:min-h-0 lg:overflow-auto ${
        isTranslucent ? "transparency-grid" : ""
      }`}
    >
      {/*
       * The card is centred, and stays reachable when it is taller than the
       * room it has. `items-center` on the scroller itself would centre it and
       * then clip the top off, because a flex item centred in an overflowing
       * container overflows in both directions and only one of them can be
       * scrolled back to. A `min-h-full` child inside the scroller centres
       * against the visible height and simply grows past it instead.
       */}
      <div className="flex min-h-full items-center justify-center p-6">
        {children}
      </div>

      {/* The key is what lets `AnimatePresence` hold the strip in the tree long
          enough to play its exit — without one it is unmounted the instant the
          drag ends and only the entrance ever runs. */}
      <AnimatePresence>
        {dragged?.type === "card-block" ? (
          <BlockRemoveZone key="remove" onRemove={onRemove} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
