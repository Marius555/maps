import { describe, expect, it } from "vitest";

import { CARD_FONTS } from "./card-fonts";
import {
  CARD_BLOCKS,
  CARD_ZONES,
  DEFAULT_HOURS_ROW_GAP,
  NARROW_CONTENT_SCALE,
  MAX_BLOCK_FONT_SIZE,
  MAX_BLOCK_MARGIN,
  MAX_BLOCK_PADDING,
  DEFAULT_BUTTON_BORDER_WIDTH,
  DEFAULT_CHIP_BORDER_WIDTH,
  MAX_BUTTON_BORDER_WIDTH,
  MAX_BUTTON_PADDING,
  MAX_BUTTON_RADIUS,
  MAX_CHIP_BORDER_WIDTH,
  MAX_CHIP_PADDING,
  MAX_CLAMP_LINES,
  MAX_HOURS_ROW_GAP,
  MIN_BLOCK_FONT_SIZE,
  acceptsBlock,
  bleedsByDefault,
  blockBox,
  buttonStyleOf,
  cardRowBox,
  cardRows,
  chipStyleOf,
  defaultMarginOf,
  defaultCardLayout,
  detailsContents,
  emptyCardLayout,
  findBlock,
  justifyOf,
  hasControl,
  isSavedCardLayout,
  isSelfSized,
  logoImageOf,
  leadBox,
  lineTakes,
  overlapOf,
  resolveCardLayout,
  rowOffsetHolder,
  selfShareOf,
  upwardLiftOf,

  type CardBlock,
  type CardBlockType,
  type CardLayout,
} from "./card-layout";

/**
 * The clamps here are the feature, not a detail of it.
 *
 * "No element can be bigger than the card, and nothing overflows" is a promise
 * made to someone dragging a handle, but it has to be true of a layout that
 * arrives from anywhere — an older build, a hand-edited row, a snapshot
 * published before a rule changed. The designer clamping as you drag is
 * politeness; this is the enforcement.
 */

const layoutWith = (zones: Partial<CardLayout["zones"]>): unknown => ({
  ...defaultCardLayout(),
  zones: { top: [], middle: [], bottom: [], ...zones },
});

describe("defaultCardLayout", () => {
  it("shows what a visitor came to the card for", () => {
    /*
     * The order somebody reads it in, and the reason `description` and `hours`
     * are on the card rather than inside the fold: while the designer is
     * unfinished this is not one card among several an owner could pick, it is
     * the only one, and a card that hides when a shop opens has hidden the
     * answer.
     *
     * And the reason the fold itself is gone. It could only ever hold those
     * same two, `detailsContents` subtracted both, so on this card it drew
     * nothing at all — a control that is always empty is not a fold. It is
     * `retired` rather than deleted, so a layout somebody saved with the
     * description dragged off still folds it.
     */
    const layout = defaultCardLayout();

    expect(layout.zones.top.map((block) => block.type)).toEqual(["gallery"]);
    expect(layout.zones.middle.map((block) => block.type)).toEqual([
      "name",
      "address",
      "description",
      "tags",
      "hours",
    ]);
    expect(layout.zones.bottom.map((block) => block.type)).toEqual(["actions"]);
  });

  it("round-trips through resolve unchanged", () => {
    // The snapshot omits the layout when it equals this, so a resolve that
    // altered it would make every map look custom the moment it was read back.
    expect(resolveCardLayout(defaultCardLayout())).toEqual(defaultCardLayout());
  });

  it("is these exact bytes, and a map that never opened the designer publishes them", () => {
    /*
     * The §7 canary. Every field added to a block since — `padding`, `margin`,
     * `offset` — is one a stored layout may leave out, and this is what holds
     * the line: the default card carries none of them, so the bytes stay short
     * and the dashboard and the embed can each build this card from nothing.
     *
     * The string is not sacred — the blocks on the default card have changed
     * three times, deliberately, and this is where that is noticed. The second
     * was the Category block coming off it: categories merged into tags, so it
     * would have been a second chip drawn from the same list. The third was the
     * "More details" fold, which held only the description and the week and so
     * drew nothing on a card carrying both. What is sacred is that *this* file
     * and embed/src/popup.ts produce the same card from the same function, so a
     * snapshot with no `cardLayout` draws the same popup on a customer's site as
     * the owner sees in the editor.
     */
    expect(JSON.stringify(defaultCardLayout())).toBe(
      '{"v":1,"width":320,"maxHeight":440,"radius":12,"padding":12,"gap":8,"borderWidth":0,"shadow":"soft","zones":{"top":[{"id":"gallery","type":"gallery","heightPct":25}],"middle":[{"id":"name","type":"name"},{"id":"address","type":"address"},{"id":"description","type":"description"},{"id":"tags","type":"tags"},{"id":"hours","type":"hours"}],"bottom":[{"id":"actions","type":"actions"}]}}',
    );
  });

  it("places every block in a zone that block is allowed in", () => {
    const layout = defaultCardLayout();

    for (const zone of CARD_ZONES) {
      for (const block of layout.zones[zone]) {
        expect(CARD_BLOCKS[block.type].zones).toContain(zone);
      }
    }
  });
});

describe("emptyCardLayout", () => {
  it("carries the default's card-level numbers, with nothing on it", () => {
    const empty = emptyCardLayout();
    const populated = defaultCardLayout();

    expect(empty.zones).toEqual({ top: [], middle: [], bottom: [] });
    expect(empty.width).toBe(populated.width);
    expect(empty.maxHeight).toBe(populated.maxHeight);
    expect(empty.radius).toBe(populated.radius);
    expect(empty.gap).toBe(populated.gap);
    expect(empty.shadow).toBe(populated.shadow);
  });

  it("starts with no padding, unlike the card an untouched account publishes", () => {
    /*
     * The one number a blank canvas does not take from the default, and the
     * reason is a block that cannot bleed: a half-width or narrowed block has
     * its margin forced to the card's own padding, so on a padded blank card
     * the first photo someone halves sits a visible strip in from the wall.
     *
     * The second assertion is the one that matters more. `defaultCardLayout()`
     * is what a map whose owner never opened the designer publishes, and
     * `lib/snapshot/build.ts` omits the layout entirely when it matches — so
     * moving *that* number would restyle cards already live on customers'
     * sites (CLAUDE.md §7).
     */
    expect(emptyCardLayout().padding).toBe(0);
    expect(defaultCardLayout().padding).toBe(12);
  });
});

describe("isSavedCardLayout", () => {
  it("is false for anything that is not a layout someone saved", () => {
    expect(isSavedCardLayout(null)).toBe(false);
    expect(isSavedCardLayout("gallery")).toBe(false);
    expect(isSavedCardLayout([])).toBe(false);
    expect(isSavedCardLayout({})).toBe(false);
    expect(isSavedCardLayout({ zones: {} })).toBe(false);
    expect(isSavedCardLayout({ zones: { top: "nope" } })).toBe(false);
  });

  it("is true for a card someone emptied, not just one that still has blocks", () => {
    // The whole point of this predicate: an owner who cleared their card gets
    // told that happened, not that they never opened the designer.
    expect(isSavedCardLayout({ zones: { top: [], middle: [], bottom: [] } })).toBe(
      true,
    );
    expect(isSavedCardLayout(defaultCardLayout())).toBe(true);
  });
});

