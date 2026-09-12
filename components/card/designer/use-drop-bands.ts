"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

import type { DraggedObject } from "@/components/groups/use-row-drag";
import { newBlockHeight, overHeight } from "@/lib/card/card-space";
import {
  dropBands,
  dropRegions,
  splitAlignColumns,
  toCardDrag,
  type DropBand,
  type DropRegion,
} from "@/lib/card/drop-bands";
import {
  blockedFaces,
  dropSlots,
  lendToEndZones,
  sideSlots,
  vacatedSpace,
  zoneHeights,
  type BlockedFace,
  type DropSlot,
  type HeightAt,
  type VacatedSpace,
  type ZoneMeasure,
} from "@/lib/card/drop-slots";
import type { CardDrag } from "@/lib/card/card-edits";
import {
  CARD_ZONES,
  blockBox,
  findBlock,
  isSelfSized,
  shareOf,
  type CardBlock,
  type CardLayout,
} from "@/packages/shared/card-layout";

/** Everything the drop overlay draws with, measured off the card in one pass. */
export type CardDropGeometry = {
  /**
   * Every place this drag could land — each with the box to draw for it and the
   * slice of the card that aims at it. See `dropSlots` and `dropBands`.
   *
   * The whole of it, and deliberately: the overlay draws only the band the
   * pointer is in, but every one of them is a live hit area, and which is which
   * changes with the hand rather than with the measurement. The card's own
   * height and the height of the block in the air are what these were divided
   * out of; neither survives the pass, because nothing downstream reads them.
   */
  bands: DropBand[];
  /**
   * The same places, merged into the areas the resting layer draws.
   *
   * Worked out here rather than in the overlay so it is measured once per
   * gesture with everything else, and so the overlay stays a renderer: the
   * grouping is arithmetic over the bands and belongs with the rest of it.
   */
  regions: DropRegion[];
  /**
   * The parts of the card that already have a block on them — see
   * `blockedFaces`. Not places, and deliberately a separate list: nothing lands
   * on one, and putting them in `bands` would be inviting every reader to treat
   * them as somewhere to go.
   */
  blocked: BlockedFace[];
  /**
   * The block this move is about to leave stranded, and the leading space it has
   * to take so its own top edge does not move — see `vacatedSpace`.
   *
   * Absent for a drag that frees nothing. It belongs to the *gesture* rather than
   * to any one place the block could land, which is why it sits here beside the
   * bands rather than on each of them; the overlay copies it onto whichever
   * target the pointer is released on.
   */
  vacate?: VacatedSpace;
  /**
   * How far past its own height this card's blocks already reach, in px —
   * `overHeight`. Absent when the design fits, which is the usual case.
   *
   * Here because it is the one thing an empty `bands` cannot explain for itself.
   * A card whose blocks need more room than it has does not look broken: the one
   * block allowed to shrink quietly gives up the difference (see `wants` in
   * lib/card/drop-slots.ts), so every zone refuses while the screen shows a
   * large empty block that reads as somewhere to drop. The overlay says this
   * number instead of shrugging.
   */
  over?: number;
};

/**
 * Where this drag can land on the card, measured off the card itself.
 *
 * **Once per drag, not continuously**, and that is the whole shape of this file.
 * It replaces a `ResizeObserver` that ran for the life of the page so the room
 * check would always have live block heights — with the stable-ref-callback
 * cache and the write-only-if-changed guard that an observer feeding state
 * needs to avoid re-rendering itself in a loop. None of that is necessary any
 * more: the drop targets are no longer in the card's flow, so **the card does
 * not change while a drag is in progress**, and the only moment these numbers
 * are read is during one. One measurement at the start of the gesture is both
 * cheaper and more honest than a stream of them.
 *
 * `useLayoutEffect`, so the measurement and the overlay's first paint land in
 * the same frame — React re-renders synchronously off a layout effect, so the
 * outlines are on screen the instant a block leaves the palette rather than a
 * frame later.
 *
 * Read by attribute rather than through refs. `CardZoneBox` already emits
 * `data-zone` for its own sake and `DesignerBlock` carries `data-block-id`, so
 * two `querySelectorAll` calls per gesture replace a map of element refs that had
 * to be kept in step with what the card was rendering.
 *
 * Null while nothing is in the air; a geometry with an empty `bands` while
 * something is, but the card has nowhere to put it.
 */
