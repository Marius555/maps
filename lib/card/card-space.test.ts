import { describe, expect, it } from "vitest";

import { defaultCardLayout, type CardLayout } from "@/packages/shared/card-layout";
import {
  contentHeight,
  hasRoomFor,
  newBlockHeight,
  roomForNew,
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

describe("roomForNew", () => {
  it("is what the card has not spent, and never negative", () => {
    const layout = cardWith({ top: [{ id: "g", type: "gallery", heightPct: 70 }] });

    // 70% of 440 is 308, plus 24 of card padding, out of 440.
    expect(roomForNew(layout, {})).toBe(440 - 308 - 24);
    // A card already overflowing has no room, rather than negative room.
    expect(roomForNew(layout, { g: 900 })).toBe(0);
  });

  it("does not charge for the empty room holding a block down the card", () => {
    /*
     * The same card twice, once with its name at the top and once with the name
     * pushed to the bottom by 300px of leading space. The same blocks are on it
     * either way, so the same room is left for a new one — the gap is somewhere
     * a block can *go*, not something the card has spent.
     */
    const stacked = cardWith({ top: [{ id: "n", type: "name" }] });
    const spread = cardWith({ top: [{ id: "n", type: "name", offset: 300 }] });

    expect(roomForNew(spread, { n: 24 })).toBe(roomForNew(stacked, { n: 24 }));
    // `usedHeight` still counts it — that is the fitter's question, not this one.
    expect(usedHeight(spread, { n: 24 })).toBe(usedHeight(stacked, { n: 24 }) + 300);
    expect(contentHeight(spread, { n: 24 })).toBe(24 + 24);
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

  it("opens a zone whose only fullness is the gap somebody left", () => {
    /*
     * The card this was reported on: a logo and an address paired at the top,
     * and a name pushed to the very bottom of the middle. Three hundred pixels
     * of white space down the centre of it, and every chip dragged over that
     * space was answered "No room for this on the card."
     *
     * `usedHeight` charged the name's leading space as height already spent, so
     * the card reported 8px free of 440 — and the *larger* the gap, the more
     * certain the refusal. A drop into it costs the card nothing: `run` in
     * ./drop-slots.ts lands the block inside the gap and hands the name a
     * `nextOffset` that keeps its own top edge exactly where it is.
     */
    const gap = cardWith({
      top: [
        { id: "logo", type: "logo", heightPct: 14, half: true },
        { id: "address", type: "address", half: true },
      ],
      middle: [{ id: "name", type: "name", offset: 326 }],
    });
    const measured = { logo: 62, address: 62, name: 20 };

    expect(usedHeight(gap, measured)).toBeGreaterThan(gap.maxHeight - 32);

    for (const type of ["description", "hours", "details"] as const) {
      expect(hasRoomFor(gap, "middle", { kind: "new", type }, measured)).toBe(true);
    }
    expect(hasRoomFor(gap, "bottom", { kind: "new", type: "actions" }, measured)).toBe(
      true,
    );
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
