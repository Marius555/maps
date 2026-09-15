"use client";

import { useRowDragState } from "@/components/groups/row-drag-context";
import {
  isSameObject,
  useRowDragSource,
  type DraggedObject,
} from "@/components/groups/use-row-drag";
import { TAP_SOURCE_PROPS } from "@/components/groups/use-tap-carry";
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
 * **One per line, and it costs a scroll.** This was two-up for a while, and the
 * argument for it was arithmetic: eleven full-width rows *carrying a sentence of
 * hint each* is ~700px, against ~340px for eleven two-up tiles in the ~540px
 * this column has at an 800px viewport — so the whole inventory fitted with the
 * card empty, which is exactly when all eleven are offered.
 *
 * That arithmetic was never wrong; the premise was. The hint is not on the tile
 * and has not been for a long time — it is in `title`, which is what made the
 * two-up tile small enough to work in the first place. Without it a row is one
 * line, so the real choice was between a dense grid of half-width chips and a
 * column of things that look like the controls they are. A grid of two-word
 * chips reads as a legend; a stack of buttons reads as a shelf you take from,
 * which is what this is.
 *
 * **Measured after, with all eleven offered — an empty card, which is the worst
 * case: 38px a tile, 582px of content in a 524px scroller at an 800px
 * viewport.** So it overflows by 58px and the column scrolls, where the two-up
 * grid did not. That is the price, it was paid deliberately, and the panel was
 * already a scroller (`DesignerTabPanel`) — 58px is one flick. Re-measure if a
 * tile ever grows a second line or a fifth shelf appears: those are the two
 * changes that would turn one flick into a hunt.
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

          {/* One per line. `flex-col` rather than `grid-cols-1`, because a
              grid with one column still reserves a track and a row for every
              child; this is a stack and nothing here needs alignment across
              rows now that the tiles are not paired. */}
          <ul className="flex flex-col gap-1.5">
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
 * border is doing all the work.
 *
 * **The border is `border-border` at rest, not transparent, and that changed
 * with the row shape.** A transparent border was right for a two-up grid, where
 * eleven outlined chips would have been eleven boxes competing with the card
 * beside them; the ground alone was enough to separate two words from their
 * neighbour. A full-width row has no neighbour to separate it from, so the only
 * thing saying "this is a control you take" is its edge.
 *
 * **The hover does not touch that edge**, and used to. `hover:border-accent` put
 * an accent hairline round every tile the pointer crossed, which on a column of
 * eleven read as the list flickering rather than as one row answering — and next
 * to the card being designed it was a second accent outline competing with the
 * drop chrome, which is the one place on this screen accent means something.
 * Hover now changes the fill and the glyph's well only, so the tile lights up
 * inside its own shape and the shape itself never moves. The label stays
 * `text-foreground` throughout: `--accent-soft` is `color-mix(accent 15%)` — a
 * tint of the page, not a solid — so `--accent-foreground` on top of it would be
 * near-white text on a pale ground in the light theme.
 *
 * **Picked up by a click, it does take an accent edge** — an inset ring, which is
 * a box-shadow and leaves the 38px above alone. That is not the hover's flicker
 * coming back: it is a state held rather than a pointer passing, on exactly one
 * tile, and it is the tile every lit place on the card is lit for. The well goes
 * solid accent with it, the hover look made to stay.
 *
 * **It is a pill**, and the round end is doing a job the rectangle was not: this
 * is the one list in the designer whose rows are not part of the thing being
 * built, and a `rounded-lg` row on a panel full of `rounded-xl` boxes read as a
 * table of contents. A pill reads as something you take off a shelf.
 *
 * The glyph sits in a circle of its own rather than loose in the padding, which
 * is what gives the pill a left end to be round *about* — eleven bare icons
 * floating a fixed distance from a curve is the shape's one failure mode. Sized
 * so the tile's height does not move: 24px glyph well + 12px of padding + the
 * hairline is the same 38px the docblock above is measured against.
 *
 * There is no grip glyph, and there was one twice: first as decoration, then
 * briefly as the real drag source. Both were the same mistake in different
 * directions — the whole tile has always been what you pick up, so a glyph beside
 * it drew a control that was never there and narrowed the target to itself.
 * `.is-draggable` sets `cursor: pointer` rather than a drawn hand (see
 * globals.css), which leaves the affordance to the hover border.
 *
 * **A `div`, not a `button`, and that is load-bearing.** Every HeroUI `Button`
 * runs React Aria's `usePress`, which ends its own `onPointerDown` with
 * `stopPropagation()` — the press would never reach the drag. It is shaped like
 * a button and is not one; the gesture it offers is a drag, which no button
 * role describes anyway.
 *
 * `title` still carries the hint and the zones sentence, and deliberately stays
 * there rather than coming on screen now that there is room for it. A visible
 * second line of prose per row is the ~700px palette the docblock above
 * measured and rejected, and it would undo the button shape this is: a control
 * is a word you press, not a paragraph.
 */