export function useCardDropBands(
  cardRef: RefObject<HTMLElement | null>,
  layout: CardLayout,
  dragged: DraggedObject | null,
): CardDropGeometry | null {
  const [geometry, setGeometry] = useState<CardDropGeometry | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;

    if (!dragged || !card) {
      setGeometry(null);
      return;
    }

    setGeometry(measureCard(card, layout, dragged));
    /*
     * `dragged` is the object held in the drag context's own state, so its
     * identity changes once per gesture rather than once per pointer sample —
     * which is what keeps this from re-measuring sixty times a second while the
     * context re-renders its readers. `layout` is the draft, and only changes
     * when a drop has already ended the gesture.
     */
  }, [cardRef, layout, dragged]);

  return geometry;
}

/** The card's zones and blocks, as pixels relative to the card's own top. */
function measureCard(
  card: HTMLElement,
  layout: CardLayout,
  dragged: DraggedObject,
): CardDropGeometry {
  const cardRect = card.getBoundingClientRect();
  const drag = toCardDrag(dragged);
  const zones: ZoneMeasure[] = [];

  /*
   * How tall the block in the user's hand currently draws. Picked up in the same
   * pass that measures every other block, because a move's outline is that
   * block — its real height, not the fallback its type implies.
   */
  let movedHeight = 0;
  /*
   * And the element it was measured from, kept so it can be measured a second
   * time at the width it is about to land at — see `lineHeightOf`. Null until
   * the loop below finds it, and for a drag that has nothing on screen yet.
   */
  let movedNode: HTMLElement | null = null;
  let movedZone: HTMLElement | null = null;
  /*
   * Every block on the card by id, with the zone element it lives in — what
   * `heightAt` clones from. Collected in the same pass rather than queried again
   * per question, because a second `querySelectorAll` is a second chance for the
   * two to disagree about what is on the card.
   */
  const nodes = new Map<string, { node: HTMLElement; zone: HTMLElement }>();

  for (const zone of CARD_ZONES) {
    const element = card.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
    if (!element) continue;

    const rect = element.getBoundingClientRect();

    /*
     * The zone's own vertical padding, subtracted rather than measured a second
     * time: it is `--card-pad`, written from `layout.padding`, and only the top
     * and bottom zones pay it (`zoneClass` in components/card/card-frame.tsx).
     * What is left is the zone's *content* box, which is where blocks actually
     * sit — and a run of free space measured against anything else would put
     * every outline a few pixels off what it is promising.
     *
     * `padded` is the same condition `zoneClass` asks: an empty zone pays no
     * vertical padding, so subtracting one here would put its whole run — and
     * the mark drawn for it — a padding below where the card actually has room.
     */
    const padded = layout.zones[zone].length > 0;

    zones.push({
      zone,
      top: rect.top - cardRect.top + (padded && zone === "top" ? layout.padding : 0),
      bottom:
        rect.bottom -
        cardRect.top -
        (padded && zone === "bottom" ? layout.padding : 0),
      /*
       * The horizontal content edges, which is the width a *line* has — and
       * therefore what a block's share is a share of. Unlike the vertical
       * padding above, every zone pays this one and pays it always
       * (`CardZoneBox`'s `px-[var(--card-pad)]`), so there is no `padded`
       * condition to ask.
       *
       * `sideSlots` is the only reader: the room left beside a narrowed block
       * runs from that block's far edge to this, which is the one way to get a
       * mark that is exactly the box the block landing in it will fill.
       */
      left: rect.left - cardRect.left + layout.padding,
      right: rect.right - cardRect.left - layout.padding,
      /*
       * Still a descendant query, so it finds the two blocks inside a row
       * wrapper exactly as it finds a full-width one directly under the zone.
       * The *grouping* into lines is not read from the DOM at all — `dropSlots`
       * takes it from the layout and joins these rects on by id, because the
       * layout is what the insertion indices are indices into.
       */
      blocks: [...element.querySelectorAll<HTMLElement>("[data-block-id]")].map(
        (node) => {
          const box = node.getBoundingClientRect();
          const id = node.dataset.blockId ?? "";

          nodes.set(id, { node, zone: element });

          if (drag?.kind === "move" && drag.id === id) {
            movedHeight = box.height;
            movedNode = node;
            movedZone = element;
          }

          return {
            id,
            top: box.top - cardRect.top,
            bottom: box.bottom - cardRect.top,
            // The horizontal edges are read for the room beside a narrowed
            // block (`sideSlots`), and for the width to re-measure a line's
            // survivors at when the drag leaves it (`shrunkBy`).
            left: box.left - cardRect.left,
            right: box.right - cardRect.left,
            // And what it asked for, which is not always what it got. See
            // `wantedHeight`.
            wants: wantedHeight(node, box.height),
          };
        },
      ),
    });
  }

  const blockHeight = draggedHeight(layout, drag, movedHeight);

  // An end zone with nothing in it measures zero, and a zone with no height has
  // nowhere to drop into. See `lendToEndZones`.
  lendToEndZones(zones, layout, drag, blockHeight);

  /*
   * Whether what is in the hand is a mark — a block drawn at a square size of
   * its own rather than filling the line it lands on. Only the logo is, and it
   * is the one drag whose targets are a grid rather than a stack.
   */
  const markType = drag
    ? drag.kind === "new"
      ? drag.type
      : findBlock(layout, drag.id)?.block.type
    : undefined;
  const markSize = markType && isSelfSized(markType) ? blockHeight : 0;

  /*
   * The line's own box, which every zone shares: they all pay the card's own
   * horizontal padding and nothing else (`CardZoneBox`). Taken from whichever
   * zone was measured first rather than recomputed from the layout, so the grid
   * and the columns beside a block are laid out against the same number.
   */
  const line = zones.find((zone) => zone.left !== undefined);
  const lineBox =
    line?.left !== undefined && line.right !== undefined
      ? { left: line.left, width: line.right - line.left }
      : { left: 0, width: cardRect.width };

  /*
   * Two sources, composed rather than merged.
   *
   * `dropBands` partitions the card top to bottom — every pixel to exactly one
   * slot — which is a one-dimensional answer and the right one for a target that
   * spans the card's width. A column slot is only part of a line wide, so it has
   * no place in that partition and needs none: its band *is* its own rect. They
   * go last, and the overlay paints them last, which is what lets one win the
   * pointer inside its own box against the full-width band underneath it.
   */
  /*
   * One measurer for the whole pass, and so one cache.
   *
   * All three of these ask the same question of the same blocks — a column
   * landing about the block it lands beside, and the other two about the line
   * the drag is *leaving*, whose survivors are drawn stretched and so cannot be
   * read off their own rects (`shrunkBy` in lib/card/drop-slots.ts). Each answer
   * costs a clone in the document, so they share one.
   */
  const heightAt = heightMeasurer(layout, nodes);

  const partitioned = dropBands(
    dropSlots(
      layout,
      dragged,
      zones,
      /*
       * How tall the block will be **where these marks put it**, which is a
       * line of its own: every slot `dropSlots` returns is card-wide, because
       * `run` writes `widthPct: 100` on all of them. For a block already full
       * width that is what it draws now, and this costs nothing.
       */
      lineHeightOf(movedNode, movedZone, layout, drag, lineBox.width, blockHeight),
      heightAt,
    ),
    0,
    cardRect.height,
  );

  const vacated = vacatedSpace(layout, dragged, zones, heightAt);
  const over = overHeight(layout, zoneHeights(layout, zones));

  const columns = sideSlots(layout, dragged, zones, heightAt).map((slot) => ({
    ...slot,
    /*
     * A pair target draws the whole column it will fill but catches only the
     * middle of it, so the strips at the top and bottom of the block stay with
     * the runs above and below — see `hitTop` on `DropSlot`. Every other column
     * slot's band is its own rect, which is what the fallbacks say.
     */
    top: slot.hitTop ?? slot.y,
    bottom: slot.hitBottom ?? slot.y + slot.height,
    ...markBox(slot, markSize),
  }));

  return {
    /*
     * `splitAlignColumns` applies to the partition alone, and only to the bands:
     * a mark in the hand turns each full-width band into the three places across
     * the line a square could sit. It has to run after the partition rather than
     * before it — three slots sharing one centre would collapse the arithmetic
     * that decides which pixel belongs to whom.
     */
    bands: [...splitAlignColumns(partitioned, markSize, lineBox), ...columns],
    /*
     * And the resting layer is drawn from the partition *before* that split. The
     * split answers "where across this line could the square sit", which is a
     * fact about aiming and belongs to the hit areas and the bold mark; the faint
     * outlines answer "where is there room", and the answer to that is the run —
     * one box per free area, the same thing every other block in hand gets.
     * Merging the split bands instead gave a logo three narrow columns the full
     * height of the card, which is not a shape a logo ever lands as.
     */
    regions: dropRegions([...partitioned, ...columns]),
    /*
     * Measured in the same pass and from the same rows, so a face and the column
     * targets that carve holes in it cannot be a frame apart.
     */
    blocked: blockedFaces(layout, dragged, zones),
    /*
     * And the same rows again, read for the one fact about the space the block
     * is leaving rather than about the space it could go to. Measured here with
     * everything else because it is the same rects: a departure worked out a
     * frame later would be worked out against a card the drop has already
     * changed.
     */
    ...(vacated ? { vacate: vacated } : {}),
    /*
     * And the one fact about the card rather than about this drag: how far past
     * its own height it already reaches. Read from `zoneHeights`, which is the
     * same map `dropSlots` answers `canDrop` from, so the explanation and the
     * refusal cannot disagree — an empty `bands` and a non-zero `over` are two
     * readings of one number.
     */
    ...(over > 0 ? { over } : {}),
  };
}

