import { describe, expect, it } from "vitest";

import { CARD_FONTS } from "@/packages/shared/card-fonts";
import {
  CARD_BLOCKS,
  DEFAULT_HOURS_ROW_GAP,
  MAX_BLOCK_FONT_SIZE,
  MAX_BLOCK_MARGIN,
  MAX_BLOCK_PADDING,
  MAX_BUTTON_LABEL,
  DEFAULT_CHIP_BORDER_WIDTH,
  MAX_CHIP_BORDER_WIDTH,
  MAX_CLAMP_LINES,
  cardRows,
  defaultCardLayout,
  findBlock,
  type CardBlock,
  type CardLayout,
} from "@/packages/shared/card-layout";
import {
  availableBlocks,
  dropCardBlock,
  makeCardBlock,
  removeCardBlock,
  resizeCardBlock,
} from "./card-edits";

/**
 * The rules a person feels while dragging, asked here instead of by hand.
 *
 * Every "null" in this file is a zone that must stay dark as the pointer crosses
 * it. A target that lights up and then refuses the drop is worse than one that
 * never offered, so the highlight and the drop are the same question.
 */

const types = (layout: CardLayout, zone: "top" | "middle" | "bottom") =>
  layout.zones[zone].map((block) => block.type);

/**
 * A card to drag things around on — **not** the card the app ships.
 *
 * These tests are about the drop, the pairing and the resize, and they read
 * whole zones back to say where a block landed. Written against
 * `defaultCardLayout()` they also silently asserted its exact contents, so
 * adding a block to the card everyone sees broke thirteen tests about
 * dragging, none of which had an opinion about it.
 *
 * So the fixture is pinned here instead. It was pinned by *filtering* the
 * default at first, which is not pinning at all — the day Category came off the
 * shipped card (categories merged into tags), the middle zone lost a block and
 * nine drop-position assertions shifted by one. The zones are written out in
 * full now, so the only thing that can move them is editing them here.
 *
 * It keeps a `category` block deliberately. That type is retired and the palette
 * no longer offers it (`CARD_BLOCKS.category.retired`), which makes it a useful
 * fourth block: it exercises the drop machinery without pretending anything
 * about what a new card contains. Anything that genuinely is about the default
 * belongs in packages/shared/card-layout.test.ts, where changing it must fail.
 */
function sampleCardLayout(): CardLayout {
  return {
    ...defaultCardLayout(),
    zones: {
      top: [
        {
          id: "gallery",
          type: "gallery",
          heightPct: CARD_BLOCKS.gallery.defaultHeightPct,
        },
      ],
      // The four blocks these tests index against by hand. Adding one here
      // shifts every drop-position assertion below.
      middle: [
        { id: "name", type: "name" },
        { id: "category", type: "category" },
        { id: "address", type: "address" },
        { id: "details", type: "details" },
      ],
      bottom: [{ id: "actions", type: "actions" }],
    },
  };
}

describe("makeCardBlock", () => {
  it("gives a sized block the dimensions it has before anyone drags it", () => {
    expect(makeCardBlock("gallery").heightPct).toBe(
      CARD_BLOCKS.gallery.defaultHeightPct,
    );
    expect(makeCardBlock("spacer").heightPct).toBe(
      CARD_BLOCKS.spacer.defaultHeightPct,
    );
  });

  it("leaves a text block to grow with its content", () => {
    expect(makeCardBlock("address").heightPct).toBeUndefined();
  });

  it("gives a block made of words a little room inside its own box", () => {
    expect(makeCardBlock("address").padding).toBe(
      CARD_BLOCKS.address.defaultPadding,
    );
    expect(makeCardBlock("name").padding).toBe(CARD_BLOCKS.name.defaultPadding);
  });

  it("gives a rule a body, so it can be clicked on at all", () => {
    // A divider draws one pixel and has no height control, so its padding is
    // the only thing that makes it a target rather than a hairline.
    expect(makeCardBlock("divider").padding).toBe(
      CARD_BLOCKS.divider.defaultPadding,
    );
  });

  it("leaves the blocks that are not words alone", () => {
    // A photo padded away from its own edges is an illustration in a document,
    // and a spacer with padding is a number with no pixel behind it.
    expect(makeCardBlock("gallery").padding).toBeUndefined();
    expect(makeCardBlock("spacer").padding).toBeUndefined();
  });

  it("gives a fresh button the whole width of its block", () => {
    // A call to action across the foot of a card is what almost everyone means
    // by one, so a hugging button was every owner's first thing to fix. It is a
    // property of a *new* block only — `buttonFull` still means what it always
    // meant, so nothing already published moves.
    expect(makeCardBlock("button").buttonFull).toBe(true);
  });

  it("gives it to nothing else", () => {
    expect(makeCardBlock("name").buttonFull).toBeUndefined();
    expect(makeCardBlock("actions").buttonFull).toBeUndefined();
  });

  it("mints an id per block, so two of the same type never collide", () => {
    expect(makeCardBlock("divider").id).not.toBe(makeCardBlock("divider").id);
  });
});

describe("dropCardBlock — a new block from the palette", () => {
  it("lands where it is allowed", () => {
    const layout = sampleCardLayout();
    const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
      zone: "middle",
      index: 1,
    });

    expect(next).not.toBeNull();
    expect(types(next!, "middle")).toEqual([
      "name",
      "divider",
      "category",
      "address",
      "details",
    ]);
  });

  it("refuses a zone the block may not enter", () => {
    const layout = sampleCardLayout();

    // The actions row is bottom-only: a card that puts its calls to action above
    // the address has buried the answer under them.
    expect(
      dropCardBlock(layout, { kind: "new", type: "actions" }, {
        zone: "middle",
        index: 0,
      }),
    ).toBeNull();

    expect(
      dropCardBlock(layout, { kind: "new", type: "description" }, {
        zone: "top",
        index: 0,
      }),
    ).toBeNull();
  });

  it("refuses a second copy of a unique block", () => {
    const layout = sampleCardLayout();

    expect(
      dropCardBlock(layout, { kind: "new", type: "name" }, {
        zone: "top",
        index: 0,
      }),
    ).toBeNull();
  });

  it("takes as many dividers and spacers as anyone wants", () => {
    let layout = sampleCardLayout();

    for (let i = 0; i < 3; i += 1) {
      const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
        zone: "middle",
        index: 0,
      });
      expect(next).not.toBeNull();
      layout = next!;
    }

    expect(types(layout, "middle").filter((type) => type === "divider")).toHaveLength(3);
  });

  it("clamps an index past the end rather than leaving a hole", () => {
    const layout = sampleCardLayout();
    const next = dropCardBlock(layout, { kind: "new", type: "spacer" }, {
      zone: "bottom",
      index: 99,
    });

    expect(types(next!, "bottom")).toEqual(["actions", "spacer"]);
  });
});

describe("dropCardBlock — moving a block already on the card", () => {
  it("moves it between zones when the new zone allows it", () => {
    const layout = sampleCardLayout();
    const name = findBlock(layout, "name");
    const next = dropCardBlock(layout, { kind: "move", id: name!.block.id }, {
      zone: "top",
      index: 0,
    });

    expect(types(next!, "top")).toEqual(["name", "gallery"]);
    expect(types(next!, "middle")).toEqual(["category", "address", "details"]);
  });

  it("reorders within a zone", () => {
    const layout = sampleCardLayout();
    const address = findBlock(layout, "address");
    const next = dropCardBlock(layout, { kind: "move", id: address!.block.id }, {
      zone: "middle",
      index: 0,
    });

    expect(types(next!, "middle")).toEqual([
      "address",
      "name",
      "category",
      "details",
    ]);
  });

  it("indexes against the list the block is leaving, not the one it is in", () => {
    // Moving the first block to the end. Without the shift this lands one short,
    // which is the classic off-by-one of a remove-then-insert.
    const layout = sampleCardLayout();
    const name = findBlock(layout, "name");
    const next = dropCardBlock(layout, { kind: "move", id: name!.block.id }, {
      zone: "middle",
      index: 4,
    });

    expect(types(next!, "middle")).toEqual([
      "category",
      "address",
      "details",
      "name",
    ]);
  });

  it("is not a move when it lands back where it already was", () => {
    const layout = sampleCardLayout();
    const category = findBlock(layout, "category");

    // On itself, and immediately after itself — the same non-move, and both have
    // to be caught before the index shift.
    expect(
      dropCardBlock(layout, { kind: "move", id: category!.block.id }, {
        zone: "middle",
        index: 1,
      }),
    ).toBeNull();

    expect(
      dropCardBlock(layout, { kind: "move", id: category!.block.id }, {
        zone: "middle",
        index: 2,
      }),
    ).toBeNull();
  });

  it("lets a block on a shared line leave it for the run just below", () => {
    /*
     * The run under a shared row starts at `row.end`, which for the last member
     * of that row is its own index plus one — the arithmetic the non-move test
     * above reads as "back where it already was". It is not: the block is
     * leaving the line it shares and taking a line of its own below it. The mark
     * for it lit up and the drop did nothing, while the mark one further down
     * worked.
     */
    const layout = shared();

    expect(cardRows(layout.zones.middle, layout)[0].blocks).toHaveLength(2);

    const next = dropCardBlock(layout, { kind: "move", id: "name" }, {
      zone: "middle",
      index: 2,
      offset: 0,
    });

    expect(next).not.toBeNull();
    expect(lines(next!)).toEqual([["logo"], ["name"], ["address"]]);
  });

  it("lets the block that leads a shared line leave it upwards", () => {
    // The mirror of the same arithmetic: the run above the row starts at
    // `row.index`, which for the row's first member is its own index.
    const layout = shared();

    const next = dropCardBlock(layout, { kind: "move", id: "logo" }, {
      zone: "middle",
      index: 0,
      offset: 0,
    });

    expect(next).not.toBeNull();
    expect(lines(next!)).toEqual([["logo"], ["name"], ["address"]]);
  });

  it("lets a unique block move to a zone it is allowed in, despite being itself", () => {
    const layout = sampleCardLayout();
    const gallery = findBlock(layout, "gallery");
    const next = dropCardBlock(layout, { kind: "move", id: gallery!.block.id }, {
      zone: "bottom",
      index: 0,
    });

    expect(types(next!, "top")).toEqual([]);
    expect(types(next!, "bottom")).toEqual(["gallery", "actions"]);
  });

  it("refuses a move into a zone the block may not enter", () => {
    const layout = sampleCardLayout();
    const actions = findBlock(layout, "actions");

    expect(
      dropCardBlock(layout, { kind: "move", id: actions!.block.id }, {
        zone: "top",
        index: 0,
      }),
    ).toBeNull();
  });

  it("refuses a block that is not on the card", () => {
    expect(
      dropCardBlock(sampleCardLayout(), { kind: "move", id: "ghost" }, {
        zone: "middle",
        index: 0,
      }),
    ).toBeNull();
  });
});

