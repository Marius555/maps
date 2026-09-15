"use client";

import { motion, useIsPresent } from "motion/react";
import { useRef } from "react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import { useDropTarget } from "@/components/groups/use-row-drag";
import { MAGNET_SPRING } from "@/components/ui/list-row-motion";
import type { CardDrag, CardDropTarget } from "@/lib/card/card-edits";
import { toCardDrag, type DropBand } from "@/lib/card/drop-bands";
import type { BlockedFace, VacatedSpace } from "@/lib/card/drop-slots";
import { DropBlockPreview, type IncomingBlock } from "./drop-preview";
import { DropSpotOutline } from "./drop-spot";
import type { CardDropGeometry } from "./use-drop-bands";
import { useGhostSnap } from "./use-ghost-snap";

/**
 * The app's own 150ms decelerate — `TRANSITION` in components/ui/list-row-motion.ts,
 * written out here because that file's exports are whole prop bundles and this
 * one needs the timing on its own, per property and per slot.
 */
const EASE = { duration: 0.15, ease: [0, 0, 0.2, 1] } as const;

/**
 * The whole layer's fade, as named variants rather than as inline targets.
 *
 * **Stable identity is the point, not tidiness.** `AnimatePresence` keeps this
 * component mounted while it fades out, and it keeps re-rendering during that
 * fade — the drop that ended the gesture also selects the block that landed,
 * switches the sidebar tab and fires a save, and each of those is a render.
 * An inline `animate={{ opacity: 1 }}` is a *new object* every one of them, which
 * Motion reads as a changed target and restarts, cancelling the exit before it
 * has run. The layer then sat on the card at full opacity until the next drag
 * replaced it. Two constants and a pair of labels cannot say that.
 */
const OVERLAY_VARIANTS = {
  gone: { opacity: 0 },
  shown: { opacity: 1 },
} as const;

/**
 * The layer the drop targets are drawn on, above the card and not in it.
 *
 * The card used to answer "where can this go" by opening a dashed lane between
 * every pair of blocks — chrome inside the layout, which meant it had to stay
 * small enough not to wreck the card, and it still reflowed the thing the user
 * was aiming at the moment they picked something up. Everything here is
 * `position: absolute` over the card, so none of it can move, resize or clip a
 * single block. The card underneath is untouched, and is the card that will be
 * published.
 *
 * **Two answers at two volumes, both the size of the block.** Every place the
 * block in the hand fits at its current size is outlined, faintly, for the whole
 * gesture (`DropSpotOutline`); the one under the pointer is filled in and draws
 * the block itself in it (`SlotMark`).
 *
 * The faint layer used to be *areas*: each run of free space merged into one
 * outline (`dropRegions`, deleted), on the argument that thirteen stacked
 * outlines on an empty card was unreadable. What it drew instead was the size of
 * the space rather than of the block — a tall dashed box for a small logo, three
 * of them for a logo across a line, and nothing at all for the spot straddling a
 * photo, whose area is empty. That was reported as dashes that made no sense
 * next to a spot that had none, and the answer asked for was the block's own
 * outline at every place it fits. `.card-drop-spot` is lighter than the region
 * was, for exactly the reason the old argument gave.
 *
 * **The block is previewed where it lands.** A block moved on the card is its
 * own copy in the hand, pulled onto the place under the pointer (`useGhostSnap`).
 * A block off the palette has no copy that looks like it — a pill stood in for
 * it, small inside a large spot, and a click-to-place carry had nothing at all —
 * so the mark draws the real block (`DropBlockPreview`) and the pill steps aside.
 * The spot is free space by construction, so the preview covers nothing.
 *
 * **A click can open this layer too** (components/groups/use-tap-carry.ts). A
 * palette tile picked up by a click is `dragged` like any other carry, so the
 * layer is drawn exactly as for a drag; the pointer lights the mark on hover, and
 * a click on a `DropSlot` is the release.
 *
 * **And one thing that is not a place.** A block already on the card is covered,
 * top to bottom, by a `BlockedTarget`: it accepts the drag so the release is a
 * no-op rather than a drop into nothing, and it draws a hatch instead of an
 * outline.
 *
 * **Only free space aims anywhere.** A place's hit area is its share of the run
 * of free space it is in (`areaBands`), or of the room across its line: larger
 * than the box drawn for it, because a target you have to be precise with is a
 * target you fight, and never reaching past that room. Over a block, or the gap
 * between two, the pointer aims at nothing — the copy in the hand lets go and
 * follows it, and a release falls through to the card's own catch-all and does
 * nothing.
 *
 * **It arrives and it leaves.** The whole layer fades in with the gesture and
 * back out when the block lands. The exit is only possible because the caller
 * keeps this mounted under `AnimatePresence` — `useCardDropBands` nulls its
 * geometry the moment the pointer goes up.
 */