/**
 * How tall a block **asked** to be, in px — which is not always how tall it is.
 *
 * A zone is a flex column, and one block in it is allowed to shrink below its
 * own content: `hours` is `flex: 0 1 auto` with `min-height: 0`, because it
 * scrolls inside itself (docs/notes/cards.md). So on a card whose design needs
 * more height than the card has, that block quietly gives up the whole surplus
 * and every rect in the zone then sums to exactly the card's height. Nothing
 * overflows and nothing looks wrong — but the room check compares those rects
 * against `layout.maxHeight` and reads back a card that is permanently, exactly
 * full, so `roomForNew` pins to 0 and every zone refuses every drop. The only
 * thing on screen is the shrunken block, drawn as a large empty area that reads
 * as free space. That is the bug this function exists to answer, and it is the
 * same shape as the leading-space one `roomForNew` already documents: the more
 * over-full the card, the more certain the refusal.
 *
 * The content element is what still knows. `blockContentStyle` stretches it to
 * `height: 100%`, but a block holding a reservation floors it as well
 * (`.card-block--empty` in app/globals.css, from `--card-empty-h`), and a floor
 * beats a percentage — so the content keeps its full height and is simply
 * clipped by the `overflow: hidden` box between it and the block. Its rect is
 * therefore the unshrunk number, and adding back the block's own padding gives
 * what the block wanted.
 *
 * For every block nothing has shrunk this returns exactly the rect it was given,
 * because the content is that rect less the padding. **Its one blind spot is a
 * shrunk block whose content is real rather than reserved** — there the content
 * is stretched to `height: 100%` with no floor under it, so it reports the
 * shrink too and this comes back level with the rect. That is what the room
 * check already did for every block before this existed, so it is never worse
 * than the old answer; it is exact for the case that produced the bug.
 *
 * `getComputedStyle` once per block per gesture, alongside the rect that is
 * already being taken — the measurement runs once when a block leaves the
 * palette, not per pointer sample. See `useCardDropBands`.
 */
