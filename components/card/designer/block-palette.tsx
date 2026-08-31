"use client";

import { useRowDragSource } from "@/components/groups/use-row-drag";
import { availableBlocks } from "@/lib/card/card-edits";
import {
  CARD_BLOCKS,
  type CardBlockType,
  type CardLayout,
} from "@/packages/shared/card-layout";
import { BLOCK_LABELS, zonesSentence } from "./block-labels";

/**
 * The blocks you can put on the card, as things you pick up.
 *
 * Dragged with the same hook the canvas and the Locations panel use, so a chip
 * leaving this list behaves exactly like a row leaving that one — including on
 * touch, where a finger has to rest for 250ms before the gesture is a drag
 * rather than a scroll.
 *
 * A block already on the card is not offered, rather than offered and refused.
 * Only dividers and spacers repeat, so the palette shrinks as the card fills up
 * and what is left is exactly what can still be added.
 */
export function BlockPalette({ layout }: { layout: CardLayout }) {
  const available = availableBlocks(layout);

  return (
    <div className="space-y-2">
      {available.length === 0 ? (
        <p className="text-xs text-muted">
          Everything is on the card already. Remove a block to add it somewhere
          else.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-1.5">
          {available.map((type) => (
            <PaletteChip key={type} type={type} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PaletteChip({ type }: { type: CardBlockType }) {
  const { isDragging, rowProps, isDraggable } = useRowDragSource({
    self: { type: "card-new", id: type },
  });

  const { label, hint, icon: Icon } = BLOCK_LABELS[type];
  const spec = CARD_BLOCKS[type];

  return (
    <li>
      <div
        {...rowProps}
        // The hint says where it can go *before* the drag, so the answer is
        // learnable rather than only discoverable by trying.
        title={`${hint}. Goes in ${zonesSentence(spec.zones)}.`}
        className={`flex touch-pan-y items-center gap-1.5 rounded-lg border border-border bg-surface p-2 text-xs transition-colors select-none ${
          isDraggable ? "is-draggable" : ""
        } ${isDragging ? "opacity-35" : "hover:border-accent hover:bg-accent-soft"}`}
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
        <span className="min-w-0 truncate text-foreground">{label}</span>
      </div>
    </li>
  );
}