/** A middle zone whose first line is a logo and a narrowed name, sharing it. */
function shared(): CardLayout {
  return {
    ...sampleCardLayout(),
    zones: {
      top: [],
      middle: [
        { id: "logo", type: "logo", align: "center" },
        { id: "name", type: "name", widthPct: 50 },
        { id: "address", type: "address" },
      ],
      bottom: [],
    },
  };
}

/** Which blocks are on which line of a middle zone, as ids. */
function lines(layout: CardLayout): string[][] {
  return cardRows(layout.zones.middle, layout).map((row) =>
    row.blocks.map((block) => block.id),
  );
}

describe("dropCardBlock — where in the free space it landed", () => {
  it("remembers how far down the run the block was let go", () => {
    const layout = sampleCardLayout();
    const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
      zone: "middle",
      index: 4,
      offset: 96,
    });

    expect(next!.zones.middle.at(-1)).toMatchObject({
      type: "divider",
      offset: 96,
    });
  });

  it("stores no offset for a block dropped at the top of its run", () => {
    // Zero is the absence of an offset, on the same argument full width is the
    // absence of a width — so a card nobody has moved anything on publishes the
    // bytes it always did.
    const next = dropCardBlock(
      sampleCardLayout(),
      { kind: "new", type: "divider" },
      { zone: "middle", index: 4, offset: 0 },
    );

    expect(next!.zones.middle.at(-1)).not.toHaveProperty("offset");
  });

  it("puts the block it landed above back where it was", () => {
    /*
     * The whole point of `nextOffset`. Dropping an address into the gap above a
     * name must not shove the name — and the rest of the card — down by the
     * height of what arrived.
     */
    const layout: CardLayout = {
      ...sampleCardLayout(),
      zones: {
        top: [],
        middle: [
          { id: "a", type: "name" },
          { id: "b", type: "address", offset: 72 },
        ],
        bottom: [],
      },
    };

    const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
      zone: "middle",
      index: 1,
      offset: 32,
      nextOffset: 8,
    });

    expect(next!.zones.middle.map((block) => block.type)).toEqual([
      "name",
      "divider",
      "address",
    ]);
    expect(next!.zones.middle[1].offset).toBe(32);
    expect(next!.zones.middle[2].offset).toBe(8);
  });

  it("finds the block after the one that landed, past the move's own shift", () => {
    // A move removes itself first, so "the block after it" is only unambiguous
    // once it has landed — which is why `settle` looks it up by id.
    const layout: CardLayout = {
      ...sampleCardLayout(),
      zones: {
        top: [],
        middle: [
          { id: "m", type: "name" },
          { id: "a", type: "category" },
          { id: "b", type: "address", offset: 120 },
        ],
        bottom: [],
      },
    };

    const next = dropCardBlock(layout, { kind: "move", id: "m" }, {
      zone: "middle",
      index: 2,
      offset: 40,
      nextOffset: 16,
    });

    expect(next!.zones.middle.map((block) => block.id)).toEqual(["a", "m", "b"]);
    expect(next!.zones.middle[1].offset).toBe(40);
    expect(next!.zones.middle[2].offset).toBe(16);
  });

  it("is a real move when only the offset changed", () => {
    /*
     * Sliding a block four places down the *same* run of free space is the same
     * `(zone, index)` — nothing is between it and its neighbours either way —
     * and it is the whole gesture. Without the offset in the comparison it
     * silently did nothing.
     */
    const layout: CardLayout = {
      ...sampleCardLayout(),
      zones: { top: [], middle: [{ id: "only", type: "name" }], bottom: [] },
    };

    expect(
      dropCardBlock(layout, { kind: "move", id: "only" }, {
        zone: "middle",
        index: 0,
        offset: 128,
      })!.zones.middle[0].offset,
    ).toBe(128);

    // And still a non-move when the offset agrees too.
    expect(
      dropCardBlock(layout, { kind: "move", id: "only" }, {
        zone: "middle",
        index: 0,
        offset: 0,
      }),
    ).toBeNull();
  });

  it("clamps a landing offset to the card it landed on", () => {
    const next = dropCardBlock(
      sampleCardLayout(),
      { kind: "new", type: "divider" },
      { zone: "middle", index: 4, offset: 9_000 },
    );

    expect(next!.zones.middle.at(-1)?.offset).toBe(440);
  });

  it("leaves offsets alone when the target does not name one", () => {
    // The older shape of a drop — everything that is not the canvas still uses
    // it, and a bare `{ zone, index }` must not quietly reset a block's place.
    const layout: CardLayout = {
      ...sampleCardLayout(),
      zones: {
        top: [],
        middle: [
          { id: "a", type: "name", offset: 40 },
          { id: "b", type: "address" },
        ],
        bottom: [],
      },
    };

    const next = dropCardBlock(layout, { kind: "move", id: "a" }, {
      zone: "middle",
      index: 2,
    });

    expect(next!.zones.middle.map((block) => block.id)).toEqual(["b", "a"]);
    expect(next!.zones.middle[1].offset).toBe(40);
  });

  it("charges the space a move frees to the block it leaves behind", () => {
    /*
     * The mirror of `nextOffset`. Lifting a block out from above another used to
     * hand that other block the hole for nothing, and it rode up into it — which
     * is one gesture moving two blocks. The number comes from `vacatedSpace` in
     * ./drop-slots.ts; this is only the edit that applies it.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "description", offset: 200 },
      ],
      top: [],
    });

    const next = dropCardBlock(layout, { kind: "move", id: "a" }, {
      zone: "top",
      index: 0,
      offset: 0,
      vacateId: "b",
      vacateOffset: 236,
    });

    expect(next!.zones.middle.map((block) => block.id)).toEqual(["b"]);
    expect(next!.zones.middle[0].offset).toBe(236);
  });

  it("lets the landing block's own settling win over the space it freed", () => {
    /*
     * The ordering rule, stated on its own because it is what lets both fields
     * exist with no test between them: a block that lands back in the run it came
     * out of writes that run's own `nextOffset` onto the very block the vacated
     * space was charged to, and `settle` runs last. Without that, the two would
     * have to know about each other.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "description", offset: 200 },
      ],
    });

    const next = dropCardBlock(layout, { kind: "move", id: "a" }, {
      zone: "middle",
      index: 1,
      offset: 40,
      nextOffset: 160,
      vacateId: "b",
      vacateOffset: 236,
    });

    expect(next!.zones.middle.map((block) => block.id)).toEqual(["a", "b"]);
    expect(next!.zones.middle[1].offset).toBe(160);
  });

  it("ignores a vacated space naming a block that is not on the card", () => {
    // An offer can go stale between the measurement and the release, and this is
    // the edit path.
    const layout = cardWith({ middle: [{ id: "a", type: "name" }] });

    const next = dropCardBlock(layout, { kind: "move", id: "a" }, {
      zone: "top",
      index: 0,
      offset: 0,
      vacateId: "gone",
      vacateOffset: 120,
    });

    expect(next!.zones.top.map((block) => block.id)).toEqual(["a"]);
    expect(next!.zones.middle).toEqual([]);
  });
});

describe("dropCardBlock — pairing two blocks on one line", () => {
  it("narrows the block already there, and puts the newcomer beside it", () => {
    /*
     * The drop a `pairTargets` slot makes (lib/card/drop-slots.ts): the block in
     * the hand takes half the line, and the block that owned the line pays for it
     * by taking the other half. Nothing else about the edit is new — the halves
     * pair by adjacency, exactly as two blocks narrowed by hand always have.
     */
    const layout = sampleCardLayout();
    const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
      zone: "middle",
      index: 1,
      half: "end",
      widthPct: 50,
      line: 0,
      pairId: "name",
      pairWidthPct: 50,
    });

    expect(next).not.toBeNull();
    expect(types(next!, "middle")).toEqual([
      "name",
      "divider",
      "category",
      "address",
      "details",
    ]);
    expect(next!.zones.middle[0].widthPct).toBe(50);
    expect(next!.zones.middle[1].widthPct).toBe(50);

    // And the two really are one line, which is the whole point of the gesture.
    const [first] = cardRows(next!.zones.middle, sampleCardLayout());
    expect(first.blocks.map((block) => block.type)).toEqual(["name", "divider"]);
  });

  it("lets the newcomer take the near column and pushes the other across", () => {
    // The same line, the other end. `insert` reads "start" as "take this line,
    // the block here joins you".
    const layout = sampleCardLayout();
    const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
      zone: "middle",
      index: 0,
      half: "start",
      widthPct: 50,
      line: 0,
      pairId: "name",
      pairWidthPct: 50,
    });

    expect(types(next!, "middle")).toEqual([
      "divider",
      "name",
      "category",
      "address",
      "details",
    ]);
    expect(cardRows(next!.zones.middle, sampleCardLayout())[0].blocks).toHaveLength(2);
  });

  it("pairs a block already on the card with one somewhere else on it", () => {
    const layout = sampleCardLayout();
    const address = findBlock(layout, "address");
    const next = dropCardBlock(layout, { kind: "move", id: address!.block.id }, {
      zone: "middle",
      index: 1,
      half: "end",
      widthPct: 50,
      line: 0,
      pairId: "name",
      pairWidthPct: 50,
    });

    expect(types(next!, "middle")).toEqual([
      "name",
      "address",
      "category",
      "details",
    ]);
    expect(cardRows(next!.zones.middle, sampleCardLayout())[0].blocks.map((block) => block.id)).toEqual(
      ["name", "address"],
    );
  });

  it("is a real drop even when the block in the hand does not move", () => {
    /*
     * The case the non-move guard would otherwise swallow. A half sitting
     * directly above a full-width block is already at the index the pair target
     * names, already at 50%, and already at the same end of its line — every
     * test that guard makes passes. What changes is the *other* block, which
     * narrows to make the line they share.
     */
    const layout: CardLayout = {
      ...sampleCardLayout(),
      zones: {
        top: [],
        middle: [
          { id: "name", type: "name", widthPct: 50 },
          { id: "category", type: "category" },
        ],
        bottom: [],
      },
    };

    // Two lines before: a half with reserved room beside it, and a full-width
    // block under it.
    expect(cardRows(layout.zones.middle, sampleCardLayout())).toHaveLength(2);

    const next = dropCardBlock(layout, { kind: "move", id: "name" }, {
      zone: "middle",
      index: 1,
      half: "start",
      widthPct: 50,
      line: 1,
      pairId: "category",
      pairWidthPct: 50,
    });

    expect(next).not.toBeNull();
    expect(cardRows(next!.zones.middle, sampleCardLayout())).toHaveLength(1);
    expect(next!.zones.middle.map((block) => block.widthPct)).toEqual([50, 50]);
  });

  it("lets a logo take the square it needs and narrows the rest away", () => {
    /*
     * The drop a *mark's* pair target makes. A logo has no width to narrow, so
     * the split is not down the middle: it reserves `selfShareOf` — 24% of a
     * 296px line for a default 62px logo — and the block already on the line pays
     * the other 76%.
     *
     * Nothing in `pair` needed changing for this; it has always applied whatever
     * `pairWidthPct` the target carried. What it must not do is write a width on
     * the logo, which has no control for one.
     */
    const next = dropCardBlock(sampleCardLayout(), { kind: "new", type: "logo" }, {
      zone: "middle",
      index: 1,
      half: "end",
      line: 0,
      pairId: "name",
      pairWidthPct: 76,
    });

    expect(next).not.toBeNull();
    expect(types(next!, "middle")).toEqual([
      "name",
      "logo",
      "category",
      "address",
      "details",
    ]);
    expect(next!.zones.middle[0].widthPct).toBe(76);
    expect(next!.zones.middle[1].widthPct).toBeUndefined();

    // And the two are one line, which is the only thing the gesture promised.
    const [first] = cardRows(next!.zones.middle, sampleCardLayout());
    expect(first.blocks.map((block) => block.type)).toEqual(["name", "logo"]);
  });

  it("leaves a gallery at the width its owner gave it", () => {
    /*
     * The edit-path half of `isPairable`. `pairTargets` never draws a target
     * over a photo, so this can only be reached by a stale one — but a target is
     * an offer and this is where a rule has to be true, which is the same
     * belt-and-braces `withShare` already gets from `pair`.
     *
     * The rest of the drop still runs: the block lands, on a line of its own,
     * because a photo that has not narrowed leaves nothing beside it. That is
     * `pair` returning the layout it was given, which `dropCardBlock` reads as
     * "nothing to do" rather than as "refuse".
     */
    const layout = sampleCardLayout();
    const next = dropCardBlock(layout, { kind: "new", type: "divider" }, {
      zone: "top",
      index: 1,
      half: "end",
      widthPct: 50,
      line: 0,
      pairId: "gallery",
      pairWidthPct: 50,
    });

    expect(next).not.toBeNull();
    expect(next!.zones.top[0].widthPct).toBeUndefined();
    expect(types(next!, "top")).toEqual(["gallery", "divider"]);

    // Two lines, not one: the photo is still the full width of the card, so
    // there is no room beside it for the newcomer to have landed in.
    expect(cardRows(next!.zones.top, layout)).toHaveLength(2);
  });

  it("refuses to pair a block with itself", () => {
    // No slot builds this target, but the edit path is where the rule has to be
    // true rather than merely observed: it falls through to the ordinary non-move
    // and answers null.
    const layout = sampleCardLayout();
    const name = findBlock(layout, "name");

    expect(
      dropCardBlock(layout, { kind: "move", id: name!.block.id }, {
        zone: "middle",
        index: 0,
        pairId: name!.block.id,
        pairWidthPct: 50,
      }),
    ).toBeNull();
  });
});

