import { describe, expect, it } from "vitest";

import type { DraggedObject } from "@/components/groups/use-row-drag";
import {
  cardRows,
  defaultCardLayout,
  type CardLayout,
} from "@/packages/shared/card-layout";
import { dropCardBlock } from "./card-edits";
import { toCardDrag } from "./drop-bands";
import {
  blockedFaces,
  dropSlots,
  lendToEndZones,
  sideSlots,
  vacatedSpace,
  zoneHeights,
  type DropSlot,
  type HeightAt,
  type ZoneMeasure,
} from "./drop-slots";

/**
 * "Every place it fits", asked in numbers.
 *
 * The card is `defaultCardLayout()` — 440px tall, 12px of padding, an 8px gap —
 * and the block in the air is 24px unless a test says otherwise, so one place
 * costs 32px of the run it sits in. Every expectation below is that arithmetic
 * written out, because the whole feature is the arithmetic: an outline drawn
 * where the block will not land is worse than no outline at all.
 */

/** A card holding exactly these blocks, and nothing else. */
const cardWith = (zones: Partial<CardLayout["zones"]>): CardLayout => ({
  ...defaultCardLayout(),
  zones: { top: [], middle: [], bottom: [], ...zones },
});

/**
 * A zone as it measures — every edge is a *content* edge.
 *
 * The horizontal pair defaults to the default card's own: 320px wide with 12px
 * of padding is a line 296px across, running from 12 to 308. That is what a
 * block's share is a share of, so it is what `sideSlots` divides.
 */
const zoneOf = (
  zone: ZoneMeasure["zone"],
  top: number,
  bottom: number,
  blocks: ZoneMeasure["blocks"] = [],
  left = 12,
  right = 308,
): ZoneMeasure => ({ zone, top, bottom, left, right, blocks });

/**
 * How wide a column of this share draws on the default card, in px.
 *
 * `blockBox` gives a share of `s` the basis `calc(s% - gap/2)`, so this is that
 * arithmetic — written out rather than imported, because a test that computes
 * its expectation the way the code does proves nothing.
 */
const columnPx = (share: number) => (296 * share) / 100 - 4;

const newBlock = (type: string): DraggedObject => ({ type: "card-new", id: type });
const moveBlock = (id: string): DraggedObject => ({ type: "card-block", id });

describe("dropSlots", () => {
  it("divides an empty zone into every place the block fits", () => {
    /*
     * The complaint this whole model answers: an empty card used to offer three
     * places — top, middle, bottom — because the question being asked was "what
     * index in which list", and an empty list has one. 416px of free middle zone
     * holds thirteen 24px names at an 8px gap, so it offers thirteen.
     */
    const slots = dropSlots(
      cardWith({}),
      newBlock("name"),
      [zoneOf("middle", 12, 428)],
      24,
    );

    expect(slots).toHaveLength(13);
    expect(slots[0]).toEqual({
      zone: "middle",
      index: 0,
      y: 12,
      height: 24,
      offset: 0,
      // And every one of the thirteen names the same free space it came out of,
      // which is what each one's share of the pointer is cut from.
      areaTop: 12,
      areaBottom: 428,
    });
    /*
     * And they are spread across the whole run rather than packed against its
     * top. Thirteen 24px blocks and twelve 8px gaps is 408 of the 416 available,
     * so the 8 left over is shared between the twelve spaces — a third of a
     * pixel each. The seventh place is six of those steps down, and that is
     * exactly what the block stores, which is what makes it stay there instead
     * of snapping to the top.
     */
    expect(slots[6]).toMatchObject({ y: 12 + 196, offset: 196 });
    // The last one ends flush with the bottom of the run: 404 + 24 = 428.
    expect(slots.at(-1)).toMatchObject({ y: 12 + 392, offset: 392 });
  });

  it("spreads a tall block's places evenly, with nothing left at the bottom", () => {
    /*
     * The complaint, in numbers. A 110px photo used to be offered three places
     * one 118px step apart — 0, 118, 236 — which put all three in the top
     * three-quarters of a 440px card and left 94px of plainly empty card at the
     * bottom offering nothing. The count is honest either way; what was wrong
     * was packing them.
     *
     * Shared out, the same three places are 0, 165 and 330: the top, the middle
     * and the bottom, with 55px between each, and the last one ending exactly on
     * the card's own edge.
     */
    const slots = dropSlots(cardWith({}), newBlock("gallery"), [
      zoneOf("middle", 0, 440),
    ], 110);

    expect(slots.map((slot) => slot.offset)).toEqual([0, 165, 330]);
    expect(slots.at(-1)!.y + slots.at(-1)!.height).toBe(440);

    // Equal gaps is the property, not the numbers: the space between each pair
    // of neighbours is the same all the way down.
    const gaps = slots
      .slice(1)
      .map((slot, i) => slot.y - (slots[i].y + slots[i].height));

    expect(new Set(gaps).size).toBe(1);
  });

  it("leaves a single place at the start of its run", () => {
    // There is no space *between* one slot and another to share the slack out
    // into, and a lone mark floating mid-run would be at a position nobody
    // chose. It stays where the run starts, exactly as it always did.
    const slots = dropSlots(cardWith({}), newBlock("gallery"), [
      zoneOf("middle", 12, 160),
    ], 110);

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ y: 12, offset: 0 });
  });

  it("counts the room after the last block, gap included", () => {
    const layout = cardWith({ middle: [{ id: "a", type: "name" }] });
    const slots = dropSlots(
      layout,
      newBlock("address"),
      [zoneOf("middle", 12, 428, [{ id: "a", top: 12, bottom: 40 }])],
      24,
    );

    // 388px below the block. The first place pays the gap after it, so twelve
    // fit rather than thirteen.
    const after = slots.filter((slot) => slot.index === 1);
    expect(after).toHaveLength(12);
    expect(after[0]).toEqual({
      zone: "middle",
      index: 1,
      y: 48,
      height: 24,
      offset: 0,
      // The area pays the same gap the first place does, so the pointer's share
      // starts below the block rather than against it.
      areaTop: 48,
      areaBottom: 428,
    });
  });

  it("offers nothing between two blocks with no room between them", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "address" },
      ],
    });

    const slots = dropSlots(
      layout,
      newBlock("description"),
      [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40 },
          { id: "b", top: 48, bottom: 76 },
        ]),
      ],
      24,
    );

    // This used to be a seam — a zero-height place on b's top edge that pushed
    // b down to make room. A block goes where there is space for it, and between
    // two touching blocks there is none.
    expect(slots.filter((slot) => slot.index === 1)).toEqual([]);
  });

  it("puts the block after it back exactly where it was", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "address", offset: 72 },
      ],
    });

    // 80px between them, of which 8 is the gap: two places.
    const slots = dropSlots(
      layout,
      newBlock("description"),
      [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40 },
          { id: "b", top: 120, bottom: 148 },
        ]),
      ],
      24,
    );

    const between = slots.filter((slot) => slot.index === 1);
    expect(between).toHaveLength(2);

    for (const slot of between) {
      // Whichever place is taken, b's own top edge lands back on 120: the new
      // block's bottom, plus the gap, plus what b's leading space becomes.
      expect(slot.y + 24 + 8 + (slot.nextOffset ?? 0)).toBe(120);
    }
  });

  it("treats the block in your hand as free space", () => {
    /*
     * A move is still drawn on the card, dimmed, but its box is about to be
     * freed — so the run either side of it is one run, and it can be dropped
     * back into the middle of that run rather than only above or below itself.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "m", type: "category" },
        { id: "b", type: "address" },
      ],
    });

    const slots = dropSlots(
      layout,
      moveBlock("m"),
      [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40 },
          { id: "m", top: 48, bottom: 76 },
          { id: "b", top: 84, bottom: 112 },
        ]),
      ],
      28,
    );

    // The gap a and b would leave behind holds exactly one 28px block, and it
    // is offered under b's own index — a and b are 0 and 2 in the layout's own
    // list, and skipping the moved block must not rename them.
    const between = slots.filter((slot) => slot.index === 2);
    expect(between).toEqual([
      {
        zone: "middle",
        index: 2,
        y: 48,
        height: 28,
        offset: 0,
        nextOffset: 0,
        // Closed at both ends, so the area is the run less a gap at each: the
        // 40–84 hole between a and b, held off both of them.
        areaTop: 48,
        areaBottom: 76,
      },
    ]);

    // And there is somewhere else to put it, which is the point.
    expect(slots.filter((slot) => slot.index === 3).length).toBeGreaterThan(1);
  });

  it("offers nothing at all in a zone the block may not enter", () => {
    // Actions are bottom-only, so the top and middle contribute nothing however
    // much room they have — the bottom zone's own 48px is the only place offered.
    const slots = dropSlots(
      cardWith({}),
      newBlock("actions"),
      [
        zoneOf("top", 12, 12),
        zoneOf("middle", 12, 380),
        zoneOf("bottom", 380, 428),
      ],
      24,
    );

    expect(slots).toEqual([
      {
        zone: "bottom",
        index: 0,
        y: 380,
        height: 24,
        offset: 0,
        areaTop: 380,
        areaBottom: 428,
      },
    ]);
  });

  it("offers nothing in a zone with no room left, measured rather than assumed", () => {
    // A 408px photo plus the card's own 24px of padding is 432 of a 440px card,
    // so a 26px spacer fits nowhere the card would not clip it. Top and bottom
    // are what it clips; the middle is its scroller and always has room.
    const layout = cardWith({
      top: [{ id: "photo", type: "gallery", heightPct: 25 }],
    });

    const slots = dropSlots(
      layout,
      newBlock("spacer"),
      [
        zoneOf("top", 12, 420, [{ id: "photo", top: 12, bottom: 420 }]),
        zoneOf("bottom", 430, 440),
      ],
      26,
    );

    expect(slots).toEqual([]);
  });

  it("lets a block already on the card go back into the room it leaves", () => {
    // A move needs no *new* room — the block is already counted — so a full card
    // still offers the space the block itself is about to free. It does not offer
    // the bottom zone's 10px: a 408px photo does not fit there, and a block goes
    // where there is room for it. That used to be a seam, and this test used to
    // assert it.
    const layout = cardWith({
      top: [{ id: "photo", type: "gallery", heightPct: 25 }],
    });

    const slots = dropSlots(
      layout,
      moveBlock("photo"),
      [
        zoneOf("top", 12, 420, [{ id: "photo", top: 12, bottom: 420 }]),
        zoneOf("bottom", 430, 440),
      ],
      408,
    );

    expect(slots.map((slot) => [slot.zone, slot.y, slot.height])).toEqual([
      ["top", 12, 408],
    ]);
  });

  it("clamps a place into its own zone, for the scroller", () => {
    // The middle zone scrolls, so a block scrolled out of view still has a rect
    // and it is somewhere the card cannot draw.
    const layout = cardWith({ middle: [{ id: "a", type: "name" }] });

    const slots = dropSlots(
      layout,
      newBlock("description"),
      [zoneOf("middle", 100, 200, [{ id: "a", top: 40, bottom: 68 }])],
      24,
    );

    for (const slot of slots) {
      expect(slot.y).toBeGreaterThanOrEqual(100);
      expect(slot.y + slot.height).toBeLessThanOrEqual(200);
    }
  });

  it("does not divide free space by a block that measures nothing", () => {
    // A category block on a location with no category draws nothing at all. Its
    // measured height is zero, and free space divided by a gap alone is fifty
    // places for a block that will not stay that small.
    const slots = dropSlots(
      cardWith({}),
      newBlock("category"),
      [zoneOf("middle", 12, 428)],
      0,
    );

    expect(slots).toHaveLength(13);
  });

  /*
   * A logo is the one block that does not land where its offset says.
   *
   * It arrives with `overlapPct: 50` and `blockEdges` turns that into a
   * negative `margin-top` of half its own height for any logo that is not the
   * first block of its zone — 31px on the default card, since 14% of 440 is 62.
   * The card below is a 110px photo across the top of the top zone, which is
   * what every one of these numbers is measured from.
   */
  const withPhoto = cardWith({ top: [{ id: "g", type: "gallery", heightPct: 25 }] });
  const photoAt = (top: number, bottom: number) => [
    zoneOf("top", 12, 428, [{ id: "g", top, bottom }]),
  ];

  it("draws the mark under a photo where the logo actually straddles it", () => {
    const slots = dropSlots(withPhoto, newBlock("logo"), photoAt(12, 122), 62);

    /*
     * 306px of run below the photo, less the 8px gap it opens with, holds four
     * 62px logos at 70px a place with 26px of slack shared between the three
     * spaces — so the offsets are 0, 79, 157 and 236, exactly as they would be
     * for any other block of that height.
     */
    const below = slots.filter((slot) => slot.index === 1);
    expect(below).toHaveLength(4);

    /*
     * The first place is flush against the photo, and straddling it is the whole
     * reason the overlap exists. So the *offset* stays at nothing and the mark
     * moves instead: 122 + 8 - 31, which is the box the logo will fill, half
     * over the picture. Drawn where it lands, rather than 31px below it with the
     * logo's own centre on its top border.
     */
    expect(below[0]).toEqual({
      zone: "top",
      index: 1,
      y: 99,
      height: 62,
      offset: 0,
      areaTop: 130,
      areaBottom: 428,
    });
    expect(below[0].y + 31).toBe(122 + 8);
  });

  it("cancels the pull for a place that has nothing to straddle", () => {
    const slots = dropSlots(withPhoto, newBlock("logo"), photoAt(12, 122), 62);
    const below = slots.filter((slot) => slot.index === 1);

    /*
     * Every place below the first sits in open space. Pulling the block up there
     * drags it into empty air rather than over anything, so the mark stays where
     * the run put it and the lift is folded into the stored offset —
     * `blockEdges` subtracts it straight back out, and the logo lands filling
     * the box that was drawn.
     */
    expect(below.slice(1).map((slot) => slot.y)).toEqual([209, 287, 366]);
    expect(below.slice(1).map((slot) => slot.offset)).toEqual([110, 188, 267]);

    for (const slot of below.slice(1)) {
      // Where the block lands: the photo's bottom, the gap, the stored offset,
      // less the overlap the renderer will apply.
      expect(122 + 8 + slot.offset - 31).toBe(slot.y);
    }
  });

  it("leaves the run above a photo alone, where no overlap applies", () => {
    /*
     * A block landing at its zone's own top is that zone's first, and
     * `blockEdges` only overlaps against a sibling — so there is nothing to
     * correct, and a card with no photo above the logo has to draw exactly what
     * it drew before any of this existed.
     */
    const slots = dropSlots(withPhoto, newBlock("logo"), photoAt(200, 310), 62);
    const above = slots.filter((slot) => slot.index === 0);

    expect(above).toEqual([
      {
        zone: "top",
        index: 0,
        y: 12,
        height: 62,
        offset: 0,
        nextOffset: 118,
        areaTop: 12,
        areaBottom: 192,
      },
      {
        zone: "top",
        index: 0,
        y: 130,
        height: 62,
        offset: 118,
        nextOffset: 0,
        areaTop: 12,
        areaBottom: 192,
      },
    ]);
  });

  it("names the free space itself, which is neither where the marks start nor where they end", () => {
    /*
     * What each place's share of the pointer is cut from, and the reason it is a
     * field of its own rather than the union of the boxes above.
     *
     * Both ends are wrong in the union. The first mark is lifted 31px over the
     * photo, so the union starts inside a block that is already on the card —
     * which is exactly the outline over the picture this replaced. And the last
     * mark stops at 366 + 62 = 428 only by luck of the arithmetic; a run whose
     * slack does not divide evenly leaves room below it that is just as
     * droppable and would go undrawn.
     *
     * The area is the same two numbers for every place in the run, because they
     * are all one place to look at: 122 + 8 to the bottom of the card.
     */
    const below = dropSlots(withPhoto, newBlock("logo"), photoAt(12, 122), 62).filter(
      (slot) => slot.index === 1,
    );

    expect(below.map((slot) => slot.areaTop)).toEqual([130, 130, 130, 130]);
    expect(below.map((slot) => slot.areaBottom)).toEqual([428, 428, 428, 428]);
    // The lift, stated as the gap it opens between the two answers.
    expect(below[0].areaTop! - below[0].y).toBe(31);
  });

  it("moves nothing for a block that overlaps nothing", () => {
    // The guard that this is the logo's correction and no one else's: a name
    // carries no `overlapPct`, so its places are the plain run arithmetic.
    const slots = dropSlots(withPhoto, newBlock("name"), photoAt(12, 122), 62);
    const below = slots.filter((slot) => slot.index === 1);

    expect(below.map((slot) => slot.y)).toEqual([130, 209, 287, 366]);
    expect(below.map((slot) => slot.offset)).toEqual([0, 79, 157, 236]);
  });

  it("lands the logo in the box that was drawn for it, at every place", () => {
    /*
     * The round trip, through the drop itself rather than through the geometry
     * alone: take each place the card offers, apply it, and work out from the
     * layout that comes back where the flex column actually puts the logo —
     * the photo's bottom, the gap, the stored leading space, less the overlap
     * `blockEdges` applies to a block that is not its zone's first.
     *
     * That number is the mark's own `y` for every one of them, which is the
     * whole of "the outline is the box the block will fill". It was out by 31
     * on all four before this, and looked right on the first only because
     * straddling the photo is what the overlap is for.
     */
    const slots = dropSlots(withPhoto, newBlock("logo"), photoAt(12, 122), 62);

    for (const slot of slots.filter((s) => s.index === 1)) {
      const dropped = dropCardBlock(withPhoto, { kind: "new", type: "logo" }, {
        zone: slot.zone,
        index: slot.index,
        offset: slot.offset,
      });

      const logo = dropped?.zones.top[1];
      expect(logo?.type).toBe("logo");
      expect(122 + 8 + (logo?.offset ?? 0) - 31).toBe(slot.y);
    }
  });

  it("puts the block after a logo back exactly where it was", () => {
    /*
     * `nextOffset` says what the *next* block's leading space has to become for
     * its own top edge not to move.
     *
     * Measured from `slot.y` — the box the mark is actually drawn in — and not
     * from the run's nominal start, because for a **flush** mark those are two
     * different numbers: it is drawn `lift` above the run it opens, and gives
     * that much back to the flex column. This used to add the offset to the
     * nominal start, which is the same arithmetic `settles` was doing, so the
     * two agreed with each other and both were half a logo out. `b` came back
     * 31px high, and every further move measured from there.
     */
    const layout = cardWith({
      top: [
        { id: "g", type: "gallery", heightPct: 25 },
        { id: "b", type: "address", offset: 100 },
      ],
    });

    const slots = dropSlots(
      layout,
      newBlock("logo"),
      [
        zoneOf("top", 12, 428, [
          { id: "g", top: 12, bottom: 122 },
          { id: "b", top: 230, bottom: 258 },
        ]),
      ],
      62,
    );

    const between = slots.filter((slot) => slot.index === 1);
    expect(between.length).toBeGreaterThan(0);

    for (const slot of between) {
      // b's own top edge lands back on 230 whichever place is taken: where the
      // logo is drawn, its own box, the gap, and what b's leading space becomes.
      expect(slot.y + 62 + 8 + (slot.nextOffset ?? 0)).toBe(230);
    }

    // And the flush one really is drawn above the run it opens, which is the
    // whole reason the line above cannot be written as `122 + 8 + 62`.
    expect(between[0].y).toBe(122 + 8 - 31);
  });

  it("ignores a drag that is not the card's", () => {
    expect(
      dropSlots(
        cardWith({}),
        { type: "place", id: "p1" },
        [zoneOf("middle", 12, 428)],
        24,
      ),
    ).toEqual([]);
  });
});

