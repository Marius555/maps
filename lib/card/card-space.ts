import {
  CARD_BLOCKS,
  CARD_ZONES,
  cardRows,
  rowOffsetHolder,
  type CardBlock,
  type CardBlockType,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";
import type { CardDrag } from "./card-edits";

/**
 * Whether there is room on the card for what is in the air.
 *
 * The same split `card-edits.ts` and `lib/map/drop-action.ts` make: the gesture
 * asks, a tested module answers. A zone that has run out of room offers no drop
 * target at all, which is what stops a 70%-tall photo in the top zone from still
 * advertising a landing spot above itself — and then clipping whatever went
 * there, because the card is `overflow: hidden` and only its middle scrolls.
 *
 * **Measured, not computed.** Most blocks have no height of their own: a name is
 * as tall as the name, an address as tall as the address, and both change with
 * the location the canvas happens to be drawing. So the caller passes in what
 * each block currently measures (`components/card/designer/use-drop-bands.ts`,
 * in the same pass that finds the seams) and this does the arithmetic. The
 * fallbacks below are only for a block that has never been measured at all.
 */

/**
 * What a block with nothing measured yet is assumed to take, in px.
 *
 * One line of text at the card's own type scale, near enough. Deliberately
 * small: guessing high would close a lane the card actually had room for, and
 * the real number arrives a frame later either way.
 *
 * It doubles as the floor `dropSlots` divides free space by — a block whose
 * sample location has nothing to show measures zero, and free space divided by
 * nothing is every pixel of the card offered as a landing spot.
 */
export const MIN_BLOCK_HEIGHT = 24;

/** What each block on the canvas currently measures, by block id. */
export type BlockHeights = Readonly<Record<string, number>>;

/** A block's height in px — what it measures, or what its type implies. */
function blockHeight(
  block: CardBlock,
  layout: CardLayout,
  heights: BlockHeights,
): number {
  const measured = heights[block.id];
  if (typeof measured === "number" && measured > 0) return measured;

  return block.heightPct
    ? Math.round((layout.maxHeight * block.heightPct) / 100)
    : MIN_BLOCK_HEIGHT;
}

/**
 * How tall a block of this type arrives, in px — the same number
 * `makeCardBlock` gives it, resolved against this card.
 */
export function newBlockHeight(
  layout: CardLayout,
  type: CardBlockType,
): number {
  const spec = CARD_BLOCKS[type] as (typeof CARD_BLOCKS)[CardBlockType] | undefined;
  const pct = spec?.defaultHeightPct;

  return pct ? Math.round((layout.maxHeight * pct) / 100) : MIN_BLOCK_HEIGHT;
}

/**
 * Every block on the card, plus the gaps, the leading space anyone has put
 * above a block, and the card's own padding.
 *
 * The total **including** the slack, in other words — what the card comes to
 * when every block gets all the room it asked for. `contentHeight` is the same
 * sum without it, and that is the one the drop question is answered from, since
 * leading space gives way (`leadBox` in packages/shared/card-layout.ts) and so
 * is never in a newcomer's way.
 *
 * Kept as its own export because it is the honest answer to "how tall would this
 * card like to be", which is what the tests are written against and what tells a
 * card that merely *prefers* more room from one that genuinely cannot fit.
 */
export function usedHeight(
  layout: CardLayout,
  heights: BlockHeights,
): number {
  let used = layout.padding * 2;

  for (const zone of CARD_ZONES) {
    const rows = cardRows(layout.zones[zone], layout);
    if (rows.length === 0) continue;

    /*
     * Per row, not per block, and both halves of that matter for a pair. Two
     * blocks sharing a line are as tall as the taller of them, not as tall as
     * both, and there is one gap after the line rather than one after each of
     * them. Counting either the old way would have a card report itself full
     * with half its height unspent, and close lanes that were really open.
     *
     * For a card with no halves on it this is the arithmetic it always was:
     * one row per block, and `Math.max` over a single value is that value.
     */
    used += layout.gap * (rows.length - 1);

    for (const row of rows) {
      let tallest = 0;
      let offset = 0;

      for (const block of row.blocks) {
        tallest = Math.max(tallest, blockHeight(block, layout, heights));
        offset = Math.max(offset, block.offset ?? 0);
      }

      used += tallest + offset;
    }
  }

  return used;
}

/**
 * The leading space on the card — every row's, summed.
 *
 * `rowOffsetHolder` and not a second `Math.max`, deliberately. A row's space is
 * one number held by one member, and this has to name the same pixels
 * `usedHeight` added and the same ones `leadBox` actually gives back on the
 * card; three readings of "the row's leading space" that agree today are three
 * that can drift tomorrow.
 */
export function reclaimableSpace(layout: CardLayout): number {
  let space = 0;

  for (const zone of CARD_ZONES) {
    for (const row of cardRows(layout.zones[zone], layout)) {
      space += rowOffsetHolder(row.blocks)?.offset ?? 0;
    }
  }

  return space;
}

/**
 * What the card has spent on things that are actually *there* — everything
 * `usedHeight` counts, less the empty room holding blocks apart.
 */
export function contentHeight(
  layout: CardLayout,
  heights: BlockHeights,
): number {
  return usedHeight(layout, heights) - reclaimableSpace(layout);
}

/**
 * How much of the card a **new** block may have, in px.
 *
 * Not `maxHeight - usedHeight`, and the difference is the whole of the bug this
 * replaced. A block sitting near the bottom of the card is held there by a
 * leading `offset`, and `usedHeight` charges that offset as height already
 * spent — correctly, for its own purpose. So a card with a logo and an address
 * at the top and a name at the bottom reported about eight pixels free while
 * showing three hundred pixels of white space down the middle, and every
 * palette chip dragged over that space was answered "No room for this on the
 * card." The larger the gap, the more certain the refusal: exactly backwards.
 *
 * A drop into that space does not grow the card. `run` in ./drop-slots.ts lays
 * its landing marks *inside* the free runs and hands the block below a
 * `nextOffset` — what its leading space has to become for its own top edge not
 * to move — so the newcomer is paid for out of the gap it landed in. Where the
 * gap is in one zone and the drop in another, the gap simply compresses: every
 * renderer draws leading space as a box that gives way under exactly this
 * pressure (`leadBox` in packages/shared/card-layout.ts). Leading space is slack,
 * and every part of this system treats it as slack.
 *
 * `usedHeight` goes on counting it, because it answers the opposite question:
 * not "what may still be added" but "how tall would this card like to be".
 */
export function roomForNew(layout: CardLayout, heights: BlockHeights): number {
  return Math.max(0, layout.maxHeight - contentHeight(layout, heights));
}

/**
 * Whether this zone can take this drag without the card overflowing.
 *
 * Two things are always true and are checked before the arithmetic:
 *
 * - **A move needs no room.** The block is already on the card and already
 *   counted, so wherever it lands the total is the same. That is a promise the
 *   drop arithmetic has to keep rather than a fact about moves — `vacate` and
 *   `settle` in ./card-edits.ts are what keep it — and refusing a move would
 *   strand a block on a full card with no way to reorder it.
 * - The **middle zone** used to be exempt as well, because it is the card's only
 *   scroller (`ZONE_CLASS.middle` in components/card/card-frame.tsx) and a long
 *   description overflowing it is how a long description works. It is not exempt
 *   any more. A card is a fixed box on somebody else's website and a visitor
 *   will not scroll inside one to find the block at the bottom, so the editor
 *   does not let one be *designed* that way.
 *
 * The scroller stays, and that is deliberate rather than a leftover: a block's
 * height comes from the location's own content, and the studio draws one sample
 * location. Some other location's description is longer than anything measured
 * here, and clipping it would hide a real customer's real content. Scrolling is
 * the safety valve for what cannot be known at design time; this is what stops
 * the design itself needing it.
 */
export function hasRoomFor(
  layout: CardLayout,
  zone: CardZone,
  drag: CardDrag,
  heights: BlockHeights,
): boolean {
  if (drag.kind === "move") return true;

  // The gap the new block brings with it counts too — a block that fits only by
  // ignoring the space either side of it does not fit.
  const needed =
    newBlockHeight(layout, drag.type) +
    (layout.zones[zone].length > 0 ? layout.gap : 0);

  return roomForNew(layout, heights) >= needed;
}
