import { describe, expect, it } from "vitest";

import type { DraggedObject } from "@/components/groups/use-row-drag";
import {
  MIN_BAND,
  areaBands,
  dropBands,
  dropRegions,
  splitAlignColumns,
  toCardDrag,
  type DropBand,
} from "./drop-bands";

import type { DropSlot } from "./drop-slots";

/**
 * The rules a person feels as "I can drop it there and the two targets never
 * tangle", asked here instead. Where the *places* come from is
 * `drop-slots.test.ts`; this is only how the free space is divided among them.
 *
 * Every number is px against a 440px card, which is what `defaultCardLayout` is.
 */

/**
 * A place with no height of its own: the bare arithmetic of dividing by centres,
 * with no box in the way. The card no longer offers one — a run with no room for
 * the block offers nothing (`run` in ./drop-slots.ts) — but `dropBands` still
 * has to divide them correctly.
 */
const point = (y: number, index = 0): DropSlot => ({
  zone: "middle",
  index,
  y,
  height: 0,
  offset: 0,
});

/** A place with a block-sized box, which bands against its own centre. */
const box = (y: number, height: number, index = 0): DropSlot => ({
  zone: "middle",
  index,
  y,
  height,
  offset: 0,
});

/** The one property everything below depends on: a partition, not a pile. */
function expectPartition(
  bands: { top: number; bottom: number }[],
  top: number,
  bottom: number,
) {
  expect(bands[0].top).toBeCloseTo(top);
  expect(bands.at(-1)?.bottom).toBeCloseTo(bottom);

  for (let i = 1; i < bands.length; i += 1) {
    // No gap and no overlap: one band ends exactly where the next begins.
    expect(bands[i].top).toBeCloseTo(bands[i - 1].bottom);
  }
}

describe("dropBands", () => {
  it("gives one place the whole of what it is given", () => {
    const bands = dropBands([point(220)], 0, 440);

    expect(bands).toEqual([
      { zone: "middle", index: 0, y: 220, height: 0, offset: 0, top: 0, bottom: 440 },
    ]);
  });

  it("splits at the midpoint between two places", () => {
    const bands = dropBands([point(100, 0), point(300, 1)], 0, 440);

    expectPartition(bands, 0, 440);
    expect(bands[0].bottom).toBe(200);
    expect(bands[1].top).toBe(200);
  });

  it("divides a box by its centre, not by its top edge", () => {
    /*
     * A slot is a box the size of the block now, not a line. Two boxes stacked
     * with no room between them share the boundary halfway down the pair, which
     * is the plain reading of "nearest wins" — measuring from their top edges
     * would give the upper box a band ending inside itself.
     */
    const bands = dropBands([box(0, 100, 0), box(100, 100, 1)], 0, 440);

    expectPartition(bands, 0, 440);
    expect(bands[0].bottom).toBe(100);
  });

  it("orders by position, whatever order the places arrive in", () => {
    const bands = dropBands([point(300, 1), point(100, 0)], 0, 440);

    expect(bands.map((band) => band.y)).toEqual([100, 300]);
  });

  it("keeps two places either side of a divider apart", () => {
    /*
     * The bug this whole module exists for. A divider is a couple of pixels
     * tall, so a place above it and a place below it sit 2px apart — as in-flow
     * lanes they drew over each other and over the divider.
     */
    const bands = dropBands([point(200, 0), point(202, 1)], 0, 440);

    expectPartition(bands, 0, 440);
    for (const band of bands) {
      expect(band.bottom - band.top).toBeGreaterThanOrEqual(MIN_BAND);
    }
  });

  it("never lets the minimum push the last band past the card", () => {
    // Four places crowded at the bottom: the forward pass alone would walk the
    // boundaries off the end of the card. The backward pass is what pulls them
    // back inside it.
    const bands = dropBands(
      [point(400, 0), point(410, 1), point(420, 2), point(430, 3)],
      0,
      440,
    );

    expectPartition(bands, 0, 440);
    for (const band of bands) {
      expect(band.bottom - band.top).toBeGreaterThanOrEqual(MIN_BAND);
      expect(band.top).toBeGreaterThanOrEqual(0);
      expect(band.bottom).toBeLessThanOrEqual(440);
    }
  });

  it("falls back to equal shares when the card cannot fit a minimum each", () => {
    // Five places in 40px: 16px each is 80px, which the card does not have.
    // Every place still gets a band, because one that exists and cannot be
    // reached is worse than one that is small.
    const bands = dropBands(
      [point(0, 0), point(10, 1), point(20, 2), point(30, 3), point(40, 4)],
      0,
      40,
    );

    expectPartition(bands, 0, 40);
    expect(bands).toHaveLength(5);
    for (const band of bands) expect(band.bottom - band.top).toBeCloseTo(8);
  });

  it("has nothing to divide when nothing accepts the drag", () => {
    expect(dropBands([], 0, 440)).toEqual([]);
  });
});