export function CardDropOverlay({
  geometry,
  onDrop,
  preview,
}: {
  geometry: CardDropGeometry;
  onDrop: (dragged: CardDrag, target: CardDropTarget) => void;
  /**
   * The block a palette tile is carrying, to draw in the place under the
   * pointer. Absent for a block moved on the card, whose own copy is pulled
   * onto that place instead.
   */
  preview?: IncomingBlock;
}) {
  const { bands, blocked, vacate, over, line } = geometry;

  /*
   * Which slot the pointer is in, read once here rather than by each slot for
   * itself — one subscription to the drag context instead of fifteen.
   */
  const { overId } = useRowDragState();

  // False from the moment `AnimatePresence` starts removing this layer.
  const isPresent = useIsPresent();

  /*
   * And the copy in the hand, pulled onto whichever of these slots the pointer
   * is in — the magnet. Drawing only: see `useGhostSnap`. The layer is what it
   * finds the card from, being the card's own child.
   */
  const layerRef = useRef<HTMLDivElement>(null);
  useGhostSnap(layerRef, geometry, slotId);

  /*
   * The one place the block would go if it were let go now.
   *
   * Undefined twice over, and both are the same answer — draw no mark: before
   * the pointer has reached the card at all, and while it is over something that
   * is not a slot, which is the remove strip and anything outside the workspace.
   */
  const active = bands.find((band) => slotId(band) === overId);
  /*
   * And the other thing the pointer can be over: a block already on the card,
   * where this drag cannot go. Only asked when nothing accepted, because a
   * column target painted over a face wins the pointer and is the answer.
   */
  const refused = active
    ? undefined
    : blocked.find((face) => blockedId(face) === overId);

  return (
    <motion.div
      ref={layerRef}
      aria-hidden="true"
      className="absolute inset-0 z-20"
      variants={OVERLAY_VARIANTS}
      initial="gone"
      animate="shown"
      exit="gone"
      transition={EASE}
      /*
       * Going deaf the moment it starts leaving, and this is load-bearing rather
       * than tidiness: `AnimatePresence` keeps the element in the tree for the
       * length of the fade *with its last props*, hit areas and all, so a click
       * in the 150ms after a drop would otherwise land on a drop slot for a
       * gesture that is already over.
       *
       * Read from `useIsPresent` rather than written into the `exit` target. A
       * target holding a property Motion cannot interpolate does not animate and
       * does not finish — the exit never ran at all, and the whole overlay stayed
       * on screen at full opacity until the next drag replaced it.
       */
      style={{ pointerEvents: isPresent ? undefined : "none" }}
    >
      {/* Not a drop target itself: a release on a card with no slots falls
          through to the frame's own catch-all and is a no-op, exactly as a
          sloppy drop has always been. */}
      <div className="card-drop-scrim pointer-events-none absolute inset-0" />

      {bands.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          {/*
            * Why, and what to do about it — not just "no".
            *
            * A card refuses every zone for one of two reasons, and only one of
            * them is visible. Full is visible: the blocks reach the bottom and
            * the owner can see it. **Over-full is not**, because the one block
            * allowed to shrink absorbed the difference and drew itself smaller
            * (see `wants` in lib/card/drop-slots.ts) — so the card looks fine,
            * there is a large empty block in the middle of it, and "No room for
            * this on the card" contradicts the screen. `over` is the missing
            * number, and the second sentence is the way out: the Height control
            * under Size, or one block fewer.
            *
            * Rounded, because it is measured text and a card is never 36.8px
            * over in any sense its owner can act on.
            */}
          <p className="card-drop-note text-center text-xs">
            {over === undefined
              ? "No room for this on the card."
              : `This card is ${String(Math.round(over))}px over its height. Make it taller, or remove a block.`}
          </p>
        </div>
      ) : (
        <>
          {/*
           * Every place, quietly, at the size of the block. Keyed on the place's
           * own id, so the set changing between two drags of different-sized
           * blocks does not reuse a box for a different place.
           */}
          {bands.map((band) => (
            <DropSpotOutline key={slotId(band)} band={band} line={line} />
          ))}
          {/*
           * **One element, kept**, rather than one per band with the id as its
           * key. The mark moves from place to place under the hand, and a key
           * that changed with the target would unmount the box the pointer had
           * just left and fade a new one in over 150ms — a flicker on every
           * boundary crossed, on a gesture whose whole job is to say *here*.
           * Keyed like this it is mounted once, fades in once, and afterwards
           * only its geometry changes.
           */}
          {active ? (
            <SlotMark key="mark" band={active} line={line} preview={preview} />
          ) : null}
          {refused ? <BlockedMark key="blocked" face={refused} /> : null}
          {/*
           * **Order is the mechanism here, not house style.** A drag resolves
           * its target with `document.elementFromPoint`, so the *last* of three
           * overlapping hit areas is the one that wins. That is three layers,
           * bottom to top:
           *
           * 1. the **runs**, each dividing its own free space between the places
           *    in it (`areaBands`) — they never overlap one another, and only a
           *    straddling logo's square, listed after them, reaches past one;
           * 2. the **faces**, one per line already on the card, which cover the
           *    whole line and refuse the drop;
           * 3. the **columns**, which are the places on a line beside what is
           *    already there — so wherever a face really can be landed on, a
           *    column is painted over it and wins inside its own box.
           *
           * Collapsing this back into one `bands.map`, or sorting either list,
           * would silently make a layer unreachable, and no test can catch it.
           * `half` is what tells a column from a run: `sideSlots` sets it on
           * every target it returns and `dropSlots` sets it on none.
           */}
          {bands
            .filter((band) => band.half === undefined)
            .map((band) => (
              <DropSlot
                key={slotId(band)}
                band={band}
                vacate={vacate}
                onDrop={onDrop}
              />
            ))}
          {blocked.map((face) => (
            <BlockedTarget key={blockedId(face)} face={face} />
          ))}
          {bands
            .filter((band) => band.half !== undefined)
            .map((band) => (
              <DropSlot
                key={slotId(band)}
                band={band}
                vacate={vacate}
                onDrop={onDrop}
              />
            ))}
        </>
      )}
    </motion.div>
  );
}

