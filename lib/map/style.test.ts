import { describe, expect, it } from "vitest";

import {
  ATTRIBUTION_HTML,
  ATTRIBUTION_TEXT,
  AUTO_STYLE,
  BASEMAP_SOURCES,
  CONCRETE_MAP_STYLES,
  DEFAULT_MAP_STYLE,
  isAutoMapStyle,
  isDarkMapStyle,
  isMapStyleKey,
  MAP_STYLES,
  resolveMapStyle,
  resolveStyleUrl,
  resolveTint,
  shouldDarkenStyle,
  STYLE_LABELS,
  STYLE_URLS,
  THEME_KEYS,
  TILE_CREDITS,
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

  /**
   * Only the *sources* have URLs. A theme is one of those documents recoloured
   * in the browser, which is what lets there be sixteen looks without a second
   * tile provider — so a URL per selectable style is exactly what must not be
   * true here.
   */
  it("gives every basemap source a URL and no more", () => {
    expect(Object.keys(STYLE_URLS).sort()).toEqual([...BASEMAP_SOURCES].sort());
  });

  /**
   * Absolute, always. These end up in a published snapshot that a stranger's
   * page fetches, where a relative URL would resolve against *their* domain —
   * the same rule `gazetteerBase` is held to.
   */
  it("gives every source an absolute https URL", () => {
    for (const source of BASEMAP_SOURCES) {
      expect(STYLE_URLS[source]).toMatch(/^https:\/\//);
      expect(STYLE_URLS[source]).toContain(source);
    }
  });

  it("resolves every theme to a source URL and a tint", () => {
    for (const style of THEME_KEYS) {
      expect(resolveStyleUrl(style)).toMatch(/^https:\/\//);
      expect(resolveTint(style)).not.toBeNull();
    }
  });

  /**
   * Auto has no tint of its own: whether it is darkened depends on who is
   * looking, and that is `shouldDarkenStyle`'s question. A tint here would mean
   * two answers to it.
   */
  it("gives Auto and the plain basemaps no tint", () => {
    expect(resolveTint("auto")).toBeNull();
    for (const style of BASEMAP_SOURCES) expect(resolveTint(style)).toBeNull();
  });

  /** Every key is stored in a varchar(32) — see scripts/appwrite-schema.mjs. */
  it("keeps every style key short enough for its column", () => {
    for (const style of MAP_STYLES) expect(style.length).toBeLessThanOrEqual(32);
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

  /*
   * Attribution is non-negotiable on every rendered map (§12), and it is written
   * twice: once as markup for the controls, once as plain text for the image
   * exporter, which paints onto a canvas and has no DOM to put a control in. Two
   * constants can drift; this is what stops them.
   *
   * Over every credit rather than the live one. Only one pair is selected by any
   * given environment, so a test that read `ATTRIBUTION_HTML` alone would leave
   * the self-hosted pair unchecked until the day it went live — which is the day
   * nobody wants to discover an empty credit.
   */
  it.each(TILE_CREDITS)("says the same thing in markup and in plain text", (credit) => {
    const stripped = credit.html.replace(/<[^>]+>/g, "");

    expect(stripped).toBe(credit.text);
    // OpenStreetMap is the one name that appears in every credit, whoever is
    // serving the tiles. §12 puts it beyond a product decision.
    expect(credit.text).toContain("OpenStreetMap");
    expect(credit.html).toContain("openstreetmap.org/copyright");
  });

  it("ships one of those credits, not something assembled elsewhere", () => {
    expect(TILE_CREDITS).toContainEqual({
      html: ATTRIBUTION_HTML,
      text: ATTRIBUTION_TEXT,
    });
  });
});
