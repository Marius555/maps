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
 * That buys three things at once:
 *
 * - **Nothing on the card moves.** The chrome is not in the layout at all, so it
 *   cannot resize, reflow or clip anything, and a target is free to be as large
 *   as it likes — which is what lets the *drawn* mark be the size of the block
 *   while the *hit area* is the size of a fair share of the card.
 * - **They cannot overlap.** `dropBands` *partitions* the card: every pixel
 *   belongs to exactly one slot. However thin the block between two slots is,
 *   their two bands are still disjoint.
 * - **Nearest wins.** Because the partition covers the whole card there is no
 *   dead space and nothing to aim at precisely — and when only one zone accepts
 *   the drag (`actions` may only go at the bottom), the entire card aims at it.
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
): boolean {
  const drag = toCardDrag(dragged);
  if (!drag) return false;
  if (!hasRoomFor(layout, zone, drag, heights)) return false;

  if (drag.kind === "new") return acceptsBlock(layout, drag.type, zone);

  const block = CARD_ZONES.flatMap((other) => layout.zones[other]).find(
    (candidate) => candidate.id === drag.id,
  );

  return block ? acceptsBlock(layout, block.type, zone, block.id) : false;
}

/** A slot, plus the slice of the card that aims at it. */
export type DropBand = DropSlot & { top: number; bottom: number };

/**
 * Every full-width band, divided into the three places a **mark** could sit
 * across it: the start of the line, its middle, and its end.
 *
 * A logo is the one block whose position has two degrees of freedom. Everything
 * else fills the line it lands on, so "where does this go" is one number and one
 * band down the card answers it; a mark is a square, so the same band is really
 * three places and offering it as one meant the only way to move a logo sideways
 * was the Alignment buttons in the sidebar. Dragging it did nothing at all,
 * which on a canvas you arrange by dragging reads as the block being stuck.
 *
 * So a mark in the hand turns the card's runs of free space into a **grid** —
 * three square outlines across, however many rows of them the free space holds.
 * The square is the size the logo actually draws at, which is the same promise
 * every other mark makes about the block it stands for, and it is the whole of
 * "the outline should be the shape of the thing you are dragging".
 *
 * **The drawn square and the box that catches the pointer are not the same**, in
 * exactly the way `hitTop`/`hitBottom` already separates them vertically. A 62px
 * square is not something anyone can aim at with a moving pointer, so each
 * column catches a full third of the line and the square is drawn where the
 * block will actually land. The partition survives: this only ever subdivides a
 * band that `dropBands` already owns outright, so every pixel still belongs to
 * exactly one slot.
 *
 * Runs **after** `dropBands`, never before it — that function partitions the
 * card top to bottom by each slot's centre, and three slots sharing one centre
 * would collapse its arithmetic.
 *
 * Two kinds of band are left alone. A seam has no height, so there is no square
 * to draw in it and nothing for the three columns to be three of; and a column
 * slot already knows its own box, because it is the room beside a block rather
 * than a share of the card.
 */
export function splitAlignColumns(
  bands: readonly DropBand[],
  /** How big the mark draws, in px. It is square, so this is both dimensions. */
  markSize: number,
  /** The line's own box: where a share of the card starts, and how wide it is. */
  line: { left: number; width: number },
): DropBand[] {
  const size = Math.min(markSize, line.width);
  const travel = line.width - size;

  /*
   * A mark that fills its line has nowhere to be aligned *to*: the three squares
   * would be drawn within a few pixels of each other, three separate drop
   * targets stacked on one box. The band stays whole, and the Alignment buttons
   * remain the way to move a logo that large.
   */
  if (size <= 0 || travel < MIN_BAND) return [...bands];

  const third = line.width / 3;
  const columns: { align: CardBlockAlign; left: number; hitLeft: number }[] = [
    { align: "start", left: line.left, hitLeft: line.left },
    {
      align: "center",
      left: line.left + travel / 2,
      hitLeft: line.left + third,
    },
    { align: "end", left: line.left + travel, hitLeft: line.left + third * 2 },
  ];

  return bands.flatMap((band) =>
    band.left !== undefined || band.height <= 0
      ? [band]
      : columns.map((column) => ({
          ...band,
          mark: true,
          align: column.align,
          left: column.left,
          width: size,
          hitLeft: column.hitLeft,
          hitWidth: third,
        })),
  );
}