describe("resolveCardLayout", () => {
  it("falls back on anything that is not a layout", () => {
    const fallback = defaultCardLayout();

    expect(resolveCardLayout(null)).toEqual(fallback);
    expect(resolveCardLayout("gallery")).toEqual(fallback);
    expect(resolveCardLayout([])).toEqual(fallback);
    expect(resolveCardLayout({})).toEqual(fallback);
    expect(resolveCardLayout({ zones: { top: "nope" } })).toEqual(fallback);
  });

  it("drops a block type it has never heard of", () => {
    const layout = resolveCardLayout(
      layoutWith({
        middle: [
          { id: "a", type: "name" },
          { id: "b", type: "video-wall" },
        ] as never,
      }),
    );

    expect(layout.zones.middle.map((block) => block.type)).toEqual(["name"]);
  });

  it("drops a block sitting in a zone it may not occupy", () => {
    // `actions` is bottom-only. A layout claiming otherwise predates the rule.
    const layout = resolveCardLayout(
      layoutWith({
        top: [{ id: "a", type: "actions" }],
        bottom: [{ id: "b", type: "actions" }],
      }),
    );

    expect(layout.zones.top).toEqual([]);
    expect(layout.zones.bottom.map((block) => block.type)).toEqual(["actions"]);
  });

  it("keeps only the first of a unique block, across zones", () => {
    const layout = resolveCardLayout(
      layoutWith({
        top: [{ id: "a", type: "name" }],
        middle: [{ id: "b", type: "name" }],
      }),
    );

    expect(layout.zones.top).toHaveLength(1);
    expect(layout.zones.middle).toHaveLength(0);
  });

  it("allows the blocks that are meant to repeat", () => {
    const layout = resolveCardLayout(
      layoutWith({
        middle: [
          { id: "a", type: "divider" },
          { id: "b", type: "spacer" },
          { id: "c", type: "divider" },
        ],
      }),
    );

    expect(layout.zones.middle).toHaveLength(3);
  });

  it("clamps a gallery to 70% of the card however tall it claims to be", () => {
    const layout = resolveCardLayout(
      layoutWith({ top: [{ id: "a", type: "gallery", heightPct: 420 }] }),
    );

    expect(layout.zones.top[0].heightPct).toBe(CARD_BLOCKS.gallery.maxHeightPct);
    expect(layout.zones.top[0].heightPct).toBe(70);
  });

  it("clamps a width into the block's own range and never past the card", () => {
    const layout = resolveCardLayout(
      layoutWith({
        top: [
          { id: "a", type: "gallery", widthPct: 400 },
          { id: "b", type: "divider", widthPct: 2 },
        ],
      }),
    );

    // Over-wide collapses to the full card, which drops `widthPct` entirely —
    // full width is the absence of a width, so there is one way to say it.
    expect(layout.zones.top[0].widthPct).toBeUndefined();
    expect(layout.zones.top[1].widthPct).toBe(CARD_BLOCKS.divider.minWidthPct);
  });

  it("ignores a width on a block that cannot be narrowed", () => {
    const layout = resolveCardLayout(
      layoutWith({ bottom: [{ id: "a", type: "actions", widthPct: 40 }] }),
    );

    expect(layout.zones.bottom[0].widthPct).toBeUndefined();
  });

  it("gives a fixed block its default height when it has none", () => {
    const layout = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "spacer" }] }),
    );

    expect(layout.zones.middle[0].heightPct).toBe(
      CARD_BLOCKS.spacer.defaultHeightPct,
    );
  });

  it("leaves a block that grows with its content without a height at all", () => {
    const layout = resolveCardLayout(
      layoutWith({
        middle: [
          { id: "a", type: "address" },
          // A height on a block that does not carry one is dropped, not
          // honoured: text is as tall as the text is.
          { id: "b", type: "description", heightPct: 40 },
        ],
      }),
    );

    expect(layout.zones.middle[0].heightPct).toBeUndefined();
    expect(layout.zones.middle[1].heightPct).toBeUndefined();
  });

  it("clamps a block's own padding, and treats zero as none", () => {
    const layout = resolveCardLayout(
      layoutWith({
        middle: [
          { id: "a", type: "name", padding: 900 },
          { id: "b", type: "address", padding: 0 },
          { id: "c", type: "description", padding: 10 },
        ],
      }),
    );

    expect(layout.zones.middle[0].padding).toBe(MAX_BLOCK_PADDING);
    // Absent, not 0 — the same "one way to say it" rule full width follows, and
    // what keeps a card saved before padding existed byte-identical.
    expect(layout.zones.middle[1].padding).toBeUndefined();
    expect(layout.zones.middle[2].padding).toBe(10);
  });

  it("clamps a block's leading space to the card it is on, and treats zero as none", () => {
    const layout = resolveCardLayout({
      ...(layoutWith({
        middle: [
          { id: "a", type: "name", offset: 9_000 },
          { id: "b", type: "address", offset: 0 },
          { id: "c", type: "description", offset: 64 },
          // Nonsense, as a hand-edited row would hold it.
          { id: "d", type: "hours", offset: "halfway" } as unknown as CardBlock,
        ],
      }) as object),
      maxHeight: 300,
    });

    // The card is what bounds it — an offset taller than the card is a block
    // pushed out through the bottom of it.
    expect(layout.zones.middle[0].offset).toBe(300);
    expect(layout.zones.middle[1].offset).toBeUndefined();
    expect(layout.zones.middle[2].offset).toBe(64);
    // Nonsense degrades to none rather than throwing — a snapshot published
    // years ago has to stay drawable.
    expect(layout.zones.middle[3].offset).toBeUndefined();
  });

  it("keeps an alignment at full width, where it is the text that moves", () => {
    const layout = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "address", align: "center" }] }),
    );

    expect(layout.zones.middle[0].align).toBe("center");
    expect(layout.zones.middle[0].widthPct).toBeUndefined();
  });

  it("clamps the card's own box", () => {
    const layout = resolveCardLayout({
      ...(defaultCardLayout() as unknown as Record<string, unknown>),
      width: 9000,
      maxHeight: -5,
      radius: 1e6,
      borderWidth: 40,
      shadow: "neon",
    });

    expect(layout.width).toBe(480);
    expect(layout.maxHeight).toBe(180);
    expect(layout.radius).toBe(28);
    expect(layout.borderWidth).toBe(6);
    // An unreadable shadow is the default one, not none.
    expect(layout.shadow).toBe(defaultCardLayout().shadow);
  });

  it("treats a colour it cannot read as unset, so the theme decides", () => {
    const withColors = resolveCardLayout({
      ...(defaultCardLayout() as unknown as Record<string, unknown>),
      background: "#FFF",
      border: "rgb(1,2,3)",
    });

    expect(withColors.background).toBe("#fff");
    expect(withColors.border).toBeUndefined();
  });

  /**
   * The difference between "this is not a layout" and "this is an empty card".
   *
   * The first is a column written before the designer existed, or hand-edited
   * into nonsense, and the default is the only safe reading of it. The second is
   * an owner who cleared their card, and putting the default back would be the
   * designer undoing their work in front of them.
   */
  it("keeps an empty card empty, but falls back when there are no zones at all", () => {
    const emptied = resolveCardLayout(layoutWith({}));

    expect(emptied.zones.top).toEqual([]);
    expect(emptied.zones.middle).toEqual([]);
    expect(emptied.zones.bottom).toEqual([]);

    expect(resolveCardLayout({ width: 320 })).toEqual(defaultCardLayout());
  });

  it("reads a legacy bleed as the margin it always meant", () => {
    // `bleed` could say exactly two things — the card's edges, or the card's
    // padding — so both survive the field being replaced. Layouts saved under
    // it, and snapshots published under it that customers' sites are still
    // fetching, have to keep drawing what they drew.
    const flush = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "address", bleed: true }] as never }),
    );
    expect(flush.zones.middle[0].margin).toBe(0);

    const inset = resolveCardLayout(
      layoutWith({ top: [{ id: "a", type: "gallery", bleed: false }] as never }),
    );
    expect(inset.zones.top[0].margin).toBe(defaultCardLayout().padding);

    // Absent, not coerced — an unreadable value falls back to the type's own
    // default rather than to some guessed number.
    const junk = resolveCardLayout(
      layoutWith({ top: [{ id: "a", type: "gallery", bleed: "yes" }] as never }),
    );
    expect(junk.zones.top[0].margin).toBeUndefined();
  });

  it("drops a margin that is already the type's own default", () => {
    // Full width is the absence of a width; the card's padding is the absence
    // of a margin. It is what leaves the card's own Padding slider in charge of
    // a block nobody has singled out.
    const pad = defaultCardLayout().padding;

    const text = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "name", margin: pad }] }),
    );
    expect(text.zones.middle[0].margin).toBeUndefined();

    // The gallery's default is zero, so zero is what gets dropped there and the
    // card's padding is the explicit value.
    const photo = resolveCardLayout(
      layoutWith({ top: [{ id: "a", type: "gallery", margin: 0 }] }),
    );
    expect(photo.zones.top[0].margin).toBeUndefined();
    expect(
      resolveCardLayout(
        layoutWith({ top: [{ id: "a", type: "gallery", margin: pad }] }),
      ).zones.top[0].margin,
    ).toBe(pad);
  });

  it("clamps a margin, and never reads one onto a spacer", () => {
    expect(
      resolveCardLayout(
        layoutWith({ middle: [{ id: "a", type: "name", margin: 400 }] }),
      ).zones.middle[0].margin,
    ).toBe(MAX_BLOCK_MARGIN);

    // A spacer draws nothing, so where its edges sit is a number with no pixel
    // behind it — the one block type that does not offer the control.
    expect(
      resolveCardLayout(
        layoutWith({ middle: [{ id: "a", type: "spacer", margin: 0 }] }),
      ).zones.middle[0].margin,
    ).toBeUndefined();
  });

  it("leaves margin unset when the stored block never mentioned it", () => {
    const layout = resolveCardLayout(
      layoutWith({ top: [{ id: "a", type: "gallery" }] }),
    );

    expect(layout.zones.top[0].margin).toBeUndefined();
  });

  it("makes every block id unique, whatever was stored", () => {
    const layout = resolveCardLayout(
      layoutWith({
        middle: [
          { id: "same", type: "divider" },
          { id: "same", type: "spacer" },
          { type: "divider" },
        ] as never,
      }),
    );

    const ids = layout.zones.middle.map((block) => block.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("detailsContents", () => {
  it("holds nothing on the default card, because it carries both itself", () => {
    // Not a gap: the default puts the description and the week on the card,
    // which is where someone standing outside the shop needs them. The fold is
    // there for the owner who drags one of them *off* again.
    expect(detailsContents(defaultCardLayout())).toEqual([]);
  });

  it("holds a block the card does not carry", () => {
    const layout = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "details" }] }),
    );

    expect(detailsContents(layout)).toEqual(["description", "hours"]);
  });

  it("stops holding a block that was placed on the card itself", () => {
    // Otherwise the description renders twice — once where the owner put it and
    // once inside the fold, which is the one card this model could produce that
    // nobody designed.
    const layout = resolveCardLayout(
      layoutWith({
        middle: [
          { id: "a", type: "description" },
          { id: "b", type: "details" },
        ],
      }),
    );

    expect(detailsContents(layout)).toEqual(["hours"]);
  });
});

describe("acceptsBlock", () => {
  const layout = defaultCardLayout();

  it("refuses a zone the block is not allowed in", () => {
    // `divider` is not unique, so it is the one that asks about the zone rule
    // alone with uniqueness out of the way — and it is allowed everywhere,
    // which is why the refusals below are asked of blocks that are not.
    expect(acceptsBlock(layout, "divider", "middle")).toBe(true);
    expect(acceptsBlock(layout, "divider", "top")).toBe(true);
    expect(acceptsBlock(layout, "actions", "middle")).toBe(false);
    expect(acceptsBlock(layout, "description", "top")).toBe(false);
  });

  it("refuses a second copy of a unique block", () => {
    expect(acceptsBlock(layout, "name", "middle")).toBe(false);
  });

  it("lets a unique block land back on itself while it is being moved", () => {
    const name = findBlock(layout, "name");
    expect(name?.zone).toBe("middle");
    expect(acceptsBlock(layout, "name", "top", name?.block.id)).toBe(true);
  });

  it("always takes a block that repeats", () => {
    expect(acceptsBlock(layout, "divider", "top")).toBe(true);
    expect(acceptsBlock(layout, "spacer", "bottom")).toBe(true);
  });
});

describe("bleedsByDefault", () => {
  it("is true only for the gallery", () => {
    expect(bleedsByDefault("gallery")).toBe(true);
    expect(bleedsByDefault("name")).toBe(false);
    expect(bleedsByDefault("description")).toBe(false);
  });
});

describe("defaultMarginOf", () => {
  it("is the card's own padding, and zero for what reaches the edges", () => {
    expect(defaultMarginOf("gallery", 12)).toBe(0);
    expect(defaultMarginOf("name", 12)).toBe(12);
    // It tracks the card's padding rather than a constant, which is what keeps
    // the card-level slider moving every block nobody has singled out.
    expect(defaultMarginOf("name", 0)).toBe(0);
  });
});

describe("blockBox", () => {
  const layout = defaultCardLayout();

  it("bleeds a full-width gallery with nothing said, and every published card already relies on that", () => {
    expect(blockBox({ id: "a", type: "gallery" }, layout).bleed).toBe(true);
  });

  it("lets an explicit margin override the type's own default, at full width", () => {
    const inset = blockBox({ id: "a", type: "gallery", margin: 12 }, layout);
    expect(inset.bleed).toBe(false);
    expect(inset.marginInline).toBeUndefined();

    const flush = blockBox({ id: "a", type: "name", margin: 0 }, layout);
    expect(flush.bleed).toBe(true);
    // Against the card's padding, which the zone already pays for every block.
    expect(flush.marginInline).toBe("-12px");
  });

  it("emits no margin at all for a block sitting where the zone put it", () => {
    // The untouched path has to stay byte-identical: a card whose owner never
    // moved a margin draws exactly what it always did.
    expect(blockBox({ id: "a", type: "name" }, layout).marginInline).toBeUndefined();
  });

  it("pushes a block further in than the card's own padding", () => {
    expect(
      blockBox({ id: "a", type: "name", margin: 20 }, layout).marginInline,
    ).toBe("8px");
  });

  it("moves the text, and never the block", () => {
    /*
     * `align` used to reach `align-self` as well, which *centred* a narrowed
     * block — and that is what makes the room left beside it useless: two
     * strips either side rather than one column another block can go in. Where
     * the block sits on its line is `side` now, applied to the row as a
     * `justify-content` (see `cardRowBox`), and `align` is the words alone.
     *
     * An `align-self` on a narrowed block would also be the cross axis of a flex
     * *row*, so "align right" would silently become "align bottom".
     */
    const wide = blockBox({ id: "a", type: "address", align: "end" }, layout);
    expect(wide.textAlign).toBe("end");
    expect(wide.alignSelf).toBeUndefined();

    const narrow = blockBox(
      { id: "a", type: "address", align: "end", widthPct: 50 },
      layout,
    );
    expect(narrow.textAlign).toBe("end");
    expect(narrow.alignSelf).toBeUndefined();
    // Nor a `width`: the share is a flex basis, so the row is what sizes it.
    expect(narrow.width).toBeUndefined();
  });

  it("leaves an unset alignment unset, so an older card is not re-anchored", () => {
    expect(blockBox({ id: "a", type: "address" }, layout).textAlign).toBeUndefined();
    expect(
      blockBox({ id: "a", type: "address", widthPct: 50 }, layout).textAlign,
    ).toBeUndefined();
  });

  it("turns a block's padding into pixels, and none into nothing", () => {
    expect(blockBox({ id: "a", type: "name", padding: 12 }, layout).padding).toBe(
      "12px",
    );
    expect(blockBox({ id: "a", type: "name" }, layout).padding).toBeUndefined();
  });

  it("keeps a block's leading space out of the block's own box", () => {
    // It belongs to the *line*, and every renderer draws it as a box of its own
    // above that line — see `leadBox`. A margin here could not give way.
    expect(
      Object.keys(blockBox({ id: "a", type: "name", offset: 40 }, layout)),
    ).not.toContain("marginTop");
  });

  it("never bleeds a narrowed block, whatever its margin says", () => {
    // A photo hanging over one edge of a card that no longer spans the full
    // width is not a design anyone asked for — see the field's own doc.
    const box = blockBox(
      { id: "a", type: "gallery", widthPct: 60, margin: 0 },
      layout,
    );

    expect(box.bleed).toBe(false);
    expect(box.marginInline).toBeUndefined();
  });
});

