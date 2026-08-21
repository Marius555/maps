import {
  formatRgba,
  lightnessOf,
  parseColor,
  type Rgba,
  withHue,
  withLightness,
} from "./color";

/**
 * Recolours a MapLibre style, in the browser, before the map is built.
 *
 * This is the engine that ./darken-style.ts used to be. It was written for one
 * job — turn Liberty into a readable dark map — and it turned out that job is
 * the general one: every theme this product offers is the same walk over every
 * layer's `paint`, with different numbers.
 *
 * Why recolour at all, instead of shipping more style documents? Because
 * OpenFreeMap publishes five, and a sixth would mean a second tile origin: a new
 * CORS surface, a new uptime dependency and, for anything commercial, a new bill
 * in the visitor's path (CLAUDE.md §2). A tint is ~15 numbers and costs nothing.
 *
 * Lives in /packages/shared because both build targets have to run *the same*
 * transform, not two that agree today — the preview panel renders the real embed
 * bundle next to the editor's own canvas, on one screen, so any drift shows up
 * as two differently-coloured maps side by side. What makes that legal under §4
 * is that this file is dependency-free: no React, no MapLibre import, nothing
 * but ./color.
 */

/*
 * Ground, figure and text are transformed separately, because no single rule is
 * right for all three. Measured off the live Liberty style:
 *
 *   ground (fills)   L 0.800 … 0.969   water … background
 *   figure (lines)   L 0.517 … 1.000   boundaries … white minor roads
 *   text             L 0.000 … 0.734   #000 cities … pale waterway names
 *
 * Two things follow. Roads are the *lightest* thing on a light map and must stay
 * the lightest thing on a dark one, so figure rarely inverts while ground
 * usually does. And every one of those three ranges is narrow — ground spans
 * 0.17 of the scale — so a band that only scales will collapse land, water,
 * parks and buildings into indistinguishable neighbours. `exponent` is what
 * stops that.
 */

/**
 * One band: where a group of colours lands, and how the source spread is
 * redistributed on the way.
 *
 *   t  = invert ? 1 - L : L        // normalise, optionally flipping polarity
 *   t  = t ** exponent             // redistribute
 *   L' = floor + t * range
 *
 * `exponent` is the part worth understanding. Liberty's fills all sit in the top
 * 17% of the lightness scale, so `1 - L` lands them in a 0.17-wide sliver near
 * zero and any straight scaling of that produces four near-identical shades. An
 * exponent below 1 spreads values near zero apart; above 1 spreads values near
 * one apart, which is what a *light* theme's ground needs instead.
 */
export type Band = {
  floor: number;
  range: number;
  /** Defaults to 1 — a straight scale. */
  exponent?: number;
  /**
   * Scales the colour's own chroma: 1 keeps it, 0 is greyscale. Ignored when
   * `hue` is set, since there is no original hue left to keep.
   */
  chroma: number;
  invert: boolean;
  /**
   * Replaces the hue outright, in degrees, at `hueChroma` absolute chroma. This
   * is what makes a theme a theme rather than a brightness setting.
   */
  hue?: number;
  hueChroma?: number;
};

export type StyleTint = {
  /** Fills: land, water, parks, buildings, sky. */
  ground: Band;
  /** Lines and icons: roads, rails, casings, boundaries. */
  figure: Band;
  /** Label text. */
  text: Band;
  /**
   * One halo for every label, replacing whatever the style asked for and
   * supplied to labels that asked for none.
   */
  halo: string;
  /** Only used where the style left `text-halo-width` out; MapLibre defaults it to 0. */
  haloWidth: number;
  /** Low-zoom shaded relief is a bright raster that fights any recoloured map. */
  rasterOpacity: number;
  /**
   * Floor on a label's alpha. Labels drawn see-through on a light map vanish on
   * a dark one — OpenFreeMap's stock dark style makes exactly that mistake with
   * its 70%-opacity water labels.
   */
  textMinAlpha: number;
};

const TEXT_COLOR_PROPS = new Set(["text-color"]);
const HALO_COLOR_PROPS = new Set(["text-halo-color", "icon-halo-color"]);

/**
 * The rest, split by which treatment they want. Listed rather than
 * pattern-matched on "-color" so a future property cannot be swept in without
 * someone deciding which group it belongs to.
 */