describe("areaBands", () => {
  /** A run's place: a name-sized box inside the free space it names. */
  const inRun = (
    y: number,
    areaTop: number,
    areaBottom: number,
    rest: Partial<DropSlot> = {},
  ): DropSlot => ({
    ...box(y, 24, rest.index ?? 0),
    areaTop,
    areaBottom,
    ...rest,
  });

  it("divides a run between its own places and stops at its edges", () => {
    // Free space from 48 to 140 holds three names. Above 48 and below 140 is a
    // block or a gap, and it aims at nothing.
    const bands = areaBands([
      inRun(48, 48, 140),
      inRun(82, 48, 140),
      inRun(116, 48, 140),
    ]);

    expect(bands).toHaveLength(3);
    expectPartition(bands, 48, 140);
  });

  it("gives the space between two runs to nobody", () => {
    // Two runs in one zone with a block between them, 140 to 208.
    const bands = areaBands([
      inRun(48, 48, 140),
      inRun(208, 208, 300, { index: 2 }),
    ]);

    expect(bands.map((band) => [band.top, band.bottom])).toEqual([
      [48, 140],
      [208, 300],
    ]);
  });

  it("keeps runs in different zones apart, even at the same index", () => {
    const bands = areaBands([
      inRun(12, 12, 60, { zone: "top" }),
      inRun(80, 80, 200, { zone: "middle" }),
    ]);

    expect(bands.map((band) => [band.zone, band.top, band.bottom])).toEqual([
      ["top", 12, 60],
      ["middle", 80, 200],
    ]);
  });

  it("lets a place with no free space of its own catch its own box, last", () => {
    /*
     * A logo straddling the photo above it: its area is empty (130 to 130) and
     * its square is drawn from 99 to 161, half over the photo. It comes after the
     * runs, so where it hangs into the free space below, the square wins inside
     * its own box.
     */
    const bands = areaBands([
      inRun(99, 130, 130, { zone: "top", index: 1, height: 62 }),
      inRun(130, 130, 428),
    ]);

    expect(bands.map((band) => [band.zone, band.top, band.bottom])).toEqual([
      ["middle", 130, 428],
      ["top", 99, 161],
    ]);
  });

  it("has nothing to divide when nothing accepts the drag", () => {
    expect(areaBands([])).toEqual([]);
  });
});

const newBlock = (type: string): DraggedObject => ({ type: "card-new", id: type });
const moveBlock = (id: string): DraggedObject => ({ type: "card-block", id });

describe("toCardDrag", () => {
  it("reads the palette's chips and the card's own blocks", () => {
    expect(toCardDrag(newBlock("hours"))).toEqual({ kind: "new", type: "hours" });
    expect(toCardDrag(moveBlock("abc"))).toEqual({ kind: "move", id: "abc" });
  });

  it("is null for every other kind of drag", () => {
    expect(toCardDrag({ type: "place", id: "p1" })).toBeNull();
    expect(toCardDrag({ type: "group", id: "g1" })).toBeNull();
  });
});

describe("splitAlignColumns", () => {
  /*
   * The grid a mark in the hand turns the card's free space into.
   *
   * The line is the default card's: 296px across, running from 12 to 308. The
   * mark is a 62px square — a logo at its default 14% of a 440px card — so it
   * has 234px of travel across that line, and each column catches a third of it
   * (98.67px).
   */
  const line = { left: 12, width: 296 };
  const banded = (slots: DropSlot[]) => dropBands(slots, 0, 440);

  it("draws one square per place across the line, and catches a third each", () => {
    const columns = splitAlignColumns(banded([box(100, 62)]), 62, line);

    expect(columns.map((band) => band.align)).toEqual([
      "start",
      "center",
      "end",
    ]);
    // Drawn where the block will actually land: hard left, centred, hard right.
    expect(columns.map((band) => band.left)).toEqual([12, 129, 246]);
    expect(columns.every((band) => band.width === 62)).toBe(true);
    // And caught across a third of the line each, because nobody can aim a
    // moving pointer at 62px.
    expect(columns.map((band) => band.hitLeft)).toEqual([12, 12 + 296 / 3, 12 + (296 / 3) * 2]);
    expect(columns.every((band) => band.hitWidth === 296 / 3)).toBe(true);
  });

  it("leaves the vertical partition exactly as it found it", () => {
    /*
     * The invariant the whole overlay rests on. This subdivides bands
     * `dropBands` already owns outright, so all three columns of a place inherit
     * its band and every pixel still belongs to exactly one slot — which is why
     * it has to run *after* the partition rather than before it.
     */
    const bands = banded([box(40, 62), box(150, 62), box(260, 62)]);
    const columns = splitAlignColumns(bands, 62, line);

    expect(columns).toHaveLength(9);

    for (let i = 0; i < 3; i += 1) {
      for (const column of columns.slice(i * 3, i * 3 + 3)) {
        expect([column.top, column.bottom]).toEqual([bands[i].top, bands[i].bottom]);
      }
    }
  });

  it("leaves a column slot, and anything with no height, alone", () => {
    // A column slot already knows its own box, because it is the room beside a
    // block rather than a share of a run; a place with no height has no square
    // to draw in it.
    const column: DropSlot = { ...box(100, 62), left: 12, width: 140, half: "start" };
    const bands = banded([point(40), column]);

    expect(splitAlignColumns(bands, 62, line)).toEqual(bands);
  });

  it("does not offer three places to a mark that fills its line", () => {
    /*
     * Three squares within a few pixels of each other are three separate drop
     * targets stacked on one box, which is worse than not offering the gesture
     * at all. Above about 280px of a 296px line there is nothing left to move
     * the mark *to*, and the Alignment buttons stay the way to do it.
     */
    const bands = banded([box(100, 290)]);

    expect(splitAlignColumns(bands, 290, line)).toEqual(bands);
  });

  it("is a no-op for a drag that is not a mark", () => {
    // Everything else fills the line it lands on, so its position across that
    // line is not a question and one band per place is the whole answer.
    const bands = banded([box(40, 24), box(120, 24)]);

    expect(splitAlignColumns(bands, 0, line)).toEqual(bands);
  });
});

