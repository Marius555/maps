import { describe, expect, it } from "vitest";

import {
  AUTO_STYLE,
  CONCRETE_MAP_STYLES,
  DEFAULT_MAP_STYLE,
  isAutoMapStyle,
  isDarkMapStyle,
  isMapStyleKey,
  MAP_STYLES,
  resolveMapStyle,
  resolveStyleUrl,
  shouldDarkenStyle,
  STYLE_LABELS,
  STYLE_URLS,
} from "./style";

describe("resolveMapStyle", () => {
  it("swaps Auto for the style it is built on", () => {
    expect(resolveMapStyle("auto")).toBe(AUTO_STYLE);
  });

  /**
   * The property that makes the editor honest: toggling the dashboard theme must
   * not quietly change what a customer chose to publish.
   */
  it("leaves a pinned basemap alone", () => {
    for (const style of CONCRETE_MAP_STYLES) {
      expect(resolveMapStyle(style)).toBe(style);
    }
  });

  it("always lands on a style that has a URL", () => {
    for (const style of MAP_STYLES) {
      expect(resolveStyleUrl(style)).toMatch(/^https:\/\//);
    }
  });
});

describe("shouldDarkenStyle", () => {
  it("inverts Auto only for a viewer in dark", () => {
    expect(shouldDarkenStyle("auto", true)).toBe(true);
    expect(shouldDarkenStyle("auto", false)).toBe(false);
  });

  /**
   * Including the already-dark ones. `dark` and `fiord` are dark because their
   * owner picked them, and inverting a dark style produces a light one — the
   * exact opposite of what the viewer's preference is asking for.
   */
  it("never inverts a pinned basemap, whatever the viewer prefers", () => {
    for (const style of CONCRETE_MAP_STYLES) {
      expect(shouldDarkenStyle(style, true)).toBe(false);
      expect(shouldDarkenStyle(style, false)).toBe(false);
    }
  });
});

describe("style tables", () => {
  /**
   * Auto is built by inverting a light style, so the style it names has to be a
   * light one. Pointing AUTO_STYLE at `dark` would leave dark mode showing a
   * washed-out light map.
   */
  it("builds Auto on a light style", () => {
    expect(isDarkMapStyle(AUTO_STYLE)).toBe(false);
  });

  it("labels every selectable style, including Auto", () => {
    for (const style of MAP_STYLES) {
      expect(STYLE_LABELS[style]).toBeTruthy();
    }
  });

  it("gives every concrete style a URL and no more", () => {
    expect(Object.keys(STYLE_URLS).sort()).toEqual([...CONCRETE_MAP_STYLES].sort());
  });

  it("defaults to Auto, so a new map follows whoever is looking", () => {
    expect(DEFAULT_MAP_STYLE).toBe("auto");
    expect(isAutoMapStyle(DEFAULT_MAP_STYLE)).toBe(true);
  });

  it("accepts every selectable style and rejects anything else", () => {
    for (const style of MAP_STYLES) expect(isMapStyleKey(style)).toBe(true);

    // What a hand-edited console row or an older build could leave behind.
    expect(isMapStyleKey("satellite")).toBe(false);
    expect(isMapStyleKey(undefined)).toBe(false);
  });
});