/**
 * A pair measures as one line, and the empty space beside a lone half is a place
 * a block can go.
 *
 * The card is still `defaultCardLayout()` — 440px tall, 12px of padding, an 8px
 * gap — and the numbers below are that arithmetic written out, same as above.
 */
describe("dropSlots with a pair on the card", () => {
  const pair = cardWith({
    middle: [
      { id: "a", type: "name", half: true },
      { id: "b", type: "address", half: true },
    ],
  });

  /** Two blocks side by side: same vertical extent, different halves. */
  const pairMeasure = [
    zoneOf("middle", 12, 428, [
      { id: "a", top: 12, bottom: 40, left: 12, right: 154 },
      { id: "b", top: 12, bottom: 40, left: 162, right: 304 },
    ]),
  ];

  it("treats two blocks sharing a line as one, with no run between them", () => {
    /*
     * The bug this is the guard for: walking the blocks in order and taking the
     * distance between each pair gives a "run" from a's bottom (40) to b's top
     * (12) — a span of minus twenty-eight — and a slot drawn nowhere. Lines are
     * what stack; blocks only stack when each is alone on one.
     */
    const slots = dropSlots(pair, newBlock("description"), pairMeasure, 24);

    // Nothing lands between the two halves: index 1 is unreachable by a drag,
    // which is deliberate. Un-pairing is the Size toggle's job.
    expect(slots.some((slot) => slot.index === 1)).toBe(false);
    expect(slots.every((slot) => slot.height > 0)).toBe(true);
    // Below the line only. The line's own indices are 0 and 2, and above it there
    // is no room — it starts on the zone's content edge — so there is no place.
    expect(new Set(slots.map((slot) => slot.index))).toEqual(new Set([2]));
  });

  it("frees a half-width line whose only block is in the hand", () => {
    /*
     * It used not to, and that was the bug. The line was kept so that a run
     * would not draw a card-width box over the free column `sideSlots` offers
     * beside it — but keeping the line does not keep that column, and what it
     * did keep was a run measured from a bottom edge the drop deletes. The mark
     * was drawn a line-and-a-gap below where the block would actually land.
     *
     * A line holding nothing but the block in your hand is free space, narrowed
     * or not. `sideSlots` still describes its column, from its own pass.
     */
    const lone = cardWith({
      middle: [{ id: "a", type: "name", half: true }],
    });

    const slots = dropSlots(
      lone,
      moveBlock("a"),
      [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40, left: 12, right: 154 },
        ]),
      ],
      28,
    );

    // One run over the whole zone, opening at its content edge — not two runs
    // stopping either side of a line that is leaving.
    expect(new Set(slots.map((slot) => slot.index))).toEqual(new Set([0]));
    expect(slots[0].y).toBe(12);
    expect(slots[0].offset).toBe(0);
    // And it reaches across the pixels the block is drawn on, which is the
    // whole difference: the block can land back where it already is.
    expect(slots.some((slot) => slot.y < 40)).toBe(true);
  });

  it("does not free the line when only one half of it is in the hand", () => {
    /*
     * Contrast with "treats the block in your hand as free space" above. A block
     * alone on its line is about to vacate it, so the space either side becomes
     * one run. One half of a pair vacates nothing: its partner is still drawn
     * there and still holds that height, and offering the space as free would
     * draw outlines across a block that is staying put.
     */
    const slots = dropSlots(pair, moveBlock("a"), pairMeasure, 28);

    expect(slots.some((slot) => slot.index === 1)).toBe(false);
    // The run above the line still stops at the line's top edge.
    const above = slots.filter((slot) => slot.index === 0);
    expect(above.every((slot) => slot.y + slot.height <= 40)).toBe(true);
  });
});

