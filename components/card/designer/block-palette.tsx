"use client";

import { GripVertical } from "lucide-react";

import { useRowDragSource } from "@/components/groups/use-row-drag";
import { PropertyFold } from "@/components/ui/properties/property-fold";
import { PropertyFolds } from "@/components/ui/properties/property-folds";
import { availableBlocks } from "@/lib/card/card-edits";
import {
  CARD_BLOCKS,
  type CardBlockType,
  type CardLayout,
} from "@/packages/shared/card-layout";
import { BLOCK_GROUPS, BLOCK_LABELS, zonesSentence } from "./block-labels";

/**
 * The blocks you can put on the card, as things you pick up.
 *
 * Dragged with the same hook the canvas and the Locations panel use, so a row
 * leaving this list behaves exactly like a row leaving that one — including on
 * touch, where a finger has to rest for 250ms before the gesture is a drag
 * rather than a scroll.
 *
 * A block already on the card is not offered, rather than offered and refused.
 * Only dividers, spacers and buttons repeat, so the palette shrinks as the card
 * fills up and what is left is exactly what can still be added.
 *
 * **Shelved and folded, where this was one flat two-column grid of chips.** Two
 * things were wrong with that and both were about the same 24rem column. The
 * chips were `bg-surface` inside a `bg-surface` panel, so a dozen hairline
 * rectangles floated on an identical ground with nothing saying they could be
 * picked up; and at half the column's width every label truncated, which is why
 * the hint each block already carries had nowhere to go but a native `title`.
 * Full-width rows fix both — the hint is on screen, the grip says the row is a
 * handle — and the folds are what keep eleven of those from being a wall.
 *
 * The folds are `PropertyFold`, shared with the publish designer, for the reason
 * that column gives: several unrelated questions, none of which has to be open
 * to read the others. The Modify tab beside this one folds the same way now, so
 * the two halves of the sidebar are one thing rather than two conventions.
 */
export function BlockPalette({ layout }: { layout: CardLayout }) {
  const available = new Set(availableBlocks(layout));

  if (available.size === 0) {
    return (
      <p className="text-xs text-muted">
        Everything is on the card already. Remove a block to add it somewhere
        else.
      </p>
    );
  }

  /*
   * A shelf holding nothing renders nothing at all, heading included — the rule
   * `PropertyFold`'s own `isEmpty` states for the panel beside this one. It is
   * what lets the
   * palette shrink gracefully: build a card out and Content empties, then Media,
   * and the column ends up as the two or three things that genuinely repeat.
   */
  const shelves = BLOCK_GROUPS.map((group) => ({
    ...group,
    types: group.types.filter((type) => available.has(type)),
  })).filter((group) => group.types.length > 0);

  return (
    /* Shut, and one at a time, like every other fold in the app — see
       `PropertyFolds`. This shelf used to open all of them on the grounds that
       nothing is compared across shelves, which is still true and is no longer
       enough: eleven blocks under four headings is the wall the shelves were
       introduced to break up, and opening all four rebuilds it. */
    <PropertyFolds>
      {shelves.map((group) => (
        <PropertyFold key={group.id} id={group.id} title={group.label}>
          <ul
            className={
              "compact" in group ? "grid grid-cols-2 gap-1.5" : "space-y-1.5"
            }
          >
            {group.types.map((type) => (
              <PaletteRow
                key={type}
                type={type}
                isCompact={"compact" in group}
              />
            ))}
          </ul>
        </PropertyFold>
      ))}
    </PropertyFolds>
  );
}

/**
 * One block, as a handle.
 *
 * `bg-default` and not `bg-surface`: the panel around this is already
 * `bg-surface`, so a row painted with it has no ground of its own and the
 * border is doing all the work. The border stays, transparent at rest, so that
 * the accent one on hover changes a colour rather than adding a line and moving
 * everything by a pixel.
 *
 * The grip is the affordance the chips never had. `.is-draggable` deliberately
 * sets `cursor: pointer` rather than a drawn hand (see globals.css), so without
 * a glyph nothing on screen says these are picked up rather than clicked.
 *
 * `title` still carries the zones sentence, because where a block may go is a
 * sentence and there is no room for a second line of it.
 */
function PaletteRow({
  type,
  isCompact,
}: {
  type: CardBlockType;
  /** A shelf whose labels say themselves, drawn two-up with no hint. */
  isCompact: boolean;
}) {
  const { isDragging, rowProps, isDraggable } = useRowDragSource({
    self: { type: "card-new", id: type },
  });

  const { label, hint, icon: Icon } = BLOCK_LABELS[type];
  const spec = CARD_BLOCKS[type];

  return (
    <li>
      <div
        {...rowProps}
        title={`${hint}. Goes in ${zonesSentence(spec.zones)}.`}
        className={`flex touch-pan-y items-center gap-2 rounded-lg border border-transparent bg-default text-xs transition-colors select-none ${
          isCompact ? "p-1.5" : "p-2"
        } ${isDraggable ? "is-draggable" : ""} ${
          isDragging ? "opacity-35" : "hover:border-accent hover:bg-accent-soft"
        }`}
      >
        <GripVertical
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted"
        />

        {/* The glyph gets a tile of its own on a full row, where it is one of
            three things sharing the line; on a compact row it is the only thing
            beside two words and a box around it would be most of the row. */}
        {isCompact ? (
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-muted"
          >
            <Icon className="size-4" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">{label}</span>
          {/* The hint wraps where the label truncates, and the asymmetry is the
              point: a label is two words and a hint is a sentence, so clipping
              the sentence is clipping the only thing on the row that explains
              anything. Two lines is where it stops — the longest hint here
              ("One call to action — directions, or a link you choose") takes
              exactly that, and a clamp is what stops a longer one someday
              turning a shelf into a paragraph. */}
          {isCompact ? null : (
            <span className="block line-clamp-2 text-[11px] text-muted">
              {hint}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}