/**
 * Half-width blocks: the rules that let two of them share a line.
 *
 * The three renderers all walk `cardRows` and all read `blockBox`, and two of
 * them — `CardView` and the embed's `buildPopup` — have no tests of their own.
 * So these are not a nice-to-have: they are the only thing standing between a
 * mistake here and a wrong card on a customer's site.
 */
describe("the fit control", () => {
  const layout = defaultCardLayout();

  it("is offered on the gallery and nowhere else", () => {
    expect(hasControl("gallery", "fit")).toBe(true);

    for (const type of ["name", "address", "divider", "spacer"] as const) {
      expect(hasControl(type, "fit")).toBe(false);
    }
  });

  it("says nothing at all when the owner has not chosen", () => {
    // Absent is the crop every card has drawn since the gallery existed, so a
    // layout saved before this field — and every snapshot already live on a
    // customer's site — has to keep drawing exactly that.
    expect(
      blockBox({ id: "a", type: "gallery", heightPct: 25 }, layout).objectFit,
    ).toBeUndefined();
  });

  it("carries the one thing there is to say", () => {
    expect(
      blockBox({ id: "a", type: "gallery", fit: "contain" }, layout).objectFit,
    ).toBe("contain");
  });

  it("is dropped from a block whose type does not offer it", () => {
    const stored = {
      zones: { middle: [{ id: "a", type: "name", fit: "contain" }] },
    };

    expect(resolveCardLayout(stored).zones.middle[0].fit).toBeUndefined();
  });

  it("survives a round trip on the block that does", () => {
    const stored = {
      zones: { top: [{ id: "a", type: "gallery", fit: "contain" }] },
    };

    expect(resolveCardLayout(stored).zones.top[0].fit).toBe("contain");
  });

  it("reads anything that is not \"contain\" as the crop", () => {
    const stored = {
      zones: { top: [{ id: "a", type: "gallery", fit: "cover" }] },
    };

    expect(resolveCardLayout(stored).zones.top[0].fit).toBeUndefined();
  });
});

/**
 * The chip controls: what a block's pills are drawn on, and how roomy they are.
 *
 * Held here rather than in either renderer for the reason the fit control is:
 * `TagChips` in the dashboard and `buildTags` in the embed both read
 * `chipStyleOf` and neither has tests of its own, so this is the only thing
 * standing between a mistake and a wrong card on a customer's site.
 */