const GROUND_COLOR_PROPS = new Set([
  "background-color",
  "fill-color",
  // The polygon's own edge, not a road: a building outline lifted into the
  // figure band turns every block into a bright box.
  "fill-outline-color",
  "fill-extrusion-color",
  "sky-color",
  "horizon-color",
  "fog-color",
]);

const FIGURE_COLOR_PROPS = new Set([
  "line-color",
  "circle-color",
  "circle-stroke-color",
  "icon-color",
]);

export type LayerLike = {
  type?: string;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};

export type StyleLike = {
  layers?: LayerLike[];
  [key: string]: unknown;
};

export function tintStyle<T extends StyleLike>(style: T, tint: StyleTint): T {
  const layers = Array.isArray(style.layers) ? style.layers : [];

  return {
    ...style,
    layers: layers.map((layer) => tintLayer(layer, tint)),
  };
}

function tintLayer(layer: LayerLike, tint: StyleTint): LayerLike {
  const paint = layer.paint;

  if (layer.type === "raster") {
    return { ...layer, paint: { ...paint, "raster-opacity": tint.rasterOpacity } };
  }

  if (!paint) return layer;

  const next: Record<string, unknown> = { ...paint };

  for (const [property, value] of Object.entries(paint)) {
    if (HALO_COLOR_PROPS.has(property)) {
      next[property] = tint.halo;
      continue;
    }

    if (TEXT_COLOR_PROPS.has(property)) {
      next[property] = mapColors(value, (color) => toTextColor(color, tint));
      continue;
    }

    if (GROUND_COLOR_PROPS.has(property)) {
      next[property] = mapColors(value, (color) => applyBand(color, tint.ground));
      continue;
    }

    if (FIGURE_COLOR_PROPS.has(property)) {
      next[property] = mapColors(value, (color) => applyBand(color, tint.figure));
    }
  }

  /*
   * A label with no halo gets one.
   *
   * The loop above can only replace a halo that is already declared, and the
   * layers that need one most often do not declare it: Liberty's street names
   * ask for `text-halo-width: 1` and never name a colour, because on the light
   * map the text is dark and the road under it is white, so none is needed.
   * Recolouring can reverse exactly that relationship. Without this the name and
   * the ribbon it runs along end up two similar shades, and no amount of moving
   * the text band separates them — moving it can only take the label *towards*
   * the road or away from every other label.
   */
  if (next["text-color"] !== undefined && next["text-halo-color"] === undefined) {
    next["text-halo-color"] = tint.halo;
    if (next["text-halo-width"] === undefined) {
      next["text-halo-width"] = tint.haloWidth;
    }
  }

  return { ...layer, paint: next };
}

/**
 * A paint value is a colour string, or an expression, or a legacy stop function
 * with colours buried in it. Walking the whole value and transforming any string
 * that parses as a colour handles all three without having to understand the
 * expression grammar — and anything unparseable is passed through untouched.
 */
function mapColors(value: unknown, transform: (color: string) => string): unknown {
  if (typeof value === "string") return transform(value);

  if (Array.isArray(value)) return value.map((item) => mapColors(item, transform));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        mapColors(item, transform),
      ]),
    );
  }

  return value;
}

/**
 * The band maths, and the only place a tint's numbers turn into a colour.
 * Anything that does not parse as a colour comes back untouched, which is the
 * safe default for a value this file does not understand.
 */
export function applyBand(input: string, band: Band): string {
  const color = parseColor(input);
  if (!color) return input;

  return formatRgba(bandColor(color, band));
}

function bandColor(color: Rgba, band: Band): Rgba {
  const normalised = band.invert ? 1 - lightnessOf(color) : lightnessOf(color);
  const spread =
    band.exponent === undefined ? normalised : normalised ** band.exponent;
  const lightness = band.floor + spread * band.range;

  return band.hue === undefined
    ? withLightness(color, lightness, band.chroma)
    : withHue(color, lightness, band.hue, band.hueChroma ?? 0.04);
}

function toTextColor(input: string, tint: StyleTint): string {
  const color = parseColor(input);
  if (!color) return input;

  return formatRgba({
    ...bandColor(color, tint.text),
    a: Math.max(color.a, tint.textMinAlpha),
  });
}
