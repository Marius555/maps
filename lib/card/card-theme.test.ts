import { describe, expect, it } from "vitest";

import { cardThemeClass } from "./card-theme";
import {
  CONCRETE_MAP_STYLES,
  isDarkMapStyle,
  resolveMapStyle,
} from "@/lib/map/style";

describe("cardThemeClass", () => {
  it("follows the viewer for Auto", () => {
    expect(cardThemeClass("auto", true)).toBe("dark");
    expect(cardThemeClass("auto", false)).toBe("light");
  });

  /**
   * The half that keeps the studio a preview of a customer's site: a pinned
   * basemap looks the same for everybody, so an owner in light mode still has to
   * see the dark card a Dark map really draws.
   */
  it("ignores the viewer for a pinned basemap", () => {
    for (const style of CONCRETE_MAP_STYLES) {
      const expected = isDarkMapStyle(resolveMapStyle(style)) ? "dark" : "light";

      expect(cardThemeClass(style, true)).toBe(expected);
      expect(cardThemeClass(style, false)).toBe(expected);
    }
  });

  /** The two basemaps that are dark, named rather than derived. */
  it("draws a dark card on Dark and Fiord", () => {
    expect(cardThemeClass("dark", false)).toBe("dark");
    expect(cardThemeClass("fiord", false)).toBe("dark");
    expect(cardThemeClass("liberty", true)).toBe("light");
  });

  /**
   * The reported bug: a white ground pinned on the card, the basemap switched to
   * Dark, and every word on the card drawn in the dark set — near-white text on
   * a card that is still white. The ground has the final say because the text
   * sits on it. `packages/shared/card-ground.test.ts` holds the rule itself;
   * these hold the wiring.
   */
  describe("a ground the owner pinned", () => {
    it("outranks a dark basemap", () => {
      expect(
        cardThemeClass("dark", false, {
          background: "#ffffff",
          backgroundOpacity: 60,
        }),
      ).toBe("light");
    });

    it("outranks a light basemap", () => {
      expect(cardThemeClass("liberty", false, { background: "#141414" })).toBe(
        "dark",
      );
    });

    it("outranks Auto, which the viewer would otherwise decide", () => {
      expect(cardThemeClass("auto", true, { background: "#ffffff" })).toBe(
        "light",
      );
    });
  });

  /**
   * §0: a card that never touched the Background control has to render exactly
   * as it did. Passing a layout with no ground must not change a single answer.
   */
  it("is unchanged by a layout with no pinned ground", () => {
    for (const style of CONCRETE_MAP_STYLES) {
      for (const prefersDark of [true, false]) {
        expect(cardThemeClass(style, prefersDark, {})).toBe(
          cardThemeClass(style, prefersDark),
        );
      }
    }

    expect(cardThemeClass("auto", true, {})).toBe(cardThemeClass("auto", true));
    expect(cardThemeClass("auto", false, {})).toBe(
      cardThemeClass("auto", false),
    );
  });
});