describe("the chip controls", () => {
  it("are offered by the two block types that draw chips and no others", () => {
    for (const type of ["tags", "category"] as const) {
      expect(hasControl(type, "chips")).toBe(true);
    }

    for (const type of ["name", "address", "hours", "divider"] as const) {
      expect(hasControl(type, "chips")).toBe(false);
    }
  });

  it("say nothing at all when the owner has not chosen", () => {
    // The whole reason these could be added to a live model: a Tags block
    // nobody has styled draws the pill it always drew, on every card already
    // published (CLAUDE.md §7).
    expect(chipStyleOf({ id: "a", type: "tags" })).toBeUndefined();
  });

  it("carry the ground and the extra room as CSS values", () => {
    const chip = chipStyleOf({
      id: "a",
      type: "tags",
      chipBackground: "#ff8800",
      chipPadding: 6,
    });

    expect(chip?.background).toBe("#ff8800");
    expect(chip?.padding).toBe("6px");
  });

  /*
   * The bug this whole group exists for. `align` reaches a block as
   * `text-align`, which cannot move a flex item — so the three Alignment buttons
   * on the Tags block moved nothing at all until the chip row started reading
   * this instead.
   */
  it("turn the block's own alignment into one a row of chips can use", () => {
    expect(chipStyleOf({ id: "a", type: "tags", align: "end" })?.justify).toBe(
      "flex-end",
    );
    expect(
      chipStyleOf({ id: "a", type: "tags", align: "center" })?.justify,
    ).toBe("center");
    // Not the logical `start`/`end` spelling, for `FLEX_ALIGN`'s reason: a card
    // is opened on a stranger's site.
    expect(chipStyleOf({ id: "a", type: "tags", align: "start" })?.justify).toBe(
      "flex-start",
    );
  });

  /*
   * The same fix, now shared. The Links row is the second flex row on a card, so
   * the mapping came out of `chipStyleOf` and became `justifyOf` — one answer
   * read by both renderers rather than a second copy that agrees today.
   */
  it("hand the same alignment to any row that is a flex row", () => {
    expect(justifyOf("start")).toBe("flex-start");
    expect(justifyOf("center")).toBe("center");
    expect(justifyOf("end")).toBe("flex-end");
    // Absent writes nothing, so a row nobody has aligned sits exactly where
    // every published card has always drawn it.
    expect(justifyOf(undefined)).toBeUndefined();
  });

  it("offer that alignment on the Links row at all", () => {
    // It had no `align` control until this change, which is why the row could
    // only ever be left-aligned.
    expect(hasControl("actions", "align")).toBe(true);
  });

  it("still says nothing for a block that is only aligned", () => {
    // `textAlign` is what an aligned block of *words* gets, and every block has
    // one — so `blockBox` keeps emitting it and this stays about the chips.
    expect(
      blockBox({ id: "a", type: "name", align: "center" }, defaultCardLayout())
        .textAlign,
    ).toBe("center");
  });

  it("are dropped from a block whose type does not draw chips", () => {
    const stored = {
      zones: {
        middle: [
          { id: "a", type: "name", chipBackground: "#ff8800", chipPadding: 6 },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.middle[0];

    expect(block.chipBackground).toBeUndefined();
    expect(block.chipPadding).toBeUndefined();
  });

  it("survive a round trip on a block that does", () => {
    const stored = {
      zones: {
        middle: [
          { id: "a", type: "tags", chipBackground: "#ff8800", chipPadding: 6 },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.middle[0];

    expect(block.chipBackground).toBe("#ff8800");
    expect(block.chipPadding).toBe(6);
  });

  it("read zero padding as no padding, and clamp what is over the ceiling", () => {
    const stored = {
      zones: {
        middle: [
          { id: "a", type: "tags", chipPadding: 0 },
          { id: "b", type: "category", chipPadding: 999 },
        ],
      },
    };

    const [none, huge] = resolveCardLayout(stored).zones.middle;

    // Zero is the absence of padding, on the same argument full width is the
    // absence of a width — so a card nobody has touched stores nothing new.
    expect(none.chipPadding).toBeUndefined();
    expect(huge.chipPadding).toBe(MAX_CHIP_PADDING);
  });

  it("refuse a ground that is not a hex colour", () => {
    const stored = {
      zones: { middle: [{ id: "a", type: "tags", chipBackground: "red" }] },
    };

    expect(
      resolveCardLayout(stored).zones.middle[0].chipBackground,
    ).toBeUndefined();
  });

  it("carry the outline as a colour and a width together", () => {
    const chip = chipStyleOf({
      id: "a",
      type: "tags",
      chipBorder: "#c8ced6",
      chipBorderWidth: 2,
    });

    expect(chip?.border).toBe("#c8ced6");
    expect(chip?.borderWidth).toBe("2px");
  });

  /*
   * Both halves or neither, and this is the assertion that says why: a colour
   * with no width draws nothing, and a width with no colour draws a line nobody
   * picked. `.card-chip` and `.lm-popup__tag` both default to a transparent
   * 0px, so a half that got through would be a visible chip nobody designed.
   */
  it("say nothing about an outline that is only half described", () => {
    expect(
      chipStyleOf({ id: "a", type: "tags", chipBorder: "#c8ced6" })?.border,
    ).toBeUndefined();
    expect(
      chipStyleOf({ id: "a", type: "tags", chipBorderWidth: 2 })?.borderWidth,
    ).toBeUndefined();
  });

  it("give a stored outline colour the default width when it has none", () => {
    const stored = {
      zones: { middle: [{ id: "a", type: "tags", chipBorder: "#c8ced6" }] },
    };

    const block = resolveCardLayout(stored).zones.middle[0];

    expect(block.chipBorder).toBe("#c8ced6");
    expect(block.chipBorderWidth).toBe(DEFAULT_CHIP_BORDER_WIDTH);
  });

  it("drop an outline stored at no width at all, colour included", () => {
    const stored = {
      zones: {
        middle: [
          { id: "a", type: "tags", chipBorder: "#c8ced6", chipBorderWidth: 0 },
          // And a width with nothing to be a width of. `category` rather than a
          // second `tags`, which is `unique` and would be dropped whole.
          { id: "b", type: "category", chipBorderWidth: 3 },
        ],
      },
    };

    const [none, orphan] = resolveCardLayout(stored).zones.middle;

    expect(none.chipBorder).toBeUndefined();
    expect(none.chipBorderWidth).toBeUndefined();
    expect(orphan.chipBorder).toBeUndefined();
    expect(orphan.chipBorderWidth).toBeUndefined();
  });

  it("clamp an outline thicker than the ceiling", () => {
    const stored = {
      zones: {
        middle: [
          { id: "a", type: "tags", chipBorder: "#c8ced6", chipBorderWidth: 99 },
        ],
      },
    };

    expect(resolveCardLayout(stored).zones.middle[0].chipBorderWidth).toBe(
      MAX_CHIP_BORDER_WIDTH,
    );
  });

  it("drop the outline from a block whose type does not draw chips", () => {
    const stored = {
      zones: {
        middle: [
          { id: "a", type: "name", chipBorder: "#c8ced6", chipBorderWidth: 2 },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.middle[0];

    expect(block.chipBorder).toBeUndefined();
    expect(block.chipBorderWidth).toBeUndefined();
  });
});

/*
 * The mark's one non-measurement, and the fallback that makes it safe on a map
 * of four hundred locations.
 */
describe("a logo block's drawing", () => {
  it("is the pin until somebody says otherwise", () => {
    // The whole reason this could be added to a live model: a Logo block on a
    // card published before the field existed draws exactly what it drew.
    expect(logoImageOf({ id: "a", type: "logo" }, "data:image/png;base64,x")).toBe(
      null,
    );
  });

  it("is the uploaded image once it is asked for", () => {
    expect(
      logoImageOf({ id: "a", type: "logo", logoMode: "image" }, "data:image/png;base64,x"),
    ).toBe("data:image/png;base64,x");
  });

  /*
   * The assertion the feature rests on. A design is saved for the whole account
   * and drawn against every location in it — so "draw the logo" has to mean
   * "draw the logo *if this pin has one*", or a card arranged against the one
   * location with a brand mark goes blank on the rest.
   */
  it("falls back to the pin for a location whose pin has no image", () => {
    expect(logoImageOf({ id: "a", type: "logo", logoMode: "image" }, "")).toBe(
      null,
    );
  });

  it("survives a round trip, and is dropped from a type that is not a mark", () => {
    const stored = {
      zones: {
        top: [
          { id: "a", type: "logo", logoMode: "image" },
          { id: "b", type: "name", logoMode: "image" },
        ],
      },
    };

    const [logo, name] = resolveCardLayout(stored).zones.top;

    expect(logo.logoMode).toBe("image");
    expect(name.logoMode).toBeUndefined();
  });

  it("reads anything that is not the one word as the pin", () => {
    const stored = { zones: { top: [{ id: "a", type: "logo", logoMode: "pin" }] } };

    expect(resolveCardLayout(stored).zones.top[0].logoMode).toBeUndefined();
  });
});

describe("cardRows", () => {
  const half = (id: string): CardBlock => ({ id, type: "name", half: true });
  const full = (id: string): CardBlock => ({ id, type: "name" });

  it("gives a line of its own to every full-width block, indexed as it always was", () => {
    // The neutrality proof. A card with nothing narrowed on it is one row per
    // block, which is what makes every existing measurement and insertion index
    // right.
    const rows = cardRows([full("a"), full("b"), full("c")], defaultCardLayout());

    expect(rows.map((row) => row.blocks.map((block) => block.id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
    expect(rows.map((row) => [row.index, row.end])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(rows.every((row) => !row.shared)).toBe(true);
  });

  it("lets a half keep its own line, with the next half pairing below it", () => {
    /*
     * The one shape greedy adjacency cannot reach on its own, and the reason
     * `newLine` exists: three consecutive halves are otherwise always
     * `[a,b] [c]` and never `[a] [b,c]`. Without it, dragging a half out of a
     * pair to join the lone half below it freed its old partner to grab that
     * lone half instead — and the two appeared to swap lines under the cursor.
     */
    const rows = cardRows([
      half("a"),
      { ...half("b"), newLine: true },
      half("c"),
    ], defaultCardLayout());

    expect(rows.map((row) => row.blocks.map((block) => block.id))).toEqual([
      ["a"],
      ["b", "c"],
    ]);
    expect(rows.map((row) => [row.index, row.end])).toEqual([
      [0, 1],
      [1, 3],
    ]);
    expect(rows.every((row) => row.shared)).toBe(true);
  });

  it("pairs two consecutive halves onto one line", () => {
    const rows = cardRows([half("a"), half("b")], defaultCardLayout());

    expect(rows).toHaveLength(1);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["a", "b"]);
    expect(rows[0].index).toBe(0);
    // One past the last, which is the index a third block would be inserted at.
    expect(rows[0].end).toBe(2);
    expect(rows[0].shared).toBe(true);
  });

  it("is greedy from the top, so three halves are a pair and a single", () => {
    // Not three-thirds, and not a single then a pair: the line a block shares is
    // decided walking down the card, the way someone reading it would.
    const rows = cardRows([half("a"), half("b"), half("c")], defaultCardLayout());

    expect(rows.map((row) => row.blocks.map((block) => block.id))).toEqual([
      ["a", "b"],
      ["c"],
    ]);
  });

  it("keeps a lone half on a line of its own", () => {
    // Not a special case to tidy away: a bare narrowed block in the zone's flex
    // *column* would have its basis apply to its height. The row is what makes a
    // share mean width — and the room left beside it is the drop target.
    const rows = cardRows([half("a")], defaultCardLayout());

    expect(rows).toHaveLength(1);
    expect(rows[0].shared).toBe(true);
    expect(rows[0].blocks).toHaveLength(1);
  });

  it("lets a full-width block break a run of halves", () => {
    const rows = cardRows([half("a"), full("b"), half("c")], defaultCardLayout());

    expect(rows.map((row) => row.blocks.map((block) => block.id))).toEqual([
      ["a"],
      ["b"],
      ["c"],
    ]);
    expect(rows.map((row) => row.shared)).toEqual([true, false, true]);
  });

  it("pairs two narrowed blocks whose shares fit on one line", () => {
    // The rule the `half` flag used to state as a special case: 40 and 60 make a
    // line, and it is the widths that say so rather than a second field.
    const rows = cardRows([
      { id: "a", type: "name", widthPct: 40 },
      { id: "b", type: "address", widthPct: 60 },
    ], defaultCardLayout());

    expect(rows).toHaveLength(1);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["a", "b"]);
    expect(rows[0].shared).toBe(true);
  });

  it("refuses a pair whose shares do not fit, and gives each its own line", () => {
    // 120% of a line is not a line. Both keep the room they reserved, which is
    // the honest reading — and it is why widening one member of a pair is
    // clamped rather than allowed to silently break it (`maxShareFor`).
    const rows = cardRows([
      { id: "a", type: "name", widthPct: 60 },
      { id: "b", type: "address", widthPct: 60 },
    ], defaultCardLayout());

    expect(rows.map((row) => row.blocks.map((block) => block.id))).toEqual([
      ["a"],
      ["b"],
    ]);
    expect(rows.map((row) => row.shared)).toEqual([true, true]);
  });

  it("reads a stored `half` as 50%, so a published card still pairs", () => {
    /*
     * The back-compat proof, and it has to live at *this* level rather than in
     * the resolver: the embed draws `snapshot.cardLayout` exactly as published,
     * without re-resolving it (embed/src/map.ts). A card live on a customer's
     * site says `half: true`, and it has to keep drawing two columns.
     */
    const rows = cardRows([
      { id: "a", type: "name", half: true },
      { id: "b", type: "address", widthPct: 50 },
    ], defaultCardLayout());

    expect(rows).toHaveLength(1);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["a", "b"]);
  });

  it("indexes against the list it was handed, which is what CardView relies on", () => {
    // The read-only card drops blocks this location has nothing to show for and
    // then pairs what is left, so a blank Category lets the Name and the Address
    // either side of it share a line rather than leaving a hole.
    const rows = cardRows([
      { id: "name", type: "name", half: true },
      { id: "address", type: "address", half: true },
    ], defaultCardLayout());

    expect(rows[0].blocks.map((block) => block.id)).toEqual(["name", "address"]);
    expect(rows[0].index).toBe(0);
    expect(rows[0].end).toBe(2);
  });

  it("has nothing to say about an empty zone", () => {
    expect(cardRows([], defaultCardLayout())).toEqual([]);
  });
});

/**
 * The empty space above a line, as a box that gives way.
 *
 * The reason it is a box at all is a bug: as a `margin-top` it could not shrink,
 * so a block growing under a card's fixed height pushed everything below it off
 * the bottom, and the only thing that could give the room back was a pass that
 * rewrote the layout — permanently, so the blocks never came back down when the
 * content shrank again. What is checked here is that the arithmetic comes out
 * the same at both ends of the stretch.
 */
describe("leadBox", () => {
  const layout = defaultCardLayout();

  it("asks for the space as its basis, and gives all of it back under pressure", () => {
    const box = leadBox(120, layout);

    // `0` grow, so it never takes room the blocks could have had.
    expect(box.flex).toBe(`0 1000 120px`);
    // And nothing holds it open: a flex item's automatic minimum is its content,
    // and there is no content in here to keep.
    expect(box.minHeight).toBe("0");
  });

  it("cancels the second gap it brings with it, at both ends of the stretch", () => {
    // A zone is a flex column with a gap between every pair of items, so an
    // extra item between two lines adds a second one. At rest the line has to
    // sit `gap + offset` below its neighbour, which is exactly where the old
    // margin left it; fully compressed it has to sit at `gap`, which is exactly
    // where an absent offset leaves it. One negative margin does both.
    const box = leadBox(120, layout);
    expect(box.marginBottom).toBe(`-${String(layout.gap)}px`);

    const atRest = layout.gap + 120 + layout.gap - layout.gap;
    expect(atRest).toBe(layout.gap + 120);

    const compressed = layout.gap + 0 + layout.gap - layout.gap;
    expect(compressed).toBe(layout.gap);
  });

  it("shrinks far harder than any block, which is the whole ordering rule", () => {
    // Flex shares the shortfall out by shrink factor times basis, and every
    // block is `flex: none` — so the empty space goes first with no pass over
    // the card deciding that it should.
    const shrink = Number(leadBox(120, layout).flex.split(" ")[1]);

    expect(shrink).toBeGreaterThan(1);
    for (const type of Object.keys(CARD_BLOCKS) as CardBlockType[]) {
      expect(blockBox({ id: "a", type }, layout).flex).toBe("none");
    }
  });
});

describe("cardRowBox", () => {
  const layout = defaultCardLayout();

  it("separates the pair by the card's own gap", () => {
    const row = cardRows([
      { id: "a", type: "name", half: true },
      { id: "b", type: "address", half: true },
    ], defaultCardLayout())[0];

    expect(cardRowBox(row, layout).columnGap).toBe("8px");
    expect(cardRowBox(row, { ...layout, gap: 20 }).columnGap).toBe("20px");
  });

  it("takes the greater of the pair's two leading spaces, once", () => {
    // A `margin-top` on a flex-row child offsets that child within the row and
    // pulls the pair apart. The row is where it has to land — and taking the
    // maximum means a stray offset on the second member still does something
    // rather than being silently dropped.
    const row = cardRows([
      { id: "a", type: "name", half: true, offset: 12 },
      { id: "b", type: "address", half: true, offset: 30 },
    ], defaultCardLayout())[0];

    expect(rowOffsetHolder(row.blocks)?.offset).toBe(30);
  });

  it("emits no leading space when nobody asked for any", () => {
    const row = cardRows([{ id: "a", type: "name", half: true }], defaultCardLayout())[0];

    expect(rowOffsetHolder(row.blocks)?.offset).toBeUndefined();
  });

  it("puts a lone half at its line's end when it says so", () => {
    const row = cardRows([
      { id: "a", type: "name", half: true, side: "end" },
    ], defaultCardLayout())[0];

    expect(cardRowBox(row, layout).justifyContent).toBe("flex-end");
  });

  it("leaves a lone half at the start when it does not", () => {
    // Absent is the start, which is where every lone half sat before it could
    // be moved at all — so no card drawn before `side` existed moves.
    const row = cardRows([{ id: "a", type: "name", half: true }], defaultCardLayout())[0];

    expect(cardRowBox(row, layout).justifyContent).toBeUndefined();
  });

  it("keeps the room on a leading mark's far side", () => {
    /*
     * A flex row leaves what a line has not spent at its *end*, and a mark loses
     * its `align-self` the moment it has a neighbour — so a centred logo used to
     * be shoved to the start of the card by the first block that landed beside
     * it, which then drew in the middle with the leftover trailing it.
     */
    const row = cardRows([
      { id: "a", type: "logo", align: "center" },
      { id: "b", type: "name", widthPct: 50 },
    ], defaultCardLayout())[0];

    expect(row.blocks).toHaveLength(2);
    expect(cardRowBox(row, layout).justifyContent).toBe("flex-end");
  });

  it("leaves a mark that asked for the start of its line at the start", () => {
    // And a mark with no alignment at all, which is where every logo drew before
    // the field existed — so no card anybody has already published moves.
    const aligned = cardRows([
      { id: "a", type: "logo", align: "start" },
      { id: "b", type: "name", widthPct: 50 },
    ], defaultCardLayout())[0];
    const bare = cardRows([
      { id: "a", type: "logo" },
      { id: "b", type: "name", widthPct: 50 },
    ], defaultCardLayout())[0];

    expect(cardRowBox(aligned, layout).justifyContent).toBeUndefined();
    expect(cardRowBox(bare, layout).justifyContent).toBeUndefined();
  });

  it("says nothing about a mark that follows a column", () => {
    // Its leading space is spent by the block in front of it, so the room left
    // over already falls on its far side with nothing needing to be said.
    const row = cardRows([
      { id: "a", type: "name", widthPct: 50 },
      { id: "b", type: "logo", align: "center" },
    ], defaultCardLayout())[0];

    expect(row.blocks).toHaveLength(2);
    expect(cardRowBox(row, layout).justifyContent).toBeUndefined();
  });

  it("says nothing about a mark alone on its line", () => {
    // There it is a child of the zone's flex column, where `align-self` is
    // horizontal and is what positions it. See `blockBox`.
    const row = cardRows(
      [{ id: "a", type: "logo", align: "center" }],
      defaultCardLayout(),
    )[0];

    expect(cardRowBox(row, layout).justifyContent).toBeUndefined();
  });

  it("ignores a side on a line that holds a pair", () => {
    /*
     * Two 50% bases and a gap are the whole row, so there is nothing left for
     * `justify-content` to move. Emitting it anyway would be a property that
     * appears to work on one line and does nothing on the next — and `side` is
     * deliberately not cleared when a partner arrives, so a stale one has to be
     * harmless here rather than merely unlikely.
     */
    const row = cardRows([
      { id: "a", type: "name", half: true, side: "end" },
      { id: "b", type: "address", half: true },
    ], defaultCardLayout())[0];

    expect(cardRowBox(row, layout).justifyContent).toBeUndefined();
  });
});

describe("the width control", () => {
  it("is offered on exactly the blocks that can share a line", () => {
    /*
     * There used to be two lists here and a test that they matched — `half` was
     * a control of its own, offered on precisely the types that offered `width`.
     * One list is the point of the change: narrowing a block *is* how you open
     * room beside it, so there is nothing left to keep in step.
     */
    const types = Object.keys(CARD_BLOCKS) as CardBlockType[];
    const narrowable = types.filter((type) => hasControl(type, "width"));

    expect(narrowable).toEqual([
      "gallery",
      "name",
      "category",
      "tags",
      "address",
      "button",
      "divider",
    ]);
    // No block declares a control the panel no longer renders.
    expect(
      types.filter((type) =>
        (CARD_BLOCKS[type].controls as readonly string[]).includes("half"),
      ),
    ).toEqual([]);
  });

  it("gives every narrowable block the same floor, and it leaves room", () => {
    // A quarter is the narrowest a block goes, so the most that can ever be
    // reserved is three quarters — still wide enough for another block's own
    // floor, which is what keeps the reserved column droppable.
    for (const type of [
      "gallery",
      "name",
      "category",
      "tags",
      "button",
      "address",
      "divider",
    ] as const) {
      expect(CARD_BLOCKS[type].minWidthPct).toBe(25);
    }
  });
});

describe("blockBox for a narrowed block", () => {
  const layout = defaultCardLayout();

  it("takes the share it was given, minus its half of the gap", () => {
    /*
     * Two shares summing to 100, each giving up half the one `column-gap`
     * between them, is exactly the row. That arithmetic is what lets a 40/60
     * split be a line at all, and it is the same formula a 50/50 has always
     * used.
     */
    expect(
      blockBox({ id: "a", type: "name", widthPct: 40 }, layout).flex,
    ).toBe("0 0 calc(40% - 4px)");
    expect(
      blockBox({ id: "b", type: "address", widthPct: 60 }, layout).flex,
    ).toBe("0 0 calc(60% - 4px)");
  });

  it("reads a stored `half` as 50%, for the cards already published with it", () => {
    expect(blockBox({ id: "a", type: "name", half: true }, layout).flex).toBe(
      blockBox({ id: "a", type: "name", widthPct: 50 }, layout).flex,
    );
  });

  it("never bleeds, whatever its type would do at full width", () => {
    /*
     * The regression guard for the one bug that would ship a broken card. A
     * bleeding block carries a negative inline margin of the card's padding, and
     * two of them on one line make that line twice a padding wider than the card
     * itself. In the embed it is worse than an inline style, because
     * `.lm-popup__block--bleed` would apply the same margin from the stylesheet
     * — and `bleed: false` here is the only thing that stops the class being
     * added at all.
     */
    const box = blockBox({ id: "a", type: "gallery", half: true }, layout);

    expect(box.bleed).toBe(false);
    expect(box.marginInline).toBeUndefined();

    // Even asked for outright.
    const asked = blockBox(
      { id: "a", type: "gallery", half: true, margin: 0 },
      layout,
    );

    expect(asked.bleed).toBe(false);
    expect(asked.marginInline).toBeUndefined();
  });

  it("takes half the line, minus its share of the gap", () => {
    expect(blockBox({ id: "a", type: "name", half: true }, layout).flex).toBe(
      "0 0 calc(50% - 4px)",
    );
    expect(
      blockBox({ id: "a", type: "name", half: true }, { ...layout, gap: 20 })
        .flex,
    ).toBe("0 0 calc(50% - 10px)");
  });

  it("keeps its height and still takes half the line", () => {
    /*
     * The other collision. `flex: none` is `0 0 auto`, so a sized block written
     * blind would throw the basis away and put a half photo back across the
     * whole card. One function decides `flex`, which is why it cannot happen.
     */
    const box = blockBox(
      { id: "a", type: "gallery", half: true, heightPct: 25 },
      layout,
    );

    expect(box.height).toBe("110px");
    expect(box.flex).toBe("0 0 calc(50% - 4px)");
  });

  it("still gives a sized full-width block the flex it has always had", () => {
    const box = blockBox({ id: "a", type: "gallery", heightPct: 25 }, layout);

    expect(box.flex).toBe("none");
    expect(box.contentZoom).toBeUndefined();
    expect(box.overflowWrap).toBeUndefined();
  });

  it("draws its content smaller, by the one shared number", () => {
    const box = blockBox({ id: "a", type: "name", half: true }, layout);

    expect(box.contentZoom).toBe(NARROW_CONTENT_SCALE);
    // What actually stops a half overflowing: the words already wrap, so the
    // only thing that can poke out of the column is one unbroken token.
    expect(box.overflowWrap).toBe("anywhere");
  });

  it("shrinks words and nothing else", () => {
    /*
     * A photo halved does not read as cramped, and shrinking it by a tenth only
     * left a band of card under it inside a block whose height its owner had
     * dragged a handle to. Same for the two blocks that *are* a measurement — a
     * space and a rule.
     */
    for (const type of ["gallery", "spacer", "divider"] as const) {
      expect(
        blockBox({ id: "a", type, half: true }, layout).contentZoom,
      ).toBeUndefined();
    }

    // And a half photo keeps the basis that makes it a half at all.
    expect(
      blockBox({ id: "a", type: "gallery", half: true }, layout).flex,
    ).toBe("0 0 calc(50% - 4px)");
  });

  it("moves its words but never itself", () => {
    // `align-self` in a flex *row* is the cross axis, so "align right" on a half
    // would silently become "align bottom".
    const box = blockBox(
      { id: "a", type: "address", half: true, align: "end" },
      layout,
    );

    expect(box.textAlign).toBe("end");
    expect(box.alignSelf).toBeUndefined();
    expect(box.width).toBeUndefined();
  });

  it("leaves its leading space to the line", () => {
    // Narrowed or not: it is one number per line, drawn as a box above it.
    for (const onRow of [true, false]) {
      expect(
        Object.keys(
          blockBox({ id: "a", type: "name", half: true, offset: 24 }, layout, onRow),
        ),
      ).not.toContain("marginTop");
    }
  });
});

describe("resolveCardLayout and the legacy half", () => {
  it("reads it as 50% on a block whose type can be narrowed", () => {
    /*
     * The migration, and it is the same shape `bleed` -> `margin` took: the old
     * field said exactly one thing, so it reads as the number that says it and
     * nothing is lost. Every layout saved under `half`, and every snapshot
     * published with it, keeps drawing the two columns it drew — with no
     * migration touching a single row.
     */
    const layout = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "name", half: true }] }),
    );

    expect(layout.zones.middle[0].widthPct).toBe(50);
    // And it is never written back out: one way to say how wide a block is.
    expect(layout.zones.middle[0].half).toBeUndefined();
  });

  it("drops it on a block whose type does not", () => {
    // Opening hours in half a 320px card is a week nobody can read, which is the
    // whole reason CARD_BLOCKS writes the rule down.
    const layout = resolveCardLayout(
      layoutWith({ middle: [{ id: "a", type: "hours", half: true }] }),
    );

    expect(layout.zones.middle[0].half).toBeUndefined();
    expect(layout.zones.middle[0].widthPct).toBeUndefined();
  });

  it("lets half win over a width, so a stored card can never claim both", () => {
    // A blob claiming both is an older build's `half` plus a number that build
    // would itself have ignored, so the old field is the one to believe.
    const layout = resolveCardLayout(
      layoutWith({
        middle: [{ id: "a", type: "name", half: true, widthPct: 40 }],
      }),
    );

    expect(layout.zones.middle[0].widthPct).toBe(50);
    expect(layout.zones.middle[0].half).toBeUndefined();
  });

  it("reads anything that is not true as absent", () => {
    // Absence is the one way to say full width, so `false` is never stored as a
    // second way to say it — which is what keeps a card that has never used this
    // publishing the bytes it always did.
    for (const value of [false, "yes", 1, null]) {
      const layout = resolveCardLayout(
        layoutWith({
          middle: [
            { id: "a", type: "name", half: value } as unknown as CardBlock,
          ],
        }),
      );

      expect(layout.zones.middle[0].half).toBeUndefined();
    }
  });
});

/**
 * The logo, which is the one block with a size of its own.
 *
 * 14% of the default card's 440px is 62px, and half of that is the 31px it is
 * pulled up by — the arithmetic written out, because "half over the edge" is the
 * whole layout this block exists for.
 */
describe("the logo block", () => {
  const logoCard = (block: Partial<CardBlock> = {}): CardLayout => ({
    ...defaultCardLayout(),
    zones: {
      top: [
        { id: "gallery", type: "gallery", heightPct: 25 },
        {
          id: "logo",
          type: "logo",
          heightPct: 14,
          align: "center",
          overlapPct: 50,
          ...block,
        },
      ],
      middle: [],
      bottom: [],
    },
  });

  const boxOf = (block: Partial<CardBlock> = {}) => {
    const layout = logoCard(block);

    return blockBox(layout.zones.top[1], layout);
  };

  it("is drawn square, from the one number", () => {
    // A brand mark wider than it is tall is a wordmark, and a layout that set
    // only one of two dimensions could produce one by accident.
    const box = boxOf();

    expect(box.height).toBe("62px");
    expect(box.width).toBe("62px");
    // Or the zone's flex column shrinks it back to its content, which is nothing.
    expect(box.flex).toBe("none");
  });

  it("positions its box rather than its words", () => {
    // The one block where `align` is an `align-self`: it has a width of its own
    // inside the zone's flex *column*, where the cross axis is horizontal.
    const box = boxOf();

    expect(box.alignSelf).toBe("center");
    expect(box.textAlign).toBeUndefined();
  });

  it("hands the overlap back as a length, to be painted over its neighbour", () => {
    const box = boxOf();

    expect(box.overlap).toBe("31px");
    // Absent is upwards, which is the photo above it.
    expect(box.overlapEdge).toBeUndefined();
    expect(box.raised).toBe(true);
  });

  it("carries the edge when it is the other one", () => {
    expect(boxOf({ overlapEdge: "below" }).overlapEdge).toBe("below");
  });

  it("asks for nothing at all when it overlaps nothing", () => {
    // Zero is the absence of an overlap, so there is nothing to raise it over.
    const box = boxOf({ overlapPct: 0 });

    expect(box.overlap).toBeUndefined();
    expect(box.raised).toBeUndefined();
  });

  it("cannot share a line, so it is never given a share", () => {
    expect(hasControl("logo", "width")).toBe(false);
    expect(hasControl("logo", "valign")).toBe(false);
  });
});

describe("resolveCardLayout and the overlap", () => {
  const withBlock = (block: unknown): CardLayout =>
    resolveCardLayout({
      ...defaultCardLayout(),
      zones: { top: [block], middle: [], bottom: [] },
    });

  it("keeps an overlap and the edge it is against", () => {
    const block = withBlock({
      id: "l",
      type: "logo",
      overlapPct: 40,
      overlapEdge: "below",
    }).zones.top[0];

    expect(block.overlapPct).toBe(40);
    expect(block.overlapEdge).toBe("below");
  });

  it("falls back to the type's own overlap rather than to none", () => {
    /*
     * A logo whose stored number is unreadable draws the layout a fresh one
     * arrives with, rather than silently detaching itself from the photo. Every
     * other clamp in this file falls back to the type's starting value for the
     * same reason.
     */
    const block = withBlock({ id: "l", type: "logo", overlapPct: "half" })
      .zones.top[0];

    expect(block.overlapPct).toBe(CARD_BLOCKS.logo.defaultOverlapPct);
  });

  it("drops the edge along with the overlap it described", () => {
    // A direction on a block that overlaps nothing is a field with no pixel
    // behind it.
    const block = withBlock({
      id: "l",
      type: "logo",
      overlapPct: 0,
      overlapEdge: "below",
    }).zones.top[0];

    expect(block.overlapPct).toBeUndefined();
    expect(block.overlapEdge).toBeUndefined();
  });

  it("gives no overlap to a block whose type cannot have one", () => {
    const block = withBlock({ id: "n", type: "name", overlapPct: 50 })
      .zones.top[0];

    expect(block.overlapPct).toBeUndefined();
  });
});

describe("overlapOf", () => {
  /*
   * The one number two files have to agree on: `blockBox` writes it as a
   * negative margin, and the drop geometry draws its mark against it so an
   * outline promises the box the block will actually fill (`liftOf` in
   * lib/card/drop-slots.ts).
   */
  const layout = defaultCardLayout();

  it("is that share of the block's own resolved height", () => {
    // 14% of a 440px card is 62px, and half of that is 31 — which is what a
    // logo arrives with.
    expect(
      overlapOf({ id: "l", type: "logo", heightPct: 14, overlapPct: 50 }, layout),
    ).toBe(31);
  });

  it("follows the height rather than the type", () => {
    // 40% of 440 is 176, and a quarter of that is 44.
    expect(
      overlapOf({ id: "l", type: "logo", heightPct: 40, overlapPct: 25 }, layout),
    ).toBe(44);
  });

  it("is nothing without both halves of the arithmetic", () => {
    // A block with no overlap, and one with no height to take a share of.
    expect(overlapOf({ id: "n", type: "name" }, layout)).toBe(0);
    expect(overlapOf({ id: "l", type: "logo", overlapPct: 50 }, layout)).toBe(0);
  });
});

describe("upwardLiftOf", () => {
  /*
   * How far a block is *actually* pulled up, which is `overlapOf` less the one
   * question it refuses to answer: is there anything there to be pulled over.
   *
   * Three files ask it — `blockEdges`, the embed's `wrapBlock`, and the drop
   * geometry's `measuredRows` — and while each asked it for itself they drifted:
   * the first two counted **blocks** and the third did not ask at all. Counting
   * blocks is what made a logo's overlap a fact about its *neighbours*, so
   * moving the block beside it moved the logo.
   */
  const layout = defaultCardLayout();
  const logo: CardBlock = {
    id: "l",
    type: "logo",
    heightPct: 14,
    overlapPct: 50,
  };

  it("is the whole overlap once a line is above it", () => {
    expect(upwardLiftOf(logo, layout, true)).toBe(31);
    expect(upwardLiftOf(logo, layout, true)).toBe(overlapOf(logo, layout));
  });

  it("is nothing on a zone's first line, whoever else is on it", () => {
    /*
     * The reported bug. `[address][logo]` opening the middle zone makes the logo
     * the zone's *second block* and its line's second member — and the line is
     * still the first there is, so nothing is above it. Pulling it up anyway
     * takes it out through the top of the zone, which the middle zone clips and
     * the top zone answers by fighting its own padding cancel.
     */
    expect(upwardLiftOf(logo, layout, false)).toBe(0);
  });

  it("is nothing for a block pulled the other way", () => {
    // `overlapEdge: "below"` lifts the block *underneath* it and moves nothing
    // about its own position, so it is not a lift however the lines fall.
    expect(upwardLiftOf({ ...logo, overlapEdge: "below" }, layout, true)).toBe(0);
  });

  it("is nothing for a block that overlaps nothing", () => {
    expect(upwardLiftOf({ id: "n", type: "name" }, layout, true)).toBe(0);
  });
});

describe("vertical alignment", () => {
  const withBlocks = (blocks: unknown[]): CardLayout =>
    resolveCardLayout({
      ...defaultCardLayout(),
      zones: { top: [], middle: blocks, bottom: [] },
    });

  it("is kept on a block that shares its line", () => {
    const block = withBlocks([
      { id: "a", type: "name", widthPct: 50, valign: "center" },
    ]).zones.middle[0];

    expect(block.valign).toBe("center");
  });

  it("is dropped from a block that owns its line outright", () => {
    /*
     * Read under the width, alongside `newLine` and `side` and for the same
     * reason: a full-width block *is* its line — exactly as tall as itself — so
     * there is nothing for this to move, and a stale value cannot survive
     * someone widening a block back out to reappear weeks later.
     */
    const block = withBlocks([{ id: "a", type: "name", valign: "center" }])
      .zones.middle[0];

    expect(block.valign).toBeUndefined();
  });

  it("becomes an align-self, which on a row is the vertical axis", () => {
    const layout = withBlocks([
      { id: "a", type: "name", widthPct: 50, valign: "center" },
      { id: "b", type: "address", widthPct: 50, valign: "end" },
    ]);

    expect(blockBox(layout.zones.middle[0], layout).alignSelf).toBe("center");
    expect(blockBox(layout.zones.middle[1], layout).alignSelf).toBe("flex-end");
  });

  it("stretches when nobody has said otherwise", () => {
    // Absent is the flex default, which is what every card drew before this
    // field existed — so no card already published moves a pixel.
    const layout = withBlocks([{ id: "a", type: "name", widthPct: 50 }]);

    expect(blockBox(layout.zones.middle[0], layout).alignSelf).toBeUndefined();
  });

  it("is offered by exactly the blocks that can be narrowed", () => {
    /*
     * Not a coincidence in the table but a rule about it: narrowing is what
     * makes a line something to sit on, so the types that can share a line are
     * the types with somewhere to be vertically aligned.
     */
    for (const type of Object.keys(CARD_BLOCKS) as CardBlockType[]) {
      expect(hasControl(type, "valign")).toBe(hasControl(type, "width"));
    }
  });
});

describe("a self-sized mark on a line", () => {
  /*
   * The one block whose box is a size of its own rather than a share of the
   * line, and the arithmetic that lets it take part in the same line-packing
   * everything else does.
   *
   * The card is `defaultCardLayout()`: 320px wide with 12px of padding, so a
   * line is 296px across, and 440px tall with an 8px gap. A logo at its default
   * 14% is therefore 62px, and reserves `ceil(100 * (62 + 8) / 296)` = 24% of
   * its line — its own square plus the one column gap it costs.
   */
  const layout = defaultCardLayout();
  const logo = (heightPct = 14): CardBlock => ({
    id: "logo",
    type: "logo",
    heightPct,
  });
  const column = (
    id: string,
    type: CardBlockType,
    widthPct: number,
  ): CardBlock => ({ id, type, widthPct });

  const idsOf = (blocks: readonly CardBlock[]) =>
    cardRows(blocks, layout).map((row) => row.blocks.map((block) => block.id));

  it("reserves its own square plus a gap, as a share of the line", () => {
    expect(selfShareOf(logo(), layout)).toBe(24);
    // And it grows with the mark: 40% of 440 is 176px, which is 63% of a 296px
    // line once the gap is counted.
    expect(selfShareOf(logo(40), layout)).toBe(63);
  });

  it("keeps a line to itself when nothing is beside it", () => {
    /*
     * The neutrality proof, and the reason this can ship without touching a card
     * anybody has already published: a lone logo is still an *unshared* row, so
     * it stays a direct child of the zone's flex column with the `align-self` it
     * has always had.
     */
    const rows = cardRows([logo()], layout);

    expect(rows).toHaveLength(1);
    expect(rows[0].shared).toBe(false);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["logo"]);
  });

  it("shares its line with a block narrow enough to fit beside it", () => {
    const rows = cardRows([logo(), column("name", "name", 70)], layout);

    expect(rows).toHaveLength(1);
    expect(rows[0].shared).toBe(true);
    expect(rows[0].blocks.map((block) => block.id)).toEqual(["logo", "name"]);
    expect([rows[0].index, rows[0].end]).toEqual([0, 2]);
  });

  it("holds a column on each side of it — the whole point of the mark", () => {
    // 38 + 24 + 38 is exactly 100, which is one line: a name, the logo and an
    // address, which is the layout a logo straddling a photo exists for.
    expect(
      idsOf([
        column("name", "name", 38),
        logo(),
        column("address", "address", 38),
      ]),
    ).toEqual([["name", "logo", "address"]]);
  });

  it("does not hold two columns that do not fit around it", () => {
    // 50 + 24 leaves 26 and the second column wants 50. The line takes what fits
    // and the rest starts its own, exactly as two ordinary columns do.
    expect(
      idsOf([
        column("name", "name", 50),
        logo(),
        column("address", "address", 50),
      ]),
    ).toEqual([["name", "logo"], ["address"]]);
  });

  it("still refuses three columns of text", () => {
    /*
     * The cap counts *share-bearing* blocks, and a mark is not one. Three 30%
     * columns fit inside 100 by arithmetic alone, and are still a pair and a
     * single — three columns of words in a 296px line is three ellipses.
     */
    expect(
      idsOf([
        column("name", "name", 30),
        column("address", "address", 30),
        column("category", "category", 30),
      ]),
    ).toEqual([["name", "address"], ["category"]]);
  });

  it("holds at most one mark to a line", () => {
    // Two logos cannot happen — `acceptsBlock` allows one per card — but the
    // capacity rule says so on its own rather than leaning on that.
    expect(lineTakes([logo()], { ...logo(), id: "logo2" }, layout)).toBe(false);
  });

  it("lets a mark be pulled out of its line, and remembers it", () => {
    /*
     * `newLine` is read on a mark as well as on a narrowed block, because a mark
     * has a line something else can be pulled onto beside it. Without it,
     * `preserveRows` could not record that a logo starts its own line, and the
     * block below would slide up next to it after an unrelated edit.
     */
    expect(
      idsOf([column("name", "name", 70), { ...logo(), newLine: true }]),
    ).toEqual([["name"], ["logo"]]);

    const stored = resolveCardLayout({
      ...defaultCardLayout(),
      zones: {
        top: [],
        middle: [{ id: "logo", type: "logo", newLine: true }],
        bottom: [],
      },
    });

    expect(stored.zones.middle[0].newLine).toBe(true);
  });

  it("is positioned by its own alignment, and by its line once it shares one", () => {
    /*
     * One property, two meanings, and the flag is which one applies. In the
     * zone's flex *column* `align-self` is horizontal, so it is what `align`
     * means; in a flex *row* the same property is vertical, so emitting it there
     * would quietly turn "align right" into "align bottom".
     */
    const mark: CardBlock = { ...logo(), align: "center" };

    expect(blockBox(mark, layout).alignSelf).toBe("center");
    expect(blockBox(mark, layout, true).alignSelf).toBeUndefined();

    // Its square is its square either way — that is what self-sized means.
    expect(blockBox(mark, layout, true).width).toBe("62px");
    expect(blockBox(mark, layout, true).height).toBe("62px");
  });

  it("hands its leading space to the line, shared or not", () => {
    // A `margin-top` on a flex-row child pushes that one block down *within* the
    // row rather than moving the row, so the line would come apart. The line's
    // own lead box takes it instead — see `leadBox`.
    const mark: CardBlock = { ...logo(), offset: 20 };

    expect(Object.keys(blockBox(mark, layout))).not.toContain("marginTop");
    expect(Object.keys(blockBox(mark, layout, true))).not.toContain("marginTop");
  });

  it("names the logo, and only the logo", () => {
    for (const type of Object.keys(CARD_BLOCKS) as CardBlockType[]) {
      expect(isSelfSized(type)).toBe(type === "logo");
    }
  });
});

describe("the type controls", () => {
  const withBlock = (block: unknown): CardBlock =>
    resolveCardLayout({
      ...defaultCardLayout(),
      zones: { top: [], middle: [block], bottom: [] },
    }).zones.middle[0];

  it("is offered by exactly the blocks made of words", () => {
    /*
     * Not a coincidence in the table but a rule about it, in the shape the
     * valign/width correspondence above already takes: a photo, a mark, a rule
     * and a gap have no words, so a font picker on any of them would be a
     * control that does nothing — which is the one thing CARD_BLOCKS forbids.
     */
    const wordy = (Object.keys(CARD_BLOCKS) as CardBlockType[]).filter((type) =>
      hasControl(type, "text"),
    );

    expect(wordy).toEqual([
      "name",
      "category",
      "tags",
      "address",
      "description",
      "hours",
      "details",
      "actions",
      "button",
    ]);
  });

  it("keeps a font from the catalogue and refuses anything else", () => {
    // The refusal is the security half: this string is written into a
    // font-family inline on a stranger's page. See packages/shared/card-fonts.
    expect(
      withBlock({ id: "a", type: "name", font: CARD_FONTS[1].stack }).font,
    ).toBe(CARD_FONTS[1].stack);
    expect(
      withBlock({ id: "a", type: "name", font: "Comic Sans MS, cursive" }).font,
    ).toBeUndefined();
  });

  it("clamps a size and drops one that was never set", () => {
    expect(withBlock({ id: "a", type: "name", fontSize: 400 }).fontSize).toBe(
      MAX_BLOCK_FONT_SIZE,
    );
    expect(withBlock({ id: "a", type: "name", fontSize: 1 }).fontSize).toBe(
      MIN_BLOCK_FONT_SIZE,
    );
    expect(withBlock({ id: "a", type: "name" }).fontSize).toBeUndefined();
  });

  it("reads a colour the way every other hex in this file is read", () => {
    expect(withBlock({ id: "a", type: "name", color: "#ABC" }).color).toBe(
      "#abc",
    );
    expect(
      withBlock({ id: "a", type: "name", color: "red" }).color,
    ).toBeUndefined();
  });

  it("stores bold only when it is true", () => {
    // Not bold is the absence, so there is one way to say it and neither
    // renderer has to treat false and missing as the same thing.
    expect(withBlock({ id: "a", type: "name", bold: true }).bold).toBe(true);
    expect(
      withBlock({ id: "a", type: "name", bold: false }).bold,
    ).toBeUndefined();
  });

  it("drops every one of them on a block that has no words", () => {
    const block = withBlock({
      id: "a",
      type: "spacer",
      font: CARD_FONTS[0].stack,
      fontSize: 20,
      color: "#123456",
      bold: true,
    });

    expect(block.font).toBeUndefined();
    expect(block.fontSize).toBeUndefined();
    expect(block.color).toBeUndefined();
    expect(block.bold).toBeUndefined();
  });

  it("emits nothing at all for a block nobody has styled", () => {
    // The whole reason this could be added to a live model: an untouched block
    // produces the box it produced before the fields existed, so no renderer
    // writes a single custom property for it.
    const box = blockBox({ id: "a", type: "name" }, defaultCardLayout());

    expect(box.text).toBeUndefined();
    expect(box.lines).toBeUndefined();
    expect(box.rowGap).toBeUndefined();
  });

  it("hands each renderer the same four CSS values", () => {
    const box = blockBox(
      {
        id: "a",
        type: "name",
        font: CARD_FONTS[1].stack,
        fontSize: 18,
        color: "#112233",
        bold: true,
      },
      defaultCardLayout(),
    );

    expect(box.text).toEqual({
      font: CARD_FONTS[1].stack,
      size: "18px",
      color: "#112233",
      // A number rather than the word, because a custom property holding
      // "bold" is one no arithmetic can ever be done on.
      weight: "700",
    });
  });
});

describe("the opening-hours controls", () => {
  const withHours = (block: unknown): CardBlock =>
    resolveCardLayout({
      ...defaultCardLayout(),
      zones: { top: [], middle: [block], bottom: [] },
    }).zones.middle[0];

  it("treats a collapsed week as the absence, because that is what is published", () => {
    /*
     * The embed has always drawn this as a closed <details>, and the embed is
     * what a customer publishes. If absence meant "open", every card already
     * live on a customer's site would unfold its hours the day this shipped.
     */
    expect(withHours({ id: "h", type: "hours" }).hoursOpen).toBeUndefined();
    expect(
      withHours({ id: "h", type: "hours", hoursOpen: true }).hoursOpen,
    ).toBe(true);
  });

  it("keeps long day names only when they were asked for", () => {
    expect(withHours({ id: "h", type: "hours" }).hoursLongDays).toBeUndefined();
    expect(
      withHours({ id: "h", type: "hours", hoursLongDays: true }).hoursLongDays,
    ).toBe(true);
  });

  it("drops a row gap that is back at the default", () => {
    // Back at the default is back to inheriting it, on the same argument full
    // width is the absence of a width.
    expect(
      withHours({ id: "h", type: "hours", hoursRowGap: DEFAULT_HOURS_ROW_GAP })
        .hoursRowGap,
    ).toBeUndefined();
    expect(
      withHours({ id: "h", type: "hours", hoursRowGap: 99 }).hoursRowGap,
    ).toBe(MAX_HOURS_ROW_GAP);
    expect(
      blockBox(
        withHours({ id: "h", type: "hours", hoursRowGap: 6 }),
        defaultCardLayout(),
      ).rowGap,
    ).toBe("6px");
  });

  it("drops all three on a block that is not a week", () => {
    const block = withHours({
      id: "a",
      type: "description",
      hoursOpen: true,
      hoursLongDays: true,
      hoursRowGap: 8,
    });

    expect(block.hoursOpen).toBeUndefined();
    expect(block.hoursLongDays).toBeUndefined();
    expect(block.hoursRowGap).toBeUndefined();
  });
});

describe("the description clamp", () => {
  const withDescription = (block: unknown): CardBlock =>
    resolveCardLayout({
      ...defaultCardLayout(),
      zones: { top: [], middle: [block], bottom: [] },
    }).zones.middle[0];

  it("shows the whole paragraph when nobody has said otherwise", () => {
    // Which is what both renderers have always done, so the control reads as
    // "show the whole description", ticked.
    expect(
      withDescription({ id: "d", type: "description" }).clampLines,
    ).toBeUndefined();
  });

  it("clamps a stored count into the range a card can hold", () => {
    expect(
      withDescription({ id: "d", type: "description", clampLines: 40 })
        .clampLines,
    ).toBe(MAX_CLAMP_LINES);
    expect(
      withDescription({ id: "d", type: "description", clampLines: 3 })
        .clampLines,
    ).toBe(3);
    expect(
      blockBox(
        withDescription({ id: "d", type: "description", clampLines: 3 }),
        defaultCardLayout(),
      ).lines,
    ).toBe("3");
  });

  it("is offered by the description and nothing else", () => {
    const clamped = (Object.keys(CARD_BLOCKS) as CardBlockType[]).filter(
      (type) => hasControl(type, "clamp"),
    );

    expect(clamped).toEqual(["description"]);
    expect(
      withDescription({ id: "a", type: "address", clampLines: 2 }).clampLines,
    ).toBeUndefined();
  });
});

/**
 * The button controls: what a call to action is drawn on, and how it is shaped.
 *
 * Held here for the chip controls' reason — `CardButton` in the dashboard and
 * `buildButton` in the embed both read `buttonStyleOf` and neither has tests of
 * its own, so this is the only thing standing between a mistake and a wrong
 * button on a customer's site. Where the button *points* is `card-button.ts`'s
 * own file, and has its own test beside it.
 */
describe("the button controls", () => {
  it("are offered by the button block and no other", () => {
    expect(hasControl("button", "button")).toBe(true);
    expect(hasControl("button", "buttonStyle")).toBe(true);

    for (const type of ["name", "actions", "tags", "divider"] as const) {
      expect(hasControl(type, "button")).toBe(false);
      expect(hasControl(type, "buttonStyle")).toBe(false);
    }
  });

  it("say nothing at all when the owner has not styled it", () => {
    // The same §7 promise the chips carry: a Button nobody has touched writes
    // nothing, and the stylesheet's own fallbacks stay in charge of every edge
    // of it — which is what keeps an unstyled button theme-aware where a stored
    // `#ffffff` could not be.
    expect(buttonStyleOf({ id: "a", type: "button" })).toBeUndefined();
  });

  it("carry the ground, the room and the corner as CSS values", () => {
    const style = buttonStyleOf({
      id: "a",
      type: "button",
      buttonBackground: "#1c7ed6",
      buttonPadding: 6,
      buttonRadius: 12,
      buttonFull: true,
    });

    expect(style?.background).toBe("#1c7ed6");
    expect(style?.padding).toBe("6px");
    expect(style?.radius).toBe("12px");
    expect(style?.full).toBe(true);
  });

  /*
   * The corner is the one number on this block where zero is a value.
   *
   * Absent draws the stylesheet's own `0.5rem`, so square has nowhere else to be
   * written down — and it was dropped in three separate places as "not set",
   * which made the Corners control unable to say the one thing it exists for.
   * Both halves are asserted, because the bug is only visible as the pair: a
   * stored zero that survives, and an absent one that still says nothing.
   */
  it("tell a square corner from no corner at all", () => {
    expect(
      buttonStyleOf({ id: "a", type: "button", buttonRadius: 0 })?.radius,
    ).toBe("0px");
    expect(buttonStyleOf({ id: "a", type: "button" })?.radius).toBeUndefined();
  });

  it("keep a square corner through a round trip", () => {
    const layout = resolveCardLayout({
      v: 1,
      zones: { middle: [{ id: "a", type: "button", buttonRadius: 0 }] },
    });

    expect(findBlock(layout, "a")?.block.buttonRadius).toBe(0);
  });

  /*
   * The treatment and the hover reach a renderer as **class names**, and the
   * embed draws a published snapshot without ever re-running this parse — so a
   * word that survived unchecked would be a class chosen by whatever wrote the
   * file. `buildButton` looks both up in a table for that reason; this is the
   * other half of the guarantee.
   */
  it("keep only the treatments and hovers they know", () => {
    const layout = resolveCardLayout({
      v: 1,
      zones: {
        middle: [
          {
            id: "a",
            type: "button",
            buttonVariant: "outline",
            buttonHover: "lift",
          },
          {
            id: "b",
            type: "button",
            buttonVariant: "card-button--x",
            buttonHover: "explode",
          },
        ],
      },
    });

    expect(findBlock(layout, "a")?.block.buttonVariant).toBe("outline");
    expect(findBlock(layout, "a")?.block.buttonHover).toBe("lift");
    expect(findBlock(layout, "b")?.block.buttonVariant).toBeUndefined();
    expect(findBlock(layout, "b")?.block.buttonHover).toBeUndefined();
  });

  it("carry the outline as a colour and a width together", () => {
    const style = buttonStyleOf({
      id: "a",
      type: "button",
      buttonBorder: "#c8ced6",
      buttonBorderWidth: 2,
    });

    expect(style?.border).toBe("#c8ced6");
    expect(style?.borderWidth).toBe("2px");
  });

  /*
   * A chip's outline is indivisible and a button's is not, which is the one
   * place these two deliberately part company.
   *
   * A chip has nothing under its edge to fall back to, so a width with no colour
   * there would be a black line nobody picked. Both stylesheets give a button
   * `currentColor` instead — its own label colour, which the owner picked and
   * which follows the theme — so the width carries the outline on its own. What
   * it bought is a Border width control that writes *only* a width; the version
   * that enforced the pair did it by stamping a hard-coded blue into a colour
   * field nobody had opened.
   */
  it("carry an outline that is a width and no colour", () => {
    const style = buttonStyleOf({
      id: "a",
      type: "button",
      buttonBorderWidth: 2,
    });

    expect(style?.borderWidth).toBe("2px");
    expect(style?.border).toBeUndefined();
  });

  it("say nothing about a colour with no width behind it", () => {
    // Still nothing: a colour alone genuinely does draw nothing, since the width
    // both stylesheets fall back to is zero.
    expect(
      buttonStyleOf({ id: "a", type: "button", buttonBorder: "#c8ced6" })
        ?.border,
    ).toBeUndefined();
  });

  it("survive a round trip on a button block", () => {
    const stored = {
      zones: {
        bottom: [
          {
            id: "a",
            type: "button",
            buttonAction: "link",
            buttonSource: "booking",
            buttonLabel: "Book a fitting",
            buttonBackground: "#1c7ed6",
            buttonRadius: 12,
            buttonFull: true,
          },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.buttonAction).toBe("link");
    expect(block.buttonSource).toBe("booking");
    expect(block.buttonLabel).toBe("Book a fitting");
    expect(block.buttonBackground).toBe("#1c7ed6");
    expect(block.buttonRadius).toBe(12);
    expect(block.buttonFull).toBe(true);
  });

  it("are dropped from a block whose type does not offer them", () => {
    // The per-control gate, which is what keeps the properties panel and the
    // edit path from ever disagreeing about which controls a block has.
    const stored = {
      zones: {
        middle: [
          {
            id: "a",
            type: "description",
            buttonAction: "link",
            buttonLabel: "Press me",
            buttonRadius: 12,
            buttonFull: true,
          },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.middle[0];

    expect(block.buttonAction).toBeUndefined();
    expect(block.buttonLabel).toBeUndefined();
    expect(block.buttonRadius).toBeUndefined();
    expect(block.buttonFull).toBeUndefined();
  });

  it("clamp a corner, a roominess and an outline past the ceiling", () => {
    const stored = {
      zones: {
        bottom: [
          {
            id: "a",
            type: "button",
            buttonRadius: 999,
            buttonPadding: 999,
            buttonBorder: "#c8ced6",
            buttonBorderWidth: 99,
          },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.buttonRadius).toBe(MAX_BUTTON_RADIUS);
    expect(block.buttonPadding).toBe(MAX_BUTTON_PADDING);
    expect(block.buttonBorderWidth).toBe(MAX_BUTTON_BORDER_WIDTH);
  });

  /*
   * Zero means "not set" for the room and the outline, and **not** for the
   * corner.
   *
   * The asymmetry is the point rather than an oversight. Zero extra room and a
   * zero-width border are exactly what the stylesheet already draws, so storing
   * them would be a longer way of saying nothing. A zero *radius* is not: absent
   * draws `0.5rem`, so square is a real choice, and it is asserted just above in
   * "tell a square corner from no corner at all".
   */
  it("read zero as the absence of a border and extra room", () => {
    const stored = {
      zones: {
        bottom: [
          {
            id: "a",
            type: "button",
            buttonPadding: 0,
            buttonBorder: "#c8ced6",
            buttonBorderWidth: 0,
          },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.buttonPadding).toBeUndefined();
    // The colour goes with it: a zero-width outline is not an outline, and a
    // colour left behind would draw one the moment anything read a default.
    expect(block.buttonBorderWidth).toBeUndefined();
    expect(block.buttonBorder).toBeUndefined();
  });

  it("give a stored outline colour the default width when it has none", () => {
    const stored = {
      zones: { bottom: [{ id: "a", type: "button", buttonBorder: "#c8ced6" }] },
    };

    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.buttonBorder).toBe("#c8ced6");
    expect(block.buttonBorderWidth).toBe(DEFAULT_BUTTON_BORDER_WIDTH);
  });

  it("keep a stored width that has no colour with it", () => {
    // Where a chip's would be dropped. The button's outline falls back to its
    // own label colour, so this is a whole answer rather than half of one — see
    // `CardBlock.buttonBorder`.
    const stored = {
      zones: { bottom: [{ id: "a", type: "button", buttonBorderWidth: 3 }] },
    };

    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.buttonBorderWidth).toBe(3);
    expect(block.buttonBorder).toBeUndefined();
  });

  it("refuse a ground that is not a hex colour", () => {
    const stored = {
      zones: { bottom: [{ id: "a", type: "button", buttonBackground: "red" }] },
    };

    expect(
      resolveCardLayout(stored).zones.bottom[0].buttonBackground,
    ).toBeUndefined();
  });

  /*
   * Directions is the absence, and this is the assertion that pins it: a Button
   * dropped on the card has to work before it is configured, and every location
   * has coordinates while not every one has a URL. It follows that a stored
   * `"directions"` is a longer way of saying nothing and is not kept — the same
   * treatment `hidePhone: false` gets below.
   */
  it("keep only the action that is not the default, and its source with it", () => {
    const stored = {
      zones: {
        bottom: [
          { id: "a", type: "button", buttonAction: "directions" },
          {
            id: "b",
            type: "button",
            buttonAction: "directions",
            buttonSource: "booking",
          },
        ],
      },
    };

    const [plain, sourced] = resolveCardLayout(stored).zones.bottom;

    expect(plain.buttonAction).toBeUndefined();
    // A source is only an answer to link mode's question, so it does not travel
    // on a block that is not asking it.
    expect(sourced.buttonSource).toBeUndefined();
  });

  it("can be dropped more than once, and never above the name", () => {
    // Directions and "Book now" are two buttons, not one with two jobs — which
    // is why this is the second block after the divider that is not unique.
    expect(CARD_BLOCKS.button.unique).toBe(false);
    // Same argument the Links row's `zones: ["bottom"]` carries: a card that
    // puts its call to action above the name has buried the answer.
    expect(CARD_BLOCKS.button.zones).toEqual(["middle", "bottom"]);
  });
});

/**
 * The Links checkboxes: which ways to reach a place the row leaves out.
 *
 * Spelled as the hidden state so that absent means shown, which is what let them
 * reach a live model: every card already on a customer's site draws all four and
 * says nothing about any of them (CLAUDE.md §7).
 */
describe("the links controls", () => {
  it("are offered by the links row and no other block", () => {
    expect(hasControl("actions", "links")).toBe(true);

    for (const type of ["button", "name", "tags", "address"] as const) {
      expect(hasControl(type, "links")).toBe(false);
    }
  });

  it("survive a round trip on the links row", () => {
    const stored = {
      zones: {
        bottom: [
          {
            id: "a",
            type: "actions",
            hidePhone: true,
            hideEmail: true,
            hideWebsite: true,
            hideDirections: true,
          },
        ],
      },
    };

    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.hidePhone).toBe(true);
    expect(block.hideEmail).toBe(true);
    expect(block.hideWebsite).toBe(true);
    expect(block.hideDirections).toBe(true);
  });

  it("say nothing about a row nobody has changed", () => {
    const stored = { zones: { bottom: [{ id: "a", type: "actions" }] } };
    const block = resolveCardLayout(stored).zones.bottom[0];

    expect(block.hidePhone).toBeUndefined();
    expect(block.hideDirections).toBeUndefined();
  });

  it("drop a stored false, which is a longer way of saying nothing", () => {
    const stored = {
      zones: { bottom: [{ id: "a", type: "actions", hidePhone: false }] },
    };

    expect(resolveCardLayout(stored).zones.bottom[0].hidePhone).toBeUndefined();
  });

  it("are dropped from a block that has no links to hide", () => {
    const stored = {
      zones: { middle: [{ id: "a", type: "name", hidePhone: true }] },
    };

    expect(resolveCardLayout(stored).zones.middle[0].hidePhone).toBeUndefined();
  });
});