describe("removeCardBlock", () => {
  it("takes the block off the card", () => {
    const layout = removeCardBlock(sampleCardLayout(), "category");

    expect(types(layout, "middle")).toEqual(["name", "address", "details"]);
  });

  it("leaves a layout alone when it holds no such block", () => {
    const layout = sampleCardLayout();

    expect(removeCardBlock(layout, "ghost")).toBe(layout);
  });

  it("hands the space it frees to the line below it", () => {
    /*
     * The deletion's half of the promise the drop has always kept: a block
     * stores the empty space *above* it, so the hole a departure leaves is
     * inherited by whatever is under it and the rest of the card rides up.
     * `vacatedSpace` is measured by the gesture doing the deleting and says what
     * the line below has to become to stay exactly where it is.
     */
    const layout = cardWith({
      middle: [
        { id: "name", type: "name" },
        { id: "addr", type: "address" },
        { id: "hours", type: "hours" },
      ],
    });

    const next = removeCardBlock(layout, "addr", { id: "hours", offset: 46 });

    expect(findBlock(next, "hours")?.block.offset).toBe(46);
  });

  it("gives it to the line rather than to a block, and clears the rest", () => {
    /*
     * The same rule `settle` and `vacate` both write by: a line takes its
     * leading space as the *greatest* of its members' (`rowOffsetHolder`), so a
     * number written to any other member is a number the card ignores. The
     * measurement names a member; the write lands on the line's holder, whoever
     * that is, and empties the others.
     */
    const layout = cardWith({
      middle: [
        { id: "name", type: "name" },
        { id: "addr", type: "address", widthPct: 50, offset: 12 },
        { id: "logo", type: "logo", heightPct: 14, widthPct: 50, offset: 30 },
      ],
    });

    const next = removeCardBlock(layout, "name", { id: "addr", offset: 60 });

    expect(findBlock(next, "logo")?.block.offset).toBe(60);
    expect(findBlock(next, "addr")?.block.offset).toBeUndefined();
  });

  it("leaves the card alone when the gesture measured nothing", () => {
    // A removal with no measurement in hand — there is no such path in the
    // designer, but the argument is the same one `vacate` makes on the drop
    // side: no answer is not the same as an answer of zero.
    const layout = cardWith({
      middle: [
        { id: "name", type: "name" },
        { id: "addr", type: "address", offset: 40 },
      ],
    });

    expect(findBlock(removeCardBlock(layout, "name"), "addr")?.block.offset).toBe(
      40,
    );
  });

  it("survives a block dropped into a gap and taken straight back out", () => {
    /*
     * The reported card, and the whole reason the refund exists.
     *
     * Dropping into the room above a block makes `settle` shrink that block's
     * leading space to pay for the arrival, so nothing on the card moves. Take
     * the newcomer away again with no refund and the shrunken space stands: the
     * rest of the card ends up 38px higher than it was before anything was
     * dropped, which is a delete moving four blocks.
     */
    const start = cardWith({
      middle: [
        { id: "name", type: "name" },
        { id: "addr", type: "address", offset: 40 },
      ],
      bottom: [{ id: "actions", type: "actions" }],
    });

    const dropped = dropCardBlock(start, { kind: "new", type: "divider" }, {
      zone: "middle",
      index: 1,
      offset: 0,
      // What the address has to become for its own top edge not to move, once a
      // divider and a gap are sitting in the space above it.
      nextOffset: 2,
    });

    const landed = dropped as CardLayout;
    const divider = landed.zones.middle[1];

    expect(findBlock(landed, "addr")?.block.offset).toBe(2);

    // And out again, refunding what the arrival was charged for.
    const back = removeCardBlock(landed, divider.id, { id: "addr", offset: 40 });

    expect(back.zones).toEqual(start.zones);
  });

  it("allows the card to be emptied", () => {
    // An owner who clears their card gets an empty card. Snapping the default
    // back would be the designer undoing their work in front of them.
    let layout = sampleCardLayout();
    for (const id of ["gallery", "name", "category", "address", "details", "actions"]) {
      layout = removeCardBlock(layout, id);
    }

    expect(types(layout, "top")).toEqual([]);
    expect(types(layout, "middle")).toEqual([]);
    expect(types(layout, "bottom")).toEqual([]);
  });
});