/**
 * The id a slot registers under.
 *
 * The same ids the in-flow lanes used, so nothing else has to learn a new
 * vocabulary — `DesignerCanvasArea` matches on the removal id alone. The offset
 * is part of it because one insertion index has several places to it: a block
 * can go at the top of a run of free space or four slots down it, and both are
 * "second in the middle zone".
 *
 * And the column across the line is part of it for the same reason one step
 * sideways: a mark in the hand turns one run position into the squares across
 * it (`splitAlignColumns`), and those agree about the zone, the index and the
 * leading space — they differ in nothing else this string would show.
 *
 * And `half` is part of it because two genuinely different places share the rest
 * of it. The place beside a narrowed block, and the run of free space
 * immediately below that line, are both "insert at this index, with no leading
 * space" — so without the suffix they register as one drop target under one id,
 * one silently shadows the other in the drag context's map, and the pointer
 * lights both marks while only one of them can ever fire.
 *
 * **And the line.** A block crossing *its own* line stays at its index, so "join
 * the block on line 0" and "cross to the far end of line 1" can agree about the
 * zone, the index and the side. React warned about the duplicate key, and the
 * drag context's own registry — a map keyed by exactly this id — kept only one
 * of the two. `(zone, line, side)` cannot collide: no two lines start at the
 * same index, and a line offers one place per side.
 */
export function slotId(band: DropBand): string {
  return `card:${band.zone}:${String(band.index)}:${String(band.offset)}${
    band.half ? `:half:${band.half}:${String(band.line ?? 0)}` : ""
  }${band.align ? `:at:${band.align}` : ""}`;
}

