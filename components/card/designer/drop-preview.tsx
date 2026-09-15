"use client";

import type { CSSProperties } from "react";

import type { CardBlock, CardLayout } from "@/packages/shared/card-layout";
import {
  CardBlockContent,
  hasBlockContent,
  type CardBlockData,
} from "../card-block";
import { blockContentStyle, blockStyle } from "../card-frame";

/**
 * A block that is not on the card yet — the one a palette tile is carrying —
 * and what it is drawn from.
 *
 * One block per gesture, made once by `CardCanvas` with `makeCardBlock` so it
 * arrives with exactly the defaults the drop will give it. It is never inserted
 * into the layout: its id is thrown away with the gesture.
 */
export type IncomingBlock = {
  block: CardBlock;
  layout: CardLayout;
  data: CardBlockData;
};

/**
 * What a block draws inside its own box: the content element every renderer
 * puts between a block and its words, holding the floor an empty one reserves.
 * The same shape `CardCanvas` renders for a block that is on the card.
 */
function BlockBody({ block, layout, data }: IncomingBlock) {
  return (
    <div
      data-block-content
      className={
        hasBlockContent(block.type, data, block) ? undefined : "card-block--empty"
      }
      style={blockContentStyle(block, layout)}
    >
      <CardBlockContent block={block} data={data} />
    </div>
  );
}

/**
 * The properties that size and place a block on its line. The spot it is being
 * previewed in already has its box, so these would only fight it.
 */
const PLACEMENT: readonly (keyof CSSProperties)[] = [
  "width",
  "height",
  "minHeight",
  "flex",
  "marginInline",
  "alignSelf",
  "position",
  "zIndex",
];

/**
 * The block that would land, drawn in the spot under the pointer.
 *
 * **This is what the pointer is carrying, at the size it will be.** A palette
 * tile used to be the only picture of it: a pill that stayed pill-sized inside a
 * spot the size of a photo, and — for a click-to-place carry, which has no copy
 * in the hand at all — nothing, so choosing where to put a block meant choosing
 * without seeing it. The spot is the block's own box (`dropSlots`, `sideSlots`),
 * so the real block drawn in it is the landing, before it happens.
 *
 * It covers nothing: a spot is free space by construction, and the one that
 * straddles a photo is drawn over it because that is what the logo will do.
 *
 * `inert` because it is a picture: the gallery's empty state is a file input and
 * the Links row is anchors, and neither may take a press meant for the card.
 */
export function DropBlockPreview({ block, layout, data }: IncomingBlock) {
  const style: CSSProperties = { ...blockStyle(block, layout) };
  for (const key of PLACEMENT) delete style[key];

  return (
    <div inert aria-hidden="true" className="card-drop-preview" style={style}>
      <BlockBody block={block} layout={layout} data={data} />
    </div>
  );
}

/**
 * A hidden copy of the incoming block, laid out at the line's width so the drop
 * geometry can ask how tall it is (`draggedHeight` in use-drop-bands.ts).
 *
 * Before this, a block off the palette was sized by what its type implies — one
 * line of text for everything that grows to its content — and that one line was
 * the height of every spot drawn for it and the room the card was asked to find.
 * A description is three lines; an open week of opening hours is 154px.
 *
 * Inside the card so every `--card-*` property the block reads is inherited, and
 * absolutely positioned between the card's padding so it reflows nothing: the
 * drop geometry is measured off the card, and a probe in the flow would be
 * measured with it.
 */
export function DropBlockProbe({ block, layout, data }: IncomingBlock) {
  return (
    <div
      data-drop-probe
      inert
      aria-hidden="true"
      className="pointer-events-none invisible absolute top-0"
      style={{ left: "var(--card-pad)", right: "var(--card-pad)" }}
    >
      <div style={blockStyle(block, layout)}>
        <BlockBody block={block} layout={layout} data={data} />
      </div>
    </div>
  );
}