describe("resizeCardBlock", () => {
  it("never lets a block grow past what its type allows", () => {
    const layout = resizeCardBlock(sampleCardLayout(), "gallery", {
      heightPct: 400,
    });

    expect(findBlock(layout, "gallery")?.block.heightPct).toBe(70);
  });

  it("never lets a block grow past the card", () => {
    const layout = resizeCardBlock(sampleCardLayout(), "gallery", {
      widthPct: 250,
    });

    // Full width is the absence of a width, so there is exactly one way to say it.
    expect(findBlock(layout, "gallery")?.block.widthPct).toBeUndefined();
  });

  it("holds a width at the block's own floor", () => {
    const layout = resizeCardBlock(sampleCardLayout(), "gallery", {
      widthPct: 1,
    });

    expect(findBlock(layout, "gallery")?.block.widthPct).toBe(
      CARD_BLOCKS.gallery.minWidthPct,
    );
  });

  it("sets and clears a photo's fit, and stores only the one that is not the default", () => {
    const fitted = resizeCardBlock(sampleCardLayout(), "gallery", {
      fit: "contain",
    });
    expect(findBlock(fitted, "gallery")?.block.fit).toBe("contain");

    // Cropping to fill is the *absence* of a fit, on the same argument full
    // width is the absence of a width — so a card nobody has asked about the
    // photo still publishes the bytes it always did.
    const filled = resizeCardBlock(fitted, "gallery", { fit: "cover" });
    expect(filled.zones.top[0]).not.toHaveProperty("fit");
  });

  it("ignores a fit on a block with no picture in it", () => {
    const layout = resizeCardBlock(sampleCardLayout(), "name", {
      fit: "contain",
    });

    expect(findBlock(layout, "name")?.block.fit).toBeUndefined();
  });

  it("ignores a height on a block that grows with its content", () => {
    const layout = resizeCardBlock(sampleCardLayout(), "address", {
      heightPct: 50,
    });

    expect(findBlock(layout, "address")?.block.heightPct).toBeUndefined();
  });

  it("ignores a width on a block that cannot be narrowed", () => {
    const layout = resizeCardBlock(sampleCardLayout(), "actions", {
      widthPct: 40,
    });

    expect(findBlock(layout, "actions")?.block.widthPct).toBeUndefined();
  });

  it("pads a block, clamps it, and clears the padding at zero", () => {
    const padded = resizeCardBlock(sampleCardLayout(), "address", {
      padding: 10,
    });
    expect(findBlock(padded, "address")?.block.padding).toBe(10);

    const clamped = resizeCardBlock(padded, "address", { padding: 900 });
    expect(findBlock(clamped, "address")?.block.padding).toBe(MAX_BLOCK_PADDING);

    const cleared = resizeCardBlock(padded, "address", { padding: 0 });
    expect(findBlock(cleared, "address")?.block.padding).toBeUndefined();
  });

  it("ignores a patch naming a control this block does not offer", () => {
    // The panel renders from `controls` and this reads the same list, so a
    // control that is not on screen cannot be reached by a stale patch either.
    const layout = sampleCardLayout();

    expect(
      findBlock(resizeCardBlock(layout, "address", { heightPct: 30 }), "address")
        ?.block.heightPct,
    ).toBeUndefined();
    /*
     * The gallery and not the Links row, which gained `align` when that row
     * learned to read a `justify-content`. A photo fills its box or is centred
     * in it, so there has never been an alignment to write.
     *
     * The block has to actually *be* in the sample layout, which is the trap
     * this assertion walked into once already: name one that is not and
     * `resizeCardBlock` returns the layout untouched, `findBlock` finds nothing,
     * and `?.block.align` is undefined for a reason that has nothing to do with
     * `controls`. So the block is asserted present first.
     */
    const gallery = resizeCardBlock(layout, "gallery", { align: "center" });

    expect(findBlock(gallery, "gallery")).toBeDefined();
    expect(findBlock(gallery, "gallery")?.block.align).toBeUndefined();
  });

  it("leaves a layout alone when it holds no such block", () => {
    const layout = sampleCardLayout();

    expect(resizeCardBlock(layout, "ghost", { widthPct: 50 })).toBe(layout);
  });

  it("writes a margin, and clears it again at the type's own default", () => {
    const layout = sampleCardLayout();

    // Zero is the card's edges. The gallery starts there, so this is the text
    // block being pulled out to meet it.
    const flush = resizeCardBlock(layout, "name", { margin: 0 });
    expect(findBlock(flush, "name")?.block.margin).toBe(0);

    // Back at the card's own padding is back to inheriting it — the same
    // argument full width is the absence of a width, and what keeps the card's
    // Padding slider in charge of a block nobody has singled out.
    const back = resizeCardBlock(flush, "name", { margin: layout.padding });
    expect(findBlock(back, "name")?.block.margin).toBeUndefined();

    // And for a block whose default is zero it is zero that clears it.
    const inset = resizeCardBlock(layout, "gallery", { margin: layout.padding });
    expect(findBlock(inset, "gallery")?.block.margin).toBe(layout.padding);
    expect(
      findBlock(resizeCardBlock(inset, "gallery", { margin: 0 }), "gallery")
        ?.block.margin,
    ).toBeUndefined();
  });

  it("clamps a margin, and refuses one on a block that does not offer it", () => {
    const layout = sampleCardLayout();

    expect(
      findBlock(resizeCardBlock(layout, "name", { margin: 999 }), "name")?.block
        .margin,
    ).toBe(MAX_BLOCK_MARGIN);

    // A spacer draws nothing, so where its edges sit is a number with no pixel
    // behind it. The panel does not offer the control and this path refuses it,
    // for the same reason: they read one list.
    const spacers = resizeCardBlock(
      { ...layout, zones: { ...layout.zones, top: [{ id: "s", type: "spacer" }] } },
      "s",
      { margin: 0 },
    );
    expect(findBlock(spacers, "s")?.block.margin).toBeUndefined();
  });
});

describe("availableBlocks", () => {
  it("drops the unique blocks already on the card", () => {
    const available = availableBlocks(sampleCardLayout());

    expect(available).not.toContain("name");
    expect(available).not.toContain("gallery");
    expect(available).not.toContain("actions");
    // Still offered: they live inside the fold, not on the card itself.
    expect(available).toContain("hours");
    expect(available).toContain("description");
  });

  it("always offers the blocks that repeat", () => {
    expect(availableBlocks(sampleCardLayout())).toContain("divider");
    expect(availableBlocks(sampleCardLayout())).toContain("spacer");
  });

  it("offers a unique block again once it is removed", () => {
    const layout = removeCardBlock(sampleCardLayout(), "gallery");

    expect(availableBlocks(layout)).toContain("gallery");
  });
});

/** A card holding exactly these blocks, and nothing else. */
const cardWith = (zones: Partial<CardLayout["zones"]>): CardLayout => ({
  ...sampleCardLayout(),
  zones: { top: [], middle: [], bottom: [], ...zones },
});

/**
 * Half, from the editing side.
 *
 * Two ways in — the Width slider in the properties panel and a drop into the
 * room beside a block that is already narrow — and one number between them,
 * which is the whole point of replacing the Full/Half buttons with the slider.
 */