describe("sideSlots", () => {
  /*
   * A narrowed block keeps its width wherever it lands, and nothing already on
   * a line moves or narrows to make room for it — so every place here is offered
   * to a block that already fits, at the width it already has.
   *
   * The card is the default one: a line 296px across from 12 to 308 with an 8px
   * gap, so a 50% block is 144px (`columnPx(50)`).
   */

  /** A 50% name alone at the start of its line, and a 50% address on the next. */
  const stacked = cardWith({
    middle: [
      { id: "a", type: "name", widthPct: 50 },
      { id: "b", type: "address", widthPct: 50, newLine: true },
    ],
  });

  const stackedMeasure = [
    zoneOf("middle", 12, 428, [
      { id: "a", top: 12, bottom: 40, left: 12, right: 12 + columnPx(50) },
      { id: "b", top: 48, bottom: 76, left: 12, right: 12 + columnPx(50) },
    ]),
  ];

  it("offers a narrowed block the room beside another, at its own width", () => {
    const beside = sideSlots(stacked, moveBlock("b"), stackedMeasure).filter(
      (slot) => slot.line === 0,
    );

    expect(beside).toEqual([
      {
        zone: "middle",
        // Immediately after the block it joins — which is what makes the two
        // consecutive, and therefore what makes `cardRows` put them on one line.
        index: 1,
        y: 12,
        height: 28,
        offset: 0,
        half: "end",
        left: 12 + columnPx(50) + 8,
        width: columnPx(50),
        line: 0,
        // The free run of the line it sits in, which here is exactly its box.
        hitLeft: 12 + columnPx(50) + 8,
        hitWidth: 308 - (12 + columnPx(50) + 8),
      },
    ]);
  });

  it("offers nothing to a block too wide for the room left", () => {
    // 50% and 60% make 110. It is not cut down to fit, so that line offers it
    // nowhere at all.
    const wide = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 60, newLine: true },
      ],
    });

    const slots = sideSlots(wide, moveBlock("b"), [
      zoneOf("middle", 12, 428, [
        { id: "a", top: 12, bottom: 40, left: 12, right: 12 + columnPx(50) },
        { id: "b", top: 48, bottom: 76, left: 12, right: 12 + columnPx(60) },
      ]),
    ]);

    expect(slots.filter((slot) => slot.line === 0)).toEqual([]);
  });

  it("offers a full-width block no room beside anything", () => {
    // A block that fills its line has no column to go in, and a drop does not
    // narrow it to make one.
    expect(sideSlots(stacked, newBlock("address"), stackedMeasure)).toEqual([]);
    expect(sideSlots(stacked, newBlock("button"), stackedMeasure)).toEqual([]);
  });

  it("offers the room before a block at its line's end only to a block that fills it", () => {
    /*
     * A line of two is packed from its start, so a block landing before one that
     * sat at the end would push it across — unless it fills the room exactly. A
     * 50% block does; a 40% one would move the name, and is offered nothing.
     */
    const atEnd = (share: number) =>
      cardWith({
        middle: [
          { id: "a", type: "name", widthPct: 50, side: "end" },
          { id: "b", type: "address", widthPct: share, newLine: true },
        ],
      });
    const measure = (share: number) => [
      zoneOf("middle", 12, 428, [
        { id: "a", top: 12, bottom: 40, left: 308 - columnPx(50), right: 308 },
        { id: "b", top: 48, bottom: 76, left: 12, right: 12 + columnPx(share) },
      ]),
    ];
    const onFirstLine = (share: number) =>
      sideSlots(atEnd(share), moveBlock("b"), measure(share)).filter(
        (slot) => slot.line === 0,
      );

    expect(onFirstLine(50)).toMatchObject([
      { index: 0, half: "start", left: 12, width: columnPx(50) },
    ]);
    expect(onFirstLine(40)).toEqual([]);
  });

  it("pushes nothing already on the line across it", () => {
    // What used to be offered as the occupied column: landing where the name
    // already is and shoving it to the other side. The name would move, so the
    // only place is after it.
    const narrow = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 25, newLine: true },
      ],
    });

    const slots = sideSlots(narrow, moveBlock("b"), [
      zoneOf("middle", 12, 428, [
        { id: "a", top: 12, bottom: 40, left: 12, right: 12 + columnPx(50) },
        { id: "b", top: 48, bottom: 76, left: 12, right: 12 + columnPx(25) },
      ]),
    ]).filter((slot) => slot.line === 0);

    expect(slots.map((slot) => [slot.half, slot.left, slot.width])).toEqual([
      ["end", 12 + columnPx(50) + 8, columnPx(25)],
    ]);
  });

  it("offers a block alone on its line the other end of it", () => {
    /*
     * Crossing its own line. Its index does not change — it is still the only
     * block on that line — so the whole edit is the side the drop names, and it
     * keeps its width: the space it leaves opens on the other side.
     */
    const lone = cardWith({ middle: [{ id: "a", type: "name", widthPct: 50 }] });

    expect(
      sideSlots(lone, moveBlock("a"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40, left: 12, right: 12 + columnPx(50) },
        ]),
      ]),
    ).toEqual([
      {
        zone: "middle",
        index: 0,
        y: 12,
        height: 28,
        offset: 0,
        half: "end",
        left: 308 - columnPx(50),
        width: columnPx(50),
        line: 0,
        hitLeft: 12 + columnPx(50) + 8,
        hitWidth: 308 - (12 + columnPx(50) + 8),
      },
    ]);
  });

  it("offers each member of a pair the other's place", () => {
    // Swapping two blocks that share a line. Neither width changes.
    const pair = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 50 },
      ],
    });
    const pairMeasure = [
      zoneOf("middle", 12, 428, [
        { id: "a", top: 12, bottom: 40, left: 12, right: 12 + columnPx(50) },
        { id: "b", top: 12, bottom: 40, left: 308 - columnPx(50), right: 308 },
      ]),
    ];

    expect(sideSlots(pair, moveBlock("a"), pairMeasure)).toMatchObject([
      // After the partner, which is what puts it second on the line.
      { index: 2, half: "end", left: 308 - columnPx(50), width: columnPx(50), line: 0 },
    ]);
    expect(sideSlots(pair, moveBlock("b"), pairMeasure)).toMatchObject([
      { index: 0, half: "start", left: 12, width: columnPx(50), line: 0 },
    ]);
    // And a line that is already full has nowhere for anything new.
    expect(sideSlots(pair, newBlock("logo"), pairMeasure)).toEqual([]);
  });

  it("offers nothing to a block that cannot be narrowed", () => {
    // A week of opening times has no width to keep in a column.
    expect(sideSlots(stacked, newBlock("hours"), stackedMeasure)).toEqual([]);
  });

  it("offers nothing when the caller could not measure horizontally", () => {
    // An honest degradation rather than a guess at where the room is.
    expect(
      sideSlots(stacked, moveBlock("b"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40 },
          { id: "b", top: 48, bottom: 76 },
        ]),
      ]),
    ).toEqual([]);
  });

  it("refuses a zone the block may not enter at all", () => {
    // Links only ever go at the bottom, and are never narrowed either.
    expect(sideSlots(stacked, newBlock("actions"), stackedMeasure)).toEqual([]);
  });

  it("offers the room beside a photo narrowed by hand, whatever its zone's height", () => {
    /*
     * Landing beside a block already on the card spends none of the card's
     * height, so a top zone filled by a photo still offers the space next to
     * that photo — which is exactly where someone would want to put a name.
     */
    const photo = cardWith({
      top: [{ id: "g", type: "gallery", widthPct: 50, heightPct: 70 }],
      middle: [{ id: "n", type: "name", widthPct: 50 }],
    });

    const slots = sideSlots(photo, moveBlock("n"), [
      zoneOf("top", 12, 320, [
        { id: "g", top: 12, bottom: 320, left: 12, right: 12 + columnPx(50) },
      ]),
      zoneOf("middle", 328, 428, [
        { id: "n", top: 328, bottom: 356, left: 12, right: 12 + columnPx(50) },
      ]),
    ]).filter((slot) => slot.zone === "top");

    expect(slots).toMatchObject([
      {
        index: 1,
        half: "end",
        left: 12 + columnPx(50) + 8,
        width: columnPx(50),
        y: 12,
        height: 308,
      },
    ]);
  });

  it("reads a stored `half` as a 50% line, for the cards published with it", () => {
    // The back-compat path through the drop geometry: a customer's saved design
    // still says `half: true`, and the room beside it is still droppable.
    const legacy = cardWith({
      middle: [
        { id: "a", type: "name", half: true },
        { id: "b", type: "address", widthPct: 50, newLine: true },
      ],
    });

    expect(
      sideSlots(legacy, moveBlock("b"), stackedMeasure).filter((slot) => slot.line === 0),
    ).toMatchObject([{ half: "end", width: columnPx(50) }]);
  });

  it("gives two adjacent lines distinct targets, even at the same index", () => {
    /*
     * The duplicate-key bug, in the geometry that caused it. A place on somebody
     * else's line uses `row.end` for `"end"`, which is unique because rows are
     * consecutive — but a block crossing *its own* line stays put and uses
     * `row.index`. Two adjacent lone lines with the lower one in the hand
     * therefore both emit `(middle, 1, "end")`, and the overlay keyed its marks
     * on exactly that: React warned, the two collapsed into one entry in the
     * drag context's map, and hovering either lit both.
     *
     * `line` is what separates them, and it is why it is part of the id.
     */
    const clashing = sideSlots(stacked, moveBlock("b"), stackedMeasure).filter(
      (slot) => slot.index === 1 && slot.half === "end",
    );

    expect(clashing).toHaveLength(2);
    expect(clashing.map((slot) => slot.line)).toEqual([0, 1]);
  });

  it("can land on the same index and offset as a vertical slot", () => {
    /*
     * Which is why `slotId` in card-drop-overlay.tsx carries the half flag. The
     * place beside a lone block and the run of free space below that line are
     * both "insert at 1, with no leading space" — two genuinely different places
     * that would otherwise register as one drop target, one silently shadowing
     * the other.
     */
    const side = sideSlots(stacked, moveBlock("b"), stackedMeasure).find(
      (slot) => slot.line === 0,
    );
    const below = dropSlots(stacked, moveBlock("b"), stackedMeasure, 28).find(
      (slot) => slot.index === 1 && slot.offset === 0,
    );

    expect(below).toBeDefined();
    expect(side?.index).toBe(below?.index);
    expect(side?.offset).toBe(below?.offset);
  });
});

