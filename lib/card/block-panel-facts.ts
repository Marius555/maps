import {
  cardRows,
  type CardBlock,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";

/**
 * The two things a block's properties panel needs to know that the block itself
 * cannot answer.
 *
 * Both are facts about the *zone* rather than about the block, and the panel is
 * handed one block -- which is why they were worked out at the call site. There
 * are two call sites now: the studio's own panel (`CardProperties`) and the same
 * panel opened from a pin's card in edit mode (`BlockEditorForm`). Two copies of
 * this would be two panels disagreeing about whether a control does anything,
 * which is exactly the rule `BlockProperties` is built on -- a control shown is a
 * control that takes effect.
 */
export type BlockPanelFacts = {
  /**
   * The block's overlap currently has no neighbour to overlap.
   *
   * The rule is `blockEdges`' in components/card/card-frame.tsx: a block is
   * pulled over a sibling in its own zone, so the first block of one has nothing
   * above it and the last has nothing below.
   */
  overlapsNothing: boolean;
  /**
   * The block has its line to itself.
   *
   * What decides whether a mark's Alignment control has anything to move -- a
   * logo sharing a line sits where its neighbour leaves it, and three buttons
   * that quietly do nothing are what this panel's own rule forbids.
   */
  aloneOnLine: boolean;
};

export function blockPanelFacts(
  layout: CardLayout,
  zone: CardZone,
  index: number,
  block: CardBlock,
): BlockPanelFacts {
  const list = layout.zones[zone];

  return {
    overlapsNothing:
      block.overlapEdge === "below" ? index === list.length - 1 : index === 0,
    aloneOnLine:
      cardRows(list, layout).find((row) =>
        row.blocks.some((candidate) => candidate.id === block.id),
      )?.blocks.length === 1,
  };
}