describe("width", () => {
  it("clears a legacy half the first time the slider is touched", () => {
    // `shareOf` keeps reading the old field until then, which is what lets a
    // published card go on drawing its two columns with no migration.
    const layout = cardWith({ middle: [{ id: "a", type: "name", half: true }] });
    const next = resizeCardBlock(layout, "a", { widthPct: 60 });

    expect(next.zones.middle[0].half).toBeUndefined();
    expect(next.zones.middle[0].widthPct).toBe(60);
  });

  it("deletes the key at full width rather than storing 100", () => {
    // Absence is the one way to say full width, so a card whose owner dragged a
    // narrowed block back out publishes the bytes it would have all along.
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 50 }],
    });
    const next = resizeCardBlock(layout, "a", { widthPct: 100 });

    expect("widthPct" in next.zones.middle[0]).toBe(false);
  });

  it("drops the line rules with the width, so nothing comes back later", () => {
    // `newLine` and `side` are statements about a line the block *shares*. Left
    // behind, they would reappear the moment someone narrowed it again.
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 50, side: "end" }],
    });
    const next = resizeCardBlock(layout, "a", { widthPct: 100 });

    expect(next.zones.middle[0].side).toBeUndefined();
  });

  it("is ignored on a block whose type does not offer it", () => {
    // The same rule the panel renders from. A patch naming a control this type
    // does not declare is dropped, exactly as an align on a details block is.
    const layout = cardWith({ middle: [{ id: "a", type: "hours" }] });
    const next = resizeCardBlock(layout, "a", { widthPct: 50 });

    expect(next.zones.middle[0].widthPct).toBeUndefined();
  });

  it("stops a paired block at what its partner leaves, rather than breaking the line", () => {
    /*
     * `cardRows` pairs on the two shares fitting together, so a block widened
     * past its partner's leftover stops being paired and the card reflows under
     * the hand holding the slider. The number stopping instead is the same
     * clamp idiom every other control here uses.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 40 },
        { id: "b", type: "address", widthPct: 60 },
      ],
    });
    const next = resizeCardBlock(layout, "a", { widthPct: 90 });

    expect(next.zones.middle[0].widthPct).toBe(40);
  });

  it("lets a block alone on its line take the whole card back", () => {
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 40 }],
    });

    expect(
      resizeCardBlock(layout, "a", { widthPct: 100 }).zones.middle[0].widthPct,
    ).toBeUndefined();
  });

  it("gives a block dropped into the room beside another that room's width", () => {
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 40 }],
    });
    const next = dropCardBlock(
      layout,
      { kind: "new", type: "address" },
      { zone: "middle", index: 1, half: "end", widthPct: 60, line: 0 },
    );

    expect(next).not.toBeNull();
    expect(next?.zones.middle.map((block) => block.widthPct)).toEqual([40, 60]);
    // Consecutive, which is what makes `cardRows` pair them.
    expect(next?.zones.middle.map((block) => block.type)).toEqual([
      "name",
      "address",
    ]);
  });

  it("leaves a block alone when the type cannot be narrowed", () => {
    // No such target is ever built, but the edit path is where the rule has to
    // be true rather than merely observed.
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 50 }],
    });
    const next = dropCardBlock(
      layout,
      { kind: "new", type: "hours" },
      { zone: "middle", index: 1, half: "end", widthPct: 50, line: 0 },
    );

    expect(next?.zones.middle[1].widthPct).toBeUndefined();
  });

  it("re-widths a block moved into the room beside one", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 40 },
        { id: "b", type: "address", widthPct: 70 },
      ],
    });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "b" },
      { zone: "middle", index: 1, half: "end", widthPct: 60, line: 0 },
    );

    expect(next).not.toBeNull();
    expect(next?.zones.middle[1].widthPct).toBe(60);
  });

  it("counts joining a line as a move even from immediately below it", () => {
    /*
     * The non-move guard has to let this through. A block sitting under a lone
     * narrowed one is already at that insertion index, so by index and offset
     * alone this looks like putting it back where it was — but going from owning
     * a line to sharing one is the whole gesture.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address" },
      ],
    });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "b" },
      { zone: "middle", index: 1, half: "end", widthPct: 50, line: 0 },
    );

    expect(next).not.toBeNull();
    expect(next?.zones.middle[1].widthPct).toBe(50);
  });

  it("gives a block that lands alone on a line the whole line", () => {
    /*
     * The complaint: a run mark is drawn across the whole card, and a 50%-wide
     * block released on one used to land at 50% with reserved space beside it —
     * an outline promising a block twice the size of the one that arrived. Every
     * run slot now names 100 (`run` in lib/card/drop-slots.ts), so pulling a half
     * out of a pair and dropping it somewhere it has the line to itself widens it
     * back out. Narrowing stays the Width slider's alone.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 50 },
      ],
      bottom: [],
    });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "b" },
      { zone: "middle", index: 0, widthPct: 100 },
    );

    expect(next?.zones.middle[0].id).toBe("b");
    // Deleted rather than stored as 100 — full width is the absence of a width.
    expect(next?.zones.middle[0].widthPct).toBeUndefined();
    // And the partner left behind keeps its own, because narrowing is not
    // something a drag does to a block nobody picked up.
    expect(next?.zones.middle[1].widthPct).toBe(50);
  });

  it("drops the line rules with the width, so nothing comes back on the next drag", () => {
    // `newLine` and `side` are both statements about a line the block *shares*.
    // Left on a block that has just taken a whole line to itself, they would
    // reappear the moment someone narrowed it again.
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50, side: "end", newLine: true },
        { id: "b", type: "address" },
      ],
    });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 2, widthPct: 100 },
    );

    expect(next?.zones.middle[1].id).toBe("a");
    expect(next?.zones.middle[1].widthPct).toBeUndefined();
    expect(next?.zones.middle[1].side).toBeUndefined();
    expect(next?.zones.middle[1].newLine).toBeUndefined();
  });

  it("keeps the reserved space when a lone half crosses the line it owns", () => {
    /*
     * The one drop that still names no width, and the reason `undefined` has to
     * go on meaning "leave it alone". Nothing about this gesture is a width: the
     * block stays alone on its own line and moves to the other end of it, so
     * widening it would delete the very space the move is arranging.
     */
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 50 }],
    });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 0, half: "end", line: 0 },
    );

    expect(next?.zones.middle[0].widthPct).toBe(50);
    expect(next?.zones.middle[0].side).toBe("end");
  });

  it("writes no settling offset onto a block that shares the line", () => {
    /*
     * `nextOffset` exists to stop an arrival shoving the rest of the card down.
     * When the block after the one that landed is its own partner there is
     * nothing below to protect, and a narrowed block's leading space belongs to
     * the row as the greater of the pair — so writing one would either do
     * nothing or move them both.
     */
    const layout = cardWith({
      middle: [{ id: "a", type: "name", widthPct: 50 }],
    });
    const next = dropCardBlock(
      layout,
      { kind: "new", type: "address" },
      {
        zone: "middle",
        index: 0,
        half: "end",
        widthPct: 50,
        line: 0,
        nextOffset: 40,
      },
    );

    expect(next?.zones.middle[1].offset).toBeUndefined();
  });

  it("only changes the side when a block crosses the line it owns alone", () => {
    /*
     * The bug this guards: the target for that gesture is the line's own start
     * index, and after the block is lifted out that index points at whatever
     * precedes it — so the remove-and-insert path read it as "join the block
     * above me" and silently dragged a neighbour up beside it. `line` is what
     * tells the two apart.
     */
    const layout = cardWith({
      middle: [
        { id: "x", type: "gallery", widthPct: 50 },
        { id: "a", type: "name", widthPct: 50, newLine: true },
      ],
    });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 1, half: "end", line: 1 },
    );

    expect(next).not.toBeNull();
    expect(next?.zones.middle.map((block) => block.id)).toEqual(["x", "a"]);
    expect(next?.zones.middle[1].side).toBe("end");
    // Still its own line: the flag that says so has to survive.
    expect(next?.zones.middle[1].newLine).toBe(true);
  });
});

/**
 * Which blocks share a line, across an edit that moves one of them.
 *
 * Lines are paired by *position* — a half takes the next half — so any edit that
 * changes a block's position can re-pair blocks nobody touched. Every case here
 * was a card rearranging itself in front of its owner, and the fix is one field
 * (`newLine`) written by `preserveRows` rather than by anything on screen.
 */
describe("lines survive an edit", () => {
  const halves = (...ids: string[]) =>
    cardWith({
      middle: ids.map((id, i) => ({
        id,
        type: (["name", "address", "category", "divider"] as const)[i],
        half: true as const,
      })),
    });

  /** The lines a zone actually draws, as ids. */
  const lines = (layout: CardLayout | null) =>
    cardRows(layout?.zones.middle ?? [], sampleCardLayout()).map((row) =>
      row.blocks.map((block) => block.id),
    );

  it("keeps the abandoned partner's line when a half joins the one below it", () => {
    /*
     * The reported bug, exactly. `[a,b]` share the first line and `c` is alone
     * on the second; dragging b down beside c used to leave a and c paired on
     * the first line with b alone on the second — the two blocks appearing to
     * swap places rather than the one being moved going where it was dropped.
     */
    const layout = halves("a", "b", "c");
    expect(lines(layout)).toEqual([["a", "b"], ["c"]]);

    const next = dropCardBlock(
      layout,
      { kind: "move", id: "b" },
      { zone: "middle", index: 3, half: "end" },
    );

    expect(lines(next)).toEqual([["a"], ["c", "b"]]);
  });

  it("keeps them when a half is deleted out of a pair", () => {
    // The same repair from the other direction: delete the second of `[a,b]`
    // and `c` used to jump up beside `a`.
    const next = removeCardBlock(halves("a", "b", "c"), "b");

    expect(lines(next)).toEqual([["a"], ["c"]]);
  });

  it("keeps them when a half leaves the zone entirely", () => {
    // A divider, because it is the one halvable block the bottom zone accepts —
    // the point here is the line the move leaves behind, not the zone rules.
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true },
        { id: "b", type: "divider", half: true },
        { id: "c", type: "category", half: true },
      ],
      bottom: [],
    });

    const next = dropCardBlock(
      layout,
      { kind: "move", id: "b" },
      { zone: "bottom", index: 0 },
    );

    expect(lines(next)).toEqual([["a"], ["c"]]);
  });

  it("flags nothing on a card whose lines are already right", () => {
    /*
     * A stored field that changes nothing is one someone will later trust. It
     * is also what keeps `sampleCardLayout()` byte-identical after an edit
     * that did not need the flag (CLAUDE.md §7).
     */
    const next = dropCardBlock(
      halves("a", "b", "c"),
      { kind: "new", type: "divider" },
      { zone: "bottom", index: 0 },
    );

    expect(next?.zones.middle.some((block) => "newLine" in block)).toBe(false);
  });

  it("clears the flag when the block goes back to full width", () => {
    // `newLine` is a statement about a line the block shares. Left on a
    // full-width block it comes back the moment someone narrows it again.
    const moved = dropCardBlock(
      halves("a", "b", "c"),
      { kind: "move", id: "b" },
      { zone: "middle", index: 3, half: "end", widthPct: 50, line: 2 },
    );

    expect(moved?.zones.middle[1].newLine).toBe(true);

    const next = resizeCardBlock(moved as CardLayout, "c", { widthPct: 100 });

    expect("newLine" in next.zones.middle[1]).toBe(false);
  });
});

/**
 * Crossing a line, which is the other thing a half could not do.
 *
 * A lone half sat at its line's start and there was no gesture that could move
 * it; two halves sharing a line could not be swapped. Both are the same target
 * now — the column the block is *not* in — and `side` is what stores the answer
 * for the one case where nothing about the array changes.
 */
describe("side", () => {
  it("moves a lone half to the end of its own line", () => {
    const layout = cardWith({ middle: [{ id: "a", type: "name", half: true }] });
    const next = dropCardBlock(
      layout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 0, half: "end" },
    );

    expect(next).not.toBeNull();
    expect(next?.zones.middle[0].side).toBe("end");
  });

  it("is not swallowed by the non-move guard", () => {
    /*
     * Same zone, same index, same offset, and it is still a half — by every
     * question the guard used to ask this was a block put back where it was, so
     * the drag silently did nothing at all.
     */
    const layout = cardWith({
      middle: [{ id: "a", type: "name", half: true, side: "end" }],
    });

    expect(
      dropCardBlock(
        layout,
        { kind: "move", id: "a" },
        { zone: "middle", index: 0, half: "end" },
      ),
    ).toBeNull();

    expect(
      dropCardBlock(
        layout,
        { kind: "move", id: "a" },
        { zone: "middle", index: 0, half: "start" },
      ),
    ).not.toBeNull();
  });

  it("swaps the two halves of a line", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true },
        { id: "b", type: "address", half: true },
      ],
    });

    const moved = dropCardBlock(
      layout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 2, half: "end" },
    );

    expect(moved?.zones.middle.map((block) => block.id)).toEqual(["b", "a"]);
    expect(cardRows(moved?.zones.middle ?? [], sampleCardLayout())).toHaveLength(1);

    const back = dropCardBlock(
      moved as CardLayout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 0, half: "start" },
    );

    expect(back?.zones.middle.map((block) => block.id)).toEqual(["a", "b"]);
  });

  it("carries no side while it shares its line", () => {
    // Only a block alone on its line has a column to choose; a pair fills the
    // row. Storing one anyway would be a field that means something on one card
    // and nothing on the next.
    const layout = cardWith({
      middle: [{ id: "a", type: "name", half: true, side: "end" }],
    });

    const next = dropCardBlock(
      layout,
      { kind: "new", type: "address" },
      { zone: "middle", index: 0, half: "start", widthPct: 50, line: 0 },
    );

    expect(cardRows(next?.zones.middle ?? [], sampleCardLayout())).toHaveLength(1);
    expect("side" in (next?.zones.middle[0] ?? {})).toBe(false);
  });

  it("lands at the start when the target named no column", () => {
    /*
     * Absent means the start rather than "leave it". A full-width drop mark is
     * drawn across the whole card, so a block released on one has to land where
     * the mark promised — not quietly keep the right-hand column it was in.
     */
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", half: true, side: "end" },
        { id: "b", type: "description" },
      ],
    });

    const next = dropCardBlock(
      layout,
      { kind: "move", id: "a" },
      { zone: "middle", index: 2 },
    );

    expect(next?.zones.middle[1].id).toBe("a");
    expect(next?.zones.middle[1].side).toBeUndefined();
  });
});

