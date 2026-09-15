import type { DraggedObject } from "@/components/groups/use-row-drag";
import {
  CARD_ZONES,
  acceptsBlock,
  type CardBlock,
  type CardBlockAlign,
  type CardLayout,
  type CardZone,
} from "@/packages/shared/card-layout";
import type { CardDrag } from "./card-edits";
import { hasRoomFor, type BlockHeights } from "./card-space";
import type { DropSlot } from "./drop-slots";

/**
 * Which part of the card aims at which place a block can land.
 *
 * The other half of `drop-slots.ts`: that file works out *where* a block could
 * go, this one works out which pixels of the card mean each of those places.
 * The same split `card-edits.ts` and `lib/map/drop-action.ts` make — the gesture
 * asks, a tested module answers.
 *
 * The drop targets live on an overlay above the card and are computed from the
 * card's measured geometry, rather than being lanes grown between the blocks.
 * That buys two things at once:
 *
 * - **Nothing on the card moves.** The chrome is not in the layout at all, so it
 *   cannot resize, reflow or clip anything, and a target is free to be larger
 *   than what it draws — which is what lets the *drawn* spot be the size of the
 *   block while the *hit area* is its share of a whole run of free space.
 * - **They cannot overlap.** `dropBands` *partitions* whatever it is given:
 *   every pixel of it belongs to exactly one slot, however close two slots sit.
 *
 * **What it is given is the free space, and nothing else** (`areaBands`). It
 * used to be the whole card — no dead space, the nearest place wins — and that
 * stopped being a kindness once the copy in the hand was pulled onto the place
 * aimed at: with the pointer over a block, the block in the hand was drawn
 * landing somewhere else. A pointer over a block or a gap now aims at nothing,
 * and a release there does nothing.
 */

/** What is being dropped, as the card's own vocabulary. Null for other drags. */
export function toCardDrag(dragged: DraggedObject): CardDrag | null {
  if (dragged.type === "card-new") {
    return { kind: "new", type: dragged.id as CardBlock["type"] };
  }

  return dragged.type === "card-block" ? { kind: "move", id: dragged.id } : null;
}

/**
 * Whether this zone would take this drag.
 *
 * Two rules, and the same functions the drop itself runs so a target cannot
 * light up and then refuse. `acceptsBlock` is the design rule — a block belongs
 * to certain zones and a unique one appears once. `hasRoomFor` is the spatial
 * one: a zone whose blocks already fill the card offers nowhere to put another,
 * which is what keeps a 70%-tall photo in the top zone from still advertising a
 * landing spot above itself that the card would then clip.
 */
export function canDrop(
  layout: CardLayout,
  dragged: DraggedObject,
  zone: CardZone,
  heights: BlockHeights,
  /** How tall a new block really draws — see `hasRoomFor`. */
  newHeight?: number,
): boolean {
  const drag = toCardDrag(dragged);
  if (!drag) return false;
  if (!hasRoomFor(layout, zone, drag, heights, newHeight)) return false;

  if (drag.kind === "new") return acceptsBlock(layout, drag.type, zone);

  const block = CARD_ZONES.flatMap((other) => layout.zones[other]).find(
    (candidate) => candidate.id === drag.id,
  );

  return block ? acceptsBlock(layout, block.type, zone, block.id) : false;
}

/** A slot, plus the slice of the card that aims at it. */
export type DropBand = DropSlot & { top: number; bottom: number };

