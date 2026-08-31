import { describe, expect, it } from "vitest";

import { defaultCardLayout, type CardLayout } from "@/packages/shared/card-layout";
import { cardLayoutSchema } from "@/lib/validation/card-layout.schema";
import {
  fitWithin,
  hasRoomFor,
  newBlockHeight,
  roomLeft,
  usedHeight,
} from "./card-space";

/**
 * The rule a person feels as a lane that refuses to open, asked here instead.
 *
 * Every number below is px against a 440px card, which is what
 * `defaultCardLayout` is — see packages/shared/card-layout.ts.
 */

/** A card holding exactly these blocks, and nothing else. */
const cardWith = (zones: Partial<CardLayout["zones"]>): CardLayout => ({
  ...defaultCardLayout(),
  zones: { top: [], middle: [], bottom: [], ...zones },
});

describe("newBlockHeight", () => {
  it("resolves a type's default height against this card", () => {
    const layout = defaultCardLayout();

    // The gallery arrives at a quarter of the card: 25% of 440.
    expect(newBlockHeight(layout, "gallery")).toBe(110);
    // And against a taller card, more.
    expect(newBlockHeight({ ...layout, maxHeight: 720 }, "gallery")).toBe(180);
  });

  it("falls back to one line for a block that grows to its content", () => {
    // A name is as tall as the name, so there is no number to resolve — only a
    // floor, so a full card cannot take one more of them either.
    expect(newBlockHeight(defaultCardLayout(), "name")).toBe(24);
  });
});

describe("usedHeight", () => {
  it("counts what a block measures, in preference to what its type implies", () => {
    const layout = cardWith({ top: [{ id: "g", type: "gallery", heightPct: 25 }] });

    // Nothing measured yet: 110 for the gallery, plus the card's own padding.
    expect(usedHeight(layout, {})).toBe(110 + 24);
    // Measured: the real number wins, which is the whole point — a name is only
    // as tall as the name it is drawing today.
    expect(usedHeight(layout, { g: 300 })).toBe(300 + 24);
  });

  it("pays a gap between blocks but not around them", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "address" },
      ],
    });

    // Two blocks, one gap: 20 + 20 + 8, plus the card's padding.
    expect(usedHeight(layout, { a: 20, b: 20 })).toBe(20 + 20 + 8 + 24);
  });

  it("counts the empty space someone left above a block", () => {
    // An offset is height the card has already spent. Leave it out and a card
    // whose blocks have been spread down the middle still reports the room it
    // had when they were stacked at the top.
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "address", offset: 64 },
      ],
    });

    expect(usedHeight(layout, { a: 20, b: 20 })).toBe(20 + 20 + 8 + 24 + 64);
  });
});

describe("roomLeft", () => {
  it("is what the card has not spent, and never negative", () => {
    const layout = cardWith({ top: [{ id: "g", type: "gallery", heightPct: 70 }] });

    // 70% of 440 is 308, plus 24 of card padding, out of 440.
    expect(roomLeft(layout, {})).toBe(440 - 308 - 24);
    // A card already overflowing has no room, rather than negative room.
    expect(roomLeft(layout, { g: 900 })).toBe(0);
  });
});

describe("hasRoomFor", () => {
  const full = cardWith({ top: [{ id: "g", type: "gallery", heightPct: 90 }] });

  it("closes a zone that has no room left for what is being added", () => {
    // 90% of 440 is 396, plus 24 of padding, leaves 20 — less than the 24 a
    // block needs even at its floor, before the gap.
    expect(hasRoomFor(full, "top", { kind: "new", type: "name" }, {})).toBe(false);
  });

  it("keeps the zone open while the block still fits", () => {
    const roomy = cardWith({ top: [{ id: "g", type: "gallery", heightPct: 25 }] });

    expect(hasRoomFor(roomy, "top", { kind: "new", type: "name" }, {})).toBe(true);
    // But not for something as tall as another gallery.
    expect(hasRoomFor(roomy, "top", { kind: "new", type: "spacer" }, {})).toBe(true);
    expect(
      hasRoomFor(
        cardWith({ top: [{ id: "g", type: "gallery", heightPct: 70 }] }),
        "top",
        { kind: "new", type: "gallery" },
        {},
      ),
    ).toBe(false);
  });

  it("always has room for a block already on the card", () => {
    // A move adds nothing to the total, and refusing one would strand a block
    // on a full card with no way to reorder it.
    expect(hasRoomFor(full, "top", { kind: "move", id: "g" }, {})).toBe(true);
    expect(hasRoomFor(full, "bottom", { kind: "move", id: "g" }, {})).toBe(true);
  });

  it("closes the middle too, once the card is full", () => {
    /*
     * The middle used to be exempt because it is the card's only scroller, and
     * overflowing it was how a long description was meant to work. A card is a
     * fixed box on somebody else's website, though, and a visitor will not
     * scroll inside one to find the block at the bottom — so the editor stops
     * offering a landing rather than letting one be designed that way.
     */
    expect(hasRoomFor(full, "middle", { kind: "new", type: "name" }, {})).toBe(false);
  });

  it("still has room in the middle while the card has room", () => {
    const roomy = cardWith({ middle: [{ id: "a", type: "name" }] });

    expect(hasRoomFor(roomy, "middle", { kind: "new", type: "name" }, {})).toBe(true);
  });
});