describe("dropping a mark, and dropping beside one", () => {
  /*
   * The two halves of "a logo is something you arrange by dragging".
   *
   * A mark is the one block whose position across its line is a second degree of
   * freedom, so a drop can say where it goes sideways (`align`); and a mark
   * reserves pixels rather than a share, so the rest of its line is room another
   * block can be dropped into. The card is `sampleCardLayout()` throughout.
   */
  const withLogo = (extra: Partial<CardLayout["zones"]> = {}): CardLayout => ({
    ...sampleCardLayout(),
    zones: {
      top: [],
      middle: [{ id: "logo", type: "logo", heightPct: 14, align: "center" }],
      bottom: [],
      ...extra,
    },
  });

  it("puts the mark where across its line the drop said", () => {
    const next = dropCardBlock(
      withLogo(),
      { kind: "move", id: "logo" },
      { zone: "middle", index: 0, offset: 0, align: "start" },
    );

    expect(next?.zones.middle[0].align).toBe("start");
  });

  it("treats a change of column as a real move, not a no-op", () => {
    /*
     * Sliding a logo from the middle of a run to its left-hand column is the
     * same zone, the same index and the same leading space — the alignment is
     * the entire edit. Leaving it out of the non-move guard made the gesture do
     * nothing at all, which on a canvas you arrange by dragging reads as the
     * block being stuck.
     */
    const same = dropCardBlock(
      withLogo(),
      { kind: "move", id: "logo" },
      { zone: "middle", index: 0, offset: 0, align: "center" },
    );

    expect(same).toBeNull();
  });

  it("leaves an ordinary block's alignment alone", () => {
    // `align` on anything else is `text-align` on its own words, and no drag has
    // ever moved those — there is no gesture for it, and dropping a name into a
    // right-hand column should not silently right-align its text.
    const next = dropCardBlock(
      sampleCardLayout(),
      { kind: "new", type: "spacer" },
      { zone: "middle", index: 0, offset: 0, align: "end" },
    );

    expect(next?.zones.middle[0].align).toBeUndefined();
  });

  it("puts a block into the room beside the mark, on one line", () => {
    // 38% is what a 109px run of a 296px line measures as — see
    // `sideSlots` in drop-slots.test.ts, which is where that number comes from.
    const next = dropCardBlock(
      withLogo(),
      { kind: "new", type: "name" },
      { zone: "middle", index: 1, offset: 0, half: "end", widthPct: 38, line: 0 },
    );

    expect(next?.zones.middle.map((block) => block.type)).toEqual([
      "logo",
      "name",
    ]);
    expect(next?.zones.middle[1].widthPct).toBe(38);

    const rows = cardRows(next?.zones.middle ?? [], sampleCardLayout());
    expect(rows).toHaveLength(1);
    expect(rows[0].blocks.map((block) => block.type)).toEqual(["logo", "name"]);
  });

  it("takes a block on each side of the mark", () => {
    /*
     * The layout this whole thing exists for: a logo straddling the photo above
     * it with a name to one side and an address to the other, all on one line.
     */
    const one = dropCardBlock(
      withLogo(),
      { kind: "new", type: "name" },
      { zone: "middle", index: 1, offset: 0, half: "end", widthPct: 38, line: 0 },
    );

    const two = dropCardBlock(
      one as CardLayout,
      { kind: "new", type: "address" },
      { zone: "middle", index: 0, offset: 0, half: "start", widthPct: 38, line: 0 },
    );

    expect(two?.zones.middle.map((block) => block.type)).toEqual([
      "address",
      "logo",
      "name",
    ]);

    const rows = cardRows(two?.zones.middle ?? [], sampleCardLayout());
    expect(rows).toHaveLength(1);
    expect(rows[0].blocks).toHaveLength(3);
  });

  it("leaves the mark's own fields untouched when something lands beside it", () => {
    // A mark has no width to give up, so nothing about it changes: the block
    // that lands takes the room that was already there.
    const next = dropCardBlock(
      withLogo(),
      { kind: "new", type: "name" },
      { zone: "middle", index: 1, offset: 0, half: "end", widthPct: 38, line: 0 },
    );

    expect(next?.zones.middle[0]).toEqual({
      id: "logo",
      type: "logo",
      heightPct: 14,
      align: "center",
    });
  });

  it("never gives the mark a width of its own", () => {
    // A logo dropped into a free column beside a narrowed block joins that line
    // without narrowing: its box is a square, and a share would be a second,
    // contradicting description of how wide it is.
    const beside = dropCardBlock(
      {
        ...sampleCardLayout(),
        zones: {
          top: [],
          middle: [{ id: "name", type: "name", widthPct: 60 }],
          bottom: [],
        },
      },
      { kind: "new", type: "logo" },
      { zone: "middle", index: 1, offset: 0, half: "end", widthPct: 40, line: 0 },
    );

    expect(beside?.zones.middle[1].type).toBe("logo");
    expect(beside?.zones.middle[1].widthPct).toBeUndefined();
  });

  it("counts the mark's own share against the Width slider beside it", () => {
    /*
     * The slider stops where the line does. A logo reserving 24% leaves 76 for
     * the block sharing its line, and widening past that would push its
     * neighbour onto a line of its own under the hand holding the slider.
     */
    const paired: CardLayout = {
      ...sampleCardLayout(),
      zones: {
        top: [],
        middle: [
          { id: "logo", type: "logo", heightPct: 14 },
          { id: "name", type: "name", widthPct: 38 },
        ],
        bottom: [],
      },
    };

    const widened = resizeCardBlock(paired, "name", { widthPct: 100 });

    expect(widened.zones.middle[1].widthPct).toBe(76);
  });
});

/**
 * Moving a block **along the line it already shares**.
 *
 * The one drop that had no path through `dropCardBlock` at all. A column target
 * carries the index of the line it is on (`line`), which is how "join the block
 * on the line above me" is told from "cross to the other end of the line I own
 * alone" — two drops that agree about the zone, the index and the side. But the
 * *first member* of a shared line sits at its line's own index, so every column
 * target on that line answered the second test as well, and the block was given
 * a `side` instead of being moved. `cardRowBox` reads `side` only on a row of
 * one, so the card did not move: a drop that succeeded, saved, and looked
 * refused.
 *
 * The give-away is that the identical landing works from one line lower, where
 * `line` names somebody else's row. These hold both directions to the same
 * answer.
 */
describe("moving a block along a line it shares", () => {
  /** A name at the head of a logo's line, which is the reported card. */
  const beside = (): CardLayout => ({
    ...sampleCardLayout(),
    zones: {
      top: [],
      middle: [
        { id: "name", type: "name", widthPct: 36 },
        { id: "logo", type: "logo", heightPct: 14, align: "center" },
      ],
      bottom: [],
    },
  });

  /** Where `selfTargets` puts the room past the logo: the end of line 0. */
  const pastTheMark = {
    zone: "middle",
    index: 2,
    offset: 0,
    half: "end",
    widthPct: 36,
    line: 0,
  } as const;

  it("moves the line's first block into the room past the mark", () => {
    const next = dropCardBlock(beside(), { kind: "move", id: "name" }, pastTheMark);

    expect(next).not.toBeNull();
    expect(next?.zones.middle.map((block) => block.id)).toEqual(["logo", "name"]);

    // Still one line — the whole gesture is which end of it the name sits at.
    const rows = cardRows(next?.zones.middle ?? [], sampleCardLayout());
    expect(rows).toHaveLength(1);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["logo", "name"]);
  });

  it("writes no side onto a block that shares its line", () => {
    /*
     * What the old branch left behind, and the reason this is more than a drop
     * that did nothing. `side` is meaningless on a shared line, survives being
     * stored (`readBlock` keeps it under any width), and surfaces later as a
     * block that jumps to the far end of its line the first time it is alone on
     * one.
     */
    const next = dropCardBlock(beside(), { kind: "move", id: "name" }, pastTheMark);

    // By id, not by index: the block that carried the stale side was the one at
    // the *old* head of the line, which is the position the move vacates.
    expect(findBlock(next as CardLayout, "name")?.block.side).toBeUndefined();
  });

  it("reaches the same place from the line below", () => {
    /*
     * The path that already worked, pinned. Dropped from one line down, `line`
     * names the logo's row rather than the name's own, so the flip test never
     * fired — which is exactly how the two halves of this bug were told apart.
     */
    const below: CardLayout = {
      ...sampleCardLayout(),
      zones: {
        top: [],
        middle: [
          { id: "logo", type: "logo", heightPct: 14, align: "center" },
          { id: "name", type: "name" },
        ],
        bottom: [],
      },
    };

    const next = dropCardBlock(below, { kind: "move", id: "name" }, {
      zone: "middle",
      index: 1,
      offset: 0,
      half: "end",
      widthPct: 36,
      line: 0,
    });

    expect(next?.zones.middle.map((block) => block.id)).toEqual(["logo", "name"]);
    expect(next?.zones.middle[1].widthPct).toBe(36);
    expect(cardRows(next?.zones.middle ?? [], sampleCardLayout())).toHaveLength(1);
  });

  it("swaps a pair when the first half is dropped on the second's column", () => {
    /*
     * The same bug on an ordinary pair, and unreported because the other
     * direction works: `b` is not at its line's index, so dragging it onto `a`
     * always swapped them. Dragging `a` onto `b` wrote a dead `side`.
     */
    const pair = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 50 },
      ],
    });

    const next = dropCardBlock(pair, { kind: "move", id: "a" }, {
      zone: "middle",
      index: 2,
      offset: 0,
      half: "end",
      line: 0,
    });

    expect(next?.zones.middle.map((block) => block.id)).toEqual(["b", "a"]);
    expect(cardRows(next?.zones.middle ?? [], sampleCardLayout())).toHaveLength(1);
  });
});

