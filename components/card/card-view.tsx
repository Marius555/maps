"use client";

import {
  CARD_ZONES,
  cardRows,
  detailsContents,
  type CardBlock,
  type CardLayout,
  type CardRow,
  type CardZone,
} from "@/packages/shared/card-layout";
import type { MapField, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { TagChip } from "@/packages/shared/tags";
import { overrideBlock, type CardBlockOverrides } from "@/packages/shared/card-overrides";
import { CardBlockContent, hasBlockContent, type CardBlockData } from "./card-block";
import {
  CardFrame,
  CardLead,
  CardZoneBox,
  blockContentStyle,
  blockEdges,
  blockStyle,
  cardRowStyle,
} from "./card-frame";

/**
 * A location's card, drawn from the layout its owner designed.
 *
 * The read-only half: no handles, no drop targets, nothing the designer adds.
 * The designer renders the same blocks through the same frame with chrome around
 * them, which is what makes the studio honest — it is not previewing the card,
 * it is showing it.
 */
export function CardView({
  layout,
  place,
  fields,
  tagChips,
  pinIcons,
  className,
  renderEmptyState,
  renderSlot,
  blockOverrides,
  renderOverlay,
  children,
  ref,
}: {
  layout: CardLayout;
  place: Place;
  fields: MapField[];
  /**
   * This location's tags, already resolved by whoever holds the map's vocabulary
   * and **in the location's own order** — see `CardBlockData`. Defaulted,
   * because a caller drawing a card on a map with no tags has nothing to
   * resolve.
   */
  tagChips?: readonly TagChip[];
  /** The map's pins — where a Logo block's picture comes from. */
  pinIcons: CustomPinIcon[];
  className?: string;
  /**
   * What to draw when this location has filled in nothing but its name.
   *
   * Optional, and the embed never passes it: what belongs here is an invitation
   * to go and edit the location, which is a sentence only its owner can act on.
   * A visitor gets the card as it stands.
   */
  renderEmptyState?: () => React.ReactNode;
  /**
   * What to draw *instead of* a block whose content this location has not filled
   * in — the dashed slot with a `+` in it, on the editor's own card.
   *
   * Returning null (which is the common answer, for every block that did draw)
   * leaves the block exactly as it was, so a card whose caller passes nothing is
   * byte-for-byte the card it drew before this existed. The seam is here rather
   * than inside `CardBlockContent` because the slot has to sit in the block's
   * own box, at the block's own size and position — that is the whole promise:
   * filling one in moves nothing else on the card.
   *
   * Editor-only, for `renderEmptyState`'s reason one level down. The embed
   * passes nothing: "add opening hours" is not a sentence a visitor to a
   * customer's site can act on, and the machinery behind it — a PATCH, a tag
   * vocabulary, a photo upload — is the dashboard's (CLAUDE.md §2, §4).
   */
  renderSlot?: (block: CardBlock) => React.ReactNode;
  /**
   * How *this* location's card differs from the design, keyed by block id.
   *
   * Applied before anything else reads a block, because a width or an overlap
   * decides how blocks pair into lines -- see `overrideBlock`. Absent, and for
   * the overwhelming majority of locations that have singled nothing out, every
   * block is the design's own and this card is byte-for-byte the card it drew
   * before any of this existed.
   */
  blockOverrides?: CardBlockOverrides | null;
  /**
   * What to draw *over* a block, on top of whatever it already shows -- the
   * press target that opens its own settings in edit mode.
   *
   * **An overlay, where `renderSlot` is a replacement**, and the two differ for
   * a reason rather than by accident. A slot's whole job is to *be* the content
   * of a block that has none, so it takes the block's own box and the block
   * draws nothing else. An editor's job is the opposite: the content has to stay
   * on screen, because what is being edited is what you are looking at. So this
   * renders beside the content rather than instead of it, inside the same box so
   * it inherits the block's size and position without knowing either.
   *
   * Returning anything at all also puts the block's own content behind `inert`
   * and marks the box `card-block-editable`, which is what breathes for as long
   * as the mode is on. Both are this component's to do rather than the caller's:
   * one needs the element the content lives in, the other the element that owns
   * the clip, and neither is reachable from an overlay rendered inside the box.
   *
   * Every block alike, whether it drew content or an invitation. This used to
   * hand the caller an `isEmpty` so a target could outline an empty block and
   * lift a filled one; the two affordances are now the mode and the pointer
   * rather than two kinds of block, so nothing downstream needs to know — see
   * `CardEditTarget`.
   *
   * Editor-only, on `renderSlot`'s terms one level down: the embed passes
   * nothing and has no idea it exists (CLAUDE.md §2, §4).
   */
  renderOverlay?: (block: CardBlock) => React.ReactNode;
  /** Chrome outside the layout — the close button, the Edit footer. */
  children?: React.ReactNode;
  /**
   * The card's own box.
   *
   * Editor-only in practice, and `PlaceCard` is what wants it: the per-pin
   * block editor is a portalled popover anchored to *this* element rather than
   * to the pencil that opened it, because a block crossing 100% width changes
   * its DOM parent and takes anything inside it with it. The card cannot move
   * for any edit made in that panel, which is the whole property being bought.
   * `CardFrame` has always taken one, for the designer's drop geometry.
   */
  ref?: React.Ref<HTMLDivElement>;
}) {
  const data: CardBlockData = {
    place,
    fields,
    tagChips: tagChips ?? [],
    pinIcons,
    folded: detailsContents(layout),
  };

  /**
   * The zones this layout puts blocks in, worked out before any of them
   * renders.
   *
   * Needed up front because the card's vertical padding belongs to the first
   * and last of *these*, not to the zones named top and bottom — see
   * `zoneClass` in card-frame.tsx for the bug that came of confusing the two.
   *
   * A fact about the *layout* rather than about this location, which it did not
   * used to be: it asked which zones had something to draw, so the same design
   * moved its padding around from pin to pin. Nothing is dropped per location
   * any more (see `renderZone`), so the two questions have the same answer for
   * every location on the map — which is the whole point.
   */
  const filled = CARD_ZONES.filter((zone) => layout.zones[zone].length > 0);

  const renderZone = (zone: CardZone) => {
    /*
     * **Every block the layout names, whether or not this location filled it
     * in.** A card is the design its owner arranged, and a block that vanished
     * on a half-filled location took the blocks under it up the card with it —
     * so the same saved design drew a different card on every pin, at positions
     * the studio had never shown anybody.
     *
     * What an empty block draws is nothing: an empty box, its own padding, the
     * gap after it, and its designed height if it has one. That is exactly what
     * the designer's canvas has always drawn for a block the sample location
     * left blank, which is what makes the two agree. `hasBlockContent` is still
     * asked — it decides the floor an empty box gets (`card-block--empty`) and
     * it still answers `isBare` below — it just no longer decides whether a
     * block exists.
     */
    /*
     * Each one as *this* location draws it -- see `blockOverrides`.
     *
     * Here rather than anywhere further down, because everything below reads a
     * block: `cardRows` pairs on widths, `blockStyle` and `blockEdges` size and
     * space them, and `hasBlockContent` decides whether the box holds its floor.
     * Overriding after any of those would draw a card the pairing never agreed
     * to. `overrideBlock` returns the design's own block untouched for every
     * location that has singled nothing out, which is nearly all of them.
     */
    const blocks = layout.zones[zone].map((block) =>
      overrideBlock(block, blockOverrides),
    );

    /*
     * Paired over the layout, which is what the designer pairs over.
     *
     * It used to pair over the survivors, so an untagged location closed the
     * hole where its chips would have been and let the Name and the Address
     * either side share a line. That was the right call while blocks could
     * vanish and is the wrong one now: the lines a real card draws are the
     * lines the studio drew, on every location alike.
     */
    const rows = cardRows(blocks, layout);

    /*
     * `row`, not the block's own index, and that is the whole of what the two
     * booleans mean: a block is pulled over the *line* above it, so every member
     * of the zone's first line has the same nothing above it. Counting blocks
     * instead made a logo's overlap switch on and off as its line-mates came and
     * went — see `upwardLiftOf` in packages/shared/card-layout.ts.
     */
    const blockView = (block: CardBlock, row: CardRow, onRow: boolean) => {
      const slot = renderSlot?.(block) ?? null;

      const overlay = renderOverlay?.(block) ?? null;

      /*
       * The content, as one node, because in edit mode it is rendered inside a
       * wrapper and out of it it is not — and building it twice would be two
       * subtrees React remounts between as edit mode is toggled.
       */
      const content = slot ?? <CardBlockContent block={block} data={data} />;

      return (
        <div
          key={block.id}
          style={{
            ...blockStyle(block, layout, onRow),
            ...blockEdges(
              block,
              layout,
              zone,
              row.index === 0,
              row.end === blocks.length,
              onRow,
            ),
          }}
          // overflow-hidden for the same reason DesignerBlock's own content
          // box has it: a narrowed block's image must clip to its own box
          // rather than poke past it. Cheap insurance here specifically,
          // since nothing on this read-only path currently rounds a block's
          // own corners the way the designer's selection state does.
          //
          // `card-block-editable` is the breathing every block does while edit
          // mode is on, and it is on *this* element rather than on the content
          // box because this is the element that owns the clip: a transform on
          // the content would grow it into its own parent's `overflow: hidden`
          // and be cut off on every pass (app/globals.css).
          className={`min-w-0 overflow-hidden${
            overlay ? " card-block-editable" : ""
          }`}
        >
          {/* A second element only because a half shrinks its content and must
              not shrink its own flex basis with it. It is an empty style object
              for every other block, so the extra div costs nothing anyone can
              see.

              `card-block--empty` is the floor an empty block holds, and it is on
              *this* element rather than on the box above deliberately: the embed
              applies its own copy to the innermost node too, and a floor measured
              from the content is one number both can use. On the box it would
              have to know the block's padding as well, since a `min-height` on a
              border-box element covers it. */}
          <div
            className={`relative ${
              hasBlockContent(block.type, data, block) ? "" : "card-block--empty"
            }`}
            style={blockContentStyle(block, layout)}
          >
            {/* The slot, when this location left the block empty and the caller
                offers one — see `renderSlot`. Out of edit mode this is the whole
                of what a block draws, exactly as it was before any of the
                editing chrome existed.

                In edit mode it goes inside an `inert` wrapper, and that is what
                turns the block's own controls off while its design is being
                edited: the phone `tel:` link, the Links row, the week's fold,
                and the dashed `+` that fills an empty block in are all reachable
                things sitting under a target that now owns the whole box, and a
                press that lands on one of them is a press that did not open the
                block. `display: contents` so the wrapper generates no box —
                `height: 100%` on the gallery's image still resolves against the
                content box above, and the DOM a card lays out is the same in
                both modes. */}
            {overlay ? (
              <div className="contents" inert>
                {content}
              </div>
            ) : (
              content
            )}

            {/* The editor's press target, over whatever the block just drew --
                see `renderOverlay`. Null for every caller that offers none, and
                for every block when edit mode is off, so the DOM below is
                untouched for all of them.

                **Outside the `inert` wrapper**, which is the whole reason that
                wrapper is a wrapper rather than `inert` on this box: the target
                has to stay pressable while everything it covers is not. */}
            {overlay}
          </div>
        </div>
      );
    };

    return (
      <CardZoneBox
        key={zone}
        zone={zone}
        hasBlocks={blocks.length > 0}
        padTop={zone === filled[0]}
        padBottom={zone === filled[filled.length - 1]}
      >
        {rows.flatMap((row) => [
          /*
           * The line's leading space, as a box of its own above it — see
           * `CardLead`. Null when there is none, which is every card published
           * so far, so the DOM below is untouched for all of them.
           */
          <CardLead key={`${row.blocks[0].id}:lead`} row={row} layout={layout} />,
          /*
           * A full-width block stays a *direct* child of the zone, drawing the
           * div it has always drawn. That is not tidiness: `blockEdges`'s
           * first/last edge cancel and the embed's matching `--bleed-start` /
           * `--bleed-end` rules both need it there — so a card with nothing
           * narrowed on it produces the DOM it produced before any of this
           * existed.
           */
          row.shared ? (
            <div key={row.blocks[0].id} style={cardRowStyle(row, layout)}>
              {row.blocks.map((block) => blockView(block, row, true))}
            </div>
          ) : (
            blockView(row.blocks[0], row, false)
          ),
        ])}
      </CardZoneBox>
    );
  };

  /*
   * A location whose owner has filled in nothing but its name.
   *
   * `name` and the two tag blocks are exactly what says what a location *is*
   * rather than anything about it, and a card holding only those has nothing on
   * it anyone came to read. It used to render as the seventy pixels that fact
   * deserves, which reads as a broken card rather than as an empty one — so the
   * card says which it is, and the Edit button underneath is what to do about it.
   *
   * Both tag blocks, not just the retired `category` one. They draw the same
   * thing now, so counting one as content and not the other would give the same
   * half-filled location two different answers depending on which block its
   * owner's layout happens to name.
   *
   * And `gallery`, which is a newer exception and a necessary one: it reports
   * content unconditionally now, because the band holds its place and draws a
   * plain fill when there is no picture (see `hasBlockContent`). Without it here
   * a card with a photo block on it is never bare, and a location holding
   * nothing but its name silently loses the one line telling its owner so.
   */
  const isBare = !CARD_ZONES.some((zone) =>
    layout.zones[zone].some(
      (block) =>
        block.type !== "name" &&
        block.type !== "category" &&
        block.type !== "tags" &&
        block.type !== "gallery" &&
        hasBlockContent(block.type, data, block),
    ),
  );

  return (
    <CardFrame
      ref={ref}
      layout={layout}
      className={className}
      renderZone={renderZone}
    >
      {isBare ? renderEmptyState?.() : null}
      {children}
    </CardFrame>
  );
}
