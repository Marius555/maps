import { describe, expect, it } from "vitest";

import { cardFlipsTheme } from "./card-ground";

/**
 * The rule these hold: a ground the owner pinned decides the card's light/dark,
 * and the basemap decides when nothing was pinned.
 *
 * `cardFlipsTheme` answers the *comparison* rather than the colour — true means
 * "this card wants the opposite palette to the map under it" — so each case
 * below names the map and the ground, and asserts whether they disagree.
 *
 * The last group is the one that matters most: it is the §0 guarantee that a
 * card which never touched the Background control renders exactly as it did.
 */
describe("cardFlipsTheme", () => {
  describe("nothing pinned", () => {
    it("never flips, so the basemap keeps the answer", () => {
      expect(cardFlipsTheme({}, true)).toBe(false);
      expect(cardFlipsTheme({}, false)).toBe(false);
    });

    it("never flips for an opacity with no colour behind it", () => {
      expect(cardFlipsTheme({ backgroundOpacity: 60 }, true)).toBe(false);
    });

    it("never flips for a notation parseColor does not read", () => {
      // A named colour, a gradient, a custom property — all left to the basemap
      // rather than guessed at.
      expect(cardFlipsTheme({ background: "rebeccapurple" }, true)).toBe(false);
      expect(cardFlipsTheme({ background: "var(--surface)" }, true)).toBe(false);
    });
  });

  describe("an opaque pinned ground", () => {
    it("flips a light card off a dark map, and agrees on a light one", () => {
      expect(cardFlipsTheme({ background: "#ffffff" }, true)).toBe(true);
      expect(cardFlipsTheme({ background: "#ffffff" }, false)).toBe(false);
    });

    it("flips a dark card off a light map, and agrees on a dark one", () => {
      expect(cardFlipsTheme({ background: "#141414" }, false)).toBe(true);
      expect(cardFlipsTheme({ background: "#141414" }, true)).toBe(false);
    });

    it("reads rgb() and hsl() as well as hex", () => {
      expect(cardFlipsTheme({ background: "rgb(255, 255, 255)" }, true)).toBe(
        true,
      );
      expect(cardFlipsTheme({ background: "hsl(0, 0%, 4%)" }, false)).toBe(true);
    });
  });

  /**
   * The reported bug, and the reason the mix is done at all: white at 60% on a
   * dark map is still a *light* card and needs dark text. Measured on the real
   * design before the fix, the ground resolved to about #a3a3a3 and the address
   * to #989898 — the same colour.
   */
  describe("a translucent pinned ground", () => {
    it("still flips at 60% white over a dark map", () => {
      expect(
        cardFlipsTheme({ background: "#ffffff", backgroundOpacity: 60 }, true),
      ).toBe(true);
    });

    it("gives way to the map once the veil is thin enough", () => {
      expect(
        cardFlipsTheme({ background: "#ffffff", backgroundOpacity: 10 }, true),
      ).toBe(false);
      expect(
        cardFlipsTheme({ background: "#141414", backgroundOpacity: 10 }, false),
      ).toBe(false);
    });

    it("counts the colour's own alpha, not just backgroundOpacity", () => {
      // #ffffff1a is white at ~10% — as see-through as backgroundOpacity: 10.
      expect(cardFlipsTheme({ background: "#ffffff1a" }, true)).toBe(false);
    });

    it("treats an absent opacity as opaque", () => {
      expect(cardFlipsTheme({ background: "#ffffff" }, true)).toBe(
        cardFlipsTheme({ background: "#ffffff", backgroundOpacity: 100 }, true),
      );
    });
  });
});