describe("dropRegions", () => {
  /** A band as `dropBands` leaves one: a drawn box and the share it catches. */
  const band = (
    y: number,
    height: number,
    top: number,
    bottom: number,
    rest: Partial<DropBand> = {},
  ): DropBand => ({
    zone: "middle",
    index: 0,
    y,
    height,
    offset: y - 12,
    top,
    bottom,
    ...rest,
  });

  it("merges a run's places into the one area they came from", () => {
    /*
     * The whole reason this exists. Three names' worth of free space is three
     * places to `dropSlots`, and three stacked outlines is what made drawing
     * every place unreadable. It is one area: 12 to 100, which is the first
     * box's top to the last one's bottom.
     */
    expect(
      dropRegions([
        band(12, 24, 12, 44),
        band(44, 24, 44, 76),
        band(76, 24, 76, 100),
      ]),
    ).toEqual([{ key: "middle:0::", y: 12, height: 88 }]);
  });

  it("keeps two runs of the same zone apart", () => {
    // Different insertion indexes, so different places — the free space above a
    // block and the free space below it are not one area with the block in it.
    const regions = dropRegions([
      band(12, 24, 12, 44),
      band(160, 24, 150, 190, { index: 2, offset: 0 }),
    ]);

    expect(regions).toHaveLength(2);
    expect(regions.map((region) => region.y)).toEqual([12, 160]);
  });

  it("draws nothing for a place with no height", () => {
    // Nothing to outline is nothing drawn. The card no longer offers such a
    // place — this is the guard, not a case anyone reaches.
    expect(dropRegions([band(220, 0, 0, 440)])).toEqual([]);
  });

  it("draws the free space a run names, not the boxes drawn inside it", () => {
    /*
     * The user-visible bug this whole change is: with a logo in hand the faint
     * outlines were tall dashed columns, and the top of each sat *inside* the
     * photo above it.
     *
     * A mark is drawn where it lands, and the first of a run lands half over the
     * block above — so its box starts 31px higher than the room does. The area
     * is the room: 130 down to 428, whatever the marks in it are doing.
     */
    const regions = dropRegions([
      band(99, 62, 90, 170, { areaTop: 130, areaBottom: 428 }),
      band(209, 62, 170, 248, { areaTop: 130, areaBottom: 428 }),
      band(366, 62, 248, 440, { areaTop: 130, areaBottom: 428 }),
    ]);

    expect(regions).toEqual([{ key: "middle:0::", y: 130, height: 298 }]);
  });

  it("gives a place with no room of its own no area either", () => {
    /*
     * A mark straddling the block above it: the run has no span, the square is
     * drawn half over that block, and the area is empty to say so. Drawn at rest
     * it was a faint box over a photo — a place offered on top of something that
     * is already on the card.
     */
    expect(dropRegions([band(99, 62, 90, 170, { areaTop: 130, areaBottom: 130 })])).toEqual(
      [],
    );
  });

  it("keeps a column beside a block out of the run below it", () => {
    // Both are "insert at index 1, with no leading space"; `half` is the only
    // thing that says one is across a line and the other is down the card. It is
    // the same collision `slotId` had to grow a suffix for.
    const regions = dropRegions([
      band(12, 28, 12, 40, { index: 1, half: "end", line: 0, left: 160, width: 144 }),
      band(48, 24, 40, 80, { index: 1, offset: 0 }),
    ]);

    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ left: 160, width: 144 });
    // And the run keeps the card's own padding, which is what `left: undefined`
    // means to the overlay.
    expect(regions[1].left).toBeUndefined();
  });

  it("unions the boxes sideways as well as down", () => {
    // Not a shape any run produces today, and the arithmetic should not care:
    // a region is the box its members fit inside, on both axes.
    expect(
      dropRegions([
        band(12, 24, 12, 44, { left: 12, width: 100 }),
        band(44, 24, 44, 76, { left: 60, width: 120 }),
      ]),
    ).toEqual([{ key: "middle:0::", y: 12, height: 56, left: 12, width: 168 }]);
  });
});