/**
 * A pair costs the card one line, not two.
 *
 * The room check is what closes a lane, so counting a pair twice would have the
 * card report itself full with half its height unspent — and refuse a drop into
 * space it visibly has.
 */
describe("usedHeight with a pair", () => {
  it("counts the taller of two blocks sharing a line, once", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true },
        { id: "b", type: "address", half: true },
      ],
    });

    // 40 for the taller half, plus the card's own padding. Not 40 + 28.
    expect(usedHeight(layout, { a: 28, b: 40 })).toBe(40 + 24);
  });

  it("pays one gap after the line, not one after each of its blocks", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true },
        { id: "b", type: "address", half: true },
        { id: "c", type: "description" },
      ],
    });

    // Two lines, so one gap: 40 + 8 + 30, plus the padding.
    expect(usedHeight(layout, { a: 28, b: 40, c: 30 })).toBe(40 + 8 + 30 + 24);
  });

  it("takes the greater of the pair's two leading spaces, once", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true, offset: 12 },
        { id: "b", type: "address", half: true, offset: 30 },
      ],
    });

    expect(usedHeight(layout, { a: 28, b: 28 })).toBe(28 + 30 + 24);
  });

  it("leaves a zone room a stack of the same blocks would not have", () => {
    // The visible consequence: two 110px halves in the top zone are 110px of
    // card, so there is still somewhere to put a third block.
    const paired = cardWith({
      top: [
        { id: "a", type: "gallery", half: true, heightPct: 25 },
        { id: "b", type: "name", half: true },
      ],
    });

    expect(hasRoomFor(paired, "top", { kind: "new", type: "divider" }, {})).toBe(
      true,
    );
  });
});

/**
 * A card pulled back inside itself.
 *
 * `hasRoomFor` stops one being built too tall from here on. This is the other
 * half: a card that already is — spread down the middle before the rule existed,
 * or walked past the bottom edge by an older build's arithmetic — with the block
 * at the bottom only reachable by scrolling, which is not something a visitor
 * should ever have to do.
 */
