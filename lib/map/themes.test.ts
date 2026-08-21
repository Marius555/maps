import { describe, expect, it } from "vitest";

import { lightnessOf, parseColor } from "@/packages/shared/color";
import { applyBand } from "@/packages/shared/style-tint";
import { STYLE_PALETTES, THEME_KEYS, THEMES } from "./style";

/**
 * A theme is fifteen numbers, which makes it very easy to write one that renders
 * an unreadable map — labels the colour of the road under them, four fills that
 * collapse into one, a "light" theme that comes out charcoal. Nobody is going to
 * open sixteen maps by hand after touching a band, so the claims that make a
 * theme usable are asserted here instead.
 *
 * The inputs are Liberty's real colours, since Liberty is what every theme is
 * built from. The thresholds are the same ones darken-style.test.ts settled on
 * for the dark transform, which is the theme that shipped first and the one they
 * were tuned against.
 */

const LIBERTY = STYLE_PALETTES.liberty;

/** Liberty's road casing: the outline that separates a white road from pale land. */
const LIBERTY_CASING = "#cfcdca";

function lightness(color: string): number {
  const parsed = parseColor(color);
  if (!parsed) throw new Error(`not a colour: ${color}`);

  return lightnessOf(parsed);
}

describe.each(THEME_KEYS)("%s", (key) => {
  const { tint, isDark } = THEMES[key];

  const land = lightness(applyBand(LIBERTY.land, tint.ground));
  const water = lightness(applyBand(LIBERTY.water, tint.ground));
  const park = lightness(applyBand(LIBERTY.park, tint.ground));
  const road = lightness(applyBand(LIBERTY.road, tint.figure));
  const trunk = lightness(applyBand(LIBERTY.trunk, tint.figure));
  const label = lightness(applyBand(LIBERTY.label, tint.text));

  it("lands on the side of the scale it claims", () => {
    if (isDark) {
      expect(land).toBeLessThan(0.35);
    } else {
      expect(land).toBeGreaterThan(0.7);
    }
  });

  /**
   * The failure that made the first dark attempt unusable, and the one a light
   * theme hits from the other end: Liberty's fills all sit within 0.17 of each
   * other, so a band that only scales delivers land, water and parks as three
   * indistinguishable shades.
   */
  it("keeps land, water and parkland apart", () => {
    for (const feature of [water, park]) {
      expect(Math.abs(feature - land)).toBeGreaterThan(0.03);
    }
  });

  /**
   * A road network that reads as land is a map with no streets on it — but the
   * two sides of the scale carry that differently, and a single threshold gets
   * one of them wrong. On a dark map the road itself is the contrast: Liberty
   * draws minor streets pure white and they stay the lightest thing on the map.
   * On a light one the road is *already* near-white on near-white land, exactly
   * as Liberty ships it, and what separates them is the darker casing drawn
   * underneath.
   */
  it("holds the road network clear of the ground it crosses", () => {
    const casing = lightness(applyBand(LIBERTY_CASING, tint.figure));

    if (isDark) {
      expect(road - land).toBeGreaterThan(0.3);
      expect(trunk - land).toBeGreaterThan(0.3);
    } else {
      expect(road).toBeGreaterThanOrEqual(land);
      expect(land - casing).toBeGreaterThan(0.08);
    }
  });

  /**
   * The one that is easy to get wrong twice. A street name is drawn *on* the
   * white ribbon of the road, so the text band and the figure band have to pull
   * apart — moving the text towards its own background is what the dark
   * transform's floor was raised to 0.78 to stop.
   */
  it("keeps a label clear of the road it is drawn on", () => {
    expect(Math.abs(label - road)).toBeGreaterThan(0.15);
  });

  it("keeps a label clear of the land it is drawn on", () => {
    expect(Math.abs(label - land)).toBeGreaterThan(0.4);
  });

  /** Dark labels on a dark map, or light on light, is the stock style's bug. */
  it("puts labels on the opposite side of the scale from the ground", () => {
    if (isDark) {
      expect(label).toBeGreaterThan(0.7);
    } else {
      expect(label).toBeLessThan(0.35);
    }
  });

  it("gives labels a halo their own text cannot be lost in", () => {
    const halo = lightness(tint.halo);

    expect(Math.abs(label - halo)).toBeGreaterThan(0.4);
  });
});