/**
 * The leading space above a line, when the line holds more than one block.
 *
 * A move rewrites two offsets — the hole it opens (`vacate`) and the room it
 * takes (`settle`) — and the whole design rests on those two being able to
 * overwrite each other, so a block put back where it came from leaves the card
 * exactly as it found it. They could not, because they named the block to write
 * to by two different rules and only agreed on a line of one.
 */
describe("the leading space above a shared line", () => {
  const shared = (): CardLayout =>
    cardWith({
      middle: [
        { id: "b", type: "address", widthPct: 50 },
        { id: "c", type: "description", widthPct: 50, offset: 200 },
        { id: "a", type: "name" },
      ],
    });

  it("charges the line below a landing to the member that carries it", () => {
    /*
     * `[b, c]` is one line and `c` holds its leading space, because a line takes
     * the greatest of its members' offsets. Landing above that line used to write
     * to `b` — the next block by index — where the 200 on `c` went on winning, so
     * the line ignored the number and stayed where it was.
     */
    const next = dropCardBlock(shared(), { kind: "move", id: "a" }, {
      zone: "middle",
      index: 0,
      offset: 0,
      nextOffset: 40,
    });

    expect(next?.zones.middle.map((block) => block.id)).toEqual(["a", "b", "c"]);
    expect(findBlock(next as CardLayout, "c")?.block.offset).toBe(40);
    // And nothing left on the sibling to win it back later.
    expect(findBlock(next as CardLayout, "b")?.block.offset).toBeUndefined();
  });

  it("leaves one offset on a line, whichever member the vacated space named", () => {
    // `vacatedSpace` names the holder too, so this is the same rule from the
    // other side: charge `c`, and `b` must not keep a number of its own.
    const withStale = cardWith({
      middle: [
        { id: "a", type: "name" },
        { id: "b", type: "address", widthPct: 50, offset: 60 },
        { id: "c", type: "description", widthPct: 50, offset: 200 },
      ],
    });

    const next = dropCardBlock(withStale, { kind: "move", id: "a" }, {
      zone: "top",
      index: 0,
      offset: 0,
      vacateId: "c",
      vacateOffset: 236,
    });

    expect(findBlock(next as CardLayout, "c")?.block.offset).toBe(236);
    expect(findBlock(next as CardLayout, "b")?.block.offset).toBeUndefined();
  });

  it("comes back to where it started when the move is undone", () => {
    /*
     * The reported bug, end to end: a block taken out from above a shared line
     * and put back. The line's own leading space has to be the number it started
     * with, not the greater of that and the hole the lift opened — which is what
     * made every round trip walk the card a little further down.
     */
    const start = cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "addr", type: "address", widthPct: 39 },
        { id: "logo", type: "logo", heightPct: 14, align: "center", offset: 2 },
        { id: "name", type: "name", offset: 120 },
      ],
    });

    // Down: the photo into the run below the shared line. The lift frees the top
    // of the card, so the line below it is charged for the hole.
    const down = dropCardBlock(start, { kind: "move", id: "photo" }, {
      zone: "middle",
      index: 3,
      offset: 0,
      nextOffset: 120,
      vacateId: "logo",
      vacateOffset: 89,
    });

    expect(down?.zones.middle.map((block) => block.id)).toEqual([
      "addr",
      "logo",
      "photo",
      "name",
    ]);
    expect(findBlock(down as CardLayout, "logo")?.block.offset).toBe(89);

    // And back: the run at the top of the zone, which owes the line below it the
    // two pixels it always had.
    const back = dropCardBlock(down as CardLayout, { kind: "move", id: "photo" }, {
      zone: "middle",
      index: 0,
      offset: 0,
      nextOffset: 2,
      vacateId: "name",
      vacateOffset: 120,
    });

    expect(back?.zones.middle.map((block) => block.id)).toEqual([
      "photo",
      "addr",
      "logo",
      "name",
    ]);
    expect(back?.zones.middle).toEqual(start.zones.middle);
  });

  it("charges nobody for a lift that frees nothing", () => {
    /*
     * A block crossing the line it *shares* takes its height with it and puts it
     * straight back, so the line below is owed nothing. The offer says otherwise
     * — `vacatedSpace` is worked out once per gesture, before anyone knows where
     * the block is going — and a column target carries no `nextOffset` to cancel
     * it with, so the charge would simply stand.
     */
    const start = cardWith({
      middle: [
        { id: "addr", type: "address", widthPct: 39 },
        { id: "logo", type: "logo", heightPct: 14, align: "center" },
        { id: "name", type: "name", offset: 120 },
      ],
    });

    const next = dropCardBlock(start, { kind: "move", id: "addr" }, {
      zone: "middle",
      index: 2,
      offset: 0,
      half: "end",
      widthPct: 39,
      line: 0,
      vacateId: "name",
      vacateOffset: 137,
    });

    expect(next?.zones.middle.map((block) => block.id)).toEqual([
      "logo",
      "addr",
      "name",
    ]);
    expect(findBlock(next as CardLayout, "name")?.block.offset).toBe(120);
  });
});

describe("a line keeps its leading space when a member leaves", () => {
  const beside = (): CardLayout =>
    cardWith({
      middle: [
        { id: "photo", type: "gallery", heightPct: 25 },
        { id: "addr", type: "address", widthPct: 39, offset: 25 },
        { id: "logo", type: "logo", heightPct: 14, align: "center" },
        { id: "hours", type: "hours", offset: 189 },
      ],
    });

  it("hands the line's own offset to the member that stays", () => {
    /*
     * The address is carrying 25px of leading space for the line it shares with
     * the logo. Drag it away and that space belonged to the *line*, which is
     * still there — so the logo has to take it, or the line jumps up 25px and
     * everything below it follows. One gesture, three blocks moved.
     */
    const next = dropCardBlock(beside(), { kind: "move", id: "addr" }, {
      zone: "middle",
      index: 4,
      offset: 40,
    });

    expect(findBlock(next as CardLayout, "logo")?.block.offset).toBe(25);
  });

  it("hands it over on a delete as well", () => {
    // Same argument, and `removeCardBlock` goes through the same `remove`:
    // dropping a block on the removal strip must not move the one it sat beside.
    const next = removeCardBlock(beside(), "addr");

    expect(findBlock(next, "logo")?.block.offset).toBe(25);
  });

  it("leaves a line that goes entirely to the space below it", () => {
    /*
     * A block alone on its line takes the line with it, so there is no line left
     * to hold anything — the hole it opens is `vacatedSpace`'s business, and this
     * must not also write to whatever follows.
     */
    const next = removeCardBlock(beside(), "photo");

    expect(findBlock(next, "addr")?.block.offset).toBe(25);
    expect(findBlock(next, "logo")?.block.offset).toBeUndefined();
  });

  it("says nothing when the leaver was not the one holding it", () => {
    const layout = cardWith({
      middle: [
        { id: "a", type: "name", widthPct: 50 },
        { id: "b", type: "address", widthPct: 50, offset: 90 },
      ],
    });

    const next = removeCardBlock(layout, "a");

    expect(findBlock(next, "b")?.block.offset).toBe(90);
  });
});

describe("taking a block off a logo's line and putting it back", () => {
  /*
   * The reported card: a photo in the top zone, and `[address][logo]` opening
   * the middle. Drag the address off that line onto the run below it, then drag
   * it back beside the logo.
   *
   * The logo is what this is about. Nothing in the gesture is addressed to it,
   * so nothing about it — its own stored fields, its position in the array, or
   * where the line it is on ends up — may come back different. What made the bug
   * visible was the *renderer* rather than these bytes: `blockEdges` asked
   * whether the logo was its zone's first **block** rather than whether its line
   * was the zone's first **line**, so the same stored logo drew 31px higher with
   * the address beside it than without. See `upwardLiftOf` in
   * packages/shared/card-layout.ts. This holds the half that is storable.
   */
  const start: CardLayout = {
    ...sampleCardLayout(),
    zones: {
      top: [{ id: "photo", type: "gallery", heightPct: 25 }],
      middle: [
        { id: "address", type: "address", widthPct: 39, padding: 4 },
        { id: "logo", type: "logo", heightPct: 14, overlapPct: 50, align: "center" },
      ],
      bottom: [],
    },
  };

  /** The two blocks do share one line to begin with. */
  it("starts with the address and the logo on one line", () => {
    const rows = cardRows(start.zones.middle, start);

    expect(rows).toHaveLength(1);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["address", "logo"]);
    expect(rows[0].index).toBe(0);
  });

  it("leaves the logo untouched, out and back", () => {
    // Out: onto the run below, full width, which is what a card-wide mark says.
    const out = dropCardBlock(start, { kind: "move", id: "address" }, {
      zone: "middle",
      index: 2,
      offset: 0,
      widthPct: 100,
    })!;

    expect(out.zones.middle.map((block) => block.id)).toEqual([
      "logo",
      "address",
    ]);
    expect(findBlock(out, "logo")!.block).toEqual(
      findBlock(start, "logo")!.block,
    );

    // And back into the column at the head of the logo's line, at the width it
    // was reserving there.
    const back = dropCardBlock(out, { kind: "move", id: "address" }, {
      zone: "middle",
      index: 0,
      offset: 0,
      half: "start",
      widthPct: 39,
      line: 0,
    })!;

    expect(back).toEqual(start);
  });
});

