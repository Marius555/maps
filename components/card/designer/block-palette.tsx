"use client";

import { useRowDragSource } from "@/components/groups/use-row-drag";
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
 * **All of them at once, where this used to be four folds.** The shelves were
 * `PropertyFold`s — shut, one open at a time, like every other fold in the app —
 * and that rule is right for the Modify tab beside this one, which asks up to
 * twenty questions about one block. It is wrong here, because this is not a run
 * of questions: it is the inventory, and a fold is a claim that you already know
 * which shelf the thing you want is on. Two presses to reach a Divider, and
 * nothing on screen to tell somebody a Logo block existed at all.
 *
 * What pays for it is the row shape. Eleven full-width rows carrying a sentence
 * of hint each is ~700px and would scroll on any laptop; eleven **two-up tiles**
 * under static headings is ~340px against the ~540px this column has at an
 * 800px viewport, so the whole palette is visible with the card empty — which is
 * exactly when all eleven are offered. The hint each block carries is still
 * there, in the `title` that already held the zones sentence beside it.
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
   * `PropertyFold`'s own `isEmpty` states for the panel beside this one, and the
   * reason it outlived the folds. It is what lets the palette shrink gracefully:
   * build a card out and Content empties, then Media, and the column ends up as
   * the two or three things that genuinely repeat.
   */
  const shelves = BLOCK_GROUPS.map((group) => ({
    ...group,
    types: group.types.filter((type) => available.has(type)),
  })).filter((group) => group.types.length > 0);

  return (
    <div className="space-y-3">
      {shelves.map((group) => (
        <section key={group.id}>
          {/* A label, not a control. It says which question this run of tiles
              answers and has nothing to press — the whole point of dropping the
              folds is that there is no gesture between here and a block. */}
          <h3 className="mb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
            {group.label}
          </h3>

          <ul className="grid grid-cols-2 gap-1.5">
            {group.types.map((type) => (
              <PaletteTile key={type} type={type} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * One block, as a handle.
 *
 * `bg-default` and not `bg-surface`: the panel around this is already
 * `bg-surface`, so a tile painted with it has no ground of its own and the
 * border is doing all the work. The border stays, transparent at rest, so that
 * the accent one on hover changes a colour rather than adding a line and moving
 * everything by a pixel.
 *
 * There is no grip glyph, and there was one twice: first as decoration, then
 * briefly as the real drag source. Both were the same mistake in different
 * directions — the whole tile has always been what you pick up, so a glyph beside
 * it drew a control that was never there and narrowed the target to itself.
 * `.is-draggable` sets `cursor: pointer` rather than a drawn hand (see
 * globals.css), which leaves the affordance to the hover border.
 *
 * `title` carries the hint and the zones sentence. On a tile this size a hint is
 * not something that can be on screen — it is a sentence and this is two words —
 * and the palette showing every block at once is worth more than five of them
 * showing a sentence. The hover text is the same text it always was.
 */
function PaletteTile({ type }: { type: CardBlockType }) {
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
        /* No `touch-pan-y` class: `rowProps.style` states that rule, and this
           file's neighbours all argue against saying one thing twice. */
        className={`flex items-center gap-1.5 rounded-lg border border-transparent bg-default p-1.5 transition-colors select-none ${
          isDraggable ? "is-draggable" : ""
        } ${
          isDragging ? "opacity-35" : "hover:border-accent hover:bg-accent-soft"
        }`}
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted" />

        {/* Truncated rather than wrapped: a tile that grows a second line for
            "Opening hours" makes its neighbour tall too, and a grid of tiles
            that are not all the same height reads as a list that went wrong. */}
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
          {label}
        </span>
      </div>
    </li>
  );
}