describe("sideSlots beside a mark", () => {
  /*
   * The room either side of a logo, which is the whole of "put a name next to
   * it". A mark has no width to narrow, so the room is measured: a centred 62px
   * logo on the default card sits from 129 to 191, leaving 109px either side of
   * it once the gap is paid. A 38% block is 108.48px, which fits either side
   * without moving the logo.
   */
  const NAME_W = columnPx(38);

  /** A centred logo, and a 38% name on a line of its own below it. */
  const withLogo = cardWith({
    middle: [
      { id: "logo", type: "logo", heightPct: 14, align: "center" },
      { id: "name", type: "name", widthPct: 38, newLine: true },
    ],
  });

  const logoMeasure = (top = 12, bottom = 74) => [
    zoneOf("middle", 12, 428, [
      { id: "logo", top, bottom, left: 129, right: 191 },
      { id: "name", top: 120, bottom: 148, left: 12, right: 12 + NAME_W },
    ]),
  ];

  const onLogoLine = (slots: DropSlot[]) => slots.filter((slot) => slot.line === 0);

  it("offers each side the block fits, at its own width", () => {
    const slots = onLogoLine(sideSlots(withLogo, moveBlock("name"), logoMeasure()));

    expect(slots).toHaveLength(2);
    // Before the mark, taking the line: a line led by a name packs from its start.
    expect(slots[0]).toMatchObject({ index: 0, half: "start", left: 12, line: 0 });
    // After it: a line led by a centred mark packs to its end, so the logo stays.
    expect(slots[1]).toMatchObject({ index: 1, half: "end", line: 0 });
    expect(slots[1].left).toBeCloseTo(308 - NAME_W);
    for (const slot of slots) expect(slot.width).toBeCloseTo(NAME_W);
  });

  it("stops at the zone's edge, so the room never reaches into the photo", () => {
    /*
     * A mark pulled up over its neighbour has a rect that reaches into the
     * *previous zone* — that is what an overlap is, and `measuredRows` takes a
     * line's top as the topmost of its members. So the room beside a logo
     * straddling a photo measured as starting inside the photo, and the place
     * drawn for it promised a block half buried in a picture.
     */
    const slots = onLogoLine(
      sideSlots(withLogo, moveBlock("name"), logoMeasure(-19, 43)),
    );

    expect(slots).toHaveLength(2);
    for (const slot of slots) {
      expect(slot.y).toBe(12);
      expect(slot.y + slot.height).toBe(43);
    }
  });

  it("stops at the photo above it, even inside one zone", () => {
    /*
     * The same overlap without a zone boundary to catch it, which is the shape it
     * actually has on a card: a gallery and a logo are both blocks of the middle
     * zone, so the zone's own top is 12 and clamping to it changes nothing. What
     * the room has to clear is the *block* — a place drawn from the mark's top
     * would run its first 11px under the picture.
     */
    const withPhoto = cardWith({
      middle: [
        { id: "gallery", type: "gallery", heightPct: 25 },
        { id: "name", type: "name", widthPct: 38 },
        { id: "logo", type: "logo", heightPct: 14 },
        { id: "address", type: "address", widthPct: 38, newLine: true },
      ],
    });

    const slots = sideSlots(withPhoto, moveBlock("address"), [
      zoneOf("middle", 12, 428, [
        { id: "gallery", top: 12, bottom: 122, left: 12, right: 308 },
        { id: "name", top: 130, bottom: 174, left: 12, right: 121 },
        // Pulled up 19px over the photo's bottom edge.
        { id: "logo", top: 111, bottom: 173, left: 129, right: 191 },
        { id: "address", top: 182, bottom: 210, left: 12, right: 12 + NAME_W },
      ]),
    ]);

    // The photo is a full-width line of its own and offers nothing. The one
    // place is past the logo, on the line after the photo.
    const beside = slots.filter((slot) => slot.line === 1);

    expect(beside).toHaveLength(1);
    // Not 111, which is where the line measures — 122, where the photo ends.
    expect(beside[0].y).toBe(122);
    expect(beside[0].y + beside[0].height).toBe(174);
  });

  it("is not pushed down by a block that is merely beside it", () => {
    /*
     * The reason the clearance is asked per place rather than per line. A mark
     * hanging down into the line below obstructs the room *under itself* and none
     * of the room beside it.
     */
    const hanging = (nameSide: "start" | "end", share: number) =>
      cardWith({
        middle: [
          { id: "logo", type: "logo", heightPct: 14 },
          {
            id: "name",
            type: "name",
            widthPct: 38,
            newLine: true,
            ...(nameSide === "end" ? { side: "end" as const } : {}),
          },
          { id: "address", type: "address", widthPct: share, newLine: true },
        ],
      });

    // A logo on its own line, hanging 18px into the line below.
    const logo = { id: "logo", top: 12, bottom: 120, left: 12, right: 74 };

    // Beside a name at its line's start, the room to its right is clear of the
    // logo, so the place starts where its own line does.
    const right = sideSlots(hanging("start", 38), moveBlock("address"), [
      zoneOf("middle", 12, 428, [
        logo,
        { id: "name", top: 102, bottom: 146, left: 12, right: 121 },
        { id: "address", top: 160, bottom: 188, left: 12, right: 12 + NAME_W },
      ]),
    ]).find((slot) => slot.line === 1);

    expect(right).toMatchObject({ left: 129, y: 102 });

    // Beside a name at its line's end, the room to its left runs under the logo,
    // and the place is pushed clear of it.
    const left = sideSlots(hanging("end", 62), moveBlock("address"), [
      zoneOf("middle", 12, 428, [
        logo,
        { id: "name", top: 102, bottom: 146, left: 199, right: 308 },
        { id: "address", top: 160, bottom: 188, left: 12, right: 12 + columnPx(62) },
      ]),
    ]).find((slot) => slot.line === 1);

    expect(left).toMatchObject({ left: 12, y: 120 });
  });

  it("puts three on one line, exactly", () => {
    /*
     * The rounding the old column arithmetic had to cap: a mark reserves `ceil`
     * of its square, so a 38% name, a 24% logo and a 38% address are exactly one
     * line. The address is offered the place past the two of them, and the drop
     * that place makes really does put all three on one line.
     */
    const paired = cardWith({
      middle: [
        { id: "name", type: "name", widthPct: 38 },
        { id: "logo", type: "logo", heightPct: 14 },
        { id: "address", type: "address", widthPct: 38, newLine: true },
      ],
    });

    const [slot, ...others] = sideSlots(paired, moveBlock("address"), [
      zoneOf("middle", 12, 428, [
        { id: "name", top: 12, bottom: 74, left: 12, right: 115 },
        { id: "logo", top: 12, bottom: 74, left: 123, right: 185 },
        { id: "address", top: 82, bottom: 110, left: 12, right: 12 + NAME_W },
      ]),
    ]).filter((each) => each.line === 0);

    expect(others).toEqual([]);
    expect(slot).toMatchObject({ index: 2, half: "end", left: 193 });

    const landed = dropCardBlock(paired, { kind: "move", id: "address" }, {
      zone: "middle",
      index: slot.index,
      offset: slot.offset,
      half: slot.half,
      line: slot.line,
    });

    expect(cardRows(landed?.zones.middle ?? [], defaultCardLayout())).toHaveLength(1);
    expect(landed?.zones.middle[2]).toMatchObject({ id: "address", widthPct: 38 });
  });

  it("offers nothing where the logo would have to move", () => {
    // Measured off-centre, the logo leaves no side a 38% name fits without
    // shoving it along its line.
    const slots = onLogoLine(
      sideSlots(withLogo, moveBlock("name"), [
        zoneOf("middle", 12, 428, [
          { id: "logo", top: 12, bottom: 74, left: 30, right: 92 },
          { id: "name", top: 120, bottom: 148, left: 12, right: 12 + NAME_W },
        ]),
      ]),
    );

    expect(slots).toEqual([]);
  });

  it("offers nothing to a block that may not be narrowed at all", () => {
    // A week of opening times is no more readable in a column because a drag
    // put it there — the rule `CARD_BLOCKS` writes down, asked here.
    expect(sideSlots(withLogo, newBlock("hours"), logoMeasure())).toEqual([]);
  });

  it("offers nothing to the mark on its own line", () => {
    /*
     * There is only ever one logo on a card, so the only mark that could land
     * beside this one is this one. Where a mark goes across its own line is the
     * align grid's business (`splitAlignColumns`), not a place's.
     */
    expect(onLogoLine(sideSlots(withLogo, moveBlock("logo"), logoMeasure()))).toEqual([]);
  });
});

describe("sideSlots — a logo in the hand", () => {
  /** A 50% name alone on its line, and nothing else on the card. */
  const lone = (side?: "end") =>
    cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50, ...(side ? { side } : {}) },
      ],
    });

  const measure = (left: number) => [
    zoneOf("middle", 12, 428, [
      { id: "a", top: 12, bottom: 40, left, right: left + columnPx(50) },
    ]),
  ];

  it("offers the square on the free side of a narrowed block, at the logo's own size", () => {
    /*
     * A default logo is 62px. It lands after a name at its line's start — the
     * line stays packed from the start, so the name does not move — and it is
     * drawn at 62 on both axes, however short the line of text beside it is.
     */
    expect(sideSlots(lone(), newBlock("logo"), measure(12))).toEqual([
      {
        zone: "middle",
        index: 1,
        y: 12,
        height: 62,
        offset: 0,
        half: "end",
        left: 12 + columnPx(50) + 8,
        width: 62,
        line: 0,
        hitLeft: 12 + columnPx(50) + 8,
        hitWidth: 308 - (12 + columnPx(50) + 8),
        mark: true,
      },
    ]);
  });

  it("offers the square before a block that sits at its line's end", () => {
    // A line led by a centred logo packs towards its end, which is where the name
    // already is — so the square sits just before it and nothing moves.
    const [slot, ...others] = sideSlots(
      lone("end"),
      newBlock("logo"),
      measure(308 - columnPx(50)),
    );

    expect(others).toEqual([]);
    expect(slot).toMatchObject({
      index: 0,
      half: "start",
      width: 62,
      height: 62,
      mark: true,
    });
    expect(slot.left).toBe(308 - columnPx(50) - 8 - 62);
  });

  it("offers no square where it would reach into the line below", () => {
    /*
     * A logo joining a line of text makes that line as tall as the logo. With a
     * description 8px under the name there is no room for that, and a square
     * there would promise a landing that shoves the card down.
     */
    const crowded = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "d", type: "description" },
      ],
    });

    expect(
      sideSlots(crowded, newBlock("logo"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40, left: 12, right: 12 + columnPx(50) },
          { id: "d", top: 48, bottom: 120, left: 12, right: 308 },
        ]),
      ]),
    ).toEqual([]);
  });

  it("offers nothing beside a full-width block, whatever is in the hand", () => {
    /*
     * The report: a Button across the whole card offered a logo a square at each
     * end of its line, on a line that plainly had no room — and landing there
     * narrowed the Button to make some, which is a drop resizing a block nobody
     * picked up. A full-width line is refused outright now.
     */
    const full = cardWith({
      bottom: [{ id: "button", type: "button", buttonFull: true }],
    });
    const fullMeasure = [
      zoneOf("bottom", 380, 428, [
        { id: "button", top: 380, bottom: 408, left: 12, right: 308 },
      ]),
    ];

    expect(sideSlots(full, newBlock("logo"), fullMeasure)).toEqual([]);
    expect(sideSlots(full, newBlock("divider"), fullMeasure)).toEqual([]);
    expect(sideSlots(full, newBlock("button"), fullMeasure)).toEqual([]);
  });
});

describe("dropSlots — a mark with nowhere to stand but the edge above it", () => {
  /**
   * A photo filling its zone: the run under it has no span of its own, which is
   * the shape of card someone actually drops a logo onto.
   */
  const photoCard = cardWith({
    top: [{ id: "photo", type: "gallery", heightPct: 25 }],
  });

  it("draws the square straddling the edge rather than a hairline", () => {
    /*
     * The run below the photo is 0px tall, so it used to come back as a seam —
     * height zero, which has nothing to outline, so nothing was drawn at rest
     * and the one place a logo could go looked like no place at all. The drop
     * always worked; it just never said so.
     *
     * A default logo is 62px and arrives with `overlapPct: 50`, so `blockEdges`
     * pulls it up 31px: the square is drawn at 122 + 8 - 31 = 99, half over the
     * photo, which is where it lands.
     *
     * The run *above* the photo has no block to straddle and no room, so it
     * offers nothing at all — it used to be a seam. The run below is the zone's
     * last and closes against nothing, so the square says nothing about what
     * follows it.
     */
    expect(
      dropSlots(
        photoCard,
        newBlock("logo"),
        [
          zoneOf("top", 12, 122, [
            { id: "photo", top: 12, bottom: 122, left: 0, right: 320 },
          ]),
        ],
        62,
      ),
    ).toEqual([
      {
        zone: "top",
        index: 1,
        y: 99,
        height: 62,
        offset: 0,
        /*
         * And an **empty** area, which is the other half of the same fact: this
         * run has no free space at all, so the place catches the pointer with its
         * own square (`areaBands`). It is outlined at that square, half over the
         * photo, because that is where the logo lands.
         */
        areaTop: 130,
        areaBottom: 130,
      },
    ]);
  });

  it("offers nothing for anything that straddles nothing", () => {
    // The same card and the same empty runs, with a block that has no overlap.
    // `lift` is zero, so there is no square to draw — and with no room either
    // side of the photo there is no place. Both runs used to come back as seams.
    expect(
      dropSlots(
        photoCard,
        newBlock("divider"),
        [
          zoneOf("top", 12, 122, [
            { id: "photo", top: 12, bottom: 122, left: 0, right: 320 },
          ]),
        ],
        13,
      ),
    ).toEqual([]);
  });

  it("offers no straddle where the half below the edge would push the next line down", () => {
    /*
     * An address 8px under the photo. The square would spend 31px below the
     * photo's edge and the address has none to give, so the edge between them is
     * no place for a logo — where the address's own bottom edge, with the zone's
     * room under it, still is.
     */
    const crowded = cardWith({
      top: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "address", type: "address" },
      ],
    });

    const slots = dropSlots(
      crowded,
      newBlock("logo"),
      [
        zoneOf("top", 12, 150, [
          { id: "photo", top: 12, bottom: 122, left: 0, right: 320 },
          { id: "address", top: 130, bottom: 150, left: 12, right: 308 },
        ]),
      ],
      62,
    );

    expect(slots.filter((slot) => slot.index === 1)).toEqual([]);
    expect(slots.filter((slot) => slot.index === 2)).toMatchObject([
      { y: 150 + 8 - 31, height: 62 },
    ]);
  });

  it("offers no straddle that would hang off the bottom of the card", () => {
    // A Button at the foot of a 440px card: a square straddling its bottom edge
    // would reach 467, past the card, on the one line that has no room at all.
    const footer = cardWith({ bottom: [{ id: "button", type: "button" }] });

    expect(
      dropSlots(
        footer,
        newBlock("logo"),
        [
          zoneOf("bottom", 400, 428, [
            { id: "button", top: 400, bottom: 428, left: 12, right: 308 },
          ]),
        ],
        62,
      ),
    ).toEqual([]);
  });
});