function wantedHeight(node: HTMLElement, drawn: number): number {
  const content = node.querySelector<HTMLElement>("[data-block-content]");
  if (!content) return drawn;

  const style = getComputedStyle(node);
  const padding =
    (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const wants = content.getBoundingClientRect().height + padding;

  // Never *less* than what is on screen: a block drawn taller than its content
  // is a block the column stretched, and a stretch is not a shrink to give back.
  return Math.max(drawn, wants);
}

/**
 * How tall the block in the user's hand draws **on a line of its own**, in px.
 *
 * Not the same question as how tall it is right now, and the difference is a
 * bug someone watched happen. Every mark `dropSlots` draws is card-wide — `run`
 * writes `widthPct: 100` on all three of its return paths — so a block that is
 * currently sharing a line is about to be widened by the very drop these
 * numbers are describing, and text reflows: a Name is two lines at 64% of the
 * card and one line at 100%. Measured narrow, the run divides the free space by
 * a height the block will not have and, worse, charges the block below it that
 * height (`nextOffset`), so the card under the drop rises by the difference the
 * moment the block lands.
 *
 * There is no arithmetic for it. How tall a paragraph is at a given width is a
 * question only the layout engine answers, so this asks it: a clone of the
 * block, forced to the line's width, measured, and gone again inside the same
 * synchronous block. `useCardDropBands` runs in a `useLayoutEffect`, so the
 * clone never reaches a frame.
 *
 * **Only for a narrowed block being moved.** A full-width one already draws the
 * answer, and a block off the palette has nothing to clone — the common gesture
 * pays nothing. And `markSize` deliberately keeps the *current* height: a
 * self-sized logo is a square of its own and has no width to be widened to.
 *
 * The measuring itself is `measureAt` below, which answers the same question for
 * any block at any width — a column landing has to ask it too, and about the
 * block it is landing *beside* as well as the one in the hand.
 *
 * The clone is stripped of `data-block-id` before it is attached. The attribute
 * is how every other pass in this file finds a block, and a second element
 * answering to an id would be a measurement of a thing that is not on the card.
 *
 * **And of the narrow rendering's `zoom`, which is the whole reason a clone is
 * not simply the block again.** A narrowed block shrinks its own content
 * (`contentZoom`, `blockBox` in packages/shared/card-layout.ts, applied by
 * `blockContentStyle` to the child inside it), so a clone stretched to the full
 * line still draws text at the small size and comes back four pixels short of
 * the truth. At 100% there is no zoom, so the clone must not have one either.
 * `overflowWrap: anywhere` goes with it for the same reason — it is the other
 * half of what being narrow does to this block, and a URL that only breaks
 * mid-token when the column is narrow measures a different number of lines.
 */
function lineHeightOf(
  node: HTMLElement | null,
  zone: HTMLElement | null,
  layout: CardLayout,
  drag: CardDrag | null,
  lineWidth: number,
  current: number,
): number {
  if (!node || !zone || drag?.kind !== "move" || lineWidth <= 0) return current;

  const found = findBlock(layout, drag.id);
  if (!found || shareOf(found.block) >= 100) return current;

  // A clone that measured nothing tells us nothing — an image still loading, a
  // block the browser declined to lay out. What is on screen is the better
  // guess than zero.
  return measureAt(node, zone, lineWidth) || current;
}

/**
 * One block, as tall as it would draw at a given width — asked of the layout
 * engine, because nothing else can answer it.
 *
 * A clone of the block, forced to that width, measured, and gone again inside
 * the same synchronous block. `useCardDropBands` runs in a `useLayoutEffect`, so
 * the clone never reaches a frame.
 *
 * The clone is stripped of `data-block-id` before it is attached. The attribute
 * is how every other pass in this file finds a block, and a second element
 * answering to an id would be a measurement of a thing that is not on the card.
 *
 * **And of the narrow rendering's `zoom`, which is the whole reason a clone is
 * not simply the block again.** A narrowed block shrinks its own content
 * (`contentZoom`, `blockBox` in packages/shared/card-layout.ts, applied by
 * `blockContentStyle` to the child inside it), so a clone stretched to the full
 * line still draws text at the small size and comes back four pixels short of
 * the truth.
 *
 * That cuts the other way too, now that a *column* asks this as well: a
 * full-width block being measured at 39% of the line has to be given the zoom it
 * does not have yet, or it comes back too tall. `NARROW_CONTENT_SCALE` is the
 * one number `blockBox` applies, and the condition here is the same one — see
 * `contentZoom` there.
 *
 * Zero when there is nothing to measure or the answer is nothing, so a caller
 * can `||` its way to whatever it already knew.
 */
function measureAt(
  node: HTMLElement,
  zone: HTMLElement,
  width: number,
  /**
   * The zoom the block's content would carry at that width, from
   * `blockBox`. `undefined` is the unzoomed rendering — full width, or one of
   * the types `UNZOOMED` exempts.
   */
  contentZoom?: number,
): number {
  if (width <= 0) return 0;

  const clone = node.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-block-id");
  for (const element of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
    element.style.removeProperty("zoom");
    element.style.removeProperty("overflow-wrap");
  }
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  // `flex` and `maxWidth` because the block carries a narrowed basis of its own
  // (`blockBox`), and an explicit width alone would lose to it.
  clone.style.flex = "none";
  clone.style.maxWidth = "none";
  clone.style.width = `${String(width)}px`;

  if (contentZoom !== undefined) {
    const content = clone.querySelector<HTMLElement>("[data-block-content]");
    if (content) content.style.zoom = String(contentZoom);
    // The other half of what being narrow does to a block: a URL that only
    // breaks mid-token in a narrow column measures a different number of lines.
    clone.style.overflowWrap = "anywhere";
  }

  zone.append(clone);
  const { height } = clone.getBoundingClientRect();
  clone.remove();

  return height > 0 ? height : 0;
}

/**
 * How tall any block on the card would draw at a given share of the line —
 * the question `sideSlots` has to ask before it can say what a column landing
 * costs the line below it.
 *
 * Cached by block and width, because a card of four lines asks it several times
 * for the same two answers and each one is a forced layout. The cache lives for
 * one gesture, which is exactly how long the card is guaranteed not to change.
 *
 * The zoom comes from `blockBox` asked about the block *as it would be* — a
 * width it does not have yet — rather than from a rule spelled out again here,
 * so the one place that decides when content shrinks goes on being the only one.
 *
 * Falls back to whatever the caller already knew when there is nothing to
 * measure: a block off the palette has no node, and a clone can measure zero
 * while an image is still loading.
 */
function heightMeasurer(
  layout: CardLayout,
  nodes: ReadonlyMap<string, { node: HTMLElement; zone: HTMLElement }>,
): HeightAt {
  const cache = new Map<string, number>();

  return (id, widthPct, widthPx, fallback) => {
    const key = `${id}:${String(Math.round(widthPx))}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;

    const found = findBlock(layout, id);
    const at = nodes.get(id);
    if (!found || !at) return fallback;

    const { contentZoom } = blockBox(
      widthPct >= 100
        ? withoutWidth(found.block)
        : { ...found.block, widthPct },
      layout,
    );

    const measured = measureAt(at.node, at.zone, widthPx, contentZoom) || fallback;
    cache.set(key, measured);

    return measured;
  };
}

/** The same block at full width, which is the *absence* of a width. */
function withoutWidth(block: CardBlock): CardBlock {
  const next = { ...block };
  delete next.widthPct;
  delete next.half;

  return next;
}

/**
 * A column slot, redrawn as the square a mark actually lands as.
 *
 * `sideSlots` measures the *room* beside a block, which is the right box for
 * anything that fills the column it lands in and the wrong one for a logo: a
 * mark takes a square of its own out of that room and leaves the rest, so
 * promising the whole rectangle promises a block that is never drawn. The room
 * is still what catches the pointer — a 62px square is not something anyone can
 * aim at — which is the same draw/hit split `splitAlignColumns` makes across a
 * full-width band, and the reason `hitLeft` and `hitWidth` exist at all.
 *
 * Cut here rather than in `sideSlots` because the size is a measured pixel
 * count: `markSize` is the block's own rect from the pass above, while the slot
 * geometry it is being fitted into is in the same units the layout is written
 * in. The two agree closely, never exactly.
 *
 * **Not lifted for the overlap, unlike a run's own slots.** `liftOf` in
 * lib/card/drop-slots.ts draws a mark where the pull-up actually puts the block,
 * and that correction stops at the column targets deliberately: a block landing
 * here joins a flex *row*, where a negative `margin-top` moves it inside that
 * row rather than moving the row, and what a logo joining a line should do about
 * the line above it is a question nobody has answered yet. Answer it there, not
 * by guessing here.
 *
 * Empty for a drag that is not a mark, and for a seam, which has no box to cut.
 *
 * **And for a target that has already cut its own.** The two columns a mark makes
 * of a full-width line (`pairTargets`) know where the square goes better than
 * this does: it belongs at each *end* of the line, and the arithmetic that puts
 * it there needs the line, which this function has not got. They arrive carrying
 * `hitLeft`, which is the flag as well as the geometry — a slot that has
 * separated its drawn box from its hit area has already made this decision.
 */
function markBox(
  slot: DropSlot,
  markSize: number,
): Partial<DropSlot> & { mark?: boolean } {
  if (slot.hitLeft !== undefined) return {};
  if (markSize <= 0 || slot.width === undefined || slot.height <= 0) return {};

  // Never wider than the room it sits in: a run only just big enough for the
  // mark would otherwise draw a square hanging over the block beside it.
  const size = Math.min(markSize, slot.width, slot.height);

  return {
    mark: true,
    // The room, unchanged, is what the pointer aims at.
    hitLeft: slot.left,
    hitWidth: slot.width,
    // The square sits at the run's own start, which is where the row puts it:
    // a mark on a line follows whatever is before it with a gap, and the room
    // left over is what this slot was measured from.
    width: size,
    height: size,
  };
}

/**
 * How tall the thing in the user's hand is, in px.
 *
 * A block already on the card knows: it is on screen, and it was measured in the
 * pass above. One coming off the palette does not exist yet, so it gets what its
 * type implies — a gallery's 25% of the card, a spacer's 6%, and a line of text
 * for everything that grows to its content. That last one is a floor rather than
 * a promise (`MIN_BLOCK_HEIGHT`), and it is the number the free space is divided
 * by, so a card offers roughly as many places for a name as it has lines of room.
 */
function draggedHeight(
  layout: CardLayout,
  drag: CardDrag | null,
  movedHeight: number,
): number {
  if (!drag) return 0;
  if (drag.kind === "new") return newBlockHeight(layout, drag.type);

  const found = findBlock(layout, drag.id);
  if (!found) return 0;

  return movedHeight > 0 ? movedHeight : newBlockHeight(layout, found.block.type);
}