/**
 * One contiguous area of the card a block may go into, as the resting layer
 * draws it.
 *
 * **A region is not a slot, and the difference is the whole reason this exists.**
 * A run of free space is divided into as many slots as the block in hand fits
 * into (`run` in ./drop-slots.ts), so an empty 440px card with a name in the air
 * is *thirteen* places. Drawing thirteen stacked outlines is what made the
 * all-marks-at-once overlay unreadable, and drawing none of them is what made
 * the gesture undiscoverable — you had to sweep the card to find out where a
 * block could go. A region is the union of a run's slots: one faint outline
 * saying *anywhere in here*, with the bold mark still saying *exactly here* as
 * the pointer moves inside it.
 *
 * Column and pair targets each come out as a region of their own, because they
 * differ in the fields the key is built from: the room beside a narrowed block
 * is drawn as the box that block will actually fill. The align grid does not.
 * Where a mark sits *across* a line is a fact about aiming, and it belongs to
 * the hit areas and the bold mark; the resting layer answers "where is there
 * room", and for a logo the answer is the same run every other block gets —
 * three tall dashed columns down a card is what the other reading looked like.
 * See `useCardDropBands`, which is where the two volumes part company.
 */
export type DropRegion = {
  /** What distinguishes it from the next region, and its React key. */
  key: string;
  /** Where it is drawn, in px from the card's top. */
  y: number;
  height: number;
  /**
   * Where it is drawn horizontally, in px from the card's left. Absent spans the
   * card's own padding, which is what a full-width block's box does.
   */
  left?: number;
  width?: number;
};

/**
 * Every place this drag could go, as areas rather than as slots.
 *
 * Grouped by everything that makes two slots mean different *places* — the zone,
 * the insertion index, and the two fields that put a target across a line rather
 * than down the card. Every slot one run emits carries that run's own index, and
 * no two runs in a zone share one, so a group is exactly a run.
 *
 * **Drawn from the area a slot names, not from the box drawn for it.** A run's
 * marks are spread through their free space and the first is lifted over the
 * block above them, so their union both starts higher than the room does and
 * stops short of the end of it — see `areaTop` on `DropSlot`. A column target
 * names no area, and there its own box is the honest answer: the room beside a
 * block *is* what it stands for.
 *
 * **Two places show nothing at rest.** A seam is a line, and it always lands on
 * a boundary something else already owns: the bottom edge of the block above it,
 * or the card edge where the next zone's first outline begins. A mark straddling
 * the block above it spends no room at all, so its area is empty and any outline
 * would be drawn over a block that is already on the card. Both stay marks under
 * the pointer alone — the argument `.card-drop-seam` in app/globals.css makes.
 */
export function dropRegions(bands: readonly DropBand[]): DropRegion[] {
  const regions = new Map<string, DropRegion>();

  for (const band of bands) {
    const bandTop = band.areaTop ?? band.y;
    const bandBottom = band.areaBottom ?? band.y + band.height;

    // One guard for everything with nothing to show: a seam, whose own box is a
    // line, and a straddling mark, whose area is empty because it spends no room.
    if (bandBottom - bandTop <= 0) continue;

    const key = [band.zone, band.index, band.half ?? "", band.line ?? ""].join(":");

    const region = regions.get(key);

    if (!region) {
      regions.set(key, {
        key,
        y: bandTop,
        height: bandBottom - bandTop,
        ...(band.left === undefined
          ? {}
          : { left: band.left, width: band.width ?? 0 }),
      });
      continue;
    }

    const top = Math.min(region.y, bandTop);
    const bottom = Math.max(region.y + region.height, bandBottom);
    region.y = top;
    region.height = bottom - top;

    if (band.left !== undefined && region.left !== undefined) {
      const left = Math.min(region.left, band.left);
      const right = Math.max(
        region.left + (region.width ?? 0),
        band.left + (band.width ?? 0),
      );
      region.left = left;
      region.width = right - left;
    }
  }

  return [...regions.values()];
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

  // A seam has no height, so its centre is the seam itself — which is exactly
  // where a zero-height mark is drawn.
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