describe("blockedFaces", () => {
  it("covers the whole of a block", () => {
    /*
     * The complaint this answers: releasing over the middle of a photo quietly
     * inserted the block above or below it, because every pixel of the card
     * belonged to some insertion point. The photo now belongs to the photo, top
     * to bottom. It used to keep a 16px strip at each end, so the seams between
     * touching blocks could still be reached — and there are no seams any more.
     */
    const card = cardWith({ middle: [{ id: "a", type: "gallery" }] });

    expect(
      blockedFaces(card, newBlock("name"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 122, left: 12, right: 308 },
        ]),
      ]),
    ).toEqual([{ zone: "middle", line: 0, top: 12, bottom: 122 }]);
  });

  it("refuses a block one line tall as well", () => {
    /*
     * A 28px name used to have no face at all: on a line that short the two
     * strips were the whole of it, and the insertion points either side won.
     * With nothing to insert between, being over the name is being over
     * something that is already there.
     */
    const card = cardWith({ middle: [{ id: "a", type: "name" }] });

    expect(
      blockedFaces(card, newBlock("category"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40, left: 12, right: 308 },
        ]),
      ]),
    ).toEqual([{ zone: "middle", line: 0, top: 12, bottom: 40 }]);
  });

  it("clamps a line into the zone's visible content box", () => {
    // The middle zone scrolls, so a line can reach past the zone's bottom edge;
    // the card is not drawing that part of it, and refuses nothing there.
    const card = cardWith({ middle: [{ id: "a", type: "gallery" }] });

    expect(
      blockedFaces(card, newBlock("name"), [
        zoneOf("middle", 12, 100, [
          { id: "a", top: 60, bottom: 170, left: 12, right: 308 },
        ]),
      ]),
    ).toEqual([{ zone: "middle", line: 0, top: 60, bottom: 100 }]);
  });

  it("does not refuse the line the drag came off", () => {
    // Its space is about to be freed, so the middle of it is a real place to put
    // the thing back — and a gesture you cannot undo by dropping where you
    // started is a gesture people are afraid of.
    const card = cardWith({ middle: [{ id: "a", type: "gallery" }] });

    expect(
      blockedFaces(card, moveBlock("a"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 122, left: 12, right: 308 },
        ]),
      ]),
    ).toEqual([]);
  });

  it("still refuses a shared line while one of its halves is in the hand", () => {
    // Picking up one half leaves the other drawn exactly where it is, so the line
    // is still occupied. `sideSlots` paints the free column over this face, and
    // that column is what the pointer finds inside its own box.
    const card = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 50 },
      ],
    });

    expect(
      blockedFaces(card, moveBlock("a"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 122, left: 12, right: 12 + columnPx(50) },
          { id: "b", top: 12, bottom: 122, left: 308 - columnPx(50), right: 308 },
        ]),
      ]),
    ).toEqual([{ zone: "middle", line: 0, top: 12, bottom: 122 }]);
  });

  it("names each line by where it starts, so no two faces share an id", () => {
    // `line` is the only thing distinguishing one face from the next, and the
    // overlay registers a drop target per face — two with one id and the drag
    // context keeps one of them.
    const card = cardWith({
      middle: [
        { id: "a", type: "gallery" },
        { id: "b", type: "gallery" },
      ],
    });

    const faces = blockedFaces(card, newBlock("name"), [
      zoneOf("middle", 12, 428, [
        { id: "a", top: 12, bottom: 122, left: 12, right: 308 },
        { id: "b", top: 130, bottom: 240, left: 12, right: 308 },
      ]),
    ]);

    expect(faces.map((face) => face.line)).toEqual([0, 1]);
    expect(faces[1]).toEqual({ zone: "middle", line: 1, top: 130, bottom: 240 });
  });

  it("has nothing to refuse on an empty card", () => {
    expect(blockedFaces(cardWith({}), newBlock("name"), [
      zoneOf("middle", 12, 428),
    ])).toEqual([]);
  });

  it("ignores a drag that is not a card block at all", () => {
    // A location dragged out of the panel passes straight over the card.
    const card = cardWith({ middle: [{ id: "a", type: "gallery" }] });

    expect(
      blockedFaces(card, { type: "place", id: "p1" }, [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 122, left: 12, right: 308 },
        ]),
      ]),
    ).toEqual([]);
  });
});

describe("vacatedSpace", () => {
  /*
   * A name at the top of the middle zone and a description a long way below it:
   * the name runs 12–40, and the description carries 200px of leading space, so
   * it starts at 40 + 8 + 200 = 248.
   *
   * The whole run above the description is what opens up when the name is
   * carried away — 12 to 248, and the run starts at the zone's own content edge,
   * so it pays no leading gap. The description has to take all 236 of it to stay
   * exactly where it is.
   */
  const stacked = cardWith({
    middle: [
      { id: "name", type: "name" },
      { id: "description", type: "description", offset: 200 },
    ],
  });

  const stackedZone = [
    zoneOf("middle", 12, 428, [
      { id: "name", top: 12, bottom: 40 },
      { id: "description", top: 248, bottom: 320 },
    ]),
  ];

  it("charges the whole run to the block left underneath", () => {
    expect(vacatedSpace(stacked, moveBlock("name"), stackedZone)).toEqual({
      id: "description",
      offset: 236,
    });
  });

  it("pays the leading gap when the run opens at another line's edge", () => {
    /*
     * The same card with a photo above the name. The run now starts at the
     * photo's bottom edge rather than the zone's, so it owes that line the gap
     * — which is exactly the gap the block landing there would have paid.
     */
    const layout = cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "name", type: "name" },
        { id: "description", type: "description", offset: 200 },
      ],
    });

    expect(
      vacatedSpace(layout, moveBlock("name"), [
        zoneOf("middle", 12, 428, [
          { id: "photo", top: 12, bottom: 122 },
          { id: "name", top: 130, bottom: 158 },
          { id: "description", top: 366, bottom: 428 },
        ]),
      ]),
      // 366 - 122 - 8.
    ).toEqual({ id: "description", offset: 236 });
  });

  it("frees nothing for a block coming off the palette", () => {
    expect(vacatedSpace(stacked, newBlock("address"), stackedZone)).toBeNull();
  });

  it("frees nothing when there is no line below the one being carried", () => {
    expect(
      vacatedSpace(stacked, moveBlock("description"), stackedZone),
    ).toBeNull();
  });

  it("frees nothing when the line is shared, because it is not freed", () => {
    /*
     * Picking up one half of a pair leaves its partner drawn where it is,
     * holding the line's height — so nothing below it moves and there is nothing
     * to charge. The same test `dropSlots` runs to decide which lines stand.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 50 },
        { id: "description", type: "description", offset: 200 },
      ],
    });

    expect(
      vacatedSpace(layout, moveBlock("a"), [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 40 },
          { id: "b", top: 12, bottom: 40 },
          { id: "description", top: 248, bottom: 320 },
        ]),
      ]),
    ).toBeNull();
  });

  it("ignores a drag that is not a card block at all", () => {
    expect(
      vacatedSpace(stacked, { type: "place", id: "p1" }, stackedZone),
    ).toBeNull();
  });

  it("measures to where the line below sits, not to where it is drawn", () => {
    /*
     * The line below is an address with a logo beside it, and the logo carries
     * `overlapPct: 50` — so `blockEdges` draws it 31px above the line it belongs
     * to. The line's *ink* therefore starts at 89 while the line itself sits at
     * 120, and the number being written is an `offset`, which positions the
     * second of those.
     *
     * Measured to the ink it charged 89 and the line came back 31px higher than
     * it had been. On a card whose photo is round-tripped a few times that is
     * the whole content walking up under a logo, which is the shape of card
     * nearly everyone builds. See `flowTop` on `MeasuredRow`.
     */
    const withMark = cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "address", type: "address", widthPct: 39 },
        { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      ],
    });

    expect(
      vacatedSpace(withMark, moveBlock("photo"), [
        zoneOf("middle", 12, 452, [
          { id: "photo", top: 12, bottom: 122 },
          { id: "address", top: 120, bottom: 157 },
          // 62px tall, drawn 31px above the line it is on.
          { id: "logo", top: 89, bottom: 151 },
        ]),
      ]),
    ).toEqual({ id: "address", offset: 108 });
  });
});

describe.each([20, 28])(
  "a move does not drag the block below it along (a %ipx name)",
  (NAME_H) => {
    /*
     * The reported bug, end to end: a name at the top of the middle zone and a
     * description a long way below it. Drag the name past the description and
     * back and the description used to end up permanently higher than it
     * started — one gesture moving two blocks.
     *
     * The card is the default one: content from 12 to 428, an 8px gap. A
     * description draws 72px, and the name is run at **both** sides of
     * `MIN_BLOCK_HEIGHT`. 20px is what an unpadded one-line name really
     * measures (`text-sm` is a 20px line box) and is the height the bug lived
     * at: below the floor, the counting height and the drawn height are
     * different numbers. 28px is the same name with its default padding, where
     * they are equal and the arithmetic has always been right.
     *
     * The layout is measured from the blocks' own stored leading space, which is
     * what `rectsOf` does. That matters: the second half of the gesture has to be
     * measured against the card the first half produced, not against the one it
     * started from.
     */
    const DESCRIPTION_H = 72;

    const rectsOf = (layout: CardLayout): ZoneMeasure[] => {
      let y = 12;

      return [
        zoneOf(
          "middle",
          12,
          428,
          layout.zones.middle.map((block) => {
            const height = block.type === "description" ? DESCRIPTION_H : NAME_H;

            y += block.offset ?? 0;
            const rect = { id: block.id, top: y, bottom: y + height };
            y = rect.bottom + 8;

            return rect;
          }),
        ),
      ];
    };

    /** Where the description's own top edge sits, in px from the card's top. */
    const descriptionTop = (layout: CardLayout) =>
      rectsOf(layout).flatMap((zone) => zone.blocks)
        .find((block) => block.id === "description")!.top;

    /**
     * The card after this drag is released on the first place `pick` accepts,
     * and the slot it was released on.
     *
     * Places are chosen by **where they are on the card**, not by their position
     * in the array and not by their insertion index. How many marks a run offers
     * depends on the height in hand, so "the seventh one" is a different landing
     * at 20px than at 28px; and an insertion index counts blocks, so it shifts
     * under the gesture the moment the name changes sides with the description.
     * "The first place below the description" is the same gesture throughout.
     */
    const drag = (
      layout: CardLayout,
      id: string,
      pick: (slot: DropSlot, descriptionTop: number) => boolean,
    ) => {
      const dragged = moveBlock(id);
      const zones = rectsOf(layout);
      const slots = dropSlots(layout, dragged, zones, NAME_H);
      const vacate = vacatedSpace(layout, dragged, zones);
      const slot = slots.find((candidate) =>
        pick(candidate, descriptionTop(layout)),
      )!;

      const next = dropCardBlock(layout, { kind: "move", id }, {
        zone: slot.zone,
        index: slot.index,
        offset: slot.offset,
        ...(slot.nextOffset === undefined ? {} : { nextOffset: slot.nextOffset }),
        ...(vacate === null
          ? {}
          : { vacateId: vacate.id, vacateOffset: vacate.offset }),
      })!;

      return { layout: next, slot };
    };

    /** The run above the description, and the one below it. */
    const above = (slot: DropSlot, descriptionTop: number) =>
      slot.y < descriptionTop;
    const below = (slot: DropSlot, descriptionTop: number) =>
      slot.y > descriptionTop;

    const start = cardWith({
      middle: [
        { id: "name", type: "name" },
        { id: "description", type: "description", offset: 200 },
      ],
    });

    // 12 + NAME_H + 8 + 200. Stated once so the rest of this reads as a
    // comparison.
    const START_TOP = 220 + NAME_H;

    it("starts where the arithmetic says", () => {
      expect(descriptionTop(start)).toBe(START_TOP);
    });

    it("leaves the description where it is when the name moves below it", () => {
      /*
       * The first place past the description is the first move that takes the
       * name out of the run it was in, which is exactly where the old code lost
       * the description's leading space.
       */
      const moved = drag(start, "name", below).layout;

      expect(moved.zones.middle.map((block) => block.id)).toEqual([
        "description",
        "name",
      ]);
      // It absorbs the whole run the name used to sit in: 200 + NAME_H + 8.
      expect(moved.zones.middle[0].offset).toBe(208 + NAME_H);
      expect(descriptionTop(moved)).toBe(START_TOP);
    });

    it("comes back to exactly the card it started as", () => {
      // Down past the description, then back to the top of the run above it.
      const down = drag(start, "name", below).layout;
      const up = drag(down, "name", above).layout;

      expect(up).toEqual(start);
    });

    it("is still that card after ten round trips", () => {
      /*
       * The acceptance test for the reported bug, and the reason it is ten.
       * A single cycle hid a 4px error well enough to look like rounding; ten
       * of them walk the description 40px up a 416px card, which is what the
       * user was watching happen. Byte-identical, because "close enough" is
       * what a drift test cannot say.
       */
      let layout = start;

      for (let cycle = 0; cycle < 10; cycle += 1) {
        layout = drag(layout, "name", below).layout;
        layout = drag(layout, "name", above).layout;
        expect(descriptionTop(layout)).toBe(START_TOP);
      }

      expect(layout).toEqual(start);
    });

    it("still lets the local answer win inside the run the name came from", () => {
      /*
       * `settle` runs last, so a name dropped one place further down the *same*
       * run writes the description's leading space itself and the vacated space
       * is simply overwritten. The description does not move for that either —
       * by a different route, and with no test in the edit path for which one
       * applies.
       */
      const moved = drag(
        start,
        "name",
        (slot, top) => above(slot, top) && slot.offset > 0,
      );

      expect(moved.layout.zones.middle.map((block) => block.id)).toEqual([
        "name",
        "description",
      ]);
      expect(moved.layout.zones.middle[0].offset).toBe(moved.slot.offset);
      expect(descriptionTop(moved.layout)).toBe(START_TOP);
    });

    it("promises each mark in the run the description will not move", () => {
      /*
       * The same claim one level down, on every slot at once rather than on the
       * two the gesture happens to use: a block released on a mark draws from
       * `slot.y`, spends the height it actually draws, pays the gap, and what is
       * left is what it told the description to become. Their sum is the
       * description's own top edge — which is the whole meaning of `nextOffset`,
       * and the arithmetic the counting height used to get wrong.
       */
      const marks = dropSlots(start, moveBlock("name"), rectsOf(start), NAME_H)
        .filter((slot) => above(slot, START_TOP));

      expect(marks.length).toBeGreaterThan(1);
      for (const mark of marks) {
        expect(mark.y + NAME_H + 8 + mark.nextOffset!).toBe(START_TOP);
      }
    });
  },
);