/**
 * Every full-width band, divided into the places a **mark** could sit across
 * it: the start of the line, its middle, and its end.
 *
 * A logo is the one block whose position has two degrees of freedom. Everything
 * else fills the line it lands on, so "where does this go" is one number and one
 * band down the card answers it; a mark is a square, so the same band is really
 * several places, and offering it as one meant the only way to move a logo
 * sideways was the Alignment buttons in the sidebar.
 *
 * So a mark in the hand turns the card's runs of free space into a **grid** of
 * squares the size the logo actually draws at — which is the whole of "the
 * outline is the shape of the thing you are dragging".
 *
 * **The square is never smaller than the logo.** It used to be clamped to fit
 * whatever it was drawn in, which drew squares a logo would never land as and
 * read as a drop that shrinks the block. A line too narrow for the mark offers
 * nothing at all.
 *
 * **And the squares never overlap**, because every one of them is outlined at
 * rest now rather than only the one under the pointer. Three across needs the
 * mark's travel to be at least two squares; two across (start and end) needs one;
 * below that the band is one square at the block's own alignment, and the
 * Alignment buttons stay the way to move a logo that large.
 *
 * **The drawn square and the box that catches the pointer are not the same.** A
 * 62px square is not something anyone can aim at with a moving pointer, so each
 * column catches an equal share of the line and the square is drawn where the
 * block will actually land. The vertical partition survives: this only ever
 * subdivides a band that `dropBands` already owns outright.
 *
 * Runs **after** `dropBands`, never before it — that function partitions the
 * card top to bottom by each slot's centre, and several slots sharing one centre
 * would collapse its arithmetic.
 *
 * A column slot is left alone: it already knows its own box, because it is the
 * room beside a block rather than a share of a run. So is anything with no
 * height, which has no square to draw in it.
 */
export function splitAlignColumns(
  bands: readonly DropBand[],
  /** How big the mark draws, in px. It is square, so this is both dimensions. */
  markSize: number,
  /** The line's own box: where a share of the card starts, and how wide it is. */
  line: { left: number; width: number },
  /**
   * Where the mark sits across its line now — the one place offered when the
   * line has room for only one. Absent is the centre, which is where a fresh
   * logo arrives.
   */
  align: CardBlockAlign = "center",
): DropBand[] {
  if (markSize <= 0) return [...bands];

  const travel = line.width - markSize;
  const fits = (band: DropBand) => band.left === undefined && band.height > 0;

  // Wider than the line it would land on: there is no square to offer, and a
  // smaller one would be a promise about a block that is not this one.
  if (travel < 0) return bands.filter((band) => !fits(band));

  const aligns: readonly CardBlockAlign[] =
    travel >= markSize * 2
      ? ["start", "center", "end"]
      : travel >= markSize
        ? ["start", "end"]
        : [align];

  const share = line.width / aligns.length;
  const at = { start: 0, center: travel / 2, end: travel } as const;

  return bands.flatMap((band) =>
    fits(band)
      ? aligns.map((column, i) => ({
          ...band,
          mark: true,
          align: column,
          left: line.left + at[column],
          width: markSize,
          hitLeft: line.left + share * i,
          hitWidth: share,
        }))
      : [band],
  );
}

/**
 * Every full-width band, drawn at the width of the block being moved.
 *
 * A narrowed block keeps its width wherever it lands — a drop never resizes
 * anything — so a run offers it a spot as wide as it is, at the start of the
 * line, which is where a block alone on a line with no `side` sits. It used to
 * be offered the whole line and widened to it on release, which drew an outline
 * twice the size of the block in the hand.
 *
 * The pointer still aims at the whole line (`hitLeft`/`hitWidth`), because the
 * room beside the spot is not somewhere else the block could go.
 *
 * A no-op for a block that is already the width of the line, and for a column
 * slot, which already knows its own box.
 */
export function fitRunsToBlock(
  bands: readonly DropBand[],
  /** How wide the block in the hand draws, in px. */
  width: number,
  line: { left: number; width: number },
): DropBand[] {
  if (width <= 0 || width >= line.width) return [...bands];

  return bands.map((band) =>
    band.left === undefined
      ? {
          ...band,
          left: line.left,
          width,
          hitLeft: line.left,
          hitWidth: line.width,
        }
      : band,
  );
}

/**
 * The smallest a band may be, in px.
 *
 * A target under about this is one nobody can hit with a moving pointer, and two
 * slots either side of a 2px divider would otherwise get a pixel each.
 */
export const MIN_BAND = 16;

/**
 * The card, divided among its slots — one contiguous band each, no gaps, no
 * overlaps.
 *
 * The boundary between two bands is the midpoint of their *centres*, which is
 * the plain reading of "nearest wins" now that a slot is a box rather than a
 * line. Two passes then pull those boundaries apart until every band clears
 * `MIN_BAND`: forwards, so no band is squeezed by the one above it, and
 * backwards, so the forward pass cannot push the last boundary past the bottom
 * of the card. Both invariants survive the pair, because the guard above them
 * proves there is room for all of them at once.
 *
 * The fallback is equal shares. It is reached only when the card genuinely
 * cannot give every slot `MIN_BAND` — a short card divided very finely — and it
 * is deliberately not "drop the ones that do not fit": a slot that exists is
 * drawn, and one with no band is a place the user can see and never reach.
 */