function PaletteTile({ type }: { type: CardBlockType }) {
  const self: DraggedObject = { type: "card-new", id: type };
  const { isDragging, rowProps, isDraggable } = useRowDragSource({ self });

  /*
   * And the second way to pick it up: a click (components/groups/use-tap-carry.ts).
   * The tile lights, the card shows every place it can go, and the next click on
   * one of them puts it there; a second click here puts it back.
   *
   * A drag never arms it: `swallowNextClick` in use-row-drag.ts eats the click a
   * drag leaves behind, and a finger resting 250ms lifts the tile rather than
   * clicking it. So a press that moved is a drag and a press that did not is a
   * click, on both devices.
   */
  const { dragged, carriedBy, tap } = useRowDragState();
  const isArmed =
    carriedBy === "tap" && dragged !== null && isSameObject(dragged, self);

  const { label, hint, icon: Icon } = BLOCK_LABELS[type];
  const spec = CARD_BLOCKS[type];

  return (
    <li>
      <div
        {...rowProps}
        {...TAP_SOURCE_PROPS}
        onClick={() => tap(isArmed ? null : self)}
        data-armed={isArmed || undefined}
        title={`${hint}. Goes in ${zonesSentence(spec.zones)}. Drag it onto the card, or click it and then a highlighted place.`}
        /* No `touch-pan-y` class: `rowProps.style` states that rule, and this
           file's neighbours all argue against saying one thing twice. And
           nothing here may pass a `style` of its own without spreading
           `rowProps.style` into it first — React replaces the prop wholesale,
           and dropping `touch-action: pan-y` kills touch dragging in silence. */
        /* `palette-tile` is how the copy in the hand is styled (app/globals.css):
           a class rather than anything inline, because the copy is a clone on
           `<body>` and a class is what survives the clone. */
        className={`palette-tile group/tile flex w-full items-center gap-2.5 rounded-full border border-border py-1.5 ps-1.5 pe-4 transition-[color,background-color,box-shadow] select-none ${
          isDraggable ? "is-draggable" : ""
        } ${
          isArmed ? "bg-accent-soft inset-ring-2 inset-ring-accent" : "bg-default"
        } ${isDragging ? "opacity-35" : "hover:bg-accent-soft"}`}
      >
        {/* `bg-surface` against the tile's `bg-default`, which is the same step
            the panel already makes against the page — so the well reads as set
            into the pill rather than drawn on it. */}
        <span
          aria-hidden="true"
          className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-muted transition-colors group-hover/tile:bg-accent group-hover/tile:text-accent-foreground group-data-armed/tile:bg-accent group-data-armed/tile:text-accent-foreground"
        >
          <Icon className="size-3.5" />
        </span>

        {/* Still truncated, and now it will never fire: the longest label is
            "Opening hours" and a 24rem column fits it several times over. It
            stays because the guarantee is what the row shape rests on — a tile
            that wraps to two lines is the measurement in the docblock above
            going stale, and this is where that would show up first. */}
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {label}
        </span>
      </div>
    </li>
  );
}