describe("a narrowed block alone on its line frees it", () => {
  /*
   * The mark that lied. A Name narrowed to half the card, alone on the line at
   * the top of the middle zone, with a description a long way below it.
   *
   * The line used to be kept — a run stopped at its bottom edge and started
   * again below it — so every mark in that run was measured from an edge the
   * drop was about to delete. `dropCardBlock` removes the block first and the
   * indices shift, so the block landed a line-and-a-gap above the mark someone
   * had aimed at: 26px on this card, and the description under it moved with it.
   *
   * A narrowed name is 36px here — half the card, its text wrapping to two lines
   * — and it stays that: a drop keeps a block's width, so it keeps the height
   * that width gives it too.
   */
  const NAME_H = 36;
  const DESCRIPTION_H = 72;

  const start = cardWith({
    middle: [
      { id: "name", type: "name", widthPct: 50 },
      { id: "description", type: "description", offset: 200 },
    ],
  });

  /** 12 + 36 + 8 + 200. */
  const DESC_TOP = 256;

  const measure = [
    zoneOf("middle", 12, 428, [
      { id: "name", top: 12, bottom: 12 + NAME_H, left: 12, right: 12 + columnPx(50) },
      { id: "description", top: DESC_TOP, bottom: DESC_TOP + DESCRIPTION_H },
    ]),
  ];

  const slots = () => dropSlots(start, moveBlock("name"), measure, NAME_H);
  /*
   * The run above the description — the one the block is being lifted out of.
   * There is a second below it, running to the zone's own bottom edge, and it
   * closes against nothing so it carries no `nextOffset`.
   */
  const above = () => slots().filter((slot) => slot.y < DESC_TOP);

  it("opens the run at the zone's own content edge", () => {
    const run = above();

    // One run, not two stopping either side of a line that is leaving.
    expect(new Set(run.map((slot) => slot.index))).toEqual(new Set([1]));
    expect(run[0].y).toBe(12);
    expect(run[0].offset).toBe(0);
  });

  it("promises every mark that the description will not move", () => {
    const run = above();

    expect(run.length).toBeGreaterThan(1);
    for (const slot of run) {
      expect(slot.y + NAME_H + 8 + slot.nextOffset!).toBe(DESC_TOP);
    }
  });

  it("lands the block on the mark it drew, at its own width, and leaves the description alone", () => {
    /*
     * The assertion the browser was making by hand. A slot's `y` is a promise
     * about where the block goes; `offset` is how that promise is stored, and
     * the two only agree once the vacated line is out of the arithmetic.
     */
    const vacate = vacatedSpace(start, moveBlock("name"), measure);

    for (const slot of above()) {
      const landed = dropCardBlock(start, { kind: "move", id: "name" }, {
        zone: slot.zone,
        index: slot.index,
        offset: slot.offset,
        ...(slot.nextOffset === undefined ? {} : { nextOffset: slot.nextOffset }),
        ...(vacate === null ? {} : { vacateId: vacate.id, vacateOffset: vacate.offset }),
      });

      // The first place is where the name already is, at the width it already
      // has — a drop there changes nothing.
      if (slot.offset === 0) {
        expect(landed).toBeNull();
        continue;
      }

      const [name, description] = landed!.zones.middle;

      // Where the mark was drawn, in the card the drop actually produces.
      expect(name.id).toBe("name");
      expect(12 + (name.offset ?? 0)).toBe(slot.y);
      // Still half the card: the spot was drawn at its width, not across it.
      expect(name.widthPct).toBe(50);
      // And the description's own top edge, unmoved.
      expect(12 + (name.offset ?? 0) + NAME_H + 8 + (description.offset ?? 0)).toBe(
        DESC_TOP,
      );
    }
  });

  it("does not call the line occupied", () => {
    // The same test `dropSlots` runs — a line that is about to be free is not a
    // face anything is refused for.
    expect(
      blockedFaces(start, moveBlock("name"), measure).some(
        (face) => face.top < 12 + NAME_H,
      ),
    ).toBe(false);
  });

  it("charges the description the whole run when the block leaves it", () => {
    // Everything from the zone's content edge to the description's own top.
    expect(vacatedSpace(start, moveBlock("name"), measure)).toEqual({
      id: "description",
      offset: DESC_TOP - 12,
    });
  });

  it("still keeps a line whose other half is staying", () => {
    /*
     * A pair is not freed by picking up one of its halves — the partner is
     * still drawn there, still holding the line's height — and treating it as
     * free would draw a run straight over a block that is not moving.
     */
    const paired = cardWith({
      middle: [
        { id: "name", type: "name", widthPct: 50 },
        { id: "address", type: "address", widthPct: 50 },
        { id: "description", type: "description", offset: 200 },
      ],
    });

    const run = dropSlots(paired, moveBlock("name"), [
      zoneOf("middle", 12, 428, [
        { id: "name", top: 12, bottom: 48, left: 12, right: 12 + columnPx(50) },
        { id: "address", top: 12, bottom: 48, left: 12 + columnPx(50) + 8, right: 308 },
        { id: "description", top: DESC_TOP, bottom: DESC_TOP + DESCRIPTION_H },
      ]),
    ], NAME_H);

    // Nothing is offered above the line: the zone's content edge touches it, so
    // there is no room there, and a block goes where there is room.
    expect(run.every((slot) => slot.y >= 48)).toBe(true);
  });

  it("still keeps a line whose other half has not been measured yet", () => {
    /*
     * The guard for adding `count`. `row.blocks` holds only what was measured,
     * so a pair whose partner has not rendered passes `every` on the dragged
     * block alone. Freeing that line would hand a run the pixels of a block
     * still drawn in them.
     */
    const paired = cardWith({
      middle: [
        { id: "name", type: "name", widthPct: 50 },
        { id: "address", type: "address", widthPct: 50 },
        { id: "description", type: "description", offset: 200 },
      ],
    });

    const run = dropSlots(paired, moveBlock("name"), [
      zoneOf("middle", 12, 428, [
        { id: "name", top: 12, bottom: 48, left: 12, right: 12 + columnPx(50) },
        { id: "description", top: DESC_TOP, bottom: DESC_TOP + DESCRIPTION_H },
      ]),
    ], NAME_H);

    expect(run.every((slot) => slot.y >= 48)).toBe(true);
  });
});

describe("a shared line that shrinks when one of its blocks leaves", () => {
  /*
   * The reported card, in numbers taken off it: a gallery, then a Name sharing
   * a line with a Logo that carries `overlapPct: 50`, then a Description.
   *
   * The logo is pulled up over the picture, so the line's *top* is the logo's
   * and its *bottom* is the name's — the name hangs five pixels below it. Take
   * the name away and the line ends where the logo does, and the description
   * comes up by those five pixels. That is the whole bug: one gesture, two
   * blocks moved.
   *
   * `measuredRows` takes a line's extent as the union of its members', which is
   * right for a line that is staying and wrong for the one the drag is about to
   * take a block out of.
   */
  const LINE_TOP = 239;
  const LOGO_BOTTOM = 318;
  const NAME_BOTTOM = 323;
  const DESC_TOP = 500;

  const start = cardWith({
    middle: [
      { id: "gallery", type: "gallery", heightPct: 25 },
      { id: "name", type: "name", widthPct: 36, padding: 4 },
      { id: "logo", type: "logo", heightPct: 18, overlapPct: 50, align: "center" },
      { id: "description", type: "description", padding: 4, offset: 169 },
    ],
  });

  const measure = [
    zoneOf("middle", 161, 601, [
      { id: "gallery", top: 161, bottom: 271 },
      { id: "name", top: 279, bottom: NAME_BOTTOM, left: 12, right: 123 },
      { id: "logo", top: LINE_TOP, bottom: LOGO_BOTTOM, left: 131, right: 210 },
      { id: "description", top: DESC_TOP, bottom: 524 },
    ]),
  ];

  /** The name's own height, which it keeps: a drop does not change its width. */
  const NAME_H = 44;

  const slots = () =>
    dropSlots(start, moveBlock("name"), measure, NAME_H).filter(
      (slot) => slot.y > LOGO_BOTTOM && slot.y < DESC_TOP,
    );

  it("cuts the run below it from the edge the line will actually have", () => {
    // Not `NAME_BOTTOM`: the name is the block being carried, and it is what
    // holds that edge. The first mark sits a gap below the logo.
    expect(slots()[0].y).toBe(LOGO_BOTTOM + 8);
  });

  it("promises every mark that the description will not move", () => {
    const run = slots();

    expect(run.length).toBeGreaterThan(1);
    for (const slot of run) {
      expect(slot.y + NAME_H + 8 + slot.nextOffset!).toBe(DESC_TOP);
    }
  });

  it("holds the description still through the reported drop", () => {
    const vacate = vacatedSpace(start, moveBlock("name"), measure);

    for (const slot of slots()) {
      const landed = dropCardBlock(start, { kind: "move", id: "name" }, {
        zone: slot.zone,
        index: slot.index,
        offset: slot.offset,
        ...(slot.nextOffset === undefined ? {} : { nextOffset: slot.nextOffset }),
        ...(vacate === null ? {} : { vacateId: vacate.id, vacateOffset: vacate.offset }),
      })!;

      const middle = landed.zones.middle;
      const name = middle.find((block) => block.id === "name")!;
      const description = middle.find((block) => block.id === "description")!;

      // At its own width, off the logo's line, and where the mark said it would be.
      expect(name.widthPct).toBe(36);
      expect(LOGO_BOTTOM + 8 + (name.offset ?? 0)).toBe(slot.y);
      // And the description's top edge, unmoved — measured the way the card
      // stacks it: the logo's line, the gap, the name, the gap, its own space.
      expect(slot.y + NAME_H + 8 + (description.offset ?? 0)).toBe(DESC_TOP);
    }
  });

  it("charges the description the five pixels the line gives back", () => {
    /*
     * Even for a drop that lands nowhere near this run — the block below a
     * shrinking line has to keep its place whatever the block in the hand does
     * next, which is what `vacate` is for and `settle` only overrides locally.
     */
    expect(vacatedSpace(start, moveBlock("name"), measure)).toEqual({
      id: "description",
      offset: DESC_TOP - LOGO_BOTTOM - 8,
    });
  });

  it("charges nothing when the partner holds the whole line on its own", () => {
    // The ordinary pair: the block being carried is inside its partner's
    // extent, so the line does not move and there is nothing to give back.
    const inside = [
      zoneOf("middle", 161, 601, [
        { id: "gallery", top: 161, bottom: 271 },
        { id: "name", top: 279, bottom: 300, left: 12, right: 123 },
        { id: "logo", top: LINE_TOP, bottom: LOGO_BOTTOM, left: 131, right: 210 },
        { id: "description", top: DESC_TOP, bottom: 524 },
      ]),
    ];

    expect(vacatedSpace(start, moveBlock("name"), inside)).toBeNull();
  });
});