/**
 * What will land, drawn where it will land.
 *
 * A tint the size of the block, over the place's own dashed outline — the same
 * box, so a place still has one edge (`.card-drop-slot` has why the mark lost
 * its dashes) — and, for a block off the palette, the block itself inside it.
 *
 * **The box is the block's own size, and it stays that size.** It used to grow
 * under the pointer, which was the answer to picking one outline out of a dozen
 * a centimetre apart. Growing it would take it away from the single thing it is
 * for: promising the size and the place of what is about to land.
 *
 * **It moves rather than reappearing.** The caller keeps this element mounted
 * for the whole gesture — see the key there — so crossing from one place to the
 * next is a change of geometry on a box that is already on screen. That change
 * springs (`MAGNET_SPRING`): the copy in the hand is pulled onto the same place
 * on the same spring (ghost-magnet.ts), and an outline that jumped while the
 * block beside it flew would be two answers arriving at different times. The
 * arrival — the fade and the settle from 92% — still plays once, when the
 * pointer first reaches the card.
 *
 * **Never `scale` alongside `scaleX`/`scaleY`.** Motion keeps the one the other
 * never overwrites, so an `initial` of `scale: 0.92` and an `animate` of
 * `scaleY` is a mark permanently 8% narrow. `rest` and `target` below name
 * exactly the same keys, which is what makes that impossible to get wrong.
 *
 * A **mark** — the square drawn for a self-sized block — settles on both axes. A
 * bar settles on one. A square scaled vertically alone has stopped promising the
 * block's shape.
 */
function SlotMark({
  band,
  line,
  preview,
}: {
  band: DropBand;
  /** The line's own box — what a band with no `left` of its own spans. */
  line: CardDropGeometry["line"];
  /** The block to draw in it, when the carry is off the palette. */
  preview?: IncomingBlock;
}) {
  const isMark = band.mark === true;

  const rest = isMark ? { scaleX: 0.92, scaleY: 0.92 } : { scaleY: 0.92 };
  const target = isMark ? { scaleX: 1, scaleY: 1 } : { scaleY: 1 };

  /*
   * Numbers throughout, so the box can spring between a full-width band and a
   * column: `var(--card-pad)` on one side of that and px on the other is not
   * something anything can animate across.
   */
  const box = {
    left: band.left ?? line.left,
    width: band.width ?? line.width,
    top: band.y,
    height: band.height,
  };

  return (
    <motion.div
      className="card-drop-slot"
      // The box is in `initial` too, so the first place is drawn where it is
      // rather than sprung to from the layer's corner.
      initial={{ opacity: 0, ...rest, ...box }}
      animate={{ opacity: 1, ...target, ...box }}
      transition={{
        ...EASE,
        // The magnet's own spring, so the outline hops from place to place in
        // step with the copy being pulled onto it.
        left: MAGNET_SPRING,
        width: MAGNET_SPRING,
        top: MAGNET_SPRING,
        height: MAGNET_SPRING,
      }}
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      {preview ? <DropBlockPreview {...preview} /> : null}
    </motion.div>
  );
}

/**
 * One place's hit area — its share of the free space it is in, and no mark of
 * its own.
 *
 * A run's slots divide that run between them (`areaBands`), and a place on a
 * line catches the room across the line it sits in (`hitLeft`/`hitWidth`), so a
 * release anywhere inside lands somewhere, which makes each larger than what it
 * stands for. `SlotMark` above is what says where the block goes; this is only
 * what catches the pointer.
 */
function DropSlot({
  band,
  vacate,
  onDrop,
}: {
  band: DropBand;
  /**
   * What this move is leaving behind, which is the same wherever it lands — a
   * fact about the gesture rather than about this place. See `vacatedSpace`.
   */
  vacate?: VacatedSpace;
  onDrop: (dragged: CardDrag, target: CardDropTarget) => void;
}) {
  const { targetProps } = useDropTarget({
    id: slotId(band),
    // A slot only exists because `canDrop` already said yes for this drag; this
    // is here so a drag from somewhere else entirely passes straight over it.
    accepts: (candidate) => toCardDrag(candidate) !== null,
    onDrop: (candidate) => {
      const drag = toCardDrag(candidate);
      if (!drag) return;

      onDrop(drag, {
        zone: band.zone,
        index: band.index,
        offset: band.offset,
        // Only where something follows in this zone. See `settle` in
        // lib/card/card-edits.ts — it is what stops the arrival shoving the
        // rest of the card down.
        ...(band.nextOffset === undefined ? {} : { nextOffset: band.nextOffset }),
        // And the two things a place on a line says that no other target does:
        // which end of it the block takes, and which line. See `sideSlots` in
        // lib/card/drop-slots.ts.
        ...(band.half ? { half: band.half } : {}),
        ...(band.line === undefined ? {} : { line: band.line }),
        // And the one thing only a square across a run says: which of the
        // places across the line it was released in. See `splitAlignColumns`
        // in lib/card/drop-bands.ts.
        ...(band.align === undefined ? {} : { align: band.align }),
        // And the one thing that is not about this place at all: the block the
        // lift is about to leave stranded, and the leading space it has to take
        // so it does not ride up into the hole. The mirror of `nextOffset`
        // above; `settle` overwrites it where the two land on the same block.
        ...(vacate === undefined
          ? {}
          : { vacateId: vacate.id, vacateOffset: vacate.offset }),
      });
    },
  });

  return (
    <div
      {...targetProps}
      // The hand, for a click-to-place carry — this is what takes that click. A
      // drag never shows it: `body.is-row-dragging *` forces the drag's own
      // cursor over everything.
      className="absolute cursor-pointer"
      style={{
        // A band with no box of its own across the line is a full-width share
        // of the card. Every other one catches the room it sits in, which is
        // wider than the box drawn for it: a 62px square or a 108px column is
        // not something anyone should have to aim at.
        ...(band.left === undefined
          ? { left: 0, right: 0 }
          : {
              left: `${String(band.hitLeft ?? band.left)}px`,
              width: `${String(band.hitWidth ?? band.width ?? 0)}px`,
            }),
        top: `${String(band.top)}px`,
        height: `${String(band.bottom - band.top)}px`,
      }}
    />
  );
}

