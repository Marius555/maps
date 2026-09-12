import type { DraggedObject } from "@/components/groups/use-row-drag";
import {
  CARD_BLOCKS,
  acceptsBlock,
  cardRows,
  findBlock,
  hasControl,
  isPairable,
  isSelfSized,
  rowOffsetHolder,
  selfShareOf,
  shareOf,
  shareOfAny,
  upwardLiftOf,
  type CardBlock,
  type CardBlockAlign,
  type CardBlockType,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";
import { makeCardBlock, type CardDrag } from "./card-edits";
import { MIN_BLOCK_HEIGHT, newBlockHeight } from "./card-space";
import { canDrop, MIN_BAND, toCardDrag } from "./drop-bands";

/**
 * Room at the card's own edges for an end zone that has nothing in it yet.
 *
 * **The bottom zone is the only thing on a card that pins**, and until this it
 * was the one place a block could not be dropped. A zone with no blocks is
 * content-sized and therefore zero pixels tall (`CardZoneBox`'s `hasBlocks`), so
 * it measured `top === bottom`; `dropSlots` emitted a zero-span run for it,
 * `dropRegions` skipped it outright — nothing was drawn — and `dropBands` left it
 * a `MIN_BAND` sliver at the very edge of the card that nobody could aim at. The
 * middle zone's `flex-1` had meanwhile swallowed every leftover pixel, so the
 * empty space a person sees in the lower half of a card *is the middle zone*, and
 * every "put this at the bottom" gesture landed there — held down by a stored
 * `offset`, which is space above a block and not a promise about the bottom. That
 * is the whole of the reported bug: the same design drew its button flush on a
 * location with a long description and 37px short on one with none.
 *
 * So an empty end zone borrows a block's worth of room from the middle. It is a
 * loan and not a measurement: the pixels belong to the middle zone right now, and
 * the moment something lands the zones really are this shape. Both halves are
 * written, so nothing is offered twice and the marks cannot overlap.
 *
 * The padding is paid here because the zone will pay it the moment it holds a
 * block (`zoneClass`: a bottom zone pays top *and* bottom, a top zone only its
 * top), which is what makes the outline land where the block itself will.
 *
 * Nothing happens at all when there is less than `MIN_BAND` of free space to
 * lend, which is a card whose middle zone is already full: there is no empty
 * strip on screen to point at, and drawing a target over a block is worse than
 * offering none.
 */
export function lendToEndZones(
  zones: ZoneMeasure[],
  layout: CardLayout,
  drag: CardDrag | null,
  blockHeight: number,
): void {
  const middle = zones.find((measure) => measure.zone === "middle");
  if (!middle) return;

  /*
   * The middle zone's own blocks, minus the one in the hand.
   *
   * It is still on the card and still measures — the canvas draws it dimmed
   * where it was — but its space is about to be freed, which is the same fact
   * `dropSlots` reads through `freedBy`. Counted, a block dragged off the bottom
   * of the middle zone reports that zone full, no room is lent, and the gesture
   * that most needs the bottom band is the one that cannot reach it.
   *
   * Its *line* is what really survives, so this drops the block rather than the
   * row: a block that shares its line leaves its partner behind, and that
   * partner's own rect still holds the line where it is.
   */
  const parked = middle.blocks.filter(
    (block) => !(drag?.kind === "move" && drag.id === block.id),
  );

  const pad = layout.padding;
  const want = Math.max(MIN_BLOCK_HEIGHT, Math.round(blockHeight));
  // Nothing to separate when the middle is empty, so no gap to pay for either.
  const gap = parked.length > 0 ? layout.gap : 0;

  const bottom = zones.find((measure) => measure.zone === "bottom");

  if (bottom && layout.zones.bottom.length === 0) {
    // The middle zone's last line, or its own top when it holds nothing.
    const used = parked.reduce(
      (edge, block) => Math.max(edge, block.bottom),
      middle.top,
    );
    const lent = Math.min(want, middle.bottom - used - 2 * pad - gap);

    if (lent >= MIN_BAND) {
      bottom.bottom -= pad;
      bottom.top = bottom.bottom - lent;
      middle.bottom = bottom.top - pad;
    }
  }

  const top = zones.find((measure) => measure.zone === "top");

  if (top && layout.zones.top.length === 0) {
    const used = parked.reduce(
      (edge, block) => Math.min(edge, block.top),
      middle.bottom,
    );
    // Only its own top padding: a filled top zone is the first zone drawn, never
    // the last, so it never carries the card's bottom padding.
    const lent = Math.min(want, used - middle.top - pad - gap);

    if (lent >= MIN_BAND) {
      top.top += pad;
      top.bottom = top.top + lent;
      middle.top = top.bottom;
    }
  }
}

/**
 * Every place on the card this drag could actually go — not one per gap between
 * blocks, but one per *block-sized piece of free space there is room for*.
 *
 * The card used to answer "where can this go?" with a stack of three zones. An
 * empty card offered exactly three landing spots — top, middle, bottom — because
 * the model behind them was "an insertion index in a list", and an empty list
 * has one. That is a true answer to a question nobody asked: what someone
 * dragging a block wants to know is *where on this card can I put it*, and the
 * honest answer is every place it fits.
 *
 * So this walks the runs of unused space, and divides each one by the height of
 * whatever is in the user's hand. A 440px card with nothing on it and a name in
 * the air is thirteen places, drawn as thirteen outlines. Drop into the seventh
 * and the block lands in the seventh, because the space above it is stored on
 * the block itself as `offset` (packages/shared/card-layout.ts) rather than
 * being reconstructed from an index.
 *
 * **Everything here is measured, nothing is assumed.** Most blocks have no
 * height of their own — a name is as tall as the name, and taller again once
 * someone widens the card — so the runs come from `getBoundingClientRect`, via
 * `use-drop-bands.ts`, and the free space between two blocks is simply the
 * distance between them. That is what makes the answer follow a block whose
 * height handle was just dragged, with nothing to keep in step.
 *
 * Pure, so it is testable: measurements in, places out.
 */

/** One zone as it currently measures, in px relative to the card's own top. */
export type ZoneMeasure = {
  zone: CardZone;
  /**
   * The zone's **content** edges, not its border box — the zone's own padding
   * is already subtracted. A run is space a block could occupy, and the card's
   * padding is not that.
   */
  top: number;
  bottom: number;
  /**
   * The zone's content edges horizontally, on the same terms — the card's own
   * padding already taken off.
   *
   * This is the width a *line* has, and therefore what a share of one is a share
   * of. `sideSlots` needs it to say how wide the room left beside a narrowed
   * block actually is: deriving that from the block's stored percentage would be
   * arithmetic against a number the browser has already rounded, and the mark
   * would sit a pixel or two off the column it stands for.
   *
   * Optional for the same reason `left`/`right` are on a block: a caller that
   * cannot measure horizontally should offer no column targets rather than guess.
   */
  left?: number;
  right?: number;
  /** The blocks it holds, in the order the layout holds them. */
  blocks: readonly ZoneBlockMeasure[];
};

/**
 * One block as it currently measures, in px relative to the card's own top.
 *
 * `left` and `right` are optional because only the room beside a narrowed block
 * needs them, and a caller that cannot measure horizontally should offer no such
 * targets rather than guess at where they are.
 */
export type ZoneBlockMeasure = {
  id: string;
  top: number;
  bottom: number;
  left?: number;
  right?: number;
  /**
   * How tall this block **asks** to be, as opposed to how tall it was given —
   * its own box plus whatever its content is reserving inside it.
   *
   * The two differ for exactly one reason, and it is the bug this field exists
   * to stop. A zone is a flex column, and `hours` is the one block allowed to
   * shrink below its own content (`flex: 0 1 auto` with `min-height: 0` — see
   * docs/notes/cards.md). So when a design needs more height than the card has,
   * that block silently absorbs the *entire* surplus and every rect in the zone
   * then adds up to exactly the card's height. Nothing overflows, nothing looks
   * wrong, and the room check — which compares those rects against
   * `layout.maxHeight` — reads back a card that is precisely, permanently full.
   * `roomForNew` pins to 0, every zone refuses, and the only thing on screen is
   * a shrunken empty block that reads as free space. Measured to the shrink, the
   * more over-full a card is the more certain it is to report itself exactly
   * full: the same shape of backwards answer `roomForNew` already documents for
   * leading space.
   *
   * So the room check is asked in terms of this, and the drawing is not: a mark
   * has to be painted where the block actually is, which is the rect.
   *
   * Optional, and absent means the rect — a caller that cannot measure a block's
   * own content is describing a card nothing has shrunk, which is what every
   * fixture and every card that fits already is.
   */
  wants?: number;
};

/**
 * A *line* of the card as it currently measures — which is what the runs of free
 * space are actually between.
 *
 * Two blocks sharing a line have overlapping vertical extents, so walking the
 * blocks in order and taking the distance between each pair would produce a
 * "run" of negative height between them and put an outline nowhere. The lines
 * are what stack; the blocks only stack when each is alone on one.
 *
 * The grouping comes from `cardRows` over the *layout*, not from the DOM: the
 * layout is what the insertion indices are indices into, so joining measured
 * rects to it by id is the only way `index` and `end` can be right without the
 * renderer having to publish them.
 */
type MeasuredRow = {
  /** Insertion index of the row's first block in the zone's own array. */
  index: number;
  /** One past its last — the insertion index immediately after the row. */
  end: number;
  /** How many blocks the *layout* puts on this line, measured or not. */
  count: number;
  /** Whether this line is a flex row — i.e. whether it holds a narrowed block. */
  shared: boolean;
  top: number;
  /**
   * Where the line sits **in flow** — its visual top with a mark's upward
   * overlap added back.
   *
   * `top` is where the line's ink starts, and the two differ by exactly the
   * `margin-top` a logo with `overlapPct` gives itself: it is drawn half a
   * square above the line it belongs to, and `measuredRows` takes a line's
   * extent as the union of its members'. That is the right number for drawing —
   * a mark's overhang is occupied, and a drop mark must not be painted over it —
   * and the **wrong** number for an `offset`, which positions the line's flow
   * box, i.e. where its first in-flow member starts.
   *
   * Reading one as the other is a real bug someone watched happen: a lift above
   * a line led by an overlapping logo charged the line the distance to its *ink*,
   * so the line came back half a logo higher than it was, and the card walked up
   * a little on every move. Both offset arithmetics — `vacatedSpace` here and
   * `nextOffset` in `run` — now measure to this instead.
   *
   * There is no matching `flowBottom`, and there does not need to be: a lifted
   * block's own bottom is `flowTop - lift + height`, which is exactly what it
   * contributes to the flow box, so a line's visual and flow bottoms are always
   * the same number.
   */
  flowTop: number;
  bottom: number;
  /**
   * How tall the line **asks** to be — its flow height with the flex column's
   * shrink given back. See `wants` on `ZoneBlockMeasure`, which is where the
   * whole argument is; this is that number taken over the line's members.
   *
   * Equal to `bottom - flowTop` for every line nothing has shrunk, which is
   * every line on a card that fits.
   */
  wants: number;
  /** Those of its blocks that were actually measured. */
  blocks: readonly MeasuredBlock[];
};

/**
 * A measured rect with the one thing the DOM pass cannot know: where the block
 * sits, as opposed to where it is drawn. See `flowTop` above — a line's is the
 * least of its members'.
 */
type MeasuredBlock = ZoneBlockMeasure & { flowTop: number };

/**
 * How far a set of measured blocks reaches — the three numbers a line's extent
 * is, taken over its members.
 *
 * One function because `measuredRows` and `shrunkBy` have to agree on all three:
 * the second answers "how tall is this line once the block in the hand leaves
 * it", and a `flowTop` it forgot to recompute would be the departed block's own.
 */
function extentOfBlocks(blocks: readonly MeasuredBlock[]): {
  top: number;
  flowTop: number;
  bottom: number;
  wants: number;
} {
  let top = blocks[0].top;
  let flowTop = blocks[0].flowTop;
  let bottom = blocks[0].bottom;
  let wants = 0;

  for (const rect of blocks) {
    top = Math.min(top, rect.top);
    flowTop = Math.min(flowTop, rect.flowTop);
    bottom = Math.max(bottom, rect.bottom);
    /*
     * The line's own height with each member's shrink given back — see `wants`
     * on `ZoneBlockMeasure`. A member contributes its flow height plus whatever
     * the flex column took off it, and the line asks for as much as its
     * hungriest member: two blocks sharing a line cost the card one line, which
     * is the same rule `usedHeight` applies to their rects.
     *
     * The give-back is measured against the block's *own* box rather than its
     * flow height, because the only difference between those two is an
     * overlapping mark's lift, and a lift is not something a shrink can eat.
     */
    const grown =
      rect.wants === undefined
        ? 0
        : Math.max(0, rect.wants - (rect.bottom - rect.top));

    wants = Math.max(wants, rect.bottom - rect.flowTop + grown);
  }

  return { top, flowTop, bottom, wants };
}

/** A zone's lines, in order, with the measurements joined on by id. */
function measuredRows(
  layout: CardLayout,
  measure: ZoneMeasure,
): MeasuredRow[] {
  const rects = new Map(measure.blocks.map((block) => [block.id, block]));
  const rows: MeasuredRow[] = [];

  for (const [r, row] of cardRows(layout.zones[measure.zone], layout).entries()) {
    const measured: MeasuredBlock[] = [];
    /*
     * Whether the lines above this one exist at all, which is what decides
     * whether a mark on it is pulled up.
     *
     * Counted over `cardRows` rather than over the rows pushed so far: a line
     * whose blocks have not rendered yet contributes nothing below, but it is
     * still a line above this one, and asking `rows.length > 0` would say a
     * mark's overlap had switched off for a frame.
     */
    const hasLineAbove = r > 0;

    for (const block of row.blocks) {
      const rect = rects.get(block.id);
      // Each rect carries the block's own upward overlap added back, which is
      // what separates where a line is drawn from where it sits. See `flowTop`.
      if (rect) {
        measured.push({
          ...rect,
          flowTop: rect.top + upwardLiftOf(block, layout, hasLineAbove),
        });
      }
    }

    // Nothing of this line is on screen yet — a render the measurement pass
    // beat. It contributes no run rather than a run of the wrong size.
    if (measured.length === 0) continue;

    rows.push({
      index: row.index,
      end: row.end,
      count: row.blocks.length,
      shared: row.shared,
      ...extentOfBlocks(measured),
      blocks: measured,
    });
  }

  return rows;
}

/**
 * What every block on the card is spending of its height, by id — the map the
 * room check is answered from.
 *
 * **Every block on a line is credited with the *line's* height, not its own.**
 * `usedHeight` takes the taller of a pair, so telling it both are as tall as the
 * line is the same number and needs no second code path — and it is the honest
 * one, since a pair really does cost the card one line of height.
 *
 * **And it is what the line asks for, not what it was given.** That is `wants`
 * on `ZoneBlockMeasure`, and the whole argument is there: one block in a zone is
 * allowed to shrink below its own content, so rects alone always add up to
 * exactly the card's height and a card can be over-full without a pixel of it
 * showing. From the line's **flow** top either way, not its ink — a room check
 * is arithmetic about how much of the card is spent, and a logo drawn half above
 * the line it is on costs the card only the half that is inside it. Measured to
 * the ink, a card with a logo on it reported itself 31px fuller than it was and
 * closed the last lane on a card that visibly had room. See `flowTop` on
 * `MeasuredRow`.
 */
function heightsOfRows(
  rows: Iterable<readonly MeasuredRow[]>,
): Record<string, number> {
  const heights: Record<string, number> = {};

  for (const zone of rows) {
    for (const row of zone) {
      for (const block of row.blocks) heights[block.id] = row.wants;
    }
  }

  return heights;
}

/**
 * The same map, for a caller that has zones rather than rows.
 *
 * `dropSlots` has already grouped the card into lines by the time it asks, and
 * `useCardDropBands` has not — it needs this to say *how far* over its height a
 * card is, which is the one thing the refusal has to be able to explain. Exported
 * rather than duplicated there, because the two have to agree about what a block
 * costs or the message would contradict the decision it is explaining.
 */
export function zoneHeights(
  layout: CardLayout,
  zones: readonly ZoneMeasure[],
): Record<string, number> {
  return heightsOfRows(zones.map((zone) => measuredRows(layout, zone)));
}

/**
 * Whether this line is nothing but the block in the user's hand — and so whether
 * the drop is about to free it.
 *
 * The one question three different passes have to answer identically. A freed
 * line is not occupied (`blockedFaces`), the runs either side of it are one run
 * (`dropSlots`), and the block under it inherits the hole unless something
 * charges it (`vacatedSpace`). Each used to spell the test out with a comment
 * promising the other two matched; this is that promise made mechanical.
 *
 * **A narrowed line counts.** It used to be excluded — a line holding a block
 * half the card wide stayed put even when that block was the only thing on it —
 * on the grounds that `sideSlots` already describes such a line as its own free
 * column, and a card-width run drawn over the same pixels is two marks stacked
 * on one line. But keeping the *line* is not what keeps that column: `sideSlots`
 * walks the rows itself and never asks this. What keeping the line actually did
 * was measure the run below it from an edge the drop then deleted, so the mark
 * was drawn a line-and-a-gap below where the block would land — around 26px on
 * an ordinary card, in the one gesture where the block is also about to change
 * width. The column stays; the lie goes.
 *
 * **`count` against `blocks.length` is what `shared` used to cover by accident.**
 * `blocks` holds only the members that were actually measured, `count` is how
 * many the layout puts on the line — so a pair whose partner had not rendered
 * yet passes `every` on the dragged block alone. Freeing that line would hand a
 * run the pixels of a block still drawn in them.
 */
function freedBy(row: MeasuredRow, drag: CardDrag): boolean {
  return (
    drag.kind === "move" &&
    row.count === row.blocks.length &&
    row.blocks.length > 0 &&
    row.blocks.every((block) => block.id === drag.id)
  );
}

/**
 * This line, as tall as it will be once the block in the hand has left it.
 *
 * A line that survives a departure can still change size, and the case is not
 * exotic — it is what a logo and a name sharing a line do. `measuredRows` takes
 * a line's extent as the union of its members', so a name hanging 5px below a
 * logo that is pulled up over the picture above it *is* the line's bottom edge.
 * Take the name away and the line ends where the logo does, and everything
 * under it comes up by those five pixels.
 *
 * Which is a lie told twice if it is not corrected here: the runs below the line
 * are measured from that edge, so the mark is drawn five pixels below where the
 * block will land, and the block underneath is charged five pixels it will not
 * have to pay. Both come out of `kept` in `dropSlots`, so both are fixed by
 * shrinking the line once, before the runs are cut out of it.
 *
 * Only the extent moves. `index`, `end`, `count` and `blocks` still describe the
 * line the layout has, because they are what the insertion indices index into.
 *
 * The row unchanged when the drag is not on it, when it is a palette drag, or
 * when the line is nothing but the block in the hand — that last one is
 * `freedBy`'s case, and it is filtered out before this ever sees it.
 *
 * **A survivor's rect is not its height, and this is the whole difficulty.** A
 * line is `align-items: stretch` on purpose — that is what makes a pair look
 * like a pair rather than two blocks of different sizes with a step between them
 * (`cardRowStyle` in components/card/card-frame.tsx). So an address beside a
 * logo *measures* as tall as the logo, and comparing the survivors' rects
 * against the line's says "no change" for the one case that changes most: take
 * the logo away and the address collapses from 62px to the 14px of text it
 * actually is, and everything under it rises by the difference with nothing
 * charged for the hole. Rects can only report the stretch, so the survivors are
 * asked for their own heights instead — `HeightAt`, the same measurer a column
 * landing already asks about the block it lands beside.
 */
function shrunkBy(
  row: MeasuredRow,
  drag: CardDrag,
  layout: CardLayout,
  heightAt: HeightAt,
): MeasuredRow {
  if (drag.kind !== "move") return row;

  const staying = row.blocks.filter((block) => block.id !== drag.id);
  if (staying.length === 0 || staying.length === row.blocks.length) return row;

  return {
    ...row,
    ...extentOfBlocks(
      staying.map((rect) => alone(rect, layout, heightAt)),
    ),
  };
}

/**
 * One member of a shared line, as tall as it draws once it is the only thing on
 * that line.
 *
 * Its own top is kept: a block draws downward from where it starts, and the one
 * member that starts somewhere else — a logo pulled up over the line above — is
 * measuring its own square either way. Only the bottom edge moves.
 *
 * The rect unchanged when there is nothing to ask with: a caller that measured
 * no horizontal extent has no width to ask about, and `heightAt`'s own fallback
 * is this rect's height, so the answer degrades to what it was before this
 * existed rather than to nonsense.
 */
function alone(
  rect: MeasuredBlock,
  layout: CardLayout,
  heightAt: HeightAt,
): MeasuredBlock {
  const found = findBlock(layout, rect.id);
  const width =
    rect.left !== undefined && rect.right !== undefined
      ? rect.right - rect.left
      : 0;

  if (!found || width <= 0) return rect;

  return {
    ...rect,
    bottom:
      rect.top +
      heightAt(rect.id, shareOf(found.block), width, rect.bottom - rect.top),
    /*
     * And no `wants` any more, because `heightAt` has just answered that same
     * question better. It measures a clone that is `position: absolute` and so
     * is not a flex item at all — the height it returns is already the unshrunk
     * one, for the width this block is about to have. Carrying the old rect's
     * reservation past it would be describing the block as it was on a line it
     * has just left.
     */
    wants: undefined,
  };
}

/**
 * A slice of the card that is **occupied** — see `blockedFaces`.
 *
 * Deliberately not a `DropSlot`. A slot carries an insertion index and a leading
 * offset because something lands there; nothing lands here, and giving it those
 * fields would be inviting the overlay to treat it as somewhere to go.
 */
export type BlockedFace = {
  zone: CardZone;
  /**
   * Insertion index of the line's first block.
   *
   * Not read by the geometry at all — it is what makes the face's drop-target id
   * unique, which is the same job `line` does on a column slot.
   */
  line: number;
  /** Where it starts, in px from the card's top. */
  top: number;
  /** Where it ends, on the same terms. */
  bottom: number;
};

/** One place a block can land, and everything needed to draw and apply it. */
export type DropSlot = {
  zone: CardZone;
  /** Insertion index into `layout.zones[zone]` — the array, moved block and all. */
  index: number;
  /** Where the mark is drawn, in px from the card's top. */
  y: number;
  /**
   * How tall the mark is. **Zero for a seam**: a run with no room for the block
   * still offers the one insertion point between the two blocks it separates,
   * drawn as a rule rather than a box, and dropping there pushes what follows
   * down — which is the honest outcome when there is nowhere to put it.
   *
   * With one exception, and it is the one landing that genuinely needs no room:
   * a **mark** straddling the block above it spends only half its own height, so
   * a run with no span still draws it as the square it lands as. See `run`.
   */
  height: number;
  /** The `offset` the landing block takes: how far below the run's start it sits. */
  offset: number;
  /**
   * What the block that ends up *after* it must become, so that block does not
   * move. Absent when nothing follows in this zone.
   */
  nextOffset?: number;
  /**
   * Where the mark is drawn horizontally, in px from the card's left. Absent
   * spans the card's own padding, which is what a slot for a full-width block
   * has always done.
   */
  left?: number;
  /** How wide the mark is. Absent goes with an absent `left`. */
  width?: number;
  /**
   * This slot lands the block on a shared line, in the column named — beside the
   * block already there, or in place of it.
   *
   * A side rather than a flag, because the index alone cannot say which: a slot
   * that puts the block *after* its partner and one that puts it *before* are
   * two different insertion indices with nothing else to tell them apart, and
   * `dropCardBlock` has to know which of the two blocks ends up starting the
   * line. See `sideSlots`.
   */
  half?: "start" | "end";
  /**
   * How wide the block that lands here becomes, as a percentage of the card.
   *
   * **Every slot that is drawn full width says 100**, which is the rule that
   * makes the mark honest: a run slot and a seam carry no `left`/`width`, so
   * they are painted across the whole card, and a 50%-wide block released on one
   * used to land at 50% with reserved space beside it — an outline promising a
   * block twice the size of the one that arrived. Landing alone on a line is now
   * how a block gets its full width back, and the Width slider is the only way to
   * reserve room beside one.
   *
   * Column slots carry the width of the column they draw, worked out from
   * `width` above against the line's own measured width, so the number stored and
   * the box drawn are the same thing. It is absent on some of those, and that is
   * still deliberate: a swap and a flip move a block between columns that already
   * fit it, so neither touches a width.
   *
   * `withShare` in lib/card/card-edits.ts is what applies it, and it ignores a
   * type with no `width` control — so a logo dropped on a run is not silently
   * given a share it has no way to hold.
   */
  widthPct?: number;
  /**
   * The insertion index of the line this slot is on. Column slots only.
   *
   * Two things need it. `dropCardBlock` tells "join the line above me" from
   * "cross my own line" with it — the two are otherwise the same `(zone, index,
   * side)`. And it is what makes a column slot's id unique: without it those two
   * registered as one drop target, so the pointer lit both marks and only one of
   * them could ever fire.
   */
  line?: number;
  /**
   * The block already on this line that has to narrow for this drop to fit.
   *
   * Present only on a **pair** target — the two columns offered over a block
   * that is currently the full width of the card. Every other column target
   * lands in room a narrowed block already reserved, so nothing about the block
   * beside it changes; a pair target is the gesture that *creates* the reserved
   * room, and the block already there is the other half of it.
   */
  pairId?: string;
  /** What `pairId` becomes. Half, which is the only split a drop can ask for. */
  pairWidthPct?: number;
  /**
   * The slice of the card that aims at this slot, when it is not the box drawn
   * for it. Absent means the two are the same, which is every other slot.
   *
   * A pair target draws the whole column it will fill, so the outline promises
   * the block's real size — but it only *catches* the middle of it. The strips
   * left at the top and bottom belong to the runs above and below, so dropping a
   * block onto a line to pair with it and dropping it onto a line to go above it
   * stay two aimable gestures on a card with no space between its blocks. It is
   * the same distinction the Locations panel draws between joining a group and
   * passing over one.
   */
  hitTop?: number;
  hitBottom?: number;
  /**
   * The free space this slot is one place in — what the *resting* outline draws,
   * where `y`/`height` are what the bold mark under the pointer draws.
   *
   * They differ in two ways and both matter. A mark straddling the block above
   * it is drawn half over that block, so an area merged from the slots' own
   * boxes reaches into a block that is already on the card. And a run's slots
   * are spread through their free space rather than filling it, so their union
   * starts and stops short of the room itself.
   *
   * An **empty** area — top and bottom equal — is a place with no free space of
   * its own: a mark landing on the bottom edge of the block above borrows that
   * block and spends nothing. It is a real drop and it draws no resting outline,
   * for the same reason a seam does not. Absent means the slot's own box is the
   * area, which is every column target: the room beside a block *is* what it
   * stands for.
   */
  areaTop?: number;
  areaBottom?: number;
  /**
   * The same distinction on the other axis: the slice of the *line* that aims at
   * this slot, when it is not the box drawn for it.
   *
   * A self-sized drag is the only thing that needs it, and it needs it because a
   * mark is small. The box drawn is a square the size of the logo, sitting at
   * one end of the line or in the middle of it; the box that catches the pointer
   * is a whole third of the line, so aiming at "the left of this row" does not
   * mean hitting a 62px target. See `splitAlignColumns` in ./drop-bands.ts.
   */
  hitLeft?: number;
  hitWidth?: number;
  /**
   * Where a self-sized block lands across its line. Self-sized drags only.
   *
   * The second degree of freedom a mark has and nothing else on the card does: a
   * name dropped into a run fills the line it lands on, so where it goes is one
   * number, while a logo is a square that can sit at either end of that line or
   * in the middle of it. Absent leaves the block's own alignment alone.
   */
  align?: CardBlockAlign;
  /**
   * Draw this slot as the **square** a self-sized block makes, rather than as
   * the box it was measured from.
   *
   * Set for every slot offered to a mark in the hand, and the whole of "the
   * outline is the shape of the thing you are dragging". `align` used to stand
   * in for it, which was true of the align grid and false of every column beside
   * a block: those come out of `sideSlots` with no alignment to write, so a logo
   * dragged over the room beside a name was promised that room's full rectangle
   * and then landed as a 62px square in the corner of it.
   *
   * A flag rather than the geometry, because the size is measured px while
   * `sideSlots` works in the units the layout does — see `useCardDropBands`,
   * which is where the square is cut.
   */
  mark?: boolean;
};

/**
 * How much of a block's own height offers to pair, as a fraction.
 *
 * The rest is split between the runs either side of it. Six tenths is enough
 * that the middle of a block reads as "here" rather than as a sliver you have to
 * find, and leaves a fifth of the block at each end — on a 110px photo that is
 * 22px, comfortably over `MIN_BAND`.
 */
const PAIR_BAND = 0.6;

/** The one split a pair drop makes. Everything else is the Width slider's. */
const PAIR_SHARE = 50;

/**
 * The middle of a line: the part of it that belongs to the **block sitting
 * there** rather than to the runs of free space above and below it.
 *
 * One function, because two things cut this band and they must never disagree.
 * `pairTargets` uses it for the strip that offers to split the line, and
 * `blockedFaces` uses it for the strip that refuses the drop outright — and
 * those are the same place seen from either side: wherever a line can be paired
 * with, the pair target is drawn there; wherever it cannot, the refusal is. Two
 * copies of `(height - band) / 2` would be a card where the two answers sat a
 * few pixels apart and a sliver of a block quietly meant something else.
 *
 * `strip` is what has to be left at each end, and it is the one number the two
 * callers pass differently. A pair target is something you aim **at**, so it may
 * take the whole of a short line — that is what makes dropping a name onto
 * another name work at all, and it has always done so. A blocked face is
 * something you must not fall **into**, and taking 16px out of a 24px name to
 * say "no" would cost the two insertion points either side of it, which are real
 * places someone wants. Taking the middle 66px of a 110px photo costs nothing.
 * So the refusal keeps `MIN_BAND` clear at each end and simply does not apply to
 * a line too short to spare it; the offer does not.
 *
 * Null when there is no middle left to speak of.
 */
function faceBand(
  top: number,
  bottom: number,
  /** What is left at each end, at minimum. Zero lets the band take the lot. */
  strip: number,
): { top: number; bottom: number } | null {
  const height = bottom - top;
  const room = height - strip * 2;
  if (room < MIN_BAND) return null;

  const band = Math.min(
    Math.max(MIN_BAND, Math.round(height * PAIR_BAND)),
    room,
  );
  const from = top + (height - band) / 2;

  return { top: from, bottom: from + band };
}

/**
 * The parts of the card that are **occupied**, and therefore the parts no run of
 * free space may claim.
 *
 * The card used to partition every one of its pixels between the places a block
 * could land (`dropBands`), so a release over the middle of a photo quietly
 * inserted the block above or below it instead. Nothing said no, because nothing
 * could: "nearest wins" has no way to express *there is already something here*.
 *
 * These are that missing answer. They are not slots — nothing lands on one — and
 * the overlay registers them as targets that accept the drag and then do
 * nothing, so a refused drop is a no-op rather than a release into thin air
 * (which is what `onDroppedOutside` reads as a delete).
 *
 * **It composes rather than repartitioning.** A face is painted over the run
 * bands and under the column targets, and `document.elementFromPoint` takes the
 * last of two overlapping targets — so wherever a line really can take the block
 * beside what is already on it, `sideSlots` has drawn a column there and that
 * column wins inside its own box. Nothing about `dropBands` changes, and every
 * case falls out of code that already exists:
 *
 * | the line | `sideSlots` gives | the face resolves to |
 * |---|---|---|
 * | one full-width block, pairable | two columns spanning it | the pair |
 * | one full-width block, not pairable | nothing | **blocked** |
 * | one narrowed block, another drag | free column + occupied one | the columns |
 * | one narrowed block, itself in hand | its free column only | its own half **blocked** |
 * | two halves, a new block in hand | nothing | **blocked** |
 * | a line holding a logo | the runs beside the mark | the mark itself **blocked** |
 *
 * Pure, so it is testable: measurements in, occupied bands out.
 */
export function blockedFaces(
  layout: CardLayout,
  dragged: DraggedObject,
  zones: readonly ZoneMeasure[],
): BlockedFace[] {
  const drag = toCardDrag(dragged);
  if (!drag) return [];

  const faces: BlockedFace[] = [];

  for (const measure of zones) {
    for (const row of measuredRows(layout, measure)) {
      // The line the drag came off is not occupied: its space is about to be
      // freed, and dropping back into the middle of it is a real move.
      if (freedBy(row, drag)) continue;

      /*
       * Clamped into the zone's own content box for the reason `dropSlots`
       * clamps: the middle zone is the card's only scroller, so a line scrolled
       * out of view still has a rect, and refusing a drop somewhere the card is
       * not drawing it would be a target nobody can see or explain.
       */
      const band = faceBand(
        Math.max(row.top, measure.top),
        Math.min(row.bottom, measure.bottom),
        MIN_BAND,
      );
      if (!band) continue;

      faces.push({ zone: measure.zone, line: row.index, ...band });
    }
  }

  return faces;
}

/** The block a lift leaves stranded, and what it has to become to stay put. */
export type VacatedSpace = {
  /**
   * The block that must not move — the first one on the line below the one
   * being carried.
   */
  id: string;
  /** What its `offset` has to become for its own top edge to stay where it is. */
  offset: number;
};

/**
 * The space a move is about to free, charged to the block underneath it.
 *
 * The mirror of `nextOffset`, and the half that was missing. A block stores the
 * empty space *above* it as `offset`, so a drop writes `nextOffset` onto the
 * block it landed above and nothing below the arrival moves (`settle` in
 * ./card-edits.ts). Nothing did the same for the **departure**: lift a block out
 * from above another and the one below simply inherited the hole and rode up
 * into it — so dragging a name one place down and back left the description under
 * it permanently higher than it started, which is one gesture moving two blocks.
 *
 * The answer is the whole run that opens up: from the bottom of the line above
 * the one being carried — or the zone's own content edge — to the top of the line
 * below it, less the gap the run pays at its leading end. That is exactly
 * `span - lead` of the merged run `dropSlots` builds over the same measurements
 * once the carried line is dropped from `kept`, which is why it is worked out
 * here rather than anywhere else: two copies of that arithmetic would be two
 * numbers that agree today.
 *
 * **A departure is not only a line that goes.** Picking up one half of a pair
 * usually leaves its partner drawn exactly where it was, holding the whole line,
 * and then there is nothing to charge. But a pair whose *lower* edge was the
 * block being carried — a name hanging below a logo that is pulled up over the
 * picture above it — shrinks when that block leaves, and everything under it
 * rises by the difference. `shrunkBy` is the size the line ends up, and it is
 * the same call `dropSlots` makes when it cuts its runs.
 *
 * Null is the ordinary answer: a block off the palette frees nothing, and
 * neither does one with no line below it in its own zone.
 *
 * Pure, so it is testable: measurements in, one block's leading space out.
 */
export function vacatedSpace(
  layout: CardLayout,
  dragged: DraggedObject,
  zones: readonly ZoneMeasure[],
  /**
   * See `HeightAt`. Absent means "take what is already on screen", which for a
   * block sharing a line is the *stretched* height and so reports no shrink —
   * see `shrunkBy`. The designer passes a real one.
   */
  heightAt: HeightAt = MEASURED_ALREADY,
): VacatedSpace | null {
  const drag = toCardDrag(dragged);
  if (!drag || drag.kind !== "move") return null;

  const found = findBlock(layout, drag.id);
  if (!found) return null;

  const measure = zones.find((candidate) => candidate.zone === found.zone);
  if (!measure) return null;

  const rows = measuredRows(layout, measure);
  const at = rows.findIndex((row) =>
    row.blocks.some((block) => block.id === drag.id),
  );
  if (at < 0) return null;

  const below = rows[at + 1] as MeasuredRow | undefined;
  if (!below) return null;

  const row = rows[at];
  const freed = freedBy(row, drag);
  const shrunk = shrunkBy(row, drag, layout, heightAt);

  // A line that neither goes nor changes size owes nothing: its partner is
  // still drawn exactly where it was, holding the whole of it.
  if (!freed && shrunk.bottom === row.bottom) return null;

  /*
   * The run's own start and the gap it pays there.
   *
   * Two shapes. A line the drag **frees** is gone, so the run opens at whatever
   * was above it — another line's bottom edge, which owes that line a gap, or
   * the zone's own content edge, which owes nothing because the block landing
   * there would be the zone's first flex item. A line the drag only **shrinks**
   * is still there, so the run opens at its new bottom edge and owes it a gap
   * like any other.
   */
  const above = rows[at - 1] as MeasuredRow | undefined;
  const from = freed ? (above ? above.bottom : measure.top) : shrunk.bottom;
  const lead = freed && !above ? 0 : layout.gap;

  /*
   * The member that actually decides the line, which on a lone block is simply
   * that block. A shared line takes its leading space as the **greatest** of its
   * members' (`cardRowBox` in packages/shared/card-layout.ts), so writing to any
   * other one is a write the card ignores.
   *
   * `rowOffsetHolder` rather than a `reduce` spelled out here, because `settle`
   * in ./card-edits.ts has to pick the *same* member for the two edits to be
   * able to overwrite each other — which is the whole of how a round trip
   * cancels. It used to pick the next block by index instead, and on a shared
   * line the two wrote to different members: both survived, the `Math.max` kept
   * the larger, and the line below a move kept a hole that grew with every
   * further move.
   *
   * The stale sibling is cleared by the writer rather than here — see
   * `withRowOffset` in ./card-edits.ts. This says which block the number is
   * *for*; what happens to the rest of the line is the edit's business.
   */
  const decides = rowOffsetHolder(
    layout.zones[found.zone].slice(below.index, below.end),
  );
  if (!decides) return null;

  /*
   * To the line's **flow** top, not its ink.
   *
   * The number being written is an `offset`, which positions a line's flow box.
   * A line led by an overlapping logo is drawn half a square above that box, so
   * measuring to `below.top` charged the line the distance to its ink and it came
   * back that much higher than it had been — every move, cumulatively, on the one
   * card shape most people build. See `flowTop` on `MeasuredRow`.
   */
  return {
    id: decides.id,
    offset: Math.max(0, Math.round(below.flowTop - from - lead)),
  };
}

export function dropSlots(
  layout: CardLayout,
  dragged: DraggedObject,
  zones: readonly ZoneMeasure[],
  /** How tall the block in the air draws. */
  blockHeight: number,
  /**
   * See `HeightAt`. Only the line the drag is *leaving* asks — a survivor's
   * rect is its stretched one, so without this the runs below that line are cut
   * from an edge that is about to move. See `shrunkBy`.
   */
  heightAt: HeightAt = MEASURED_ALREADY,
): DropSlot[] {
  const drag = toCardDrag(dragged);
  if (!drag) return [];

  const rowsByZone = new Map<CardZone, MeasuredRow[]>();
  for (const measure of zones) {
    rowsByZone.set(measure.zone, measuredRows(layout, measure));
  }

  // What the card is spending, for the room check alone — see `heightsOfRows`.
  const heights = heightsOfRows(rowsByZone.values());

  const { gap } = layout;
  // A floor, because a block whose sample location has nothing to show measures
  // zero — and dividing free space by zero-plus-a-gap offers a hundred places
  // to put a block that will not be that small once it holds something.
  const height = Math.max(MIN_BLOCK_HEIGHT, Math.round(blockHeight));
  const step = height + gap;
  /*
   * What the block actually draws, and so what the card really has to make room
   * for. Deliberately *not* `height`: that one is floored, which is a fact about
   * how many places are worth offering and not about how much room the block
   * takes. `nextOffset` is the one number that has to be the second thing.
   *
   * A name is shorter than the floor — `text-sm` is a 20px line box, and the
   * default card's name carries no padding — so charging the description 24px
   * for it moved the description 4px up on *every* drop. Down one place and back
   * did it twice, and it accumulated: the reported bug, where a description
   * walked up the card a little further each time the name was dragged.
   */
  const spent = Math.max(0, blockHeight);
  // How far this drag lands above the position its offset names. Zero for
  // everything but the logo — see `liftOf`.
  const lift = liftOf(layout, drag);

  const slots: DropSlot[] = [];

  for (const measure of zones) {
    // A zone this block may not enter, or one with no room left, contributes
    // nothing at all — not a disabled mark, not a greyed one. `dropBands` then
    // hands its area to whichever valid slot is nearest.
    if (!canDrop(layout, dragged, measure.zone, heights)) continue;

    const { zone, top: contentTop, bottom: contentBottom } = measure;
    /*
     * Into the zone's visible content box. The middle zone is the card's only
     * scroller, so a block scrolled out of view still has a rect — and it is
     * somewhere the card cannot draw a mark.
     */
    const clamp = (y: number) =>
      Math.min(contentBottom, Math.max(contentTop, y));

    /*
     * Every line, minus the one made up entirely of the block in the user's
     * hand.
     *
     * That block is still drawn on the card, dimmed, but its space is about to
     * be freed — so the run either side of it is one run, and dropping it back
     * into the middle of that run is a real move rather than a no-op.
     *
     * "Entirely" is the part a pair changes. Picking up one half of a line does
     * not free the line: its partner is still drawn there and still holds that
     * height, so the space either side of it is not one run and offering it as
     * one would draw outlines over a block that is staying put. See `freedBy`,
     * which is where that test lives for all three passes that ask it.
     */
    const kept = (rowsByZone.get(zone) ?? [])
      .filter((row) => !freedBy(row, drag))
      // A line the drag only *shrinks* is still a line, and still has to be the
      // size it will be rather than the size it is — see `shrunkBy`.
      .map((row) => shrunkBy(row, drag, layout, heightAt));

    if (kept.length === 0) {
      slots.push(
        ...run(zone, 0, contentTop, contentBottom, contentBottom, false, false),
      );
      continue;
    }

    slots.push(
      ...run(
        zone,
        kept[0].index,
        contentTop,
        clamp(kept[0].top),
        clamp(kept[0].flowTop),
        false,
        true,
      ),
    );

    for (let i = 1; i < kept.length; i += 1) {
      slots.push(
        ...run(
          zone,
          kept[i].index,
          clamp(kept[i - 1].bottom),
          clamp(kept[i].top),
          clamp(kept[i].flowTop),
          true,
          true,
        ),
      );
    }

    const last = kept[kept.length - 1];
    slots.push(
      ...run(
        zone,
        last.end,
        clamp(last.bottom),
        contentBottom,
        contentBottom,
        true,
        false,
      ),
    );
  }

  return slots;

  /**
   * One run of free space, divided.
   *
   * `lead` is the gap the run pays before its first slot — every run that
   * starts at a block's bottom edge, but not one that starts at the zone's own
   * content edge, where the block would be the zone's first flex item and pays
   * nothing. `trail` is the same at the far end: a run that *closes* against
   * another block has to leave that block its gap.
   *
   * So a slot's block occupies `lead + i·step + height + trail` of the run, and
   * the number that fit is the largest `i + 1` that keeps that inside `span`.
   *
   * **What is left over is then shared out between them, not left at the end.**
   * The slots used to pack from the top of the run at exactly one `step` apart,
   * so a 110px photo in a 440px card gave three places in the top three-quarters
   * of it and a large band of nothing underneath — a card that plainly had room
   * down there, offering nowhere to use it. Spreading the slack puts the first
   * slot at the run's start, the last flush against its end, and equal gaps
   * between: for a photo on an empty card that is the top, the middle and the
   * bottom, which is what someone looking at an empty card expects to be able to
   * choose between. A run with room for two gets two, evenly, for the same
   * reason — the count is whatever honestly fits, and only the spacing changes.
   *
   * `offset` is what carries it: the block stores the space above it, so a slot
   * further down the run is not a different insertion index, it is a larger
   * number on the block that lands. Nothing downstream needs to know.
   *
   * **And a block that is pulled over its neighbour is drawn where it lands, not
   * where its offset says.** A logo carries `overlapPct`, which `blockEdges`
   * turns into a negative `margin-top` of half its own height for any logo that
   * is not the first block of its zone — so every mark in a run that follows a
   * block was out by exactly that, and the block's *centre* landed on the mark's
   * *top border*. Two different answers, because the two slots mean two
   * different things:
   *
   * - The run's **first** slot is flush against the block above it, and
   *   straddling that block is the whole reason the overlap exists. It keeps
   *   `offset: 0` and the mark moves up instead, onto the box the logo will
   *   actually fill — half over the photo, which is what the sidebar's Overlap
   *   control already produces.
   * - Every slot **below** it sits in open space with nothing to straddle, so
   *   the pull is dragging the block into empty air. The mark stays where it is
   *   and the lift is folded into the stored `offset`, which `blockEdges` then
   *   subtracts straight back out.
   *
   * A run with no span at all is the same question with the same answer. It is
   * a seam for everything else — a rule on the boundary, and what follows moves
   * down — but a mark straddling the block above it is not pushing anything
   * anywhere, so it keeps the square and the lift rather than collapsing to a
   * hairline nothing draws at rest.
   *
   * `leadingGap` is the test for "there is a block above this run", and it
   * agrees with `dropCardBlock`'s own index arithmetic in the one case where
   * the two could differ: a logo currently sitting *above* the photo lands back
   * at index 0 — its zone's first, so no overlap — and the run it lands in is
   * the one at the zone's content top, where `leadingGap` is false.
   *
   * `nextOffset` is untouched by all of it. It says what the *next* block's
   * leading space has to become for its own top edge not to move, which is a
   * fact about the run rather than about where the newcomer sits in it.
   *
   * It is measured against `flowSpan` rather than `span`, and that is the same
   * distinction one level down: the run is bounded by where the line below is
   * *drawn*, because that is what a mark may not be painted over, while the
   * number handed to that line positions its *flow* box. The two differ by
   * exactly the overlap a logo gives itself, and reading one as the other left
   * a card that walked up a little on every move. See `flowTop` on `MeasuredRow`.
   *
   * It is also the one number here measured in `spent` rather than `height`, and
   * that is not a detail. Every other use of a height in this function is
   * counting — how many marks fit, how far apart they sit, how tall to draw
   * one — where a floor is exactly right. `nextOffset` is *arithmetic about the
   * card*: it hands the next block whatever the run has left after the newcomer
   * has taken the room it really occupies. Use the floored height and the two
   * disagree by a fixed amount on every drop, which does not cancel and does not
   * settle.
   */
  function run(
    zone: CardZone,
    index: number,
    from: number,
    /** Where the line below this run is *drawn*, which is what bounds the ink. */
    to: number,
    /**
     * Where that line *sits*. The same number for every line that is not led by
     * an overlapping mark, and the one `nextOffset` has to be measured against —
     * an offset positions a flow box, not an ink box. See `flowTop` on
     * `MeasuredRow`.
     */
    flowTo: number,
    leadingGap: boolean,
    closes: boolean,
  ): DropSlot[] {
    const span = to - from;
    const flowSpan = flowTo - from;
    const lead = leadingGap ? gap : 0;
    const trail = closes ? gap : 0;
    const count = Math.floor((span - lead - trail + gap) / step);
    /*
     * What the line below has to become for its own top edge not to move, given
     * the landing block's own **flow margin** within this run. `closes` is what
     * says there *is* a line below; `Math.max` because a run can be asked to
     * hold a block taller than it, and then the answer is simply "no leading
     * space".
     *
     * The flow margin, not the slot's position, and the two differ by exactly
     * one landing: a **flush** mark stores `offset: 0` and `blockEdges` then
     * writes `-lift` on it, so it gives `lift` px back to the flex column and
     * the line below owes that much *more* leading space. Every other slot
     * stores `offset + lift` and the negative margin cancels straight back out
     * to `offset`, which is why passing the position was right everywhere else
     * and silently short by half a logo here — a logo dropped straddling the
     * block above it pulled the whole card up under it.
     */
    const settles = (flowOffset: number) =>
      Math.max(0, Math.round(flowSpan - lead - flowOffset - spent - gap));

    // Only a run that starts at a block's own bottom edge has a block above it
    // to be pulled over, which is exactly when `blockEdges` applies the overlap.
    const pulls = leadingGap && lift > 0;

    if (count <= 0) {
      /*
       * A **mark** with a block above it is not a seam. `lift` is exactly the
       * half of itself `blockEdges` will pull it up by, so a run with no span of
       * its own is still the one place a logo straddles the edge above it —
       * which is the layout the Overlap slider produces, reached by dragging
       * instead of by finding the slider.
       *
       * It was a hairline before, and a hairline is the one thing this landing
       * does not look like: `dropRegions` drops a zero-height band outright, so
       * nothing was drawn at rest at all, and the card most likely to hit this —
       * a photo filling its zone, with no run under it — is exactly the card
       * someone drops a logo onto. The gesture worked and looked refused.
       *
       * Drawn as the square that lands, so `splitAlignColumns` can divide it
       * into the three places across the line the mark could sit.
       *
       * Its **area** is empty, and deliberately. This run has no free space of
       * its own — that is the whole case — so there is nothing to outline at
       * rest, and an outline drawn from the square would sit half over the very
       * block being straddled. It is the one place offered under the pointer
       * alone, which is the same bargain `.card-drop-seam` already makes.
       */
      if (pulls) {
        const area = from + lead;

        return [
          {
            zone,
            index,
            y: area - lift,
            height,
            offset: 0,
            widthPct: 100,
            areaTop: area,
            areaBottom: area,
            // Flush: it stores no offset and is drawn `lift` above the run, so
            // its flow margin is negative. See `settles`.
            ...(closes ? { nextOffset: settles(-lift) } : {}),
          },
        ];
      }

      /*
       * No room for a block, but still a place: this is the seam between the two
       * blocks the run separates, and inserting between two touching blocks has
       * to stay possible.
       *
       * **It still says what follows it.** "No room" here means no room for the
       * block *and* the gaps either side of it — a run of 112px offers nowhere
       * to put a 110px photo that also owes a gap — and that is a long way from
       * no room at all. Leaving `nextOffset` off let the line below keep a
       * leading space measured against a card the drop had just changed, which
       * is precisely how a move failed to undo itself: take a photo out from
       * above a line, put it back, and the line stayed where the *gap* had put
       * it. `settles` answers 0 for a genuinely touching pair, which is what
       * this branch used to mean by saying nothing.
       */
      return [
        {
          zone,
          index,
          y: from + lead,
          height: 0,
          offset: 0,
          widthPct: 100,
          ...(closes ? { nextOffset: settles(0) } : {}),
        },
      ];
    }

    /*
     * The room the slots do not use, divided between the spaces *between* them.
     * With one slot there is no such space, so it stays at the run's start —
     * anywhere else would be a single mark floating at a position nothing chose.
     */
    const slack = Math.max(0, span - lead - trail - (count * height + (count - 1) * gap));
    const spread = count > 1 ? step + slack / (count - 1) : step;

    return Array.from({ length: count }, (_, i) => {
      const offset = Math.round(i * spread);
      const flush = pulls && i === 0;

      return {
        zone,
        index,
        y: flush ? from + lead + offset - lift : from + lead + offset,
        height,
        // This mark is drawn across the whole card, so what lands on it is the
        // whole card wide — see `widthPct` on `DropSlot`.
        widthPct: 100,
        // The run's own free span, which is what the resting outline draws. The
        // marks inside it are spread apart and the first is lifted over the
        // block above, so their union is neither where the room starts nor how
        // far it reaches.
        areaTop: from + lead,
        areaBottom: to - trail,
        // Cancelling the pull costs the room check `lift` px it will not
        // actually spend (`usedHeight` in ./card-space.ts counts a stored
        // offset), which is the safe direction to be wrong in.
        offset: pulls && !flush ? offset + lift : offset,
        // What the next block's own leading space has to become for its top edge
        // to stay exactly where it is now, from this block's own flow margin —
        // `offset` for every slot whose stored offset cancels the pull back out,
        // and `-lift` for the flush one, which is drawn above the run it starts.
        // See `settles`.
        ...(closes ? { nextOffset: settles(flush ? -lift : offset) } : {}),
      };
    });
  }
}

/**
 * How far the thing in the user's hand lands **above** the position an offset
 * names, in px.
 *
 * A logo arrives with `overlapPct: 50` (`CARD_BLOCKS` in
 * packages/shared/card-layout.ts), and `blockEdges` turns that into a negative
 * `margin-top` of half its own height. Every other block lands exactly where it
 * is put, so this is zero for all of them — the check is `overlapOf`'s own, and
 * `normaliseBlock` only ever writes `overlapPct` on a type whose spec offers
 * the control.
 *
 * A new drag is measured through `makeCardBlock`, which is what `dropCardBlock`
 * will actually create — the alternative is a second copy of that function's
 * defaults, and a mark drawn against defaults the drop no longer uses is the
 * exact class of bug this whole change is fixing. The id it mints is thrown
 * away; this runs once per gesture.
 *
 * Zero for `overlapEdge: "below"`, which pulls the block *underneath* it up
 * instead and moves nothing about its own position.
 */
function liftOf(layout: CardLayout, drag: CardDrag): number {
  const block =
    drag.kind === "new"
      ? makeCardBlock(drag.type)
      : findBlock(layout, drag.id)?.block;

  /*
   * `true`, because the caller is `run` and every use of this number there is
   * behind `pulls` — which is `leadingGap`, i.e. "this run starts at a line's
   * bottom edge". That is the same predicate `upwardLiftOf` wants, asked one
   * level up, so answering it here as well would gate it twice.
   */
  return block ? upwardLiftOf(block, layout, true) : 0;
}

/**
 * The columns of a shared line: the room left beside a block that is narrower
 * than the card, and — for a block already on that line — the column it is not
 * currently in.
 *
 * **This is what makes narrowing a block mean something.** Take a photo to 40%
 * and the other 60% of its line is not decoration, it is a place another block
 * goes; without this it would be a narrow block with a permanent hole beside it.
 * The Width slider and these targets are two halves of one feature, which is why
 * there is no longer a separate Half control to keep in step with either.
 *
 * Separate from `dropSlots`, and deliberately **not** fed through `dropBands`.
 * That function's whole contract is that it partitions the card — every pixel to
 * exactly one slot — and a target that is part of a line has no place in a
 * one-dimensional partition. A column slot needs no partitioning anyway: its
 * band *is* its own rect. The caller appends these after the partitioned ones,
 * and the overlay paints them last, which is what makes them win the pointer
 * inside their own box.
 *
 * **A line has two columns, and both of them are drawn.** The free one used to
 * be assumed to be the right one, because a row is a plain flex row and a
 * narrowed block never carries an `alignSelf` — so it could only sit at the
 * start. `side` (packages/shared/card-layout.ts) is what changed that, and it is
 * what makes the rest of this table reachable at all:
 *
 * | line | drag | the slot(s) drawn | `index` | `half` |
 * |---|---|---|---|---|
 * | one block, at the start | anything else | the free right column | `row.end` | `"end"` |
 * | " | " | **and** the occupied left one | `row.index` | `"start"` |
 * | one block, at the end | anything else | the free left column | `row.index` | `"start"` |
 * | " | " | **and** the occupied right one | `row.end` | `"end"` |
 * | one block | **itself** | the free column only | `row.index` | that column |
 * | two blocks | one of the two | the *other* member's column | either | that column |
 *
 * The occupied column is the reason a shared line no longer gets a card-width
 * mark across it: with both columns drawn, the line is fully described by two
 * marks the width of the columns they stand for, and `dropSlots` stops handing
 * the same pixels to a run as well. Dropping on it means what it looks like —
 * put it here, push the one already there across — which `insert` in
 * card-edits.ts has always done for a `"start"` landing.
 *
 * It is offered to everything *except* the block already sitting there: a mark
 * over where a block already is promises a move `dropCardBlock` answers `null`
 * to. That block gets its free column and nothing else, which is a block
 * crossing its own line; a member of a pair gets its partner's column, which is
 * two blocks swapping. Both were impossible, and both are the same gesture as
 * the first — drop it where you want it to be.
 *
 * **Every column slot carries the width it stands for, and the line it is on.**
 * The width is what the landing block becomes, because the room reserved is no
 * longer always half of anything. The line is what tells "join the block above"
 * from "cross my own line" — see `line` on `DropSlot`, and the id it keeps
 * unique in card-drop-overlay.tsx.
 *
 * Gated on `acceptsBlock` alone rather than on the full `canDrop`. The room
 * check is about the card's *height*, and landing beside a block that is already
 * there spends none — so a top zone whose photo has filled it still offers the
 * space next to that photo, which is exactly where someone would want to put a
 * name. The row can grow if the newcomer is taller than the block it joins;
 * that is the same honest overflow a seam already accepts. A swap and a flip
 * spend nothing at all.
 */
/**
 * How tall a block on the card would draw at a given share of the line, in px.
 *
 * The one question this file cannot answer for itself. How tall a paragraph is
 * at a given width is the layout engine's to answer, so the caller measures —
 * `heightMeasurer` in components/card/designer/use-drop-bands.ts clones the
 * block, forces the width and reads the box back. `fallback` is what to return
 * when there is nothing to measure: a block off the palette has no element yet,
 * and a clone can measure zero while an image is still loading.
 *
 * Optional at every call site, and the default answers `fallback` — which is
 * what the code did before it existed, and keeps a caller with no DOM (a test,
 * a future renderer) working rather than crashing.
 */
export type HeightAt = (
  id: string,
  widthPct: number,
  widthPx: number,
  fallback: number,
) => number;

const MEASURED_ALREADY: HeightAt = (_id, _widthPct, _widthPx, fallback) =>
  fallback;

export function sideSlots(
  layout: CardLayout,
  dragged: DraggedObject,
  zones: readonly ZoneMeasure[],
  /** See `HeightAt`. Absent means "take what is already on screen". */
  heightAt: HeightAt = MEASURED_ALREADY,
): DropSlot[] {
  const drag = toCardDrag(dragged);
  if (!drag) return [];

  const moving = drag.kind === "move" ? findBlock(layout, drag.id) : null;
  const type = drag.kind === "new" ? drag.type : moving?.block.type;

  // A block that cannot be narrowed is offered nothing here — Opening hours has
  // no business in a column, which is the rule `CARD_BLOCKS` writes down. A
  // self-sized mark is the exception: it has no width to narrow, but it is
  // exactly the block that can sit in the room a column leaves.
  if (!type || !(hasControl(type, "width") || isSelfSized(type))) return [];

  /*
   * The narrowest column this drag can land in, as a share of the line.
   *
   * For an ordinary block that is the floor its type declares. For a mark it is
   * the share the mark itself *reserves* (`selfShareOf`), which is a different
   * question with the same answer's shape: a logo does not narrow to fit a
   * column, so a column narrower than the logo is not a column it can go in —
   * and offering one would put a line over 100% and push its members apart.
   */
  const floor = isSelfSized(type)
    ? selfShareOf(
        moving?.block ?? { id: "", type, heightPct: CARD_BLOCKS[type].defaultHeightPct },
        layout,
      )
    : (CARD_BLOCKS[type].minWidthPct ?? 25);

  const slots: DropSlot[] = [];

  for (const measure of zones) {
    if (!acceptsBlock(layout, type, measure.zone, moving?.block.id)) continue;
    // Nothing measured horizontally is no columns, rather than guessed ones.
    if (measure.left === undefined || measure.right === undefined) continue;

    const line = { left: measure.left, width: measure.right - measure.left };
    if (line.width <= 0) continue;

    const rows = measuredRows(layout, measure);

    for (const [r, row] of rows.entries()) {
      /*
       * Everything on an earlier line of this zone, which is what the room
       * beside this one has to stay clear of. Flattened here rather than asked
       * per target, so a zone of many lines costs one pass instead of one per
       * column offered.
       */
      const above = rows.slice(0, r).flatMap((earlier) => earlier.blocks);
      /*
       * Three shapes of line, one shape of answer.
       *
       * A line holding a self-sized mark is described by the room left over
       * beside it — which is not half of anything, because the mark's width is
       * its own. A line that already holds a narrowed block is described by its
       * columns. One holding a single full-width block is offered the two
       * columns it *would* have. All three come back as the same target, which
       * is what lets the overlay draw and apply them without knowing which it is
       * looking at.
       */
      const targets = holdsMark(layout, measure.zone, row)
        ? selfTargets(layout, measure.zone, row, line, type, floor)
        : row.shared
          ? sideTargets(layout, measure.zone, row, drag, line, floor)
          : pairTargets(layout, measure.zone, row, drag, line, type, floor);

      for (const target of targets) {
        /*
         * Clear of everything above it, which is the whole of "it must not reach
         * into the picture".
         *
         * A mark pulled up over its neighbour has a rect that reaches over
         * whatever is above it — that is what an overlap *is* — and
         * `measuredRows` takes a line's top as the topmost of its members. So
         * the room beside a logo straddling a photo measured as starting inside
         * the photo, and the column drawn for it promised a block half buried in
         * a picture.
         *
         * Two things bound it, because the photo can be on either side of a zone
         * boundary and only one of them is a boundary at all: the zone's own
         * content box, and the blocks on this zone's earlier lines. The second is
         * asked per column rather than per line — a logo hanging *down* into the
         * line below obstructs the room under itself and none of the room beside
         * it, and clamping the whole line for it would refuse a column that is
         * genuinely empty.
         */
        const top = clearOf(target, Math.max(row.top, measure.top), above);
        const bottom = Math.min(row.bottom, measure.bottom);
        if (bottom <= top) continue;

        slots.push({
          zone: measure.zone,
          index: target.index,
          y: top,
          // A column is as tall as its line unless the target says otherwise,
          // which only a mark does — see `height` on `SideTarget`.
          height: target.height ?? bottom - top,
          // The row's leading space is already spent by the block sitting there.
          offset: 0,
          half: target.side,
          left: target.left,
          width: target.width,
          line: row.index,
          ...(target.widthPct === undefined ? {} : { widthPct: target.widthPct }),
          ...(target.pairId === undefined
            ? {}
            : {
                pairId: target.pairId,
                pairWidthPct: target.pairWidthPct ?? PAIR_SHARE,
                hitTop: Math.max(target.hitTop ?? top, top),
                hitBottom: Math.min(target.hitBottom ?? bottom, bottom),
              }),
          // A target that has already cut its own square says so, and `markBox`
          // in components/card/designer/use-drop-bands.ts then leaves it alone.
          ...(target.mark === true ? { mark: true } : {}),
          ...(target.hitLeft === undefined
            ? {}
            : { hitLeft: target.hitLeft, hitWidth: target.hitWidth }),
          ...settlesBelow(
            layout,
            drag,
            rows,
            r,
            target,
            line.width,
            heightAt,
          ),
        });
      }
    }
  }

  return slots;
}

/**
 * What the line **below** a column landing has to become, so its own top edge
 * does not move.
 *
 * The half `sideSlots` never had. A run says this for every slot it draws
 * (`nextOffset` in `run`), and `settle` in ./card-edits.ts writes it onto the
 * row below the one that was landed in — but a column named no number at all, so
 * a block joining a line and making it taller pushed the whole card down and
 * nothing paid it back. Out and back was therefore charged once and refunded
 * never: a name rejoining a logo's line cost six pixels every trip, and twenty
 * trips put the block at the bottom of the card below the fold.
 *
 * Three things can change the line's height, and all three are asked here:
 *
 * - the **newcomer**, at the width of the column it is landing in — which is a
 *   reflow, so it is measured (`HeightAt`) rather than computed;
 * - the members that **stay**, which keep the height they are drawn at;
 * - and, for a *pair* target only, the block already there, which **narrows** to
 *   make the room and so reflows as well.
 *
 * Everything is in flow rather than ink: a mark hanging half above its line
 * contributes only the half of itself that is inside it, which is what
 * `upwardLiftOf` takes back off. See `flowTop` on `MeasuredRow`.
 */
function settlesBelow(
  layout: CardLayout,
  drag: CardDrag,
  rows: readonly MeasuredRow[],
  /** Which of them the column is on. */
  at: number,
  target: SideTarget,
  lineWidth: number,
  heightAt: HeightAt,
): { nextOffset?: number } {
  /*
   * The next line **that will still be there** — the drag's own line is about to
   * go, and charging a line that is being deleted writes a number onto a block
   * the drop then moves. `freedBy` is the same test `dropSlots` uses to decide
   * which lines its runs are cut between, and skipping past one here lands on
   * exactly the block `settle` will look for once the edit has been applied.
   *
   * That block is also the one `vacatedSpace` charges for the hole the departure
   * leaves, which is correct rather than a collision: `settle` runs last and its
   * answer is the local one. See `dropCardBlock`.
   */
  let next = at + 1;
  while (next < rows.length && freedBy(rows[next], drag)) next += 1;

  const below = rows[next] as MeasuredRow | undefined;
  if (!below) return {};

  const row = rows[at];
  const dragId = drag.kind === "move" ? drag.id : undefined;
  const { gap } = layout;
  // Whether the line being landed on has one above it in its zone, which is the
  // only thing that lets a mark on it be pulled up. See `upwardLiftOf`.
  const hasLineAbove = at > 0;

  const landing =
    drag.kind === "new"
      ? makeCardBlock(drag.type)
      : findBlock(layout, drag.id)?.block;
  if (!landing) return {};

  /*
   * How far the line reaches once the drop has landed, measured from its own
   * flow top. It starts at nothing rather than at the row's current bottom: a
   * block leaving this very line — a flip, or a swap — takes its height with it,
   * and a line that ends up shorter owes the one below it the difference just as
   * much as a line that grows.
   */
  let bottom = row.flowTop;

  for (const rect of row.blocks) {
    if (rect.id === dragId) continue;

    if (rect.id === target.pairId) {
      // The block being paired with narrows to make the room, so it reflows —
      // the other column of the line the newcomer is taking half of.
      const sitting = findBlock(layout, rect.id)?.block;
      const height = heightAt(
        rect.id,
        target.pairWidthPct ?? PAIR_SHARE,
        Math.max(0, lineWidth - gap - target.width),
        rect.bottom - rect.flowTop,
      );

      bottom = Math.max(
        bottom,
        row.flowTop +
          height -
          (sitting ? upwardLiftOf(sitting, layout, hasLineAbove) : 0),
      );
      continue;
    }

    bottom = Math.max(bottom, rect.bottom);
  }

  /*
   * A mark does not reflow — it is a square of its own size, and no width can
   * change that — so it is the one block here whose height is arithmetic.
   */
  const height = isSelfSized(landing.type)
    ? sizedHeight(landing, layout)
    : heightAt(
        landing.id,
        target.widthPct ?? 100,
        target.width,
        newBlockHeight(layout, landing.type),
      );

  bottom = Math.max(
    bottom,
    row.flowTop + height - upwardLiftOf(landing, layout, hasLineAbove),
  );

  return { nextOffset: Math.max(0, Math.round(below.flowTop - bottom - gap)) };
}

/** A block with a height of its own, in px — the same number `blockBox` draws. */
function sizedHeight(block: CardBlock, layout: CardLayout): number {
  return block.heightPct
    ? Math.round((layout.maxHeight * block.heightPct) / 100)
    : MIN_BLOCK_HEIGHT;
}

/**
 * Where a column can start without running under anything above it.
 *
 * `floor` is what the line and its zone already say; each block above that this
 * column actually sits under pushes it down to that block's own bottom edge.
 * Flush with it rather than a gap below it: the gap is a layout unit and these
 * are measured pixels, and "starts where the photo ends" is the promise being
 * made — a column that began a gap lower would be honest about where the block
 * lands and dishonest about which room is free.
 */
function clearOf(
  target: SideTarget,
  floor: number,
  above: readonly ZoneBlockMeasure[],
): number {
  const right = target.left + target.width;
  let top = floor;

  for (const block of above) {
    /*
     * Side by side is not above: only a block this column would run under can
     * move it. A block with no horizontal measurement counts as obstructing,
     * because the one thing known about it is that it is on a line of its own
     * above this one — and the room a line leaves is the room it does not use.
     */
    if (
      block.right !== undefined &&
      block.left !== undefined &&
      (block.right <= target.left || block.left >= right)
    ) {
      continue;
    }

    if (block.bottom > top) top = block.bottom;
  }

  return top;
}

/** One column of a line, as somewhere a block can land. */
type SideTarget = {
  index: number;
  side: "start" | "end";
  left: number;
  width: number;
  /**
   * How tall the drawn box is, when that is not the line's own height. Marks
   * only, and absent everywhere else.
   *
   * A column is as tall as the line it is part of, which is right for anything
   * that fills the column it lands in and wrong for a mark: a logo is a square
   * of its own size, so a target as tall as the block underneath promises a
   * block that is never drawn. That was the 71x110 bar at each end of a photo —
   * the logo's width with the photo's height, which is neither shape.
   *
   * It may come out *taller* than the line, and that is the honest number: a
   * logo joining a line of text makes that line as tall as the logo.
   *
   * The **hit** band is untouched by it. A pair target carries `hitTop` and
   * `hitBottom`, and those are what `useCardDropBands` reads for the pointer, so
   * the aim stays the middle six tenths of the line however the box is drawn.
   */
  height?: number;
  /** What the landing block becomes. Absent leaves its own width alone. */
  widthPct?: number;
  /** The full-width block this target splits the line with. Pair targets only. */
  pairId?: string;
  /**
   * What `pairId` becomes. Absent falls back to half, which is the split every
   * pair between two share-bearing blocks makes. A **mark** is the one thing that
   * asks for another number: a logo takes the square it reserves and leaves the
   * rest, so the block it lands beside narrows to whatever that rest is.
   */
  pairWidthPct?: number;
  /** The middle of the line, which is all a pair target catches. */
  hitTop?: number;
  hitBottom?: number;
  /**
   * Draw this target as the square a self-sized block makes, and catch the
   * pointer with `hitLeft`/`hitWidth` instead of with the drawn box.
   *
   * Set only where the target has already cut its own square — which is the mark
   * half of `pairTargets`, the one place here that knows how wide a logo will be
   * before `markBox` gets a chance to work it out from the measured DOM.
   */
  mark?: boolean;
  hitLeft?: number;
  hitWidth?: number;
};

/** The line's own box: where it starts, and how wide a share of it is a share of. */
type LineBox = { left: number; width: number };

/** Whether this line holds a self-sized mark — see `selfTargets`. */
function holdsMark(
  layout: CardLayout,
  zone: CardZone,
  row: MeasuredRow,
): boolean {
  return layout.zones[zone]
    .slice(row.index, row.end)
    .some((block) => isSelfSized(block.type));
}

/**
 * The room left beside a self-sized mark: every run of the line no block on it
 * is standing in.
 *
 * **This is what makes a logo something you can put a name next to.** A mark
 * reserves its own square and nothing more, so the rest of its line was empty
 * and unreachable — the Width slider cannot open a column beside something that
 * has no width, and `pairTargets` refuses a resident with no `width` control
 * for exactly the right reason. The room is measured instead: whatever the line
 * is, less the boxes actually drawn on it, less a gap either side of each.
 *
 * The runs are found by walking the line's members left to right, which is the
 * order the flex row draws them and therefore the order the zone's array holds
 * them. A run before the *k*-th member inserts at that member's index, and which
 * of the two blocks starts the line follows from where it is: a run at the head
 * of the line means the newcomer takes the line and everything already on it
 * shuffles along (`half: "start"`), and a run anywhere else means it joins the
 * block before it (`half: "end"`). That is `insert`'s own vocabulary in
 * card-edits.ts, unchanged.
 *
 * A mark in the hand is offered nothing here. There is only ever one logo on a
 * card (`acceptsBlock`), so the only mark that could land beside this one is
 * this one — and where a mark goes across its line is the align grid's business
 * (`splitAlignColumns`), not a column's.
 */
function selfTargets(
  layout: CardLayout,
  zone: CardZone,
  row: MeasuredRow,
  line: LineBox,
  type: CardBlockType,
  /** The narrowest column this drag can land in — see `sideSlots`. */
  floor: number,
): SideTarget[] {
  if (isSelfSized(type)) return [];

  const members = layout.zones[zone].slice(row.index, row.end);
  // Every member has to be on screen for the arithmetic below to mean anything:
  // a run is the space between two measured boxes, and a member the measurement
  // pass beat would make one run out of two.
  if (members.length !== row.blocks.length) return [];

  const rects = new Map(row.blocks.map((block) => [block.id, block]));
  const boxes: { left: number; right: number }[] = [];

  for (const member of members) {
    const rect = rects.get(member.id);
    if (!rect || rect.left === undefined || rect.right === undefined) return [];
    boxes.push({ left: rect.left, right: rect.right });
  }

  const { gap } = layout;
  const lineEnd = line.left + line.width;
  const targets: SideTarget[] = [];

  /*
   * What the line can still give away, in share.
   *
   * The run is measured in pixels and the share is worked back out of it, and
   * the two rounds disagree by a point: a mark reserves `ceil` of its square so
   * a row can never come out wider than the card, and a run inverted off the
   * measured line rounds to nearest. On a name of 38 and a logo of 24 the room
   * left measures as 39, which is 101 — and `cardRows` then does the only
   * honest thing with a line over 100 and starts a new one, so the block landed
   * *under* the mark it was dropped beside. The cap is the same number
   * `maxShareFor` gives the Width slider, applied to the drop that creates the
   * column rather than to the one that resizes it.
   */
  const room =
    100 - members.reduce((total, block) => total + shareOfAny(block, layout), 0);

  for (let k = 0; k <= boxes.length; k += 1) {
    const from = k === 0 ? line.left : boxes[k - 1].right + gap;
    const to = k === boxes.length ? lineEnd : boxes[k].left - gap;
    const width = to - from;
    if (width <= 0) continue;

    /*
     * The share the block that lands here becomes, inverted from the pixels the
     * run actually measures — the same arithmetic `sideTargets` runs, and for
     * the same reason: a column and the mark drawn over it have to be one box,
     * not two numbers that agree today.
     */
    const widthPct = Math.min(
      room,
      Math.round((100 * (width + gap / 2)) / line.width),
    );
    if (widthPct < floor) continue;

    targets.push({
      index: row.index + k,
      side: k === 0 ? "start" : "end",
      left: from,
      width,
      widthPct,
    });
  }

  return targets;
}

/**
 * The two halves of a line that one full-width block currently owns.
 *
 * **This is the gesture that makes a pair.** Narrowing a block and dropping into
 * the room it leaves has always worked, but it needs you to know that a Width
 * slider is where two columns come from — and nothing on the card says so. Here
 * the answer is the obvious one: drop a block onto another block and they share
 * the line, half each. The Locations panel teaches exactly this gesture, one row
 * onto another, and a card is the other place in the app where things are
 * arranged by dragging them at each other.
 *
 * Half, and only half. Every other split is the slider's, because a drop has one
 * degree of freedom and it is already spent saying *which* column.
 *
 * Both blocks have to be able to hold a column, which is `hasControl(_,
 * "width")` on the block already there and each of the two clearing its own
 * floor — the same rule `CARD_BLOCKS` writes down for the slider, asked of two
 * blocks instead of one. A week of opening times is no more readable in half a
 * card because a drag put it there.
 *
 * **A mark splits the line too, and not down the middle.** A logo has no `width`
 * control, so it has no `minWidthPct` either, and the floor used to come out at
 * 100 for it — 50 is under 100, and dragging a logo onto anything offered no pair
 * target at all. That was the right arithmetic answering the wrong question: a
 * logo does not narrow to fit a column, it reserves the square it draws at and
 * leaves the rest. So the share it takes is `selfShareOf` and the block already
 * there narrows to whatever is left — which is the same division `selfTargets`
 * makes from the other side of the line, the room beside a mark, and therefore
 * lands on the same two columns whichever of the two was picked up first.
 *
 * That number arrives as `floor`, already worked out by `sideSlots` for its own
 * purposes, rather than being computed a second time here. A mark's share depends
 * on its height and on the card's, so two copies would be two numbers that agree
 * until someone drags the logo bigger: the share this target promises has to be
 * the share `cardRows` will compute, or the block lands *under* the one it was
 * dropped beside instead of next to it.
 *
 * The line has to be tall enough to have a middle, too. Below `MIN_BAND` the
 * band this would catch is the whole block, which would take the insertion
 * points above and below it away entirely — and a divider is 13px tall. A line
 * that short is paired with the slider or not at all.
 */
function pairTargets(
  layout: CardLayout,
  zone: CardZone,
  row: MeasuredRow,
  drag: CardDrag,
  line: LineBox,
  type: CardBlockType,
  /** The narrowest column this drag can land in — see `sideSlots`. */
  floor: number,
): SideTarget[] {
  if (row.count !== 1 || row.blocks.length !== 1) return [];

  const measured = row.blocks[0];
  // A block cannot pair with itself: it would have to be in two columns at once.
  if (drag.kind === "move" && measured.id === drag.id) return [];

  const sitting = layout.zones[zone][row.index] as CardBlock | undefined;
  if (!sitting || sitting.id !== measured.id) return [];
  if (!hasControl(sitting.type, "width")) return [];
  /*
   * And the blocks a drop may not narrow at all — see `isPairable` in
   * packages/shared/card-layout.ts. It is the block *sitting there* that is
   * asked, so a gallery dragged onto a name still splits that name's line; what
   * it stops is the reverse, where something dropped on a photo halved it.
   *
   * Refusing here is also what puts the gallery's own `blockedFaces` band back
   * in the pointer's way: the columns were painted over that face and won it
   * inside their own boxes, so with none drawn the line refuses outright.
   */
  if (!isPairable(sitting.type)) return [];

  /*
   * What the newcomer takes, and therefore what is left for the block already
   * there. For a mark that is the square it reserves; for everything else it is
   * half, which is the only split a drop has a degree of freedom left to ask for.
   */
  const mark = isSelfSized(type);
  const share = mark ? floor : PAIR_SHARE;
  const rest = 100 - share;

  // The newcomer's own floor, which a mark has not got and does not need: its
  // width is its own, so there is nothing for a minimum to be a minimum of.
  if (!mark && share < (CARD_BLOCKS[type].minWidthPct ?? 100)) return [];
  if (rest < (CARD_BLOCKS[sitting.type].minWidthPct ?? 100)) return [];

  const band = faceBand(row.top, row.bottom, 0);
  if (!band) return [];

  // Renamed on the way in: `faceBand` speaks in the box's own edges, and here
  // that box is the *hit* area rather than the drawn one — the outline is the
  // whole column, because that is what will land there.
  const middle = { hitTop: band.top, hitBottom: band.bottom };

  if (mark) {
    /*
     * The square, in the units the line is measured in — and at each **end** of
     * the line, because those are the two places a mark that has just claimed one
     * end of a row can be. `markBox` would otherwise cut this from the measured
     * DOM and put both squares at the *start* of the room they were given, which
     * for the far column is the middle of the card.
     *
     * The pointer still aims at a **half of the line** rather than at the square
     * itself: 62px is not something anyone can hit with a moving pointer, which
     * is the same draw-versus-hit split `splitAlignColumns` makes across a run.
     */
    const square = Math.round((line.width * share) / 100);
    if (square <= 0 || square >= line.width) return [];

    const half = line.width / 2;

    return [
      {
        index: row.index,
        side: "start",
        left: line.left,
        width: square,
        // Square on both axes, which is the whole of "the outline is the shape
        // of the thing you are dragging" — see `height` on `SideTarget`.
        height: square,
        mark: true,
        hitLeft: line.left,
        hitWidth: half,
        pairId: sitting.id,
        pairWidthPct: rest,
        ...middle,
      },
      {
        index: row.end,
        side: "end",
        left: line.left + line.width - square,
        width: square,
        height: square,
        mark: true,
        hitLeft: line.left + half,
        hitWidth: half,
        pairId: sitting.id,
        pairWidthPct: rest,
        ...middle,
      },
    ];
  }

  /*
   * Exactly what `blockBox` gives a 50% share: half the line, less its half of
   * the one gap between the two columns. Taken from the measured line rather
   * than from the block's own rect, so the two halves come out equal even when
   * the block sitting there carries a margin of its own.
   */
  const width = (line.width - layout.gap) / 2;
  if (width <= 0) return [];

  return [
    {
      index: row.index,
      side: "start",
      left: line.left,
      width,
      widthPct: share,
      pairId: sitting.id,
      pairWidthPct: rest,
      ...middle,
    },
    {
      index: row.end,
      side: "end",
      left: line.left + width + layout.gap,
      width,
      widthPct: share,
      pairId: sitting.id,
      pairWidthPct: rest,
      ...middle,
    },
  ];
}

/** One line's columns, as many as this drag has on it. See `sideSlots`. */
function sideTargets(
  layout: CardLayout,
  zone: CardZone,
  row: MeasuredRow,
  drag: CardDrag,
  line: LineBox,
  /** The narrowest column this drag can land in — see `sideSlots`. */
  floor: number,
): SideTarget[] {
  /*
   * Every case here needs a measured rect, and takes the *column* width from
   * it rather than working one out from the card. A column is whatever the row
   * actually drew, which is the only number that lines a mark up with the block
   * beside it at every card width.
   */
  const rect = (block: ZoneBlockMeasure | undefined) =>
    block && block.left !== undefined && block.right !== undefined
      ? { left: block.left, right: block.right, width: block.right - block.left }
      : null;

  /*
   * A column's width in pixels, back as the percentage that produced it.
   *
   * `blockBox` gives a share of `s` the basis `calc(s% - gap/2)`, so the pixels
   * are `line·s/100 - gap/2` and this is that inverted. Doing the arithmetic
   * rather than reading the sitting block's stored number is what keeps the two
   * columns of a line summing to exactly 100: the free side is whatever is left
   * over, measured, and `100 - s` falls out of it.
   */
  const shareOfWidth = (px: number) =>
    Math.round((100 * (px + layout.gap / 2)) / line.width);

  // A column too narrow for what is in the hand is not a place it can go.
  const fits = (widthPct: number) => widthPct >= floor;

  if (row.count === 2) {
    // A full line has no free column. The one thing that can still land on it
    // is one of the two blocks already there, crossing to the other side — and
    // it takes no width with it, because both columns already hold a block.
    if (drag.kind !== "move") return [];
    if (row.blocks.length !== 2) return [];

    const [first, second] = row.blocks;

    if (first.id === drag.id) {
      const box = rect(second);
      return box
        ? [{ index: row.end, side: "end", left: box.left, width: box.width }]
        : [];
    }

    if (second.id === drag.id) {
      const box = rect(first);
      return box
        ? [{ index: row.index, side: "start", left: box.left, width: box.width }]
        : [];
    }

    return [];
  }

  const box = rect(row.blocks[0]);
  if (!box) return [];

  /*
   * Which column the block is *in* decides which one is free, and that is the
   * layout's business rather than the measurement's — a rect cannot tell a
   * block at the end of its line from a card that happens to be narrow.
   */
  const sitting = layout.zones[zone][row.index] as CardBlock | undefined;
  const atEnd = sitting?.side === "end";

  /*
   * The free column is the rest of the line, measured — not half of it. Its far
   * edge is the line's own edge, so a 40% block leaves a 60% column and the mark
   * drawn for it is exactly the box the block that lands will fill.
   */
  const free = atEnd
    ? {
        side: "start" as const,
        left: line.left,
        width: box.left - layout.gap - line.left,
      }
    : {
        side: "end" as const,
        left: box.right + layout.gap,
        width: line.left + line.width - box.right - layout.gap,
      };

  /*
   * Landing on its own free column is a real move: the block crosses its line
   * and the space it left opens on the other side. Its index does not change —
   * it is still the only block on that line — so the whole edit is the `side`
   * the drop carries, and it takes no width with it.
   */
  const isSelf = drag.kind === "move" && row.blocks[0].id === drag.id;
  const index = isSelf ? row.index : free.side === "end" ? row.end : row.index;

  const targets: SideTarget[] = [];
  const freeShare = shareOfWidth(free.width);

  if (free.width > 0 && (isSelf || fits(freeShare))) {
    targets.push({
      index,
      side: free.side,
      left: free.left,
      width: free.width,
      ...(isSelf ? {} : { widthPct: freeShare }),
    });
  }

  /*
   * And the column the block already occupies, for anything that is not that
   * block. Landing there puts the newcomer in that column — at that column's
   * width, so the line still adds up — and pushes the one already on the line
   * across. `insert` in card-edits.ts reads `"start"` as "take this line, the
   * block here joins you" and `"end"` as "join the block before you", which is
   * exactly the two cases below.
   *
   * Offering it to the block itself would be drawing a mark over where that
   * block already is, for a drop `dropCardBlock` answers `null` to.
   */
  const takenShare = shareOfWidth(box.width);

  if (!isSelf && fits(takenShare)) {
    targets.push(
      atEnd
        ? {
            index: row.end,
            side: "end",
            left: box.left,
            width: box.width,
            widthPct: takenShare,
          }
        : {
            index: row.index,
            side: "start",
            left: box.left,
            width: box.width,
            widthPct: takenShare,
          },
    );
  }

  return targets;
}