/**
 * What a column landing costs the line under it.
 *
 * A run says this for every slot it draws and a column said nothing at all, so a
 * block joining a line and making it taller pushed the rest of the card down and
 * nothing ever paid it back. Out and back was charged once and refunded never —
 * six pixels a trip on an ordinary card, which is a block at the bottom sliding
 * below the fold after twenty of them.
 */
describe("sideSlots — the line below a column landing", () => {
  /*
   * The reported card: a photo, a logo, a 38% name and a category at the
   * bottom. The name is out on a line of its own and about to be dropped back
   * into the room beside the logo.
   *
   * The logo is 14% of a 440px card — 62px — pulled up 31 by `overlapPct: 50`,
   * so its line sits at 130 and draws from 99. In flow it is 31px tall, so the
   * line ends at 161; the name at 38% is 37px, so once it lands the line ends at
   * 167 instead. The category has to give up those 6px of leading space to stay
   * where it is, and giving up nothing is the bug.
   */
  const card = cardWith({
    middle: [
      { id: "photo", type: "gallery", heightPct: 25 },
      { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      { id: "name", type: "name", widthPct: 38, newLine: true },
      { id: "category", type: "category", offset: 40 },
    ],
  });

  const measured = [
    zoneOf("middle", 12, 452, [
      { id: "photo", top: 12, bottom: 122, left: 12, right: 308 },
      { id: "logo", top: 99, bottom: 161, left: 129, right: 191 },
      { id: "name", top: 169, bottom: 206, left: 12, right: 12 + columnPx(38) },
      { id: "category", top: 237, bottom: 261, left: 12, right: 308 },
    ]),
  ];

  /** The name is 37px at 38% of the line, which is the width it keeps. */
  const heightAt: HeightAt = (id, _widthPct, _widthPx, fallback) =>
    id === "name" ? 37 : fallback;

  it("charges the line below for the room the newcomer takes", () => {
    const beside = sideSlots(card, moveBlock("name"), measured, heightAt).filter(
      (slot) => slot.line === 1,
    );

    expect(beside.length).toBeGreaterThan(0);
    // The logo's line sits at 130 — its ink starts at 99 and it is pulled up 31.
    // With the name on it the line ends at 130 + 37 = 167, and the category has
    // to sit at 237: 237 - 167 - 8 = 62.
    for (const slot of beside) expect(slot.nextOffset).toBe(62);
  });

  it("charges a mark landing on a zone's first line in full", () => {
    /*
     * The same idea with the logo in the hand, landing beside a name that is
     * already narrow — and the name's line is the **first** of its zone, so there
     * is nothing above for the logo to be pulled over. `blockEdges` refuses that
     * overlap (see `upwardLiftOf`), so the mark really does take all 62 of its
     * own pixels and the line below really does owe them.
     */
    const withNarrow = cardWith({
      middle: [
        { id: "name", type: "name", widthPct: 39 },
        { id: "category", type: "category", offset: 40 },
        // Last, so it is on a line of its own.
        { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      ],
    });

    const zones = [
      zoneOf("middle", 12, 452, [
        { id: "name", top: 12, bottom: 49, left: 12, right: 127 },
        { id: "category", top: 170, bottom: 194, left: 12, right: 308 },
        { id: "logo", top: 210, bottom: 272, left: 12, right: 74 },
      ]),
    ];

    const beside = sideSlots(withNarrow, moveBlock("logo"), zones, heightAt).filter(
      (slot) => slot.line === 0,
    );

    expect(beside.length).toBeGreaterThan(0);
    // The name's line runs 12–49 and the logo adds its whole 62 from 12, which
    // is 74 — past the name, so the line ends there and the category gives up
    // the difference to stay at 170: 170 - 74 - 8.
    for (const slot of beside) expect(slot.nextOffset).toBe(88);
  });

  it("charges only for the half of a mark that has a line above it", () => {
    /*
     * Put a photo above and the name's line is no longer the zone's first, so a
     * logo landing on it *is* pulled up: 62px of ink, 31px of line, because half
     * of it hangs over the photo. Charging the full 62 would push the card down
     * by an overlap that takes no room.
     */
    const under = cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "name", type: "name", widthPct: 39 },
        { id: "category", type: "category", offset: 46 },
        // Last, so it is on a line of its own.
        { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      ],
    });

    const zones = [
      zoneOf("middle", 12, 452, [
        { id: "photo", top: 12, bottom: 122, left: 12, right: 308 },
        { id: "name", top: 130, bottom: 150, left: 12, right: 127 },
        { id: "category", top: 215, bottom: 239, left: 12, right: 308 },
        { id: "logo", top: 250, bottom: 312, left: 12, right: 74 },
      ]),
    ];

    const beside = sideSlots(under, moveBlock("logo"), zones, heightAt).filter(
      (slot) => slot.line === 1,
    );

    expect(beside.length).toBeGreaterThan(0);
    // The line sits at 130 and the mark adds 31 of flow, so it ends at 161; the
    // category stays at 215 by taking 215 - 161 - 8.
    for (const slot of beside) expect(slot.nextOffset).toBe(46);
  });

  it("says nothing when there is no line below to charge", () => {
    const alone = cardWith({
      middle: [
        { id: "logo", type: "logo", heightPct: 14, align: "center" },
        { id: "name", type: "name", widthPct: 38, newLine: true },
      ],
    });

    const slots = sideSlots(alone, moveBlock("name"), [
      zoneOf("middle", 12, 452, [
        { id: "logo", top: 12, bottom: 74, left: 129, right: 191 },
        { id: "name", top: 82, bottom: 102, left: 12, right: 12 + columnPx(38) },
      ]),
    ]);

    expect(slots.length).toBeGreaterThan(0);
    for (const slot of slots) expect(slot.nextOffset).toBeUndefined();
  });

  it("looks past the line the drag is about to empty", () => {
    /*
     * The name's own line sits between the logo's and the category's, and it is
     * about to go — so the line that ends up under the logo is the category's,
     * and it is the category the number has to be about.
     */
    const beside = sideSlots(card, moveBlock("name"), measured, heightAt).filter(
      (slot) => slot.line === 1,
    );

    // 62 is measured to the category at 237. Measured to the name's own line at
    // 169 there would have been no room at all, and no place offered.
    expect(beside[0].nextOffset).toBe(62);
  });
});

describe("a mark on the first line of its zone", () => {
  /*
   * The reported card, reduced to the one thing that was wrong about it: a logo
   * whose line is the **first** of its zone is not pulled up — there is nothing
   * above it to be pulled over — so its line sits exactly where it is drawn.
   *
   * `measuredRows` used to add the overlap back unconditionally, on the way from
   * an ink rect to a flow position. On this card that made the logo's line
   * report itself 31px lower than it is, and every offset measured against it
   * was 31px too generous: drop anything into the run above and the logo, and
   * everything under it, moved down half a logo. Repeat and it walks out of the
   * card, which is what the user was watching happen.
   */
  const card = cardWith({
    middle: [
      { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, offset: 100 },
      { id: "description", type: "description", offset: 40 },
    ],
  });

  /*
   * The logo draws at 112 — the zone's content top plus its own leading space,
   * and *not* 31px above that, because `blockEdges` refuses an overlap on a
   * zone's first line. The description follows at 112 + 62 + 8 + 40.
   */
  const LOGO_TOP = 112;
  const zones = [
    zoneOf("middle", 12, 452, [
      { id: "logo", top: LOGO_TOP, bottom: LOGO_TOP + 62 },
      { id: "description", top: 222, bottom: 294 },
    ]),
  ];

  it("promises every mark in the run above that the logo will not move", () => {
    const above = dropSlots(card, newBlock("name"), zones, 24).filter(
      (slot) => slot.index === 0,
    );

    expect(above.length).toBeGreaterThan(1);
    for (const slot of above) {
      // The name draws at the mark, spends 24, pays the gap, and what is left is
      // what it told the logo's line to become — which is where that line is.
      expect(slot.y + 24 + 8 + slot.nextOffset!).toBe(LOGO_TOP);
    }
  });

  it("charges the lift back once there is a line above after all", () => {
    /*
     * The same card with a photo in front, so the logo's line is the second one
     * and the overlap really does apply. Now the line's flow top is 31px below
     * its ink, and the run above has to be measured to that.
     */
    const withPhoto = cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, offset: 100 },
        { id: "description", type: "description", offset: 40 },
      ],
    });

    // The photo runs 12–122, the logo's line sits at 130 + 100 = 230, and its
    // ink starts 31 above that.
    const above = dropSlots(
      withPhoto,
      newBlock("name"),
      [
        zoneOf("middle", 12, 452, [
          { id: "photo", top: 12, bottom: 122 },
          { id: "logo", top: 199, bottom: 261 },
          { id: "description", top: 309, bottom: 381 },
        ]),
      ],
      24,
    ).filter((slot) => slot.index === 1);

    expect(above.length).toBeGreaterThan(1);
    // To 230, where the line *sits* — not to 199, where it is drawn.
    for (const slot of above) {
      expect(slot.y + 24 + 8 + slot.nextOffset!).toBe(230);
    }
  });
});

