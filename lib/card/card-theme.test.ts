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
});
