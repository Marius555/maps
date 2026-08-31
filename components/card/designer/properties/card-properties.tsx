"use client";

import {
  cardRows,
  findBlock,
  type CardLayout,
  type CardShadow,
} from "@/packages/shared/card-layout";
import { BlockProperties, type BlockPatch } from "./block-properties";
import { PropertyChoice, PropertySlider } from "./property-fields";

/**
 * The numbers behind the card, for the things a drag cannot say.
 *
 * A handle is the right way to set a height you can see; it is the wrong way to
 * set a corner radius of exactly 12, and there is no handle at all for "how wide
 * is this card". Every control here writes through the same clamped edits the
 * drags do, so the two cannot disagree about what is allowed.
 *
 * One control set at a time: a block's own while something is selected, the
 * whole card's otherwise — selecting a block to nudge its height must not also
 * put every other block's size one careless drag away.
 */
export function CardProperties({
  layout,
  selectedId,
  onCard,
  onBlock,
}: {
  layout: CardLayout;
  selectedId: string | null;
  onCard: (patch: Partial<CardLayout>) => void;
  onBlock: (id: string, patch: BlockPatch) => void;
}) {
  const selected = selectedId ? findBlock(layout, selectedId) : null;

  if (selected) {
    /*
     * Whether the block's overlap currently has a neighbour to overlap.
     *
     * Worked out here rather than in the panel because it is a fact about the
     * *zone*, and the panel is handed one block. The rule is `blockEdges`'s in
     * components/card/card-frame.tsx: a block is pulled over a sibling in its own
     * zone, so the first block of one has nothing above it and the last has
     * nothing below.
     */
    const list = layout.zones[selected.zone];
    const overlapsNothing =
      selected.block.overlapEdge === "below"
        ? selected.index === list.length - 1
        : selected.index === 0;

    /*
     * Whether the block has its line to itself.
     *
     * A fact about the *line*, so it is worked out here for the same reason
     * `overlapsNothing` is: the panel is handed one block, and only the zone
     * knows what is next to it. It is what decides whether a mark's Alignment
     * control has anything to move — a logo sharing a line sits where its
     * neighbours leave it, and three buttons that quietly do nothing are exactly
     * what this panel's own rule forbids.
     */
    const alone =
      cardRows(list, layout).find((row) =>
        row.blocks.some((block) => block.id === selected.block.id),
      )?.blocks.length === 1;

    return (
      <BlockProperties
        block={selected.block}
        cardPadding={layout.padding}
        overlapsNothing={overlapsNothing}
        aloneOnLine={alone}
        onChange={(patch) => onBlock(selected.block.id, patch)}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">The card</h3>
        <p className="text-xs text-muted">
          Select a block on the card to change that block instead.
        </p>
      </div>

      <PropertySlider
        label="Width"
        value={layout.width}
        min={220}
        max={480}
        suffix="px"
        onChange={(width) => onCard({ width })}
      />
      <PropertySlider
        label="Height"
        value={layout.maxHeight}
        min={180}
        max={720}
        suffix="px"
        onChange={(maxHeight) => onCard({ maxHeight })}
      />
      <PropertySlider
        label="Corners"
        value={layout.radius}
        min={0}
        max={28}
        suffix="px"
        onChange={(radius) => onCard({ radius })}
      />
      <PropertySlider
        label="Padding"
        value={layout.padding}
        min={0}
        max={28}
        suffix="px"
        onChange={(padding) => onCard({ padding })}
      />
      <PropertySlider
        label="Gap between blocks"
        value={layout.gap}
        min={0}
        max={20}
        suffix="px"
        onChange={(gap) => onCard({ gap })}
      />

      <PropertyChoice
        label="Shadow"
        value={layout.shadow}
        options={SHADOW_OPTIONS}
        onChange={(shadow) => onCard({ shadow })}
      />
    </section>
  );
}

const SHADOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "strong", label: "Strong" },
] as const satisfies readonly { value: CardShadow; label: string }[];
