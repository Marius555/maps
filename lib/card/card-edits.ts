import {
  CARD_BLOCKS,
  CARD_ZONES,
  MAX_BLOCK_MARGIN,
  MAX_BLOCK_PADDING,
  acceptsBlock,
  cardRows,
  defaultMarginOf,
  findBlock,
  hasControl,
  isPairable,
  isSelfSized,
  lineTakes,
  rowOffsetHolder,
  shareOf,
  shareOfAny,
  type CardBlock,
  type CardBlockAlign,
  type CardBlockType,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";
import { newCardBlockId } from "@/lib/validation/card-layout.schema";

/**
 * Every change the designer can make to a layout, as pure functions.
 *
 * The same split `lib/map/drop-action.ts` makes for the locations panel: the
 * gesture asks, a tested module answers. Returning `null` for a move that is not
 * allowed is what makes a zone stay dark as the pointer crosses it — a drop
 * target that lights up and then refuses is worse than one that never offered.
 *
 * This is also where the user's rules actually live for the *editing* path:
 * nothing lands in a zone it may not occupy, nothing grows past the card, and a
 * unique block cannot be added twice. `resolveCardLayout` enforces the same
 * things for a layout arriving from storage, which is the path this one cannot
 * cover.
 */

/** What is being dropped: something new from the palette, or a block being moved. */
export type CardDrag =
  | { kind: "new"; type: CardBlockType }
  | { kind: "move"; id: string };

/**
 * Where it would land: a zone, an index within it, and how far down the free
 * space at that index the block actually sits.
 *
 * The index alone used to be the whole answer, and it is why a block dropped
 * halfway down an empty card snapped to the top: "third in the middle zone" says
 * nothing about where the middle zone's blocks start. `offset` is what the card
 * has to remember for the drop to land where the user let go, and `nextOffset`
 * is what keeps the block *after* it from being shoved down by the arrival.
 * Both come from `dropSlots` (lib/card/drop-slots.ts), which is where the
 * measuring happens.
 */
export type CardDropTarget = {
  zone: CardZone;
  /** Insertion index — 0 is above the first block, `length` is after the last. */
  index: number;
  /** Empty space above the landing block, in px. Absent leaves it as it was. */
  offset?: number;
  /** What the block that ends up after it becomes. Absent leaves it alone. */
  nextOffset?: number;
  /**
   * The block the move is about to leave stranded, and the leading space it has
   * to take so its own top edge does not move.
   *
   * The mirror of `nextOffset`, and the half that was missing. `nextOffset` stops
   * an *arrival* shoving the card down; this stops a *departure* pulling it up.
   * A block stores the empty space above it, so lifting the block above it out
   * of the card handed it that space for free and it rode up into it — which is
   * how dragging a name one place down and back left the description under it
   * permanently higher than it started.
   *
   * Measured, so it comes from the same pass everything else does:
   * `vacatedSpace` in ./drop-slots.ts. Absent on every drag that frees nothing —
   * a block off the palette, one on a shared line (whose partner still holds the
   * line where it is), and one with nothing below it in its own zone.
   *
   * The two travel together and are meaningless apart, but they are two flat
   * fields rather than one object because every other field on this type is
   * flat and the overlay spreads them in one at a time.
   */
  vacateId?: string;
  vacateOffset?: number;
  /**
   * Land this block on a shared line, in the column named.
   *
   * A side rather than a flag, and the side is what `index` cannot say: the same
   * insertion index means "after the block already there" or "before it"
   * depending on which of the two the target was drawn over, and *which of them
   * starts the line* follows from that. It is also what says where a lone
   * narrowed block ends up when it crosses its own line, since nothing about its
   * position in the array changes.
   *
   * Deliberately one-way about the width itself: a target that offers a column
   * sets it (see `widthPct`), and a full-width mark sets 100. Crossing your own
   * line is the one drop that names neither, because nothing about that gesture
   * is a width — see the early return in `dropCardBlock`.
   *
   * `side` is not one-way, and cannot be: a full-width drop mark is drawn across
   * the whole card, so a block released on one has to land at the line's start.
   * Absent here therefore means the start, not "leave it".
   */
  half?: "start" | "end";
  /**
   * How wide the place being landed in is, as a percentage of the card.
   *
   * The reserved space is not always half a line — narrow a photo to 40% and what
   * is left beside it is 60% — so the target has to carry the number, and the
   * block that lands takes it.
   *
   * **A full-width mark says 100, and that is a real edit.** A block that lands
   * alone on a line takes the whole line: the outline drawn for a run spans the
   * card, and a 50%-wide block released on one used to land at 50% with reserved
   * space beside it, which is an outline promising a block twice the size of the
   * one that arrived. So a drag can widen a block back out; only the Width slider
   * can narrow one.
   *
   * Absent leaves the block's own width alone, which is now just the one gesture:
   * a block crossing the line it owns alone changes which column it draws in and
   * nothing else, reserved space and all.
   *
   * Measured off the card rather than derived from the sitting block's stored
   * percentage, so a column and the mark drawn over it are the same box at every
   * card width. See `sideSlots` in lib/card/drop-slots.ts.
   */
  widthPct?: number;
  /**
   * The insertion index of the **line** this target is on — that is, of the
   * first block already sitting on it.
   *
   * Present only on a column target. It is what tells "join the block on the line
   * above" apart from "cross to the other column of the line I am already alone
   * on": those two are the same `(zone, index, side)` and differ in nothing else
   * (see `dropCardBlock`), which is also what let two of them register under one
   * id and light each other up.
   */
  line?: number;
  /**
   * The block already on this line, which has to narrow for this drop to fit.
   *
   * A **pair** target and nothing else — the two columns offered over a block
   * that is currently the full width of the card (`pairTargets` in
   * lib/card/drop-slots.ts). Every other column target lands in room a narrowed
   * block already reserved, so the block beside it is untouched; this is the
   * gesture that creates the room, and creating it is what the block already
   * there pays for.
   *
   * An id rather than an index, because the index moves: the drop is applied as
   * a remove and an insert, and "the second block in the middle zone" is a
   * different block on either side of that.
   */
  pairId?: string;
  /** What `pairId` becomes. Half — the only split a drop can ask for. */
  pairWidthPct?: number;
  /**
   * Where a **self-sized** block sits across the line it lands on.
   *
   * The one target field that is about a position rather than a size, and it
   * exists because a mark's position has a second degree of freedom nothing else
   * on the card has: a name dropped into a run fills the line it lands on, so
   * where it goes is one number, while a logo is a square that can sit at either
   * end of that line or in the middle of it.
   *
   * So the marks a self-sized drag draws are a *grid* — three columns down every
   * run of free space (`splitAlignColumns` in lib/card/drop-slots.ts) — and this
   * is which column was released on. Absent leaves the block's own alignment
   * alone, which is every other target: a full-width mark says nothing about
   * where a square would sit inside it.
   */
  align?: CardBlockAlign;
};

/** A block of this type as it arrives on the card, before anyone resizes it. */
export function makeCardBlock(type: CardBlockType): CardBlock {
  const spec = CARD_BLOCKS[type];

  return {
    id: newCardBlockId(),
    type,
    // "Predefined dimensions before it is dropped" — a gallery arrives at a
    // quarter of the card rather than at nothing, so what lands is already a
    // design. Only the blocks that carry a height have one to be given.
    ...(hasControl(type, "height")
      ? { heightPct: spec.defaultHeightPct ?? 0 }
      : {}),
    // And a few pixels of room for the blocks made of words, so a name that
    // lands under a photo is not touching it. Only on arrival — see
    // `defaultPadding` in packages/shared/card-layout.ts for why nothing
    // already on a card, or already published, is touched by this.
    ...(spec.defaultPadding && hasControl(type, "padding")
      ? { padding: spec.defaultPadding }
      : {}),
    // And, for the one type that has one, where it sits and how far it is pulled
    // over the block beside it — so a logo dropped under a photo arrives already
    // straddling its edge rather than sitting under it waiting to be found.
    ...(spec.defaultAlign && hasControl(type, "align")
      ? { align: spec.defaultAlign }
      : {}),
    ...(spec.defaultOverlapPct && hasControl(type, "overlap")
      ? { overlapPct: spec.defaultOverlapPct }
      : {}),
  };
}

/**
 * The layout after this drop, or `null` if the drop changes nothing or is not
 * allowed.
 *
 * Null covers three cases deliberately, because to the caller they are the same
 * thing — do not light up, do not save: a block that may not enter this zone, a
 * second copy of a unique block, and a move that puts a block back exactly where
 * it already was.
 */
export function dropCardBlock(
  stored: CardLayout,
  dragged: CardDrag,
  target: CardDropTarget,
): CardLayout | null {
  /*
   * A pair drop narrows the block already on the line *before* anything else
   * happens, and the order is load-bearing rather than tidy: `insert` runs
   * `preserveRows`, which decides lines by width, so a resident still at the
   * full width of the card would push the newcomer onto a line of its own and
   * the whole gesture would read as having been ignored.
   */
  const layout = pair(stored, dragged, target);
  /*
   * Whether it actually did. Reference equality, because `pair` hands back the
   * layout it was given in every case where there was nothing to do — a target
   * that names no block, one naming a block that is not on the card, or one
   * naming the block in the hand.
   *
   * The non-move check below reads it. A pair that happened changed the card
   * whatever else the drop did; a pair target that came to nothing has to fall
   * through to the ordinary rules rather than force a no-op through them.
   */
  const paired = layout !== stored;

  if (dragged.kind === "new") {
    if (!acceptsBlock(layout, dragged.type, target.zone)) return null;

    const block = withAlign(
      withShare(
        withOffset(makeCardBlock(dragged.type), target.offset, layout),
        target.widthPct,
      ),
      target.align,
    );

    return settle(
      withSide(insert(layout, target.zone, target.index, block, target.half), block.id, target),
      block.id,
      target,
    );
  }

  const found = findBlock(layout, dragged.id);
  if (!found) return null;
  if (!acceptsBlock(layout, found.block.type, target.zone, found.block.id)) {
    return null;
  }

  /*
   * Whether this block currently shares its line with something else, which is
   * what decides whether the non-move test below applies to it at all.
   *
   * Index adjacency means "the same place" only for a block that **owns** its
   * line: lift it out and the index just past it points back at the position it
   * came from. A block sharing a line is leaving that line whatever run it lands
   * in — and the run immediately below its row starts at `row.end`, which for the
   * last member of the row *is* its own index plus one. Every other field in that
   * test compares equal (a member of a pair carries no `side`, and a run slot
   * names no width), so dragging a block off a shared line onto the very next
   * place below it was refused outright, while two places down went through. The
   * mirror of it is the row's first member and the run immediately above.
   */
  const line = cardRows(layout.zones[found.zone], layout).find((row) =>
    row.blocks.some((block) => block.id === found.block.id),
  );
  const shares = (line?.blocks.length ?? 1) > 1;

  /*
   * Whether the block is landing on the very line it is already on — a column
   * target naming its own row.
   *
   * It matters because of what it says about the space *below*: nothing is
   * freed. `vacatedSpace` is worked out once per gesture, from the card as it
   * was before the drag, and stapled onto every target — so it describes what
   * the lift would open up wherever the block goes. Land it back on its own
   * line and it opens up nothing, but the charge is made anyway, and a column
   * target carries no `nextOffset` for `settle` to cancel it with. The line
   * below simply drops by the height the block contributed to this one.
   *
   * Only reachable for a *shared* line: a block alone on one returns above,
   * before this. It became reachable when that branch learned to say "alone",
   * which is what made moving a block along a line it shares work at all.
   */
  const staysOnItsLine =
    line !== undefined &&
    target.zone === found.zone &&
    target.line === line.index;

  /*
   * Crossing to the other column of the line this block already owns alone.
   *
   * The whole edit is one word — which end it sits at — and it has to be done
   * *here*, before the remove-and-insert below, because that path would read the
   * target as "join the block above me". Its index is the line's own start, and
   * after the block is lifted out that index points at whatever precedes it, so
   * `insert` paired the two: a block flipping across its own line silently
   * dragged its neighbour up beside it. `target.line` is what makes the two
   * cases distinguishable at all — see `CardDropTarget`.
   *
   * **Alone is the load-bearing word, and `target.line` cannot say it.** A line
   * is named by the index of its *first* block, so the first member of a line
   * that holds two sits at that index as well — and every column target drawn on
   * that line therefore answered this test. Dragging a name past the logo it
   * shares a line with took this branch, was given a `side`, and stopped:
   * `cardRowBox` reads `side` only on a row of one, so the card did not move
   * while the drop reported success and saved. The identical landing made from
   * one line lower has always worked, because there `line` names somebody
   * else's row — which is what the gesture is, and what the path below does.
   *
   * The stale `side` mattered on its own too. It is meaningless on a shared
   * line but survives storage (`readBlock` keeps it under any width), so it came
   * back weeks later as a block that jumps to the far end of its line the first
   * time it is alone on one.
   */
  if (
    !shares &&
    target.line !== undefined &&
    target.zone === found.zone &&
    target.line === found.index
  ) {
    const side = sideOf(target.half);
    if (side === found.block.side) return null;

    return replace(
      layout,
      found.zone,
      found.index,
      side ? { ...found.block, side } : without(found.block, "side"),
    );
  }

  /*
   * Removing first, then inserting, is what makes the index arithmetic honest:
   * within one zone, an index past the block's own position refers to a list
   * that no longer has it in it. Both "on itself" and "immediately after itself"
   * are the same non-move, and both have to be caught before the shift, while
   * the original index is still meaningful.
   *
   * The offset has to agree too, and that is not a detail: a block dropped four
   * slots further down the *same* run of free space is the same `(zone, index)`
   * — nothing is between it and its neighbours either way — and it is the whole
   * gesture the user is making. Without this comparison, sliding a block down an
   * empty card would silently do nothing.
   */
  if (
    /*
     * Never once a pair has been made: the block already on that line has just
     * narrowed to half the card, so the drop changed something even when the
     * block in the hand ends up at an index it could have reached without
     * moving. That is the *whole* case a half sitting directly above a
     * full-width block makes — same index, same width, same end of its line.
     */
    !paired &&
    !shares &&
    found.zone === target.zone &&
    (target.index === found.index || target.index === found.index + 1) &&
    (target.offset ?? found.block.offset ?? 0) === (found.block.offset ?? 0) &&
    // Landing in a column beside another block is not a non-move: the block goes
    // from owning a line to sharing one, and takes that column's width with it.
    (target.widthPct ?? shareOf(found.block)) === shareOf(found.block) &&
    // And, for a mark, which column of the run it was released in. Sliding a
    // logo from the middle of a run to its left-hand column is the same zone,
    // the same index and the same leading space — the alignment is the entire
    // edit, so leaving it out of this comparison made the gesture a no-op.
    (target.align ?? found.block.align) === found.block.align &&
    sideOf(target.half) === found.block.side
  ) {
    return null;
  }

  /*
   * The lift, and the space it frees charged to whatever was under it.
   *
   * Order matters and is the whole trick: `settle` runs *last*, so when the block
   * lands back in the very run it just came out of, its `nextOffset` overwrites
   * this on the same block and the local answer wins. When it lands anywhere
   * else, this stands. Neither needs to know about the other, and there is no
   * "is this the same run" test to get wrong.
   *
   * That works because both now write through `withRowOffset`, which puts a
   * line's leading space on one member and clears the others. While they picked
   * that member by two different rules, "overwrites this on the same block" was
   * true only for a line of one.
   *
   * The one lift that frees nothing is skipped outright — see `staysOnItsLine`.
   */
  const lifted = staysOnItsLine
    ? remove(layout, dragged.id)
    : vacate(remove(layout, dragged.id), target);
  const index =
    found.zone === target.zone && target.index > found.index
      ? target.index - 1
      : target.index;
  const block = withAlign(
    withShare(withOffset(found.block, target.offset, layout), target.widthPct),
    target.align,
  );

  return settle(
    withSide(
      insert(lifted, target.zone, index, block, target.half),
      block.id,
      target,
    ),
    block.id,
    target,
  );
}

/**
 * The layout without this block, and with the lines around it left as they were.
 *
 * The second half is not a nicety. Lines are paired by adjacency, so taking one
 * block out of a pair frees its partner to grab whatever narrowed block comes
 * next — delete the second of `[1,2] [3]` and 3 jumps up beside 1. `remove`
 * records which blocks started a line first, so the ones that survive keep
 * their own.
 */
export function removeCardBlock(layout: CardLayout, id: string): CardLayout {
  return findBlock(layout, id) ? remove(layout, id) : layout;
}

/**
 * A block resized, clamped to what its type allows and to the card itself.
 *
 * The clamp is here rather than in the drag handler so it is the same answer
 * however the number arrives — a pointer, a number field, or an arrow key on a
 * focused handle. It is also the reason a handle cannot be dragged past the
 * card's edge: the value simply stops changing.
 */
export function resizeCardBlock(
  layout: CardLayout,
  id: string,
  patch: Partial<
    Pick<
      CardBlock,
      | "widthPct"
      | "heightPct"
      | "padding"
      | "align"
      | "margin"
      | "offset"
      | "overlapPct"
    >
  > & {
    /*
     * Both spelled out with their absent state in them, for the reason `fit`
     * below is: `undefined` already means "don't touch this" in this patch, so a
     * control needs a word for the state the field says by not being there.
     */
    valign?: "start" | "center" | "end";
    overlapEdge?: "above" | "below";
    /*
     * Spelled out with `"cover"` in it rather than picked off `CardBlock`, where
     * it is `"contain" | undefined`: picking it would leave the panel no way to
     * say "fill", since `undefined` already means "don't touch this" — which is
     * what every other field in this patch means by it.
     */
    fit?: "cover" | "contain";
  },
): CardLayout {
  const found = findBlock(layout, id);
  if (!found) return layout;

  const { type } = found.block;
  const spec = CARD_BLOCKS[type];
  const next: CardBlock = { ...found.block };

  /*
   * Every branch asks the block's own `controls` list, which is the same list
   * the designer's panel renders from. A patch naming a control this type does
   * not offer is dropped rather than applied — otherwise the panel and the edit
   * path would be two separate opinions about what a block can be, and the one
   * that silently wins would be this one.
   */
  if (patch.align !== undefined && hasControl(type, "align")) {
    next.align = patch.align;
  }

  if (patch.margin !== undefined && hasControl(type, "margin")) {
    const margin = clamp(patch.margin, 0, MAX_BLOCK_MARGIN);
    // Back at the type's own default is back to *inheriting* it, so the card's
    // own Padding slider keeps moving a block nobody has singled out. The same
    // argument full width is the absence of a width.
    if (margin === defaultMarginOf(type, layout.padding)) delete next.margin;
    else next.margin = margin;
  }

  /*
   * The one width control, and the one thing it has to be careful of.
   *
   * A block sharing its line cannot be widened past what its partner leaves —
   * the two shares have to keep summing to 100 or `cardRows` stops pairing them
   * and the line comes apart under the slider. So the ceiling is the partner's
   * leftover rather than 100, and, as everywhere else in this file, the rule is
   * enforced by the *number stopping* rather than by a refusal after the fact.
   *
   * A stored legacy `half` is cleared here whatever the new width is: the first
   * time anyone touches this control, the block stops being described by the old
   * field. `shareOf` is what kept reading it until then.
   */
  if (patch.widthPct !== undefined && hasControl(type, "width")) {
    const width = clamp(
      patch.widthPct,
      spec.minWidthPct ?? 25,
      maxShareFor(layout, found.zone, found.block),
    );

    widen(next);
    // Full width is the *absence* of a width, so there is one way to say it and
    // the renderers do not have to treat 100 and undefined as the same thing.
    if (width >= 100) delete next.widthPct;
    else next.widthPct = width;

    /*
     * And a block widened back out has no line to sit on the cross axis of — it
     * *is* its line, exactly as tall as itself. Cleared here rather than in
     * `widen` above, which runs on every touch of this slider: 50 to 40 is still
     * a block sharing a line, and losing its alignment on the way past would be
     * a control undoing itself.
     */
    if (next.widthPct === undefined) delete next.valign;
  }

  if (patch.valign !== undefined && hasControl(type, "valign")) {
    // Stretch is the absence of a vertical alignment, and a full-width block has
    // nothing to align — the same argument full width is the absence of a width.
    if (patch.valign === "start" || next.widthPct === undefined) {
      delete next.valign;
    } else next.valign = patch.valign;
  }

  /*
   * The overlap, and then the edge it is against — in that order, because the
   * edge is only meaningful while there is an overlap to have one. Slide the
   * overlap to zero and the direction goes with it rather than waiting to
   * surprise whoever slides it back up.
   */
  if (patch.overlapPct !== undefined && hasControl(type, "overlap")) {
    const overlap = clamp(patch.overlapPct, 0, 100);

    if (overlap <= 0) {
      delete next.overlapPct;
      delete next.overlapEdge;
    } else next.overlapPct = overlap;
  }

  if (patch.overlapEdge !== undefined && hasControl(type, "overlap")) {
    // Upwards is the absence of an edge, on the same argument as everything
    // else here.
    if (patch.overlapEdge === "below" && next.overlapPct !== undefined) {
      next.overlapEdge = "below";
    } else delete next.overlapEdge;
  }

  if (patch.heightPct !== undefined && hasControl(type, "height")) {
    next.heightPct = clamp(patch.heightPct, 1, spec.maxHeightPct ?? 100);
  }

  /*
   * Leading space, which every block has and no block's panel offers — it is
   * where the block *sits*, set by dragging rather than by a control. The top
   * resize handle is what patches it: growing a block upward is spending the
   * room above it, and the two numbers have to move together or the block's top
   * edge does not follow the pointer.
   *
   * Zero is the absence of an offset, on the same argument full width is the
   * absence of a width — so a card nobody has moved anything on stores nothing
   * new (CLAUDE.md §7).
   */
  if (patch.offset !== undefined) {
    const offset = clamp(patch.offset, 0, layout.maxHeight);
    if (offset <= 0) delete next.offset;
    else next.offset = offset;
  }

  if (patch.fit !== undefined && hasControl(type, "fit")) {
    // Cropping to fill is the *absence* of a fit, on the same argument full
    // width is the absence of a width.
    if (patch.fit === "contain") next.fit = "contain";
    else delete next.fit;
  }

  if (patch.padding !== undefined && hasControl(type, "padding")) {
    const padding = clamp(patch.padding, 0, MAX_BLOCK_PADDING);
    // Zero is the absence of padding, on the same argument full width is the
    // absence of a width.
    if (padding <= 0) delete next.padding;
    else next.padding = padding;
  }

  return replace(layout, found.zone, found.index, next);
}

/** The card's own box, clamped the same way. */
export function resizeCard(
  layout: CardLayout,
  patch: Partial<
    Pick<
      CardLayout,
      | "width"
      | "maxHeight"
      | "radius"
      | "padding"
      | "gap"
      | "borderWidth"
      | "shadow"
      | "background"
      | "border"
    >
  >,
): CardLayout {
  return { ...layout, ...patch };
}

/** Which blocks the palette can still offer, given what is already on the card. */
export function availableBlocks(layout: CardLayout): CardBlockType[] {
  return (Object.keys(CARD_BLOCKS) as CardBlockType[]).filter((type) =>
    CARD_ZONES.some((zone) => acceptsBlock(layout, type, zone)),
  );
}

/**
 * A block about to be given a width of its own, with the old one's baggage gone.
 *
 * `half` is the legacy spelling of "50%" (`shareOf` in packages/shared) and has
 * to go the moment a real width is written, or the two would disagree and the
 * old one would win. `newLine` and `side` are both statements about a line the
 * block *shares*, so a full-width block carrying either is describing something
 * it does not have — and left behind they come back the moment someone narrows
 * it again, as a block that silently returns to the right of its line weeks
 * later for a reason nothing on screen can explain.
 *
 * Called before the new width is set rather than after, so the caller can write
 * `widthPct` over the top and the clears cannot undo it.
 */
function widen(block: CardBlock): void {
  delete block.half;
  delete block.newLine;
  delete block.side;
}

/**
 * The widest this block may be made without breaking the line it is on.
 *
 * 100 unless it currently shares its line, in which case it is whatever the
 * rest of that line leaves. `cardRows` groups on the shares fitting together, so
 * a block widened past this stops being grouped — its line-mates drop onto lines
 * of their own and the card reflows under the hand holding the slider. Stopping
 * the number instead makes the slider behave like the splitter it looks like.
 *
 * Summed over **every** other member rather than over a single partner: a line
 * can now hold two columns either side of a self-sized mark, and the mark's own
 * share counts against the slider exactly as a column's does — it is width the
 * line has already spent.
 */
function maxShareFor(
  layout: CardLayout,
  zone: CardZone,
  block: CardBlock,
): number {
  const row = cardRows(layout.zones[zone], layout).find((candidate) =>
    candidate.blocks.some((member) => member.id === block.id),
  );
  if (!row || row.blocks.length < 2) return 100;

  let spent = 0;
  for (const member of row.blocks) {
    if (member.id !== block.id) spent += shareOfAny(member, layout);
  }

  return Math.max(0, 100 - spent);
}

/**
 * The layout with the block a pair target names narrowed to make room for it.
 *
 * The whole of what a pair drop adds to an ordinary one. Everything after it —
 * the index arithmetic, `insert`'s line bookkeeping, `preserveRows` — is the
 * code that already puts a block into a column beside another, and it works
 * unchanged once the block already there has a column too.
 *
 * `withShare` refuses a type with no `width` control and clamps to its own
 * floor, so this does not re-ask what `pairTargets` asked before drawing the
 * target. Belt and braces on purpose: this is the edit path, and the edit path
 * is where a rule has to be true rather than merely observed.
 */
function pair(
  layout: CardLayout,
  dragged: CardDrag,
  target: CardDropTarget,
): CardLayout {
  if (target.pairId === undefined) return layout;
  // A block cannot pair with itself. No target says so, but nothing downstream
  // would survive it either.
  if (dragged.kind === "move" && dragged.id === target.pairId) return layout;

  const resident = findBlock(layout, target.pairId);
  if (!resident) return layout;
  /*
   * And a block a drop may not narrow — `isPairable` in
   * packages/shared/card-layout.ts. `pairTargets` refuses to draw the target at
   * all, so this is the second of the two asks that rule gets: an offer can go
   * stale between the measurement and the release, and this is the edit path.
   */
  if (!isPairable(resident.block.type)) return layout;

  return replace(
    layout,
    resident.zone,
    resident.index,
    withShare(resident.block, target.pairWidthPct),
  );
}

/** Which column a target puts the block in. Absent is the line's start. */
function sideOf(half: "start" | "end" | undefined): "end" | undefined {
  return half === "end" ? "end" : undefined;
}

/** The ids of the blocks that begin a line — one per row, in order. */
function rowStarts(
  blocks: readonly CardBlock[],
  layout: CardLayout,
): Set<string> {
  return new Set(cardRows(blocks, layout).map((row) => row.blocks[0].id));
}

/**
 * A zone's blocks, with `newLine` written wherever it takes to keep exactly
 * these lines.
 *
 * The repair for the one thing greedy adjacency gets wrong. Pairing is decided
 * by *position* — a narrowed block takes the next one that fits beside it — so
 * any edit that changes a block's position can re-pair blocks nobody touched.
 * Pulling one out of a pair to join the lone block below it is the case that
 * bites: the partner left behind is now the nearest candidate to that lone one,
 * grabs it, and the two appear to swap lines under the cursor.
 *
 * `starts` is which blocks began a line *before* the edit, plus whatever the
 * edit itself intends. Everything else follows from walking the list once and
 * flagging only the blocks that would otherwise be swallowed by the one in
 * front — so a card whose lines are already what they should be gets no flags
 * at all, and `defaultCardLayout()` stays byte-identical (CLAUDE.md §7).
 */
function preserveRows(
  blocks: readonly CardBlock[],
  starts: ReadonlySet<string>,
  layout: CardLayout,
): CardBlock[] {
  /*
   * The line the walk is currently on, as the blocks already on it.
   *
   * It was a single remaining-width number, which was enough while a line held
   * two blocks and closed. A line can now hold two columns *and* a self-sized
   * mark, so "is there room" is a question about the whole line — how much share
   * it has spent, how many columns it holds, and whether it already has a mark.
   * `lineTakes` in packages/shared is the one place that answers it, and this
   * asks it rather than restating it: `cardRows` asks the same function, so the
   * flags written here and the lines the renderers draw cannot drift apart.
   */
  let line: CardBlock[] = [];

  return blocks.map((block) => {
    const share = shareOfAny(block, layout);

    if (share >= 100) {
      line = [];

      return block.newLine === undefined ? block : without(block, "newLine");
    }

    // A block the line in front cannot hold starts its own by arithmetic, and a
    // flag saying so would be a stored field that changes nothing.
    const fits = lineTakes(line, block, layout);
    const ownLine = starts.has(block.id);
    const flag = fits && ownLine;

    // Taken by the line in front joins it; anything else opens one of its own.
    line = fits && !ownLine ? [...line, block] : [block];

    if (flag === (block.newLine === true)) return block;

    return flag
      ? { ...block, newLine: true as const }
      : without(block, "newLine");
  });
}

/** The same block without that field. */
function without(block: CardBlock, key: "newLine" | "side"): CardBlock {
  const next = { ...block };
  delete next[key];

  return next;
}

/**
 * The block that just landed, sitting in the column the drop named.
 *
 * Only a block **alone** on its line carries a side — a pair fills its row, so
 * there is nothing for one to move (see `cardRowBox`). And a target that named
 * no column means the start, rather than meaning "leave it": a full-width drop
 * mark is drawn across the whole card, so a block released on one has to land
 * where the mark promised.
 */
function withSide(
  layout: CardLayout,
  id: string,
  target: CardDropTarget,
): CardLayout {
  const landed = findBlock(layout, id);
  if (!landed) return layout;

  const list = layout.zones[landed.zone];
  const row = cardRows(list, layout).find((candidate) =>
    candidate.blocks.some((block) => block.id === id),
  );

  const side = row?.blocks.length === 1 ? sideOf(target.half) : undefined;
  if (side === landed.block.side) return layout;

  return replace(
    layout,
    landed.zone,
    landed.index,
    side ? { ...landed.block, side } : without(landed.block, "side"),
  );
}

/**
 * The same block, sitting that far below whatever is above it.
 *
 * `undefined` leaves the block's own offset alone, which is what a caller
 * passing a bare `{ zone, index }` means — the older shape of a drop, and the
 * shape every call that is not the canvas still uses.
 *
 * Zero *deletes* the field rather than storing it, on the same argument full
 * width is the absence of a width: one way to say it, and a card nobody has
 * moved anything on publishes the bytes it always did (CLAUDE.md §7).
 */
function withOffset(
  block: CardBlock,
  offset: number | undefined,
  layout: CardLayout,
): CardBlock {
  if (offset === undefined) return block;

  const next = { ...block };
  // Rounded, because an offset is a whole number of pixels — `cardLayoutSchema`
  // says `z.number().int()` and the endpoint refuses anything else. Every caller
  // already rounds its own measurement; this is the backstop, so the next thing
  // to hand this a sub-pixel value fails a test rather than a save.
  const value = Math.round(clamp(offset, 0, layout.maxHeight));

  if (value <= 0) delete next.offset;
  else next.offset = value;

  return next;
}

/**
 * The same block, sitting where across its line the drop said.
 *
 * Self-sized only, and gated on the type's own `align` control rather than on
 * the target having named a column: this is the edit path, and the edit path is
 * where the rule has to be true rather than merely observed. For everything else
 * `align` moves the *words*, and a drag has never moved those — there is no
 * gesture for it and dropping a name into the right-hand column should not
 * silently right-align its text.
 */
function withAlign(
  block: CardBlock,
  align: CardBlockAlign | undefined,
): CardBlock {
  if (align === undefined) return block;
  if (!isSelfSized(block.type) || !hasControl(block.type, "align")) return block;
  if (block.align === align) return block;

  return { ...block, align };
}

/**
 * The same block, as wide as the place it landed in.
 *
 * `undefined` leaves it alone, which is now one target only: a block crossing the
 * line it owns alone, where the width is the whole point of what is *not*
 * changing. Every other target names a number — a column names its own, and a
 * full-width mark names 100, which is what widens a narrowed block that has
 * landed somewhere it has the line to itself. See `widthPct` on
 * `CardDropTarget`. Which of two columns it is is `withSide`'s business, not
 * this one's.
 *
 * It refuses on a type that does not declare the control, which is what keeps a
 * logo dropped on a run from being handed a share it has nothing to do with. It
 * clamps to the type's own floor for the same reason: this is the edit path, and
 * the edit path is where a rule has to be true rather than merely observed.
 *
 * At full width it `widen`s rather than only deleting `widthPct`, so the line
 * rules go with the width. `preserveRows` and `withSide` downstream would each
 * clear one of them on this path anyway; doing it here is what makes the block
 * this function returns describable on its own, rather than correct only because
 * of what happens to run next.
 */
function withShare(
  block: CardBlock,
  widthPct: number | undefined,
): CardBlock {
  if (widthPct === undefined || !hasControl(block.type, "width")) return block;

  const spec = CARD_BLOCKS[block.type];
  const width = clamp(widthPct, spec.minWidthPct ?? 25, 100);
  const next = { ...block };
  delete next.half;

  if (width >= 100) {
    // Full width is the *absence* of a width, so there is one way to say it and
    // the renderers do not have to treat 100 and undefined as the same thing.
    delete next.widthPct;
    widen(next);
  } else next.widthPct = width;

  return next;
}

/**
 * The block left stranded by the lift, moved back to where it already was.
 *
 * The mirror of `settle` below: that one stops an arrival pushing the card down,
 * this one stops a departure pulling it up. A block stores the empty space above
 * it, so taking the block above it off the card gave it that space for nothing
 * and it slid up into it — one gesture moving two blocks.
 *
 * The number is measured rather than derived, because most blocks have no height
 * of their own: `vacatedSpace` in ./drop-slots.ts works it out from the same rects
 * the drop marks were drawn from.
 *
 * Deliberately not applied by `removeCardBlock`. Deleting a block and moving one
 * are different promises — a move says "only this block moves", while closing the
 * gap left by something that is gone is at least arguable — and nobody has asked
 * for the second one.
 */
function vacate(layout: CardLayout, target: CardDropTarget): CardLayout {
  if (target.vacateId === undefined || target.vacateOffset === undefined) {
    return layout;
  }

  const found = findBlock(layout, target.vacateId);
  if (!found) return layout;

  return withRowOffset(layout, found.zone, found.block.id, target.vacateOffset);
}

/**
 * A line's leading space set to one number, held by one block.
 *
 * The single writer both `vacate` and `settle` go through, and the reason they
 * can overwrite each other again. A line takes its leading space as the
 * **greatest** of its members' offsets (`cardRowBox`), so a number written to a
 * member that is not the greatest is a number the card ignores — and a number
 * written to the greatest while a *sibling* still holds an old one is a number
 * the card ignores the moment the sibling wins. Both were happening, in the two
 * halves of one gesture, which is why a card grew a hole above a shared line
 * that no later move could close.
 *
 * So this writes the value to the line's own holder (`rowOffsetHolder`, the same
 * rule `cardRowBox` reads by) and **clears the rest of the line**. After it the
 * line has exactly one offset, whoever asked and whichever member they named.
 *
 * Clearing only ever deletes a field — `withOffset` stores nothing for zero — so
 * a card nobody has moved anything on still publishes the bytes it always did
 * (CLAUDE.md §7).
 */
function withRowOffset(
  layout: CardLayout,
  zone: CardZone,
  /** Any member of the line whose leading space this is. */
  id: string,
  offset: number,
): CardLayout {
  const list = layout.zones[zone];
  const row = cardRows(list, layout).find((candidate) =>
    candidate.blocks.some((block) => block.id === id),
  );
  if (!row) return layout;

  const holder = rowOffsetHolder(row.blocks);
  if (!holder) return layout;

  const next = list.map((block) =>
    row.blocks.some((member) => member.id === block.id)
      ? withOffset(block, block.id === holder.id ? offset : 0, layout)
      : block,
  );

  return { ...layout, zones: { ...layout.zones, [zone]: next } };
}

/**
 * The block that ended up *after* the one that just landed, moved back to where
 * it already was.
 *
 * This is what makes a drop local. Inserting into free space would otherwise
 * push everything below it down by the height of what arrived, so putting an
 * address into the gap above a name would move the name — and the user, who
 * aimed at a gap precisely because it was empty, would watch the rest of their
 * card shuffle. `nextOffset` is that block's new leading space, worked out from
 * the same measurement the slot was drawn from.
 *
 * Located by id after the insert rather than by arithmetic before it, because
 * the move path shifts its own index and "the block after the one that landed"
 * is only unambiguous once it has landed.
 */
function settle(
  layout: CardLayout,
  id: string,
  target: CardDropTarget,
): CardLayout {
  if (target.nextOffset === undefined) return layout;

  const landed = findBlock(layout, id);
  if (!landed) return layout;

  /*
   * The next **row**, not the next block.
   *
   * These two are the same thing on a card of full-width blocks, and they are
   * not the same thing anywhere else — which is the bug this fixes. A line's
   * leading space is one number taken from its members (`cardRowBox`), so "the
   * block after the landing" is only the right place to write when the line
   * below happens to be one block long. On a shared line it is that line's
   * *first* member, while `vacatedSpace` charges the line's *holder* — so the
   * two halves of one gesture wrote to two different blocks, both survived, the
   * greater won, and the hole a move opened above a shared line stayed open.
   * Every further move measured from the shoved position and wrote a bigger
   * number, so it compounded rather than settling.
   *
   * Asking `cardRows` for the row after this one answers both at once, and it
   * retires the old "not when the two share a line" bail: a line-mate is not the
   * next row, so there is nothing left to exclude. That bail also meant a
   * landing whose neighbour was a line-mate charged nobody at all.
   */
  const rows = cardRows(layout.zones[landed.zone], layout);
  const at = rows.findIndex((row) =>
    row.blocks.some((block) => block.id === id),
  );
  if (at < 0) return layout;

  const below = rows[at + 1] as (typeof rows)[number] | undefined;
  if (!below) return layout;

  return withRowOffset(
    layout,
    landed.zone,
    below.blocks[0].id,
    target.nextOffset,
  );
}

/**
 * The block inserted, and the lines that were already there kept.
 *
 * The intent is the only thing `preserveRows` cannot work out for itself, and it
 * comes down to which of two blocks starts the line they end up sharing. A block
 * landing in the `"end"` column is *joining* the line the one before it is on,
 * so that line keeps its own head and the newcomer is not one. A block landing
 * in the `"start"` column takes the line itself, and the block it displaces
 * joins it. A target naming no column at all lands on a line of its own and
 * displaces nobody.
 *
 * **`"end"` joins a line, not a block**, and the difference only shows once a
 * line can hold three. Making the block before it a start was the same thing
 * while every shared line was a pair — the block you joined was the head of it —
 * and became a split the moment a name could sit to the left of a logo: dropping
 * an address into the room on the logo's right marked the *logo* as a line head,
 * so the line the drop was aimed at came apart under it and the address landed
 * on a line of its own below. `rowStarts` already names the head of every line,
 * so joining one means leaving that set alone.
 *
 * An `"end"` with nothing before it is the second case, not the first: there is
 * no line there to join, so it opens one. No slot builds that target, but the
 * edit path is where the rule has to hold rather than be observed.
 */
function insert(
  layout: CardLayout,
  zone: CardZone,
  at: number,
  block: CardBlock,
  half: "start" | "end" | undefined,
): CardLayout {
  const before = layout.zones[zone];
  const index = clamp(at, 0, before.length);
  const starts = rowStarts(before, layout);

  const joined = half === "end" ? (before[index - 1] as CardBlock | undefined) : undefined;

  if (joined) {
    starts.delete(block.id);
  } else {
    starts.add(block.id);

    const displaced = half ? (before[index] as CardBlock | undefined) : undefined;
    if (displaced) starts.delete(displaced.id);
  }

  const list = [...before];
  list.splice(index, 0, block);

  return {
    ...layout,
    zones: { ...layout.zones, [zone]: preserveRows(list, starts, layout) },
  };
}

/**
 * The block gone, and the lines around it left as they were.
 *
 * Scanning every zone rather than the one it is in, because a move takes a block
 * out of a zone it may not be going back to — and the zone it leaves is the one
 * whose pairing is about to shift under it.
 */
function remove(layout: CardLayout, id: string): CardLayout {
  const handed = handOverRowOffset(layout, id);
  const zones = { ...handed.zones };

  for (const zone of CARD_ZONES) {
    const list = zones[zone];
    if (!list.some((block) => block.id === id)) continue;

    const starts = rowStarts(list, layout);
    starts.delete(id);

    zones[zone] = preserveRows(
      list.filter((block) => block.id !== id),
      starts,
      layout,
    );
  }

  return { ...handed, zones };
}

/**
 * A line's leading space left with the line, when the block that was holding it
 * is about to go.
 *
 * A line's leading space is one number taken from its members (`cardRowBox`), so
 * it belongs to the *line* — but it is stored on a block, and the block can
 * leave. Drag a name out of the room beside a logo and the line that name was
 * carrying 25px of leading space for came up 25px, taking everything under it
 * along: one gesture moving three blocks, in the other direction from the hole a
 * departure leaves below itself.
 *
 * `vacatedSpace` cannot answer this — it charges the line *below* the departure,
 * and this is the departed line itself — and it needs no measurement to answer:
 * whatever the line's leading space is, it stays what it is. So it is done here,
 * where every removal already passes, and it covers deleting a block onto the
 * removal strip for the same reason it covers moving one.
 *
 * Only when the line survives and only from its holder. A line that goes
 * entirely takes its leading space with it, which is what the hole below it is
 * then charged for.
 */
function handOverRowOffset(layout: CardLayout, id: string): CardLayout {
  const found = findBlock(layout, id);
  const offset = found?.block.offset;
  if (!found || !offset) return layout;

  const list = layout.zones[found.zone];
  const row = cardRows(list, layout).find((candidate) =>
    candidate.blocks.some((block) => block.id === id),
  );
  if (!row || row.blocks.length < 2) return layout;
  if (rowOffsetHolder(row.blocks)?.id !== id) return layout;

  const heir = row.blocks.find((block) => block.id !== id);
  if (!heir) return layout;

  return {
    ...layout,
    zones: {
      ...layout.zones,
      [found.zone]: list.map((block) =>
        block.id === heir.id ? withOffset(block, offset, layout) : block,
      ),
    },
  };
}

function replace(
  layout: CardLayout,
  zone: CardZone,
  index: number,
  block: CardBlock,
): CardLayout {
  const list = [...layout.zones[zone]];
  list[index] = block;

  return { ...layout, zones: { ...layout.zones, [zone]: list } };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
