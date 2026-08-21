import { applyBand, type StyleLike, type StyleTint, tintStyle } from "./style-tint";

/**
 * Turns a light MapLibre style into a dark one, in the browser, before the map
 * is built.
 *
 * Why this exists: OpenFreeMap's own `dark` style is not usable. It carries 47
 * layers against Liberty's 111 and **no POI layers at all**, so there are no
 * shop, hospital or transit markers to show. Its labels are worse — every place
 * layer from country down to suburb uses the identical `rgb(101,101,101)`, which
 * is both a flat hierarchy and about 3.4:1 against its own background, under the
 * 4.5:1 AA floor. Street labels sit near 2.4:1 and water labels are black at 70%
 * opacity on near-black.
 *
 * So instead of shipping a broken style we take the good one and invert it.
 * Liberty already encodes a careful hierarchy — cities darker and larger than
 * suburbs, minor roads lighter than major — and inverting *perceptual* lightness
 * preserves all of it while flipping the polarity. Every POI layer and icon
 * comes along unchanged.
 *
 * The sprite needs no special handling: OpenFreeMap's POI icons are light
 * pastels (sampled: hospital rgb(227,202,199), bus rgb(127,183,255)), so they
 * read well on dark as-is. Which is fortunate, because none of the 264 icons are
 * SDF and `icon-color` therefore cannot touch them.
 *
 * Lives in /packages/shared because both build targets have to run *the same*
 * transform, not two that agree today. The preview panel renders the real embed
 * bundle next to the editor's own canvas, on one screen — any drift between them
 * shows up as two differently-coloured dark maps side by side.
 *
 * That is the reason to share it rather than copy it. What makes sharing legal
 * under §4 is that it is dependency-free: no React, no HeroUI, no MapLibre
 * import. eslint.config.mjs holds this whole directory to the embed's import
 * list so it stays that way.
 *
 * The walker itself now lives in ./style-tint.ts, because this transform turned
 * out to be the general one: every theme in lib/map/style.ts is the same walk
 * with different numbers. What is left here is Auto's own set of them, and the
 * name the rest of the codebase already calls it by.
 */

/*
 * Ground, figure and text are transformed differently, because "invert the
 * lightness" is only right for one of the three. Measured off the live Liberty
 * style:
 *
 *   ground (fills)   L 0.800 … 0.969   water … background
 *   figure (lines)   L 0.517 … 1.000   boundaries … white minor roads
 *   text             L 0.000 … 0.734   #000 cities … pale waterway names
 *
 * Roads are the *lightest* thing on a light map, and they must stay the
 * lightest thing on a dark one — inverting them turns motorways into dark
 * ribbons. Ground is the opposite: it has to flip. Text flips too, because
 * dark-on-light and light-on-dark both mean "important".
 */
export const MIDNIGHT_TINT: StyleTint = {
  /**
   * Ground: inverted into a dark band.
   *
   * The exponent is the part that matters. Every fill in Liberty sits in the top
   * 17% of the lightness scale, so a straight inversion maps them all into a
   * 0.05-wide sliver — land, water, parks and buildings arriving as four
   * indistinguishable near-blacks. A square root spreads that sliver back out
   * before it is scaled down.
   *
   * The chroma is damped because a dark map at full chroma looks radioactive.
   */
  ground: { floor: 0.15, range: 0.3, exponent: 0.5, chroma: 0.55, invert: true },

  /**
   * Figure: lines, road casings, boundaries. Order preserved, lifted clear of
   * the ground. The floor is what guarantees a line stays visible even if a
   * style draws a dark one on light land, which Liberty does not but a future
   * basemap might. Figures keep most of their chroma — an orange motorway is
   * doing real work.
   */
  figure: { floor: 0.22, range: 0.45, chroma: 0.8, invert: false },

  /**
   * Text: inverted into a bright band. The floor is what buys back the contrast.
   *
   * The band used to start at 0.66, which reads fine over land and fails over
   * the one thing labels are most often drawn on top of. Liberty's street names
   * are `#666` and its minor roads are `#fff`: the figure transform lifts the
   * road to L 0.67 and the old text transform put the name at L 0.827, so the
   * name and the ribbon under it were two greys about 1.4:1 apart. Starting at
   * 0.78 keeps the whole hierarchy in the top fifth of the scale, near enough
   * white that no label can land inside a road's band — see the halo for the
   * other half.
   */
  text: { floor: 0.78, range: 0.22, chroma: 0.7, invert: true },

  halo: "rgba(8, 8, 10, 0.85)",

  /**
   * The halo width given to a label that has none.
   *
   * Only used where the style left `text-halo-width` out entirely, in which case
   * MapLibre's default is 0 and setting a halo colour would change nothing.
   */
  haloWidth: 1,

  /** Low-zoom shaded relief is a bright raster; at full strength it fights the map. */
  rasterOpacity: 0.14,

  /**
   * Labels drawn at partial alpha on a light map vanish on a dark one — the
   * stock style's 70%-opacity water labels are exactly that mistake.
   */
  textMinAlpha: 0.9,
};

export function darkenStyle<T extends StyleLike>(style: T): T {
  return tintStyle(style, MIDNIGHT_TINT);
}

/**
 * Ground. Liberty's land lands near 0.21, its buildings and parks near 0.25 and
 * its water near 0.28 — a dark map with its features still told apart, rather
 * than the four near-blacks a straight inversion produced.
 *
 * Exported so the theme gallery can paint Auto's dark half with the same maths
 * the map uses (components/appearance/theme-swatch.tsx). A swatch that computed
 * its own idea of "darker" would eventually disagree with the tiles it stands
 * for, which is the failure STYLE_SWATCHES exists to prevent.
 */
export function darkenSurfaceColor(input: string): string {
  return applyBand(input, MIDNIGHT_TINT.ground);
}
