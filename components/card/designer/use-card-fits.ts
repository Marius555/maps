"use client";

import { useEffect, useRef, type RefObject } from "react";

import { fitWithin, type BlockHeights } from "@/lib/card/card-space";
import {
  CARD_ZONES,
  cardRows,
  overlapOf,
  type CardLayout,
} from "@/packages/shared/card-layout";

/**
 * Pulls a card that has grown past its own bottom edge back inside it.
 *
 * The other half of "a card is never designed into a scroll" — `hasRoomFor`
 * (lib/card/card-space.ts) stops one being built too tall from here on, and this
 * is what fixes one that already is: a card whose blocks were spread down the
 * middle before the rule existed, or that an older build's drop arithmetic
 * walked past the edge a few pixels at a time. The block at the bottom is still
 * on the card, but only a visitor who scrolls inside it will ever see it, and
 * nobody scrolls inside a card on somebody else's website.
 *
 * **Measured, not computed, which is why this is a hook at all.** Most blocks
 * have no height of their own — a name is as tall as the name — so the only
 * honest source is the card on screen. `fitWithin` does the arithmetic; this
 * hands it the rects and hands the answer back.
 *
 * Three guards, and each is a bug it would otherwise be:
 *
 * - **Never mid-drag.** `dragged` is what says a gesture is in the air, and
 *   trimming a leading space under the hand would move the card the drop marks
 *   were measured against.
 * - **Never a no-op.** `fitWithin` returns its input *by reference* when nothing
 *   needs doing, so the identity check is the whole test — without it every
 *   render would PATCH the same layout back and the card would save forever.
 * - **Never twice for the same answer.** The trim changes `layout`, which
 *   re-runs this; the blocks are the same height afterwards, so the second pass
 *   finds nothing to do and stops. The `applied` ref is belt and braces for the
 *   case where a block's height changes *because* of the trim — an image
 *   reflowing into a shorter box — which would otherwise be a card that trims
 *   itself a pixel at a time on every frame.
 *
 * `useEffect` rather than `useLayoutEffect`, deliberately: this reads heights
 * the browser has to have laid out, and correcting a card one paint later is
 * invisible next to blocking every paint on a measurement.
 */
export function useCardFits(
  cardRef: RefObject<HTMLElement | null>,
  layout: CardLayout,
  /** Whether a gesture is in the air. Nothing is trimmed while one is. */
  isDragging: boolean,
  onFit: (layout: CardLayout) => void,
): void {
  const applied = useRef<string | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || isDragging) return;

    const drawn = new Map<string, number>();
    for (const node of card.querySelectorAll<HTMLElement>("[data-block-id]")) {
      drawn.set(node.dataset.blockId ?? "", node.getBoundingClientRect().height);
    }

    // A card the measurement pass beat — no blocks on screen yet — measures as
    // empty, which is a card that always fits and so never trims. Nothing to do
    // either way, but say it rather than rely on it.
    if (drawn.size === 0) return;

    const heights = lineHeights(layout, drawn);

    const fitted = fitWithin(layout, heights);
    if (fitted === layout) return;

    const key = signatureOf(fitted);
    if (applied.current === key) return;
    applied.current = key;

    onFit(fitted);
  }, [cardRef, layout, isDragging, onFit]);
}

/**
 * What each block costs the card, which is its **line's** height and not its own.
 *
 * Two corrections to "read the rect", and `usedHeight` needs both:
 *
 * - **Per line, not per block.** Two blocks sharing one are as tall as the taller
 *   of them, so crediting each with the line's height is the same number
 *   `usedHeight`'s own `Math.max` arrives at, and needs no second code path. It is
 *   the same thing `dropSlots` does when it builds its heights.
 * - **Flow, not ink.** A logo with `overlapPct` is drawn half above the line it
 *   belongs to, so its rect is twice what it costs — `blockEdges` gives it a
 *   negative `margin-top` of exactly `overlapOf`, and a margin box is what a
 *   column of flex items actually stacks. Charged to the ink, an ordinary card
 *   with a logo on it reported itself 31px fuller than it was and got trimmed on
 *   load, on a card whose own middle zone said it fitted. See `flowTop` on
 *   `MeasuredRow` in lib/card/drop-slots.ts — the same distinction, one file over.
 *
 * A block with no rect is left out rather than guessed at: it contributes nothing
 * and `blockHeight` in lib/card/card-space.ts falls back to what its type implies.
 */
function lineHeights(
  layout: CardLayout,
  drawn: ReadonlyMap<string, number>,
): BlockHeights {
  const heights: Record<string, number> = {};

  for (const zone of CARD_ZONES) {
    for (const row of cardRows(layout.zones[zone], layout)) {
      let tallest = 0;
      const measured: string[] = [];

      for (const block of row.blocks) {
        const height = drawn.get(block.id);
        if (height === undefined) continue;

        measured.push(block.id);
        tallest = Math.max(
          tallest,
          height -
            (block.overlapEdge === "below" ? 0 : overlapOf(block, layout)),
        );
      }

      for (const id of measured) heights[id] = tallest;
    }
  }

  return heights;
}

/** Every block's leading space, in order — what a trim actually changes. */
function signatureOf(layout: CardLayout): string {
  return CARD_ZONES.map((zone) =>
    layout.zones[zone]
      .map((block) => `${block.id}:${String(block.offset ?? 0)}`)
      .join(","),
  ).join("|");
}
