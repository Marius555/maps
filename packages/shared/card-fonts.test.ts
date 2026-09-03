import { describe, expect, it } from "vitest";

import { CARD_FONTS, cardFontOf, isCardFont } from "./card-fonts";

/**
 * The catalogue is a promise rather than a list, which is what these hold it to.
 *
 * What a card stores is the `stack` string, and the embed writes that straight
 * into a `font-family` on a stranger's website without re-resolving anything
 * (embed/src/map.ts). So a stack is a published value: edit one and every row
 * and every snapshot carrying it stops validating, and those cards silently
 * lose their font. Add entries; never rewrite one.
 */
describe("CARD_FONTS", () => {
  it("has no two entries claiming the same id or the same stack", () => {
    const ids = CARD_FONTS.map((font) => font.id);
    const stacks = CARD_FONTS.map((font) => font.stack);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(stacks).size).toBe(stacks.length);
  });

  it("ends every stack in a generic family", () => {
    /*
     * The whole reason there are no webfonts here (see the file's own note): a
     * card costs a visitor nothing to draw. That only holds if every stack
     * degrades to something the machine already has, so the worst case is a
     * face that is not the first choice rather than a card in the browser's
     * default serif.
     */
    for (const font of CARD_FONTS) {
      expect(font.stack).toMatch(/(sans-serif|serif|monospace)$/);
    }
  });

  it("names no font that has to be downloaded", () => {
    // `url()` in a font-family is not a thing CSS does, but a stack arriving
    // from a catalogue somebody edited badly could carry one — and this string
    // is written inline on a third party's page.
    for (const font of CARD_FONTS) {
      expect(font.stack).not.toMatch(/url\(|;|\{|\}/);
    }
  });
});

describe("isCardFont", () => {
  it("accepts every stack we publish", () => {
    for (const font of CARD_FONTS) expect(isCardFont(font.stack)).toBe(true);
  });

  it("refuses anything else, whatever shape it is in", () => {
    // A closed list rather than a character class, because this value ends up
    // in a `font-family` on a page we do not control.
    expect(isCardFont("Comic Sans MS, sans-serif")).toBe(false);
    expect(isCardFont("")).toBe(false);
    expect(isCardFont(undefined)).toBe(false);
    expect(isCardFont(12)).toBe(false);
    expect(isCardFont("serif; background: url(https://x/)")).toBe(false);
  });
});

describe("cardFontOf", () => {
  it("finds the entry a stored stack came from", () => {
    expect(cardFontOf(CARD_FONTS[1].stack)?.id).toBe(CARD_FONTS[1].id);
  });

  it("answers nothing for a block that has never been given a font", () => {
    expect(cardFontOf(undefined)).toBeUndefined();
    expect(cardFontOf("")).toBeUndefined();
  });
});
