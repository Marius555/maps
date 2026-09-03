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
  children,
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
  /** Chrome outside the layout — the close button, the Edit footer. */
  children?: React.ReactNode;
}) {
  const data: CardBlockData = {
    place,
    fields,
    tagChips: tagChips ?? [],
    pinIcons,
    folded: detailsContents(layout),
  };

  /**
   * The zones that will actually draw something, worked out before any of them
   * renders.
   *
   * Needed up front because the card's vertical padding belongs to the first
   * and last of *these*, not to the zones named top and bottom — see
   * `zoneClass` in card-frame.tsx for the bug that came of confusing the two.
   */
  const filled = CARD_ZONES.filter((zone) =>
    layout.zones[zone].some((block) => hasBlockContent(block.type, data, block)),
  );

  const renderZone = (zone: CardZone) => {
    /*
     * Only the blocks this location actually fills in.
     *
     * A block that draws nothing is not free: it still pays its own padding and
     * still takes a gap after it, so a location with no photo and no hours would
     * open a card with two mystery bands in it. The embed gets this for free —
     * `buildPopup` appends a wrapper only once its builder has returned a node —
     * and this is the same subtraction, made before rendering because React
     * renders children afterwards and cannot be asked.
     *
     * The designer's canvas deliberately does *not* do this: an empty block
     * there has to stay visible, selectable and draggable, or half the palette
     * would vanish the moment it landed.
     */
    const blocks = layout.zones[zone].filter((block) =>
      hasBlockContent(block.type, data, block),
    );

    // An empty zone is not an empty box — it would still pay its own padding,
    // which on a location with no photo is a stray gap above the name.
    if (blocks.length === 0) return null;

    /*
     * Paired *after* the filter, which is the whole ordering rule.
     *
     * `cardRows` is a pure function of the list it is handed, so pairing what
     * this location actually shows means a card whose Category block is blank
     * lets the Name and the Address pair up instead of leaving a hole where the
     * category would have been. It also means a pair can come out as a lone
     * half, and a lone half stays half: promoting it to full width would make
     * the same saved design draw at two different sizes on two locations, and
     * the owner can see neither state in the studio.
     */
    const rows = cardRows(blocks, layout);

    /*
     * `row`, not the block's own index, and that is the whole of what the two
     * booleans mean: a block is pulled over the *line* above it, so every member
     * of the zone's first line has the same nothing above it. Counting blocks
     * instead made a logo's overlap switch on and off as its line-mates came and
     * went — see `upwardLiftOf` in packages/shared/card-layout.ts.
     */
    const blockView = (block: CardBlock, row: CardRow, onRow: boolean) => (
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
        className="min-w-0 overflow-hidden"
      >
        {/* A second element only because a half shrinks its content and must
            not shrink its own flex basis with it. It is an empty style object
            for every other block, so the extra div costs nothing anyone can
            see. */}
        <div style={blockContentStyle(block, layout)}>
          <CardBlockContent block={block} data={data} />
        </div>
      </div>
    );

    return (
      <CardZoneBox
        key={zone}
        zone={zone}
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
   */
  const isBare = !CARD_ZONES.some((zone) =>
    layout.zones[zone].some(
      (block) =>
        block.type !== "name" &&
        block.type !== "category" &&
        block.type !== "tags" &&
        hasBlockContent(block.type, data, block),
    ),
  );

  return (
    <CardFrame layout={layout} className={className} renderZone={renderZone}>
      {isBare ? renderEmptyState?.() : null}
      {children}
    </CardFrame>
  );
}