describe("fitWithin", () => {
  it("leaves a card that fits exactly as it was", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", offset: 40 },
        { id: "b", type: "address" },
      ],
    });

    // By reference, so a caller can tell "nothing to do" from "changed" without
    // comparing, and an untouched card publishes the bytes it always did.
    expect(fitWithin(layout, { a: 28, b: 28 })).toBe(layout);
  });

  it("takes the overflow out of the largest gap first", () => {
    /*
     * 440px of card holding 24 of its own padding, 3 gaps (24), four 28px
     * blocks (112) and 108 + 200 + 60 of leading space: 528 in total, so 88
     * over. All of it comes out of the 200.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", offset: 108 },
        { id: "b", type: "address", offset: 200 },
        { id: "c", type: "category", offset: 60 },
        { id: "d", type: "actions" },
      ],
    });

    const next = fitWithin(layout, { a: 28, b: 28, c: 28, d: 28 });

    expect(next.zones.middle.map((block) => block.offset)).toEqual([
      108,
      112,
      60,
      undefined,
    ]);
    expect(usedHeight(next, { a: 28, b: 28, c: 28, d: 28 })).toBe(440);
  });

  it("moves on to the next gap when the largest runs out", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", offset: 60 },
        { id: "b", type: "address", offset: 400 },
      ],
    });

    // 24 of padding, 8 of gap, 56 of block, 460 of space: 548, which is 108
    // over. The 400 can pay it alone, so the 60 is untouched.
    const next = fitWithin(layout, { a: 28, b: 28 });
    expect(next.zones.middle.map((block) => block.offset)).toEqual([60, 292]);

    // Take it far enough over and the first gap pays the rest: 448 over, of
    // which the 400 covers all but 48.
    const tighter = fitWithin({ ...layout, maxHeight: 100 }, { a: 28, b: 28 });
    expect(tighter.zones.middle.map((block) => block.offset)).toEqual([
      12,
      undefined,
    ]);
  });

  it("keeps a line's leading space single-valued", () => {
    /*
     * A line takes the greatest of its members' offsets, so trimming the holder
     * while a sibling still carries an older number does nothing at all — the
     * sibling simply becomes the new maximum. The same rule `withRowOffset` in
     * ./card-edits.ts writes by.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50, offset: 120 },
        { id: "b", type: "address", widthPct: 50, offset: 400 },
        { id: "c", type: "category" },
      ],
    });

    const next = fitWithin(layout, { a: 28, b: 28, c: 28 });

    expect(next.zones.middle[0].offset).toBeUndefined();
    expect(next.zones.middle[1].offset).toBe(352);
  });

  it("never touches an order, a width or a height", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "gallery", heightPct: 60, offset: 300 },
        { id: "b", type: "name", widthPct: 40 },
      ],
    });

    const next = fitWithin(layout, { a: 264, b: 28 });

    expect(next.zones.middle.map((block) => block.id)).toEqual(["a", "b"]);
    expect(next.zones.middle[0].heightPct).toBe(60);
    expect(next.zones.middle[1].widthPct).toBe(40);
  });

  it("gives up rather than loops when the blocks alone are too tall", () => {
    // No leading space to take, and a card cannot trim a block's own content.
    const layout = cardWith({
      middle: [
        { id: "a", type: "gallery", heightPct: 90 },
        { id: "b", type: "gallery", heightPct: 90 },
      ],
    });

    expect(fitWithin(layout, { a: 396, b: 396 })).toBe(layout);
  });
});

/**
 * What `fitWithin` writes has to survive the trip to the server.
 *
 * The pattern lib/import/preflight.ts already uses, and for the same reason: the
 * endpoint can only answer "Check the highlighted fields and try again.", which
 * is a sentence written for a form. There is no form here — there is a card, and
 * a person who moved a block and was told nothing they could act on.
 */
describe("fitWithin produces something the server's own schema accepts", () => {
  /*
   * The real card this was found on, measured off the page. The heights are what
   * matters: `getBoundingClientRect` reports sub-pixel, so a text block is
   * 23.98750114440918 and never 24 — and `offset` is `z.number().int()`.
   *
   * `over` came out at 28.975…, the description's 225 became 196.024…, and every
   * save from the moment the page loaded was refused.
   */
  const TEXT = 23.98750114440918;

  const measured: CardLayout = {
    ...cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
        { id: "address", type: "address", padding: 4 },
        { id: "description", type: "description", padding: 4, offset: 225 },
      ],
    }),
    // The card's own, which this one had turned off — and 24px of padding is the
    // difference between a card that fits and one that does not, so a fixture
    // that quietly kept the default would be testing a different card.
    padding: 0,
  };

  const heights = { photo: 110, logo: 62, address: TEXT, description: TEXT };

  it("writes whole pixels from measurements that are not", () => {
    const next = fitWithin(measured, heights);

    for (const block of next.zones.middle) {
      if (block.offset === undefined) continue;
      expect(Number.isInteger(block.offset)).toBe(true);
    }
  });

  it("parses under cardLayoutSchema", () => {
    expect(() => cardLayoutSchema.parse(fitWithin(measured, heights))).not.toThrow();
  });

  it("still ends up inside the card", () => {
    const next = fitWithin(measured, heights);

    // Rounded *up*, so a whole pixel too much comes off rather than a fraction
    // too little: over the edge is the one direction that is not allowed.
    expect(usedHeight(next, heights)).toBeLessThanOrEqual(next.maxHeight);
  });

  it("leaves the card alone once the logo is charged what it costs", () => {
    /*
     * The same card as the caller now measures it. A logo with `overlapPct: 50`
     * is drawn 62px tall and hangs 31 of them above the line it is on, so it
     * spends 31 — and at 31 this card is 437.98 of a 440px card and needs
     * nothing taken off it at all.
     *
     * Charged to its ink instead it came to 468.98, and the description was
     * trimmed on load on a card that visibly fitted. `useCardFits` is what feeds
     * these numbers in; see `lineHeights` there.
     */
    const flow = { ...heights, logo: 31 };

    expect(usedHeight(measured, flow)).toBeLessThanOrEqual(measured.maxHeight);
    // By reference, so nothing is written and nothing is saved.
    expect(fitWithin(measured, flow)).toBe(measured);
  });
});
