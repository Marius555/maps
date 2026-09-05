"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type CSSProperties } from "react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import { useDropTarget } from "@/components/groups/use-row-drag";
import {
  CARD_BLOCK_ROW_CLASS,
  movingBlockMotion,
} from "@/components/ui/list-row-motion";
import type { CardDrag, CardDropTarget } from "@/lib/card/card-edits";
import type { VacatedSpace } from "@/lib/card/drop-slots";
import type { MapField, Place } from "@/lib/repositories/types";
import type { TagChip } from "@/packages/shared/tags";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import {
  CARD_ZONES,
  cardRows,
  detailsContents,
  type CardBlock,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";
import {
  CardBlockContent,
  hasBlockContent,
  type CardBlockData,
} from "../card-block";
import {
  CardFrame,
  CardLead,
  CardZoneBox,
  blockContentStyle,
  blockEdges,
  blockStyle,
  cardRowStyle,
} from "../card-frame";
import type { BlockResize } from "./block-resize-handle";
import { CardDropOverlay } from "./card-drop-overlay";
import { DesignerBlock } from "./designer-block";
import { useCardDropBands } from "./use-drop-bands";

/**
 * The card, with handles on it.
 *
 * Not a preview of the card — the card itself, through the same `CardFrame` and
 * the same block renderers the editor's own place card uses. A studio that drew
 * its own approximation would be a studio that can promise a card the map does
 * not produce.
 *
 * **The designer's chrome is not in the card.** That is the rule this file is
 * built around, and it is stronger than the one it replaces. There used to be a
 * dashed lane in the flex column at every place a block could land, and it was
 * held to "none of this chrome may resize anything" by keeping every lane to one
 * fixed 8px height — a rule that was violated anyway, because the lanes were
 * *inserted*, so picking a block up added a row of them and pushed the card's
 * contents around. It also could not hold: two lanes either side of a 2px
 * divider drew over each other, and the lane nested inside a block's own
 * `overflow-hidden` wrapper had its indicator clipped away and painted as a
 * stub.
 *
 * Now the only thing the designer adds inside the card is a selected block's own
 * frame — a box-shadow, which cannot reflow anything — and, while a drag is in
 * the air, one absolutely positioned overlay above everything (see
 * `card-drop-overlay.tsx`). Nothing in the card's layout changes when a gesture
 * starts, so the drop targets are free to be as large as they need to be — they
 * cover the whole card between them — while what is *drawn* is at the size of
 * the block rather than of its share of the card: every area the block could go
 * into, faintly, for the whole drag, with the one under the pointer bold. The
 * lines that already have something on them are drawn too, hatched, because they
 * are the one place the gesture refuses.
 */
export function CardCanvas({
  layout,
  place,
  tagChips,
  fields,
  pinIcons,
  selectedId,
  justLanded,
  onSelect,
  onDrop,
  onVacate,
  onResize,
  sampleImageUrl,
  onSampleImage,
}: {
  layout: CardLayout;
  place: Place;
  /** The sample location's tags, resolved — see `CardBlockData`. */
  tagChips: readonly TagChip[];
  fields: MapField[];
  /** The map's pins — what a Logo block draws. */
  pinIcons: CustomPinIcon[];
  selectedId: string | null;
  /**
   * The block that arrived from the palette on the last drop, if the settle
   * animation for it has not finished yet. See `landedBlockMotion`.
   */
  justLanded: string | null;
  onSelect: (id: string | null) => void;
  onDrop: (dragged: CardDrag, target: CardDropTarget) => void;
  /**
   * The space the block in the hand would free, reported for the length of the
   * gesture — or null once there is nothing in the air.
   *
   * The card is the only thing that can measure this, and the *removal wall* is
   * the thing that needs it: dropping a block there deletes it, and a deletion
   * has to hand the space it opens to the line below or everything under it
   * rides up (`removeCardBlock`). The wall is a sibling of this component rather
   * than a child, so the answer goes up rather than across.
   */
  onVacate?: (freed: VacatedSpace | null) => void;
  /** `commit` is false while a handle is held, true once on release. */
  onResize: (id: string, patch: BlockResize, commit: boolean) => void;
  /** A local stand-in for a gallery block with nothing of its own to show. */
  sampleImageUrl: string | null;
  onSampleImage: (file: File) => void;
}) {
  const { dragged } = useRowDragState();

  /*
   * Where this drag could land, measured off the card once when it starts.
   *
   * Null at rest, so none of this costs anything until something is picked up —
   * and the measurement is honest because, with the chrome out of the layout,
   * the card cannot change for the length of the gesture.
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const geometry = useCardDropBands(cardRef, layout, dragged);

  /*
   * And out to whoever owns the removal wall.
   *
   * An effect rather than a call during render: this is a side effect on
   * something outside the tree, and `geometry` already changes on every pointer
   * move, so it costs nothing extra. The null at the end of a gesture matters as
   * much as the value — a stale measurement applied to a later delete would give
   * the wrong block the wrong space.
   */
  const freed = geometry?.vacate ?? null;
  useEffect(() => {
    onVacate?.(freed);
  }, [freed, onVacate]);

  /*
   * There is no fit pass here any more, and its absence is the feature.
   *
   * A `useCardFits` used to measure the card after every change and, when the
   * total came out over `maxHeight`, write a *smaller* layout back to the draft
   * — trimming the empty space above the lower blocks, then shrinking the photo.
   * It held the card together while something grew and had nothing to give back
   * when that something shrank again, so opening and closing one week of opening
   * hours walked every block below it up the card and left it there. A preview
   * gesture was editing the saved design.
   *
   * The room is given and taken in CSS instead — see `leadBox` in
   * packages/shared/card-layout.ts — which is symmetric by construction, lands in
   * the same frame, and saves nothing. What no amount of slack can fit, the
   * middle zone scrolls, exactly as a published card does.
   */

  /*
   * There is deliberately no "this block is about to be paired with" state here.
   *
   * It used to light the target block with the same solid accent ring a selected
   * block wears, on top of the two dashed column marks already drawn over it —
   * so a single pair drop showed a solid ring, a dashed outline and (wherever
   * the run above happened to be a seam) a solid rule, all saying the same thing
   * in three vocabularies. The marks are the answer: they are drawn at the size
   * and position of the two columns the line is about to become, which is more
   * than a ring around the block could say. See `card-drop-overlay.tsx`.
   */
  const data: CardBlockData = {
    place,
    tagChips,
    fields,
    pinIcons,
    folded: detailsContents(layout),
    // The one flag every designer-only difference reads. See `CardBlockData`:
    // the blocks used to infer this from `onSampleImage` being present, which
    // is true but says nothing about why.
    isDesigner: true,
    sampleImageUrl,
    onSampleImage,
  };

  /*
   * A catch-all for the card's own body, registered beneath the overlay.
   *
   * `.closest("[data-drop-id]")` walks up from wherever the pointer released, so
   * a drop that lands on the card with no slot beneath it — the scrim is
   * `pointer-events: none` — still finds *this* target rather than nothing, and
   * no-ops: the layout is unchanged, same as a sloppy drop always has been. What
   * it changes is what "nothing" means afterwards — see `onDroppedOutside` on
   * DesignerBlock, which only fires when the release point isn't over the card
   * at all.
   */
  const { targetProps: frameDropProps } = useDropTarget({
    id: "card:frame",
    // Both kinds of drag, so a palette chip released on a block's own face is a
    // no-op with a target behind it rather than a release into nothing.
    accepts: (candidate) =>
      candidate.type === "card-block" || candidate.type === "card-new",
    onDrop: () => {},
  });

  /**
   * The zones this layout puts blocks in.
   *
   * The card's vertical padding belongs to the first and last of these, which
   * is `CardView`'s rule and now this one too — the canvas used to hang the
   * padding on the zones *named* top and bottom, so a layout with an empty top
   * zone drew its first line flush against the card's edge here and inset over
   * there. One rule, both files. See `zoneClass` in ../card-frame.tsx.
   */
  const filled = CARD_ZONES.filter((zone) => layout.zones[zone].length > 0);

  const renderZone = (zone: CardZone) => {
    const blocks = layout.zones[zone];
    /*
     * Paired from the layout itself, not from what this sample location happens
     * to fill in — the studio is where a card is *arranged*, so a block with
     * nothing to show has to stay visible, selectable and draggable. `CardView`
     * pairs its own filtered list instead; see the comment there.
     */
    const rows = cardRows(blocks, layout);

    const designerBlock = (
      block: CardBlock,
      style: CSSProperties,
      onRow: boolean,
    ) => (
      <DesignerBlock
        key={block.id}
        block={block}
        layout={layout}
        zone={zone}
        isSelected={selectedId === block.id}
        onRow={onRow}
        justLanded={justLanded === block.id}
        onSelect={() => onSelect(block.id)}
        onResize={(patch, commit) => onResize(block.id, patch, commit)}
        style={style}
      >
        {/* See the same wrapper in card-view.tsx: a narrowed block shrinks its
            content without shrinking its own flex basis with it.

            `data-block-content` is how `measureAt` finds this div in a clone —
            it is the element the zoom sits on, and a block measured at a width
            it is not currently drawn at has to be given the zoom that width
            implies. Named rather than reached for by position, because "the
            first child of the first child" is a fact about this file that the
            measuring code has no business knowing. */}
        <div
          data-block-content
          // The same floor a real card gives an empty block, so the space this
          // canvas holds for one is the space that card will hold. Four of them
          // draw a hint here and nothing there; see `.card-block--empty`, and
          // `card-view.tsx` for why it sits on the content rather than the box.
          className={
            hasBlockContent(block.type, data, block)
              ? undefined
              : "card-block--empty"
          }
          style={blockContentStyle(block, layout)}
        >
          <CardBlockContent block={block} data={data} />
        </div>
      </DesignerBlock>
    );

    return (
      // No blocks means no vertical padding, so the studio leaves exactly the
      // gap a card whose zone was omitted leaves — which is every other
      // renderer. See `zoneClass` in ../card-frame.tsx.
      <CardZoneBox
        key={zone}
        zone={zone}
        // Every zone stays in the DOM — here because it is a drop target and a
        // thing to measure, and on the other two surfaces because the middle one
        // is the `flex-1` that pins the bottom strip. An empty one says so and
        // pays no padding. See `zoneClass`.
        hasBlocks={blocks.length > 0}
        padTop={zone === filled[0]}
        padBottom={zone === filled[filled.length - 1]}
      >
        {/*
          * `mode="popLayout"` because a line no longer collapses its own height
          * on the way out — travel and the space it leaves behind both belong to
          * the blocks now (see `movingBlockMotion`). Left in flow, a fading line
          * would hold its full height for the length of the fade and the card
          * would only close up 150ms later, in a second movement. Popped, it is
          * out of the column in the frame the drop lands in, and its neighbours
          * start sliding immediately.
          */}
        {/*
          * `custom` is the card as it is *after* whatever edit is unmounting a
          * line, and it is the only way an exiting row can ask a question about
          * it — a removed component's props can no longer be updated. See
          * `movingBlockMotion`, which uses it to tell a line whose block was
          * deleted from one that was merely re-paired.
          */}
        <AnimatePresence initial={false} mode="popLayout" custom={layout}>
          {rows.flatMap((row) => {
            const { outer, rest } = splitOuterBox({
              ...blockStyle(row.blocks[0], layout),
              ...blockEdges(
                row.blocks[0],
                layout,
                zone,
                row.index === 0,
                row.end === blocks.length,
              ),
            });

            return [
              /*
               * The line's leading space, as a box of its own that gives way —
               * see `CardLead`. A **sibling** rather than a wrapper, and keyed,
               * because `AnimatePresence` only tracks its own direct children:
               * a fragment holding the pair would hide the row from it and cost
               * the exit animation. It renders null when there is no space,
               * which `AnimatePresence` is happy to be handed.
               */
              <CardLead
                key={`${row.blocks[0].id}:lead`}
                row={row}
                layout={layout}
              />,
              /*
               * The **row** is what arrives and leaves, and it has to be,
               * because `AnimatePresence` only tracks its own direct children —
               * a pair wrapped in a plain div would lose its exit entirely.
               *
               * It is no longer what *travels*. A line has no identity that
               * survives an edit: narrowed blocks are paired by adjacency, so
               * swapping two of them or pulling one out of a pair rebuilds the
               * rows and this element stops existing however it is keyed —
               * which is exactly why a narrowed block used to snap while a
               * full-width one glided. Travel moved down to `DesignerBlock`,
               * whose id is stable for the block's whole life. See
               * `movingBlockTravel`.
               *
               * Keyed on the first block rather than on the pair, so a partner
               * arriving beside an existing narrowed block *adds a child* to a
               * row that is already mounted instead of collapsing it and
               * growing a new one. A card with nothing narrowed on it is one row
               * per block, keyed by that block, which is precisely the tree this
               * rendered before rows existed.
               */
              <motion.div
                key={row.blocks[0].id}
                // The Locations panel's own vocabulary — 150ms and the same
                // curve — so a block settling into the card moves at exactly
                // the speed a row settles into that list. One definition, in
                // components/ui/list-row-motion.ts.
                //
                // It is handed the block this row is keyed on and whether that
                // block is new to the *card*, because a line coming or going is
                // not by itself either: re-pairing rebuilds rows around blocks
                // that never moved, and a line built around one of those must
                // not announce itself. `justLanded` is the one arrival that is
                // real — a block off the palette.
                {...movingBlockMotion(
                  row.blocks[0].id,
                  row.blocks.some((block) => block.id === justLanded),
                )}
                // Not the Locations panel's own row class: that one carries
                // its list's gap as 2px of padding inside the animated element,
                // and `CardZoneBox` already pays `gap-[var(--card-gap)]`. Two
                // pixels per boundary is a card the studio draws slightly
                // taller than the embed does — and, now that a drop slot is
                // arithmetic over measured gaps, two pixels of drift per slot
                // between the outline and where the block lands.
                className={CARD_BLOCK_ROW_CLASS}
                // The bleed's negative margin lives here, on the actual flex
                // item, not on DesignerBlock nested inside it — see
                // splitBleedMargin's own comment for why that nesting depth
                // is what makes the difference. A row of halves never carries
                // one: a narrowed block cannot bleed (see `blockBox`), which is
                // what stops a pair being two card-paddings wider than the card.
                style={row.shared ? undefined : outer}
              >
                {row.shared ? (
                  <div style={cardRowStyle(row, layout)}>
                    {/*
                      * Each member carries its own edges, the way `CardView` and
                      * the embed have always given them. This used to hand a
                      * shared row nothing but `blockStyle`, which silently threw
                      * away every block's `blockEdges` — harmless while only a
                      * full-width block could overlap anything, and wrong the
                      * moment a logo can share a line: its 50% pull up over the
                      * photo above is a negative `margin-top` on the mark alone,
                      * and dropping it left the mark sitting *below* the photo
                      * with its neighbours.
                      */}
                    {row.blocks.map((block) =>
                      designerBlock(
                        block,
                        {
                          ...blockStyle(block, layout, true),
                          /*
                           * The **line's** ends, the same two numbers the lone
                           * branch above passes, and the same for every member
                           * of the row. A block is pulled over the line above
                           * it, so counting blocks instead made the second
                           * member of a zone's first line pull itself up out of
                           * that zone — and made the pull switch off the moment
                           * its line-mate left, dropping a logo nobody had
                           * touched by half its own height. See `upwardLiftOf`.
                           */
                          ...blockEdges(
                            block,
                            layout,
                            zone,
                            row.index === 0,
                            row.end === blocks.length,
                            true,
                          ),
                        },
                        true,
                      ),
                    )}
                  </div>
                ) : (
                  designerBlock(row.blocks[0], rest, false)
                )}
              </motion.div>,
            ];
          })}
        </AnimatePresence>
      </CardZoneBox>
    );
  };

  return (
    <CardFrame
      ref={cardRef}
      layout={layout}
      // A real height, not just a cap: the designer is where someone decides how
      // tall the card is, so it has to show them that height even when today's
      // sample location does not fill it.
      style={{ height: `${String(layout.maxHeight)}px` }}
      /*
       * An inset ring, not a border, and that is load-bearing.
       *
       * This outline is the studio's own — the real card only draws one when its
       * owner sets `borderWidth` — and a `border` takes space out of the box it
       * is on. `height` above is the card's *whole* height, so 1.6px of hairline
       * came off the middle zone's content: `usedHeight` said the card was
       * exactly full at 440 while the zone had 438.4 to give it, and the studio
       * showed a scrollbar on a card that fits. A ring is a box-shadow, so it
       * draws the same line and reflows nothing. `DesignerBlock` uses the same
       * trick on its selection ring, for the same reason.
       */
      className="relative inset-ring inset-ring-border"
      renderZone={renderZone}
      rootProps={frameDropProps}
    >
      {/*
       * `AnimatePresence` is what gives the overlay an exit at all. The geometry
       * is nulled the instant the pointer goes up (`useCardDropBands`), so
       * without this the whole layer — scrim, marks and all — vanished in the
       * same frame the block landed in. AnimatePresence keeps the removed child
       * mounted with its last props for the length of the fade; the `key` is
       * what identifies it across that removal.
       */}
      <AnimatePresence>
        {geometry ? (
          <CardDropOverlay key="drop" geometry={geometry} onDrop={onDrop} />
        ) : null}
      </AnimatePresence>
    </CardFrame>
  );
}

/**
 * The properties that have to sit on the **flex item**, split from the ones that
 * belong on the block itself.
 *
 * `CardView` (the read-only card) has no wrapper — a block's own div *is* the
 * zone's flex item, and a negative margin on a flex item shrinks that item's
 * own contribution to the flex column's height the same way it shifts the
 * item's box, so the next zone starts exactly where the bled content visually
 * ends. Here, DesignerBlock sits one level deeper, inside the `motion.div`
 * this file wraps it in for the reorder/removal animation — and a negative
 * margin on a *child* of that plain (non-flex) wrapper only pulls the child
 * up within it, while the wrapper's own auto-height still shrinks by the same
 * amount. The wrapper is the actual flex item, so *it* ends up too short for
 * what it's showing, and the next zone starts inside the bleeding block
 * instead of after it.
 *
 * The fix is to put the margin on the flex item itself — the wrapper — and
 * leave every other sizing property (height, width, padding) on DesignerBlock,
 * matching CardView's own box exactly one level down.
 *
 * The stacking pair goes with it, for a related reason: what has to paint over
 * the block beside it is the whole flex item, and a z-index on something nested
 * inside a wrapper Motion may have given a transform is a z-index in a stacking
 * context of its own. Both blocks' wrappers are siblings, which is where the
 * comparison has to happen.
 *
 * And so does the pair that positions a self-sized block — the logo, which has a
 * width of its own and an `align-self` deciding where that width sits across the
 * zone. `align-self` only means anything on a flex item, and left on the block it
 * would be read by a wrapper that is not one: the logo drew at its right size and
 * sat at the left edge whatever its owner had chosen. `CardView` has no wrapper,
 * so it never showed this.
 *
 * **Only ever called for a row of one**, which is what makes that safe: a
 * narrowed block is a direct child of the row div, `blockStyle` reaches it
 * untouched, and its own `align-self` — which is vertical there — stays where it
 * belongs.
 */
function splitOuterBox(
  style: CSSProperties,
): { outer: CSSProperties; rest: CSSProperties } {
  const {
    marginInline,
    marginTop,
    marginBottom,
    position,
    zIndex,
    width,
    alignSelf,
    ...rest
  } = style;

  return {
    outer: {
      marginInline,
      marginTop,
      marginBottom,
      position,
      zIndex,
      width,
      alignSelf,
    },
    rest,
  };
}