export function dropBands(
  slots: readonly DropSlot[],
  top: number,
  bottom: number,
): DropBand[] {
  const count = slots.length;
  const height = bottom - top;
  if (count === 0 || height <= 0) return [];

  // The middle of a place's box — which, for one with no height, is its own edge.
  const centre = (slot: DropSlot) => slot.y + slot.height / 2;

  const sorted = [...slots].sort(
    (a, b) =>
      centre(a) - centre(b) ||
      CARD_ZONES.indexOf(a.zone) - CARD_ZONES.indexOf(b.zone) ||
      a.index - b.index ||
      a.offset - b.offset,
  );

  if (count * MIN_BAND > height) {
    const share = height / count;

    return sorted.map((slot, i) => ({
      ...slot,
      top: top + share * i,
      // The last one takes the remainder outright, so rounding cannot leave a
      // sliver of the card belonging to nothing.
      bottom: i === count - 1 ? bottom : top + share * (i + 1),
    }));
  }

  const edges = new Array<number>(count + 1);
  edges[0] = top;
  edges[count] = bottom;
  for (let i = 1; i < count; i += 1) {
    edges[i] = (centre(sorted[i - 1]) + centre(sorted[i])) / 2;
  }

  for (let i = 1; i < count; i += 1) {
    edges[i] = Math.max(edges[i], edges[i - 1] + MIN_BAND);
  }

  for (let i = count - 1; i >= 1; i -= 1) {
    edges[i] = Math.min(edges[i], edges[i + 1] - MIN_BAND);
  }

  return sorted.map((slot, i) => ({
    ...slot,
    top: edges[i],
    bottom: edges[i + 1],
  }));
}

/**
 * Which part of the card aims at each place — **only the free space that place
 * is in**, and nothing outside it.
 *
 * `dropBands` used to be handed the whole card, so every pixel belonged to some
 * slot: the middle of a photo, the gap between two lines and the card's own
 * padding all aimed at whichever place was nearest. That was forgiving while the
 * only answer was an outline. Now the copy in the hand is pulled onto whatever
 * the pointer aims at (`ghost-magnet.ts`), so the nearest place would be drawn
 * too — the block carried off to a slot somewhere else on the card while the
 * pointer sits over a block — and dropping only where there is room is what was
 * asked for. So each run of free space is divided among its own slots, by the
 * same centres `dropBands` has always used, and everything between runs aims at
 * nothing: the copy follows the hand there, and a release is caught by the
 * card's own catch-all (`card:frame` in card-canvas.tsx) and does nothing.
 *
 * **Grouped by run**, `zone:index`. Every slot `run` emits carries its run's
 * index and its run's area, and no two runs in a zone share an index.
 *
 * **A place with no free space of its own catches its own box.** A logo
 * straddling the block above it names an empty area (`areaTop === areaBottom`)
 * and is still a real drop. Those boxes are listed *after* the runs, so where
 * one hangs into free space below the edge it straddles, the square wins inside
 * its own box — the same last-painted-wins rule the overlay's layers rest on.
 *
 * Column slots do not come through here. They are not part of a run, and their
 * band is their own rect (`useCardDropBands`).
 */
export function areaBands(slots: readonly DropSlot[]): DropBand[] {
  const runs = new Map<string, DropSlot[]>();
  const own: DropBand[] = [];

  for (const slot of slots) {
    const { areaTop, areaBottom } = slot;

    if (areaTop === undefined || areaBottom === undefined || areaBottom <= areaTop) {
      if (slot.height > 0) {
        own.push({ ...slot, top: slot.y, bottom: slot.y + slot.height });
      }
      continue;
    }

    const key = `${slot.zone}:${String(slot.index)}`;
    runs.set(key, [...(runs.get(key) ?? []), slot]);
  }

  const bands = [...runs.values()].flatMap((run) =>
    dropBands(run, run[0].areaTop ?? 0, run[0].areaBottom ?? 0),
  );

  return [...bands, ...own];
}