/**
 * The id a blocked face registers under.
 *
 * The line's own insertion index is enough to make it unique: rows are
 * consecutive, so no two lines in a zone start at the same index, and a line has
 * one face.
 *
 * It shares the `card:` prefix with `slotId` because everything the drag context
 * holds does, and `blocked` cannot collide with a zone — the three are named
 * `top`, `middle` and `bottom`. What it does *not* share is the shape:
 * `DesignerCanvasArea` matches the removal id and nothing else, and no code path
 * parses a slot id back into a target, so there is nothing here to keep in step.
 */
function blockedId(face: BlockedFace): string {
  return `card:blocked:${face.zone}:${String(face.line)}`;
}

/**
 * There is already something here.
 *
 * **Drawn across the whole line, not around the block.** A narrowed block's face
 * is refused across the line because the places that *do* accept are painted
 * over this one and take their own strips of it out of the pointer's reach before
 * this can ever be the answer — so by the time this draws, the whole line really
 * is refused.
 *
 * **A hatch, not dashes.** Every dashed thing on this layer is a place a block can
 * go, and this is the opposite of one; see `.card-drop-blocked` in
 * app/globals.css for why it is not red either.
 *
 * Keyed `"blocked"` by the caller for the reason the mark is keyed `"mark"`: it
 * moves from face to face under the hand rather than being remounted at each one.
 */
function BlockedMark({ face }: { face: BlockedFace }) {
  return (
    <motion.div
      className="card-drop-blocked pointer-events-none absolute"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={EASE}
      style={{
        left: "var(--card-pad)",
        right: "var(--card-pad)",
        top: `${String(face.top)}px`,
        height: `${String(Math.max(0, face.bottom - face.top))}px`,
      }}
    />
  );
}

/**
 * The one hit area on this layer that is not a place.
 *
 * **It accepts the drag, and that is the whole trick.** A target that refused
 * would leave the release unhandled, and an unhandled release while a block from
 * the card is in the air is `onDroppedOutside` — which removes it. So this takes
 * the drop and does nothing with it, because "you cannot put it there" and "throw
 * it away" are the same gesture otherwise, and the second one is destructive.
 *
 * It spans the full card width where `BlockedMark` insets to the padding: the
 * mark says which line, the target catches every pixel of it, and the places
 * that accept are painted afterwards and win back the parts that do.
 */
function BlockedTarget({ face }: { face: BlockedFace }) {
  const { targetProps } = useDropTarget({
    id: blockedId(face),
    // As `DropSlot`: a drag from the locations panel passes straight over.
    accepts: (candidate) => toCardDrag(candidate) !== null,
    // Deliberately empty, and deliberately present — see above. Without a handler
    // `useDropTarget` does not register at all and the run band underneath wins.
    onDrop: () => undefined,
  });

  return (
    <div
      {...targetProps}
      // Said to a click-to-place carry, which has no copy to let go of; a drag's
      // own cursor wins over this, as over `DropSlot`'s.
      className="absolute cursor-not-allowed"
      style={{
        left: 0,
        right: 0,
        top: `${String(face.top)}px`,
        height: `${String(Math.max(0, face.bottom - face.top))}px`,
      }}
    />
  );
}
