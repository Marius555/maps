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
 * `offset` counts here for the same reason a gap does: it is height the card
 * has already spent. Leave it out and a card whose blocks have been spread down
 * the middle still reports the room it had when they were stacked at the top,
 * which is a top zone that offers a landing spot the card then clips.
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

/** How much of the card is still unspoken for, in px. Never below zero. */
export function roomLeft(layout: CardLayout, heights: BlockHeights): number {
  return Math.max(0, layout.maxHeight - usedHeight(layout, heights));
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

  return roomLeft(layout, heights) >= needed;
}

/**
 * The same card, with its leading spaces trimmed until it fits inside itself.
 *
 * The other half of "a card is never designed into a scroll". `hasRoomFor` stops
 * one being built too tall from here on; this is what pulls back one that already
 * is — a card whose blocks were spread down the middle before the rule existed,
 * or one an older build's arithmetic walked past the bottom edge.
 *
 * **Leading space only, largest first.** It never touches an order, a width or a
 * height, so nothing anyone put on the card disappears or changes shape; the
 * only thing it takes away is the empty room that was pushing a block out of
 * sight, and it takes it from the biggest gap first because that is the one
 * somebody is least likely to have meant to the pixel.
 *
 * A row's space is one number held by one member (`rowOffsetHolder`), so it is
 * trimmed per row and the row's other members are cleared with it — the same
 * single-valued rule `withRowOffset` in ./card-edits.ts writes by. Otherwise a
 * sibling's older number becomes the new maximum and the trim does nothing.
 *
 * Returns the layout **by reference** when it already fits, so a caller can tell
 * "nothing to do" from "changed" by identity, and a card nobody has overfilled
 * publishes the bytes it always did (CLAUDE.md §7).
 */
export function fitWithin(
  layout: CardLayout,
  heights: BlockHeights,
): CardLayout {
  /*
   * Whole pixels, because an `offset` is one: `cardLayoutSchema` declares it
   * `z.number().int()` and the endpoint refuses anything else.
   *
   * This is the only writer that could hand it a fraction, and the reason is
   * structural rather than careless — every other one rounds a measurement into
   * a number (`vacatedSpace`, `run`'s `settles`, `settlesBelow`), while this one
   * subtracts a *measured total* from a stored integer. `getBoundingClientRect`
   * reports sub-pixel, so a card of two text blocks is 468.975 tall and the
   * offset that comes out the far side is 196.0249…
   *
   * That was not a rounding error anyone would see. It was a 422 on every save
   * from the moment the page loaded, so no edit persisted at all and the card
   * came back unchanged on the next reload.
   *
   * `ceil` rather than `round`: a whole pixel too much comes off the leading
   * space and the card is inside itself, where a fraction too little leaves it
   * over the edge — which is the one thing this function exists to prevent.
   */
  let over = Math.ceil(usedHeight(layout, heights) - layout.maxHeight);
  if (over <= 0) return layout;

  const spaced: { zone: CardZone; holder: string; members: string[]; offset: number }[] =
    [];

  for (const zone of CARD_ZONES) {
    for (const row of cardRows(layout.zones[zone], layout)) {
      const holder = rowOffsetHolder(row.blocks);
      if (!holder?.offset) continue;

      spaced.push({
        zone,
        holder: holder.id,
        members: row.blocks.map((block) => block.id),
        offset: holder.offset,
      });
    }
  }

  spaced.sort((a, b) => b.offset - a.offset);

  /** What each block's offset becomes. Absent means leave it alone. */
  const trimmed = new Map<string, number>();

  for (const row of spaced) {
    if (over <= 0) break;

    const take = Math.min(over, row.offset);
    over -= take;

    for (const id of row.members) {
      trimmed.set(id, id === row.holder ? row.offset - take : 0);
    }
  }

  if (trimmed.size === 0) return layout;

  const zones = { ...layout.zones };
  for (const zone of CARD_ZONES) {
    zones[zone] = layout.zones[zone].map((block) => {
      const next = trimmed.get(block.id);
      if (next === undefined || (block.offset ?? 0) === next) return block;

      const copy = { ...block };
      if (next > 0) copy.offset = next;
      else delete copy.offset;

      return copy;
    });
  }

  return { ...layout, zones };
}