describe("resizeCardBlock and the type controls", () => {
  /*
   * Every one of these fields is an override with an "off", and the off has to
   * be a *value* the panel can press rather than the absence of one — because
   * `undefined` already means "don't touch this" everywhere in this patch. So
   * the empty string clears a font and a colour, zero clears a size and a
   * clamp, and `false` clears bold. These are the tests that hold that pair
   * together, since a control that can only ever set something is a control
   * whose first press is permanent.
   */
  const card = (block: CardBlock): CardLayout => ({
    ...defaultCardLayout(),
    zones: { top: [], middle: [block], bottom: [] },
  });

  const patched = (block: CardBlock, patch: Parameters<typeof resizeCardBlock>[2]) =>
    resizeCardBlock(card(block), block.id, patch).zones.middle[0];

  const name: CardBlock = { id: "n", type: "name" };

  it("sets a font from the catalogue and clears it with the empty string", () => {
    const set = patched(name, { font: CARD_FONTS[2].stack });
    expect(set.font).toBe(CARD_FONTS[2].stack);
    expect(patched(set, { font: "" }).font).toBeUndefined();
  });

  it("refuses a font that is not one of ours", () => {
    // Belt and braces with `readBlock`: a value that reaches an inline
    // `font-family` on a stranger's page is checked wherever it can be written.
    expect(patched(name, { font: "Papyrus, fantasy" }).font).toBeUndefined();
  });

  it("clamps a size, and reads zero as putting it back", () => {
    expect(patched(name, { fontSize: 999 }).fontSize).toBe(MAX_BLOCK_FONT_SIZE);

    const sized = patched(name, { fontSize: 20 });
    expect(sized.fontSize).toBe(20);
    expect(patched(sized, { fontSize: 0 }).fontSize).toBeUndefined();
  });

  it("lowercases a colour and clears it with an empty one", () => {
    const coloured = patched(name, { color: "#AABBCC" });
    expect(coloured.color).toBe("#aabbcc");
    expect(patched(coloured, { color: "" }).color).toBeUndefined();
  });

  it("turns bold off by deleting it rather than by storing false", () => {
    const bold = patched(name, { bold: true });
    expect(bold.bold).toBe(true);
    expect(patched(bold, { bold: false }).bold).toBeUndefined();
  });

  it("ignores all four on a block that has no words", () => {
    const spacer: CardBlock = { id: "s", type: "spacer", heightPct: 6 };
    const next = patched(spacer, {
      font: CARD_FONTS[0].stack,
      fontSize: 18,
      color: "#123456",
      bold: true,
    });

    expect(next.font).toBeUndefined();
    expect(next.fontSize).toBeUndefined();
    expect(next.color).toBeUndefined();
    expect(next.bold).toBeUndefined();
  });
});

describe("resizeCardBlock and the block's own options", () => {
  const card = (block: CardBlock): CardLayout => ({
    ...defaultCardLayout(),
    zones: { top: [], middle: [block], bottom: [] },
  });

  const patched = (block: CardBlock, patch: Parameters<typeof resizeCardBlock>[2]) =>
    resizeCardBlock(card(block), block.id, patch).zones.middle[0];

  const hours: CardBlock = { id: "h", type: "hours" };

  it("stores an opened week and clears it again", () => {
    // Collapsed is the absence, because that is what every published card
    // already draws — see packages/shared/card-layout.ts.
    const open = patched(hours, { hoursOpen: true });
    expect(open.hoursOpen).toBe(true);
    expect(patched(open, { hoursOpen: false }).hoursOpen).toBeUndefined();
  });

  it("drops a row gap that is back at the default", () => {
    const spaced = patched(hours, { hoursRowGap: 8 });
    expect(spaced.hoursRowGap).toBe(8);
    expect(
      patched(spaced, { hoursRowGap: DEFAULT_HOURS_ROW_GAP }).hoursRowGap,
    ).toBeUndefined();
  });

  it("ignores the week's options on anything that is not one", () => {
    const address: CardBlock = { id: "a", type: "address" };
    const next = patched(address, { hoursOpen: true, hoursRowGap: 8 });

    expect(next.hoursOpen).toBeUndefined();
    expect(next.hoursRowGap).toBeUndefined();
  });

  it("clamps a description to a real number of lines, and zero shows them all", () => {
    const description: CardBlock = { id: "d", type: "description" };

    const clamped = patched(description, { clampLines: 99 });
    expect(clamped.clampLines).toBe(MAX_CLAMP_LINES);
    expect(patched(clamped, { clampLines: 0 }).clampLines).toBeUndefined();
    expect(
      patched({ id: "a", type: "address" }, { clampLines: 2 }).clampLines,
    ).toBeUndefined();
  });

  const tags: CardBlock = { id: "t", type: "tags" };

  /*
   * The chips' outline is stored as a pair, and these three are why the edit
   * path has to know that rather than leaving it to the resolver: the panel
   * offers one control per half, and either half alone is a chip that draws
   * something nobody designed.
   */
  it("seeds a hairline the first time an outline colour is picked", () => {
    // Otherwise the picker is a control that visibly does nothing: the width
    // defaults to zero and a zero-width border draws no pixels.
    const outlined = patched(tags, { chipBorder: "#C8CED6" });

    // Lowercased at the boundary, as every stored colour in this codebase is.
    expect(outlined.chipBorder).toBe("#c8ced6");
    expect(outlined.chipBorderWidth).toBe(DEFAULT_CHIP_BORDER_WIDTH);
  });

  it("takes the width away with the colour", () => {
    const outlined = patched(tags, { chipBorder: "#c8ced6" });
    const cleared = patched(outlined, { chipBorder: "" });

    expect(cleared.chipBorder).toBeUndefined();
    expect(cleared.chipBorderWidth).toBeUndefined();
  });

  it("takes the colour away with the width", () => {
    const outlined = patched(tags, { chipBorder: "#c8ced6" });
    const flattened = patched(outlined, { chipBorderWidth: 0 });

    expect(flattened.chipBorderWidth).toBeUndefined();
    expect(flattened.chipBorder).toBeUndefined();
  });

  it("clamps an outline thicker than the ceiling", () => {
    const outlined = patched(tags, { chipBorder: "#c8ced6" });

    expect(patched(outlined, { chipBorderWidth: 99 }).chipBorderWidth).toBe(
      MAX_CHIP_BORDER_WIDTH,
    );
  });

  it("ignores an outline on a block that draws no chips", () => {
    const next = patched(
      { id: "a", type: "address" },
      { chipBorder: "#c8ced6", chipBorderWidth: 2 },
    );

    expect(next.chipBorder).toBeUndefined();
    expect(next.chipBorderWidth).toBeUndefined();
  });

  it("stores a mark drawn as its logo, and clears it back to the pin", () => {
    const logo: CardBlock = { id: "l", type: "logo" };

    const asLogo = patched(logo, { logoMode: "image" });
    expect(asLogo.logoMode).toBe("image");

    // The pin is the absence of the field, so there is one way to say it and no
    // card published before this existed changes.
    expect(patched(asLogo, { logoMode: "pin" }).logoMode).toBeUndefined();
  });

  it("ignores the mark's drawing on anything that is not one", () => {
    expect(
      patched({ id: "g", type: "gallery" }, { logoMode: "image" }).logoMode,
    ).toBeUndefined();
  });

  /*
   * The label is the one free-text control in the whole designer, and the panel
   * commits it on **every keystroke** into a controlled input that reads its
   * value straight back off the block. So anything this function does to the
   * string is done to the box someone is still typing in.
   */
  const button: CardBlock = { id: "b", type: "button" };

  it("keeps a space, which is what makes a two-word label typeable at all", () => {
    // The regression: this trimmed, so the space vanished the instant it was
    // typed and `Book now` came out `Booknow`.
    expect(patched(button, { buttonLabel: "Book " }).buttonLabel).toBe("Book ");
    expect(patched(button, { buttonLabel: "Book now" }).buttonLabel).toBe(
      "Book now",
    );
  });

  it("reads an emptied box as the action's own word back", () => {
    const labelled = patched(button, { buttonLabel: "Book now" });

    // Whitespace is *tested* rather than written back — a label of spaces is a
    // button with no words on it, and it unsets now rather than on reload.
    expect(patched(labelled, { buttonLabel: "   " }).buttonLabel).toBeUndefined();
    expect(patched(labelled, { buttonLabel: "" }).buttonLabel).toBeUndefined();
  });

  it("caps a label at the length both renderers will draw", () => {
    expect(
      patched(button, { buttonLabel: "x".repeat(MAX_BUTTON_LABEL + 20) })
        .buttonLabel,
    ).toHaveLength(MAX_BUTTON_LABEL);
  });

  it("ignores a label on a block that draws no button", () => {
    expect(
      patched({ id: "a", type: "address" }, { buttonLabel: "Book now" })
        .buttonLabel,
    ).toBeUndefined();
  });
});

/**
 * What a Logo block arrives as.
 *
 * Its own assertion because the value is written down on *arrival* rather than
 * inferred from the absence — absent has to keep meaning the pin, or every card
 * already published would change what it draws (§7).
 */
describe("a new logo block", () => {
  it("arrives as Mixed", () => {
    expect(makeCardBlock("logo").logoMode).toBe("mixed");
  });

  it("leaves every other type without one", () => {
    expect(makeCardBlock("name").logoMode).toBeUndefined();
    expect(makeCardBlock("gallery").logoMode).toBeUndefined();
  });
});
