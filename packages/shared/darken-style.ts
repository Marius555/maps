import { formatRgba, lightnessOf, parseColor, withLightness } from "./color";

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
 * under §4 is that it is dependency-free: no React, no MapLibre import, nothing
 * but ./color. eslint.config.mjs holds this whole directory to the embed's
 * import list so it stays that way.
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

/**
 * Ground: inverted into a dark band.
 *
 * The exponent is the part that matters. Every fill in Liberty sits in the top
 * 17% of the lightness scale, so a straight inversion maps them all into a
 * 0.05-wide sliver — land, water, parks and buildings arriving as four
 * indistinguishable near-blacks. A square root spreads that sliver back out
 * before it is scaled down.
 */
const GROUND_FLOOR = 0.15;
const GROUND_RANGE = 0.3;
const GROUND_EXPONENT = 0.5;

/**
 * Figure: lines, road casings, boundaries. Order preserved, lifted clear of the
 * ground. The floor is what guarantees a line stays visible even if a style
 * draws a dark one on light land, which Liberty does not but a future basemap
 * might.
 */
const FIGURE_FLOOR = 0.22;
const FIGURE_RANGE = 0.45;

/**
 * Text: inverted into a bright band. The floor is what buys back the contrast.
 *
 * The band used to start at 0.66, which reads fine over land and fails over the
 * one thing labels are most often drawn on top of. Liberty's street names are
 * `#666` and its minor roads are `#fff`: the figure transform lifts the road to
 * L 0.67 and the old text transform put the name at L 0.827, so the name and the
 * ribbon under it were two greys about 1.4:1 apart. Starting at 0.78 keeps the
 * whole hierarchy in the top fifth of the scale, near enough white that no label
 * can land inside a road's band — see the halo below for the other half.
 */
const TEXT_FLOOR = 0.78;
const TEXT_RANGE = 0.22;

/** Ground keeps some colour, but a dark map at full chroma looks radioactive. */
const GROUND_CHROMA = 0.55;
/** Figures keep more of theirs — an orange motorway is doing real work. */
const FIGURE_CHROMA = 0.8;
const TEXT_CHROMA = 0.7;

const HALO = "rgba(8, 8, 10, 0.85)";

/**
 * The halo width given to a label that has none.
 *
 * Only used where the style left `text-halo-width` out entirely, in which case
 * MapLibre's default is 0 and setting a halo colour would change nothing.
 */
const HALO_WIDTH = 1;

/** Low-zoom shaded relief is a bright raster; at full strength it fights the map. */
const RASTER_OPACITY = 0.14;

const TEXT_COLOR_PROPS = new Set(["text-color"]);
const HALO_COLOR_PROPS = new Set(["text-halo-color", "icon-halo-color"]);

/**
 * The rest, split by which treatment they want. Listed rather than
 * pattern-matched on "-color" so a future property can't be swept in without
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

type LayerLike = {
  type?: string;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};

type StyleLike = {
  layers?: LayerLike[];
  [key: string]: unknown;
};

export function darkenStyle<T extends StyleLike>(style: T): T {
  const layers = Array.isArray(style.layers) ? style.layers : [];

  return {
    ...style,
    layers: layers.map(darkenLayer),
  };
}

function darkenLayer(layer: LayerLike): LayerLike {
  const paint = layer.paint;

  if (layer.type === "raster") {
    return { ...layer, paint: { ...paint, "raster-opacity": RASTER_OPACITY } };
  }

  if (!paint) return layer;

  const next: Record<string, unknown> = { ...paint };

  for (const [property, value] of Object.entries(paint)) {
    if (HALO_COLOR_PROPS.has(property)) {
      next[property] = HALO;
      continue;
    }

    if (TEXT_COLOR_PROPS.has(property)) {
      next[property] = mapColors(value, toTextColor);
      continue;
    }

    if (GROUND_COLOR_PROPS.has(property)) {
      next[property] = mapColors(value, darkenSurfaceColor);
      continue;
    }

    if (FIGURE_COLOR_PROPS.has(property)) {
      next[property] = mapColors(value, toFigureColor);
    }
  }

  /*
   * A label with no halo gets one.
   *
   * The loop above can only replace a halo that is already declared, and the
   * layers that need one most often do not declare it: Liberty's street names
   * ask for `text-halo-width: 1` and never name a colour, so on the light map
   * they have no halo at all — none is needed, because the text is dark and the
   * road under it is white. Inverting flips exactly that relationship. Without
   * this the name and the ribbon it runs along end up two similar lights, and no
   * amount of raising TEXT_FLOOR separates them, because raising it moves the
   * label *towards* the road rather than away from it.
   */
  if (next["text-color"] !== undefined && next["text-halo-color"] === undefined) {
    next["text-halo-color"] = HALO;
    if (next["text-halo-width"] === undefined) {
      next["text-halo-width"] = HALO_WIDTH;
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
 * Ground. Liberty's land lands near 0.21, its buildings and parks near 0.25 and
 * its water near 0.28 — a dark map with its features still told apart, rather
 * than the four near-blacks a straight inversion produced.
 *
 * Exported so the basemap picker can paint Auto's dark half with the same maths
 * the map uses (components/settings/basemap-picker.tsx). A swatch that computed
 * its own idea of "darker" would eventually disagree with the tiles it stands
 * for, which is the failure STYLE_SWATCHES exists to prevent.
 */
export function darkenSurfaceColor(input: string): string {
  const color = parseColor(input);
  if (!color) return input;

  const inverted = (1 - lightnessOf(color)) ** GROUND_EXPONENT;

  return formatRgba(
    withLightness(color, GROUND_FLOOR + inverted * GROUND_RANGE, GROUND_CHROMA),
  );
}

/**
 * Figure: roads, rails, boundaries, casings.
 *
 * Not inverted. On a light basemap the road network is drawn *lighter* than the
 * land it crosses and its casings darker, and both halves of that hold on a dark
 * map too — so this compresses the range and lifts it clear of the ground
 * instead of flipping it. Liberty's white minor roads land near 0.67, its
 * casings near 0.58 and its boundaries near 0.45, all against land at 0.21.
 */
function toFigureColor(input: string): string {
  const color = parseColor(input);
  if (!color) return input;

  const lightness = FIGURE_FLOOR + lightnessOf(color) * FIGURE_RANGE;

  return formatRgba(withLightness(color, lightness, FIGURE_CHROMA));
}

/**
 * Text inverts into a bright band. Liberty's own spread survives it: `#000` city
 * labels land at 1.00, `#333` districts and states at 0.93, `#666` street and
 * POI labels at 0.89, pale waterway names at 0.84 — still ordered, still backed
 * by Liberty's own size and weight differences, and all of them far above the
 * contrast floor that made the stock dark style unreadable.
 *
 * The spread is narrower than it was on purpose. Hierarchy between labels is
 * carried mostly by size and weight, which the transform never touches; lightness
 * was doing very little of that work and was costing the smallest labels — street
 * names — the contrast they need against the roads they sit on.
 */
function toTextColor(input: string): string {
  const color = parseColor(input);
  if (!color) return input;

  const lightness = TEXT_FLOOR + (1 - lightnessOf(color)) * TEXT_RANGE;

  // Labels drawn at partial alpha on a light map vanish on a dark one — the
  // stock style's 70%-opacity water labels are exactly that mistake.
  return formatRgba({
    ...withLightness(color, lightness, TEXT_CHROMA),
    a: Math.max(color.a, 0.9),
  });
}