describe("dragging the logo itself does not move the block under it", () => {
  /*
   * The reported bug, end to end and in the shape it was built: a photo, a logo
   * straddling its bottom edge, and a description below. Pick the logo up, put
   * it down somewhere else, bring it back — and the description has to be
   * exactly where it started.
   *
   * A **flush** landing is what used to break it. The block stores `offset: 0`
   * and `blockEdges` then draws it 31px above the run it opens, so it gives that
   * much back to the flex column — while `settles` charged the line below as
   * though it sat at the run's start. Everything under the logo rose by half a
   * logo on every trip, and nothing gave it back.
   */
  const PHOTO_H = 110;
  const LOGO_H = 62;
  const LIFT = 31;
  const DESCRIPTION_H = 72;

  const start = cardWith({
    middle: [
      { id: "photo", type: "gallery", heightPct: 25 },
      { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      { id: "description", type: "description", offset: 120 },
    ],
  });

  /**
   * The card as the browser would measure it — the one place the logo's own
   * arithmetic is written out rather than asked of the code under test.
   *
   * A line sits at `y` plus its own leading space; the photo and the description
   * draw from there, while the logo draws `LIFT` above it and contributes only
   * `LOGO_H - LIFT` to the column below.
   */
  const rectsOf = (layout: CardLayout): ZoneMeasure[] => {
    let y = 12;

    return [
      zoneOf(
        "middle",
        12,
        452,
        layout.zones.middle.map((block) => {
          y += block.offset ?? 0;

          if (block.type === "logo") {
            const rect = { id: block.id, top: y - LIFT, bottom: y + LIFT };
            y = y + LIFT + 8;

            return rect;
          }

          const height = block.type === "gallery" ? PHOTO_H : DESCRIPTION_H;
          const rect = { id: block.id, top: y, bottom: y + height };
          y = rect.bottom + 8;

          return rect;
        }),
      ),
    ];
  };

  const descriptionTop = (layout: CardLayout) =>
    rectsOf(layout)[0].blocks.find((block) => block.id === "description")!.top;

  const START_TOP = descriptionTop(start);

  /** The card after the logo is released on the first place `pick` accepts. */
  const drag = (
    layout: CardLayout,
    pick: (slot: DropSlot, descriptionTop: number) => boolean,
  ) => {
    const dragged = moveBlock("logo");
    const zones = rectsOf(layout);
    const slot = dropSlots(layout, dragged, zones, LOGO_H).find((candidate) =>
      pick(candidate, descriptionTop(layout)),
    )!;
    const vacate = vacatedSpace(layout, dragged, zones);

    return dropCardBlock(layout, { kind: "move", id: "logo" }, {
      zone: slot.zone,
      index: slot.index,
      offset: slot.offset,
      ...(slot.nextOffset === undefined ? {} : { nextOffset: slot.nextOffset }),
      ...(vacate === null
        ? {}
        : { vacateId: vacate.id, vacateOffset: vacate.offset }),
    })!;
  };

  /**
   * A place under the description, and the flush one against the photo.
   *
   * `height > 0` is kept as a guard rather than needed. A zero-height place at
   * the zone's own content top used to match the same `offset: 0` above the
   * description — a seam, inserting the logo above the photo — and the card no
   * longer offers one, but the predicate should still name the square it means.
   */
  const under = (slot: DropSlot, descriptionTop: number) => slot.y > descriptionTop;
  const flush = (slot: DropSlot, descriptionTop: number) =>
    slot.y < descriptionTop && slot.offset === 0 && slot.height > 0;

  it("starts where the arithmetic says it does", () => {
    // 12 + 110 + 8 + 31 + 8 + 120 — the photo, the gap, the half of the logo
    // that is inside the column, the gap, and the description's own space.
    expect(START_TOP).toBe(289);
  });

  it("puts the description back after one round trip", () => {
    const away = drag(start, under);
    const back = drag(away, flush);

    expect(descriptionTop(back)).toBe(START_TOP);
    expect(back).toEqual(start);
  });

  it("is still that card after ten round trips", () => {
    /*
     * Ten, for the reason the name's own drift test is ten: a single cycle hides
     * half a logo well enough to look like a rounding error, and ten of them
     * walk the description clean out of a 440px card.
     */
    let layout = start;

    for (let cycle = 0; cycle < 10; cycle += 1) {
      layout = drag(layout, under);
      layout = drag(layout, flush);
      expect(descriptionTop(layout)).toBe(START_TOP);
    }

    expect(layout).toEqual(start);
  });
});

describe("a line whose survivor was only as tall as the block that left", () => {
  /*
   * The reported card, and the half of it the unit tests could not see.
   *
   * `[address][logo]` share the middle zone's first line, with a description
   * under them. A line is `align-items: stretch` — that is what makes a pair
   * look like a pair rather than two blocks of different heights with a step
   * between them — so the address *measures* 62px tall while the logo is beside
   * it, and 14px once the logo leaves.
   *
   * Every fixture in this file used to hand `vacatedSpace` the address's natural
   * 14px, because that is what a person writing rects by hand reaches for. The
   * browser hands it 62. And 62 is exactly the line's own height, so `shrunkBy`
   * compared the survivors against the line, found no change, and charged
   * nobody: drag the logo away and the description rode up 48px into the hole,
   * every time, which is what the user was watching happen.
   *
   * `HeightAt` is the way out, and the same one `sideSlots` already uses: rects
   * cannot answer "how tall would this be on its own", so ask the layout engine.
   */
  const card = cardWith({
    middle: [
      { id: "address", type: "address", widthPct: 39 },
      { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      { id: "description", type: "description", offset: 40 },
    ],
  });

  /** The address's own height, and the height the line stretches it to. */
  const ALONE = 14;
  const STRETCHED = 62;

  /*
   * As a browser measures it: both members of the line run 12–74, because the
   * shorter one is stretched to the taller. The description follows at
   * 74 + 8 + 40 = 122.
   */
  const zones = [
    zoneOf("middle", 12, 452, [
      { id: "address", top: 12, bottom: 12 + STRETCHED, left: 12, right: 123 },
      { id: "logo", top: 12, bottom: 12 + STRETCHED, left: 131, right: 193 },
      { id: "description", top: 122, bottom: 154, left: 12, right: 308 },
    ]),
  ];

  /** What the layout engine would say: the address is 14px of text on its own. */
  const heightAt: HeightAt = (id, _widthPct, _widthPx, fallback) =>
    id === "address" ? ALONE : fallback;

  it("charges the description for the height the line is about to lose", () => {
    /*
     * The line ends at 12 + 14 = 26 once the logo goes, the run below it pays a
     * gap, and the description has to hold 122. So 122 - 26 - 8 = 88 — where it
     * was carrying 40, because the logo was holding the other 48 up for it.
     */
    expect(vacatedSpace(card, moveBlock("logo"), zones, heightAt)).toEqual({
      id: "description",
      offset: 88,
    });
  });

  it("keeps the description exactly where it was drawn", () => {
    const vacated = vacatedSpace(card, moveBlock("logo"), zones, heightAt)!;
    const zoneTop = 12;

    // Where the description ends up: the shrunken line, the gap, and the space
    // it has just been told to take.
    expect(zoneTop + ALONE + 8 + vacated.offset).toBe(122);
  });

  it("finds nothing without a measurer, which is why one is passed", () => {
    /*
     * Not an aspiration — a record of the trap. With no `HeightAt` the default
     * answers with the rect's own height, the survivor reports the stretched 62,
     * the line looks unchanged and the hole goes uncharged. Any caller that
     * measures a real card has to pass one; `useCardDropBands` does.
     */
    expect(vacatedSpace(card, moveBlock("logo"), zones)).toBeNull();
  });

  it("leaves a line alone when the survivor is the one holding it up", () => {
    /*
     * The mirror, and the reason this cannot simply always re-measure: take the
     * *address* away and the logo still draws its own 62px square, so the line
     * is exactly as tall as it was and the description owes nothing.
     */
    expect(
      vacatedSpace(card, moveBlock("address"), zones, (id, _p, _w, fallback) =>
        id === "logo" ? STRETCHED : fallback,
      ),
    ).toBeNull();
  });
});

describe("lendToEndZones", () => {
  /*
   * The bug this answers, in numbers: on the default card the bottom zone is the
   * only band that pins, and while it is empty it measures nothing at all — so
   * `dropSlots` produced a zero-span run for it, nothing was outlined, and
   * every "put this at the bottom" gesture landed in the middle instead, held
   * there by an `offset` that is space *above* a block rather than a promise
   * about the card's edge.
   *
   * `defaultCardLayout()` is 440 tall with 12px of padding and an 8px gap. An
   * empty end zone sits flush against the card's own content edge, which is why
   * the measures below start life as `(440, 440)` and `(0, 0)`.
   */
  const card = cardWith({ middle: [{ id: "name", type: "name" }] });

  /** The three zones of a card whose middle holds one 24px block at the top. */
  const measured = () => [
    zoneOf("top", 0, 0),
    zoneOf("middle", 0, 440, [{ id: "name", top: 0, bottom: 24 }]),
    zoneOf("bottom", 440, 440),
  ];

  const find = (zones: ZoneMeasure[], zone: ZoneMeasure["zone"]) =>
    zones.find((measure) => measure.zone === zone) as ZoneMeasure;

  it("gives an empty bottom zone a block's worth of room, at the card's edge", () => {
    const zones = measured();
    lendToEndZones(zones, card, null, 24);

    // The band it will actually occupy: the card's own padding below it, then
    // the block. 440 - 12 = 428, less the 24 it was lent.
    expect(find(zones, "bottom").bottom).toBe(428);
    expect(find(zones, "bottom").top).toBe(404);

    // And the middle gives up exactly that, plus the padding between them, so
    // the two cannot both offer the same strip.
    expect(find(zones, "middle").bottom).toBe(392);
  });

  it("lends the top zone only its own padding, because it never pays the card's bottom", () => {
    const zones = [
      zoneOf("top", 0, 0),
      zoneOf("middle", 0, 440, [{ id: "name", top: 200, bottom: 224 }]),
      zoneOf("bottom", 440, 440),
    ];
    lendToEndZones(zones, card, null, 24);

    expect(find(zones, "top").top).toBe(12);
    expect(find(zones, "top").bottom).toBe(36);
    expect(find(zones, "middle").top).toBe(36);
  });

  it("lends nothing to a zone the layout already fills", () => {
    const filled = cardWith({
      middle: [{ id: "name", type: "name" }],
      bottom: [{ id: "actions", type: "actions" }],
    });
    const zones = [
      zoneOf("top", 0, 0),
      zoneOf("middle", 0, 400, [{ id: "name", top: 0, bottom: 24 }]),
      zoneOf("bottom", 412, 428, [{ id: "actions", top: 412, bottom: 428 }]),
    ];
    lendToEndZones(zones, filled, null, 24);

    expect(find(zones, "bottom").top).toBe(412);
    expect(find(zones, "middle").bottom).toBe(400);
  });

  it("lends nothing when the middle has less than a band to spare", () => {
    /*
     * A card already full to its own bottom edge. There is no empty strip on
     * screen to point at, and a target drawn over a block is worse than none —
     * so this leaves the measurement exactly as it found it and the Position
     * control in the panel is what moves the block instead.
     */
    const zones = [
      zoneOf("top", 0, 0),
      zoneOf("middle", 0, 440, [{ id: "name", top: 0, bottom: 438 }]),
      zoneOf("bottom", 440, 440),
    ];
    lendToEndZones(zones, card, null, 24);

    expect(find(zones, "bottom")).toEqual(zoneOf("bottom", 440, 440));
    expect(find(zones, "middle").bottom).toBe(440);
  });

  it("discounts the block in the hand, which is the gesture that needs this most", () => {
    /*
     * Dragging a block off the bottom of the middle zone is exactly the move
     * somebody makes when they want it pinned — and the block is still on the
     * card, drawn dimmed where it was, so counted it reports the middle full and
     * the bottom band never appears. `dropSlots` reads the same fact through
     * `freedBy`; this reads it off the drag.
     */
    const zones = [
      zoneOf("top", 0, 0),
      zoneOf("middle", 0, 440, [
        { id: "name", top: 0, bottom: 24 },
        { id: "button", top: 392, bottom: 440 },
      ]),
      zoneOf("bottom", 440, 440),
    ];
    lendToEndZones(zones, card, toCardDrag(moveBlock("button")), 48);

    // The line above the departing block ends at 24, so there is room for all
    // 48px of it at the card's edge.
    expect(find(zones, "bottom").top).toBe(380);
    expect(find(zones, "bottom").bottom).toBe(428);
  });
});

/**
 * The reported bug: a card refuses every drop while showing a large empty area.
 *
 * A zone is a flex column and `hours` is the one block allowed to shrink below
 * its own content, so an over-full design never overflows — that block gives up
 * the difference and the rects then sum to exactly the card's height. Measured to
 * the rects, `roomForNew` is pinned at 0 and every zone refuses forever, while
 * the shrunken block is drawn as the very empty space the owner is aiming at.
 *
 * The numbers are the real ones, scaled to the default 440px card: two blocks
 * whose rects leave 208px going spare, where the second has been squeezed by
 * 200px and really wants 300.
 */
describe("a block the flex column has shrunk", () => {
  // An address rather than a name, so the name in hand is refused by room or by
  // nothing — `acceptsBlock` lets a card have only one of each.
  const layout = cardWith({
    middle: [
      { id: "a", type: "address" },
      { id: "h", type: "hours" },
    ],
  });

  const rects = [
    { id: "a", top: 12, bottom: 112 },
    { id: "h", top: 120, bottom: 220 },
  ];

  it("offers places when nothing says the block was squeezed", () => {
    // 24 of padding, one gap and two 100px rects is 232 of 440 — the answer
    // every caller that cannot measure a block's own content still gets.
    const slots = dropSlots(layout, newBlock("name"), [
      zoneOf("middle", 12, 428, rects),
    ], 24);

    expect(slots.length).toBeGreaterThan(0);
  });

  it("offers none once the squeeze is given back", () => {
    // The same card, saying what the second block actually asked for: 24 + 8 +
    // 100 + 300 is 432, so 8px are free and a name needs 32.
    const slots = dropSlots(layout, newBlock("name"), [
      zoneOf("middle", 12, 428, [rects[0], { ...rects[1], wants: 300 }]),
    ], 24);

    expect(slots).toEqual([]);
  });

  it("still lets a block already on the card be moved", () => {
    // A move is free — it is already counted — and refusing one would strand
    // every block on a card nobody can rearrange. See `hasRoomFor`.
    const slots = dropSlots(layout, moveBlock("h"), [
      zoneOf("middle", 12, 428, [rects[0], { ...rects[1], wants: 300 }]),
    ], 24);

    expect(slots.length).toBeGreaterThan(0);
  });
});

describe("zoneHeights", () => {
  it("credits a block with what its line asked for, not what it was given", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "h", type: "hours" },
      ],
    });

    expect(
      zoneHeights(layout, [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 112 },
          { id: "h", top: 120, bottom: 220, wants: 300 },
        ]),
      ]),
    ).toEqual({ a: 100, h: 300 });
  });

  it("gives both members of a pair the line's own height", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true },
        { id: "b", type: "address", half: true },
      ],
    });

    // One line costs the card one line — the same rule `usedHeight` applies.
    expect(
      zoneHeights(layout, [
        zoneOf("middle", 12, 428, [
          { id: "a", top: 12, bottom: 60 },
          { id: "b", top: 12, bottom: 48 },
        ]),
      ]),
    ).toEqual({ a: 48, b: 48 });
  });
});
