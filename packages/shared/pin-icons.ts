/**
 * The pin — a ball — and the icons that can sit inside it.
 *
 * Runtime code in /packages/shared, which is allowed only under one condition:
 * zero dependencies, vanilla TS (CLAUDE.md §4). It is here for the same reason
 * `darken-style.ts` is — the editor and the embed must draw *the same* pin, not
 * two that agree today. The preview dialog renders the real embed bundle beside
 * the editor's own canvas, so any drift is two differently-shaped pins on one
 * screen.
 *
 * The two targets share the geometry and part ways on the paint, because they
 * have to: the editor renders SVG and colours it with CSS custom properties, the
 * embed rasterises to a canvas and has no CSS to read. So `pinSvg` emits markup
 * with class hooks and no colours in it, and the embed paints the same paths
 * itself (embed/src/pin-image.ts).
 *
 * Icon ids are stored as plain strings, and nothing here throws on one it doesn't
 * know. That is what lets a pin the customer built store `custom:<pinIconId>` in
 * the same column with no migration, and what keeps a map rendering when it meets
 * an id written by a newer version of the app.
 */

/** Everything below is expressed in this box, the one lucide draws in. */
export const PIN_BOX = 24;

/** The middle of the box. Every shape is centred here, so a pin sits on its coordinate. */
export const PIN_CENTER = 12;

/**
 * The pin's default body.
 *
 * This used to be lucide's `map-pin` teardrop, and the change is not cosmetic —
 * it takes a whole class of geometry with it. A teardrop marks its position with
 * its *tip*, which is at (12, 21.8) rather than anywhere convenient, so every
 * renderer carried a correction: the marker's CSS nudged itself up 40.83%, the
 * drag ghost hung 90.8% below the pointer, and the embed cropped its canvas at
 * the tip so MapLibre could anchor `bottom`. Three different expressions of one
 * number, each of which had to be found by eye when it went wrong.
 *
 * A ball marks its position with its middle. Every one of those corrections is
 * gone, and a pin now sits on its coordinate because it is centred on it. The
 * square and the diamond below are centred on the same point for the same
 * reason — whatever a customer picks, `icon-anchor: center` stays correct.
 *
 * Radius 8 is what the teardrop's head was, so the glyphs below did not have to
 * be re-fitted — only re-centred.
 */
export const PIN_BALL = { cx: PIN_CENTER, cy: PIN_CENTER, r: 8 } as const;

/** A lucide icon's own box. The glyph is scaled from this into the shape's glyph box. */
export const GLYPH_SOURCE_BOX = 24;

/** Prefixes an id that names one of the map's own pins rather than a built-in. */
export const CUSTOM_PIN_PREFIX = "custom:";

/** The body outline a pin is drawn as. */
export type PinShape = "circle" | "square" | "diamond";

/** How heavy the outline around the body is. */
export type PinRingWidth = "none" | "thin" | "regular" | "thick";

/** How big the pin is drawn, relative to every other pin on the map. */
export type PinSize = "sm" | "md" | "lg";

/**
 * Named steps rather than raw numbers on the record, and that is a durability
 * choice, not a UI one. `resolvePin` never throws (see below), so a row written
 * by a newer version of the app or hand-edited in the Appwrite console has to
 * degrade rather than take a map down — and an enum degrades to a default, where
 * a number degrades to a 40-unit ring that swallows the glyph.
 */
export const PIN_RING_WIDTHS: Record<PinRingWidth, number> = {
  none: 0,
  thin: 1,
  regular: 1.5,
  thick: 2.5,
};

/** Half the thickest ring — how far an outline can stray outside its own path. */
const MAX_RING_OVERHANG = PIN_RING_WIDTHS.thick / 2;

export const PIN_SIZES: Record<PinSize, number> = { sm: 0.8, md: 1, lg: 1.25 };

/** What a pin looks like when nothing has said otherwise. Today's pin, exactly. */
export const DEFAULT_RING_WIDTH: PinRingWidth = "regular";
export const DEFAULT_PIN_SIZE: PinSize = "md";
export const DEFAULT_PIN_SHAPE: PinShape = "circle";

/**
 * One body outline, and what fits inside it.
 *
 * The outline is an SVG path `d` string rather than an arc or a rect, because
 * `Path2D` accepts path data: the editor drops the string into markup and the
 * embed hands the *same string* to `new Path2D(...)`, so there is one description
 * of a diamond rather than two that agree today. That is the whole reason this
 * file exists (§4).
 *
 * The strings are built from the numbers below rather than written out, and that
 * is worth the four builders it costs. A literal `d` is a claim about geometry
 * that nothing can check — the glyph that fits, the image that fits and the ring
 * that is not clipped are all consequences of numbers buried inside a quoted
 * string, and a shape added with a slightly wrong one looks merely "a bit tight"
 * to whoever adds it. Built, the same numbers feed `inradiusOf` and `extentOf`,
 * and the tests hold every shape to them.
 *
 * The numbers themselves are derived, not chosen:
 *
 * - A diamond of half-diagonal `d` contains a centred square of half-side `d/2`
 *   and an inscribed circle of `d/√2`. At `d = 9.5` those are 4.75 and 6.72 — so
 *   an 8.5 glyph box (half-side 4.25) clears the first, and a 5.4 image radius
 *   plus the 1.25 a thick ring strays outward clears the second.
 * - Its outer extent is then 10.75, inside the 12-unit half-box, so the thickest
 *   ring is never clipped by the SVG viewport (an `<svg>` clips to its viewBox).
 * - The square's half-side is the circle's radius, so it reads as the same pin at
 *   the same weight, and everything the circle holds fits it with room over. Its
 *   corners are rounded to 4, which is what keeps *its* extent inside the box —
 *   a hard corner would sit 11.3 out and be shaved by a thick ring.
 */
const CIRCLE_RADIUS = 8;
const SQUARE_HALF = 8;
const SQUARE_CORNER = 4;
const DIAMOND_HALF = 9.5;

export const PIN_SHAPES: Record<
  PinShape,
  { path: string; glyph: number; imageRadius: number }
> = {
  circle: {
    path: circlePath(CIRCLE_RADIUS),
    glyph: 10,
    imageRadius: 6.4,
  },
  square: {
    path: roundedSquarePath(SQUARE_HALF, SQUARE_CORNER),
    glyph: 10,
    imageRadius: 6.4,
  },
  diamond: {
    path: diamondPath(DIAMOND_HALF),
    glyph: 8.5,
    imageRadius: 5.4,
  },
};

/** Two half-arcs, which is the only way to express a full circle as path data. */
function circlePath(r: number): string {
  return `M${PIN_CENTER - r} ${PIN_CENTER}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
}

function roundedSquarePath(half: number, corner: number): string {
  const side = (half - corner) * 2;
  const start = PIN_CENTER - half;
  const arc = `a${corner} ${corner} 0 0 1`;

  return (
    `M${start + corner} ${start}h${side}${arc} ${corner} ${corner}` +
    `v${side}${arc} ${-corner} ${corner}` +
    `h${-side}${arc} ${-corner} ${-corner}` +
    `v${-side}${arc} ${corner} ${-corner}z`
  );
}

function diamondPath(half: number): string {
  return (
    `M${PIN_CENTER} ${PIN_CENTER - half}L${PIN_CENTER + half} ${PIN_CENTER}` +
    `L${PIN_CENTER} ${PIN_CENTER + half}L${PIN_CENTER - half} ${PIN_CENTER}z`
  );
}

/** An unknown string → the default shape. Never throws; see `resolvePin`. */
export function toPinShape(value: string | null | undefined): PinShape {
  return value && value in PIN_SHAPES ? (value as PinShape) : DEFAULT_PIN_SHAPE;
}

/** An unknown string → the default ring. Never throws; see `resolvePin`. */
export function toPinRingWidth(value: string | null | undefined): PinRingWidth {
  return value && value in PIN_RING_WIDTHS
    ? (value as PinRingWidth)
    : DEFAULT_RING_WIDTH;
}

/** An unknown string → the default size. Never throws; see `resolvePin`. */
export function toPinSize(value: string | null | undefined): PinSize {
  return value && value in PIN_SIZES ? (value as PinSize) : DEFAULT_PIN_SIZE;
}

/**
 * Where a glyph sits inside a given shape, in pin units.
 *
 * Centred, and sized so its *corners* stay inside the outline — a glyph is a
 * square drawing and the corner is the part that pokes through the side.
 */
export function glyphBoxFor(shape: PinShape): { x: number; y: number; size: number } {
  const size = PIN_SHAPES[shape].glyph;

  return { x: PIN_CENTER - size / 2, y: PIN_CENTER - size / 2, size };
}

/**
 * Where an uploaded image sits, in pin units.
 *
 * A circle rather than a box, because that is what both renderers actually draw:
 * the editor's CSS clips to it, the embed's canvas arcs to it. It can be wider
 * than the glyph box for the same shape — a circle only has to keep its edge
 * inside the outline, where a square has to keep its corners inside.
 */
export function imageCircleFor(shape: PinShape): { cx: number; cy: number; r: number } {
  return { cx: PIN_CENTER, cy: PIN_CENTER, r: PIN_SHAPES[shape].imageRadius };
}

/** The same circle as the box an `<image>` or `drawImage` needs. Derived, not measured. */
export function imageBoxFor(shape: PinShape): { x: number; y: number; size: number } {
  const { cx, cy, r } = imageCircleFor(shape);

  return { x: cx - r, y: cy - r, size: r * 2 };
}

/**
 * How far a shape's outline reaches from the centre at its *narrowest* point —
 * the inradius, which is what anything drawn inside it has to clear.
 *
 * And `extentOf`, the same at its widest, which is what the viewBox has to hold.
 *
 * Only the tests read these two, and that is the point: the arithmetic behind
 * `PIN_SHAPES` is asserted rather than trusted, so a shape cannot be added with
 * numbers that quietly clip its own glyph or let a thick ring be shaved off by
 * the edge of the box.
 */
export function inradiusOf(shape: PinShape): number {
  if (shape === "diamond") return DIAMOND_HALF / Math.SQRT2;
  // A rounded square's nearest edge is its flat side, at the same distance a
  // circle of the ball's radius sits.
  return shape === "square" ? SQUARE_HALF : CIRCLE_RADIUS;
}

export function extentOf(shape: PinShape): number {
  if (shape === "diamond") return DIAMOND_HALF;
  if (shape !== "square") return CIRCLE_RADIUS;

  // The farthest point of a rounded square is on a corner arc: out to that arc's
  // centre, then its radius further.
  const toArcCentre = (SQUARE_HALF - SQUARE_CORNER) * Math.SQRT2;

  return toArcCentre + SQUARE_CORNER;
}

/** What a shape's own drawing may not exceed, ring included. Tests read this too. */
export const PIN_SAFE_RADIUS = PIN_BOX / 2 - MAX_RING_OVERHANG;

/**
 * Thicker than lucide's own 2, and deliberately.
 *
 * The glyph is drawn at 10/24 scale, which takes a 2-unit stroke down to 0.83 —
 * about 1.4 device pixels on a 40px pin, which reads as grey rather than white
 * against a saturated category colour. 2.5 lands near 1.7px and stays legible.
 */
export const GLYPH_STROKE_WIDTH = 2.5;

export type PinIcon = {
  /** Stored on the place. Stable — renaming one orphans every pin using it. */
  id: string;
  label: string;
  /** lucide path `d` strings, in a 24-unit box, stroked and never filled. */
  paths: string[];
};

/**
 * A pin the customer built. Lives on the map, exactly as a category does, and is
 * referenced from a place as `custom:<id>`.
 *
 * The id names this record rather than an uploaded file, so recolouring or
 * renaming a pin never has to rewrite the places wearing it.
 *
 * `glyph` and `image` are exclusive — one of the built-in glyphs, or a data URI
 * of the customer's own logo. The image is inlined rather than fetched: the embed
 * has to draw it on a stranger's website with no request and no CSP surface, and
 * a `data:` URI handed to `createImageBitmap` through a Blob has neither.
 *
 * Everything below `image` is optional, and has to stay that way. A pin saved
 * before those fields existed is still sitting in an Appwrite row and still
 * riding inside published snapshots, and every one of them must keep drawing the
 * pin it drew — so absent means "the default", and the defaults are today's pin.
 */
export type CustomPinIcon = {
  /** No prefix — "ab12cd34", not "custom:ab12cd34". */
  id: string;
  label: string;
  /** Hex, lowercase. Unlike a built-in pin, a custom one carries its own colour. */
  color: string;
  /** A PIN_ICONS id, or "". */
  glyph: string;
  /** A `data:image/…;base64,…` URI, or "". */
  image: string;
  /** Outline colour. Hex, or "" to take the renderer's own (white on a map). */
  ring?: string;
  ringWidth?: PinRingWidth;
  /** Glyph colour. Hex, or "" to take the renderer's own (white on a map). */
  iconColor?: string;
  size?: PinSize;
  shape?: PinShape;
};

/** What either kind of pin reduces to once the id has been looked up. */
export type ResolvedPin = {
  /**
   * Changes whenever the drawing does, so a marker can skip rebuilding its SVG
   * without missing a pin that was restyled under it. Not the icon id: two
   * different drawings can share one, and one id can name two drawings a minute
   * apart. Every field below has to be folded in here — a marker whose pin gained
   * a thicker ring but kept its key would keep the SVG it already has.
   */
  key: string;
  /** lucide path data, in a 24-unit box. Empty when this pin is an image. */
  paths: string[];
  /** A data URI, or "". Empty when this pin is a glyph. */
  image: string;
  /**
   * Non-null overrides the location's category colour — a custom pin is a
   * finished design and brings its own. Null means "take the category's".
   */
  color: string | null;
  /** Outline colour, or null for the renderer's own default. */
  ring: string | null;
  /** Outline width in pin units. 0 draws none at all. */
  ringWidth: number;
  /** Glyph colour, or null for the renderer's own default. */
  iconColor: string | null;
  /** Multiplier on the rendered size. Never on the geometry, which is fixed. */
  scale: number;
  shape: PinShape;
};

/** A built-in pin has no styling of its own: it is drawn however the renderer draws. */
const PLAIN_STYLE = {
  ring: null,
  ringWidth: PIN_RING_WIDTHS[DEFAULT_RING_WIDTH],
  iconColor: null,
  scale: PIN_SIZES[DEFAULT_PIN_SIZE],
  shape: DEFAULT_PIN_SHAPE,
} as const;

/**
 * The icons offered in the add menu.
 *
 * Path data copied from node_modules/lucide-react/dist/esm/icons/*.mjs rather
 * than imported, because `lucide-react` is React and this file is read by the
 * embed, which may not import React at all (§4). All six are path-only — no
 * `<circle>` or `<rect>` in lucide — which is what lets both renderers treat an
 * icon as nothing but a list of path strings. An icon that needs a shape element
 * should be converted to arc path data when it is added, rather than teaching two
 * renderers (and a canvas) about shape elements.
 *
 * Six is a starting point, not a limit: this array is the whole registry, and
 * the menu lays out whatever is in it.
 */
export const PIN_ICONS: readonly PinIcon[] = [
  {
    id: "store",
    label: "Shop",
    paths: [
      "M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5",
      "M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244",
      "M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05",
    ],
  },
  {
    id: "utensils",
    label: "Restaurant",
    paths: [
      "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
      "M7 2v20",
      "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
    ],
  },
  {
    id: "coffee",
    label: "Café",
    paths: [
      "M10 2v2",
      "M14 2v2",
      "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",
      "M6 2v2",
    ],
  },
  {
    id: "bed",
    label: "Hotel",
    paths: ["M2 4v16", "M2 8h18a2 2 0 0 1 2 2v10", "M2 17h20", "M6 8v9"],
  },
  {
    id: "building-2",
    label: "Office",
    paths: [
      "M10 12h4",
      "M10 8h4",
      "M14 21v-3a2 2 0 0 0-4 0v3",
      "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
      "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
    ],
  },
  {
    id: "landmark",
    label: "Landmark",
    paths: [
      "M10 18v-7",
      "M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z",
      "M14 18v-7",
      "M18 18v-7",
      "M3 22h18",
      "M6 18v-7",
    ],
  },
];

/**
 * An id → the icon, or undefined for "no icon".
 *
 * Never throws, and that is the contract, not an implementation detail. The same
 * reasoning as `toGeocodeStatus` in lib/repositories/mappers.ts: a row written by
 * a newer version of the app, or hand-edited in the Appwrite console, must
 * degrade to a plain pin rather than take the map down with it.
 */
export function findPinIcon(id: string | null | undefined): PinIcon | undefined {
  if (!id) return undefined;
  return PIN_ICONS.find((icon) => icon.id === id);
}

/**
 * An icon id → what to draw, or null for a plain pin.
 *
 * The one entry point both renderers use, so a built-in glyph, a recoloured
 * glyph and an uploaded logo all arrive at the drawing code in the same shape and
 * neither renderer has to know which kind it was handed.
 *
 * Never throws, and that is the contract. Every way an id can go wrong — unknown
 * built-in, `custom:` naming a pin that was since deleted, a hand-edited record
 * with neither a glyph nor an image — lands on null, which is a plain pin.
 */
export function resolvePin(
  icon: string | null | undefined,
  custom?: readonly CustomPinIcon[],
): ResolvedPin | null {
  if (!icon) return null;

  if (!icon.startsWith(CUSTOM_PIN_PREFIX)) {
    const builtIn = findPinIcon(icon);
    if (!builtIn) return null;

    return {
      key: builtIn.id,
      paths: builtIn.paths,
      image: "",
      color: null,
      ...PLAIN_STYLE,
    };
  }

  const record = custom?.find(
    (entry) => entry.id === icon.slice(CUSTOM_PIN_PREFIX.length),
  );
  if (!record) return null;

  const style = {
    ring: record.ring || null,
    ringWidth: PIN_RING_WIDTHS[toPinRingWidth(record.ringWidth)],
    iconColor: record.iconColor || null,
    scale: PIN_SIZES[toPinSize(record.size)],
    shape: toPinShape(record.shape),
  };

  // Every field that changes the drawing, in one string. Cheaper than comparing
  // the record itself, which is a fresh object on every render of the studio.
  const styleKey = `${record.color}:${style.ring}:${style.ringWidth}:${style.iconColor}:${style.scale}:${style.shape}`;

  if (record.image) {
    // The image is fingerprinted rather than keyed on itself: `key` is written to
    // a DOM attribute on every marker, and a few hundred copies of a base64 logo
    // is real weight for a value only ever compared against itself.
    return {
      key: `${icon}:${styleKey}:${record.image.length}:${record.image.slice(-12)}`,
      paths: [],
      image: record.image,
      color: record.color,
      ...style,
    };
  }

  const glyph = findPinIcon(record.glyph);
  if (!glyph) return null;

  return {
    key: `${icon}:${styleKey}:${glyph.id}`,
    paths: glyph.paths,
    image: "",
    color: record.color,
    ...style,
  };
}

/**
 * The custom properties the dashboard's pin CSS reads.
 *
 * One helper rather than an object literal at each call site, because there are
 * four of those — the markers, the drag ghost, the tile previews and the studio's
 * own hero — and they have to agree on five property names. When this was one
 * property it was written out four times and got away with it; five is how a pin
 * ends up ringed in the list and unringed in the hand.
 *
 * A property is *omitted* rather than set to a default, so the stylesheet's own
 * fallback applies — which is what keeps a ring theme-aware (`--accent-foreground`
 * follows light and dark) until a customer picks an actual colour. Callers
 * writing onto a reused DOM element must therefore clear what they don't set;
 * see `setPinVars` in components/map/use-place-markers.ts.
 *
 * The fill takes two arguments rather than one because the map's answer has three
 * levels and the pin's own colour sits in the middle of them:
 *
 *     override (a group's)  →  the pin's own  →  fallback (a category's)
 *
 * Collapsing them would put the category ahead of a custom pin's own design, and
 * the list and the canvas would then paint the same pin two colours.
 */
export function pinCssVars(
  pin: ResolvedPin | null | undefined,
  /** Beats the pin's own colour. Only a group does this. */
  override?: string,
  /** Used only when neither the override nor the pin has one. */
  fallback?: string,
): Record<string, string> {
  const vars: Record<string, string> = {};
  const color = override ?? pin?.color ?? fallback;

  if (color) vars["--pin-color"] = color;
  if (!pin) return vars;

  if (pin.ring) vars["--pin-ring"] = pin.ring;
  if (pin.ringWidth !== PLAIN_STYLE.ringWidth) {
    vars["--pin-ring-width"] = String(pin.ringWidth);
  }
  if (pin.iconColor) vars["--pin-icon-color"] = pin.iconColor;
  if (pin.scale !== PLAIN_STYLE.scale) vars["--pin-scale"] = String(pin.scale);

  return vars;
}

/** The properties `pinCssVars` can set. Callers clear these before writing. */
export const PIN_CSS_VARS = [
  "--pin-color",
  "--pin-ring",
  "--pin-ring-width",
  "--pin-icon-color",
  "--pin-scale",
] as const;

/**
 * The pin as SVG markup, colourless.
 *
 * A string rather than elements because both callers are outside React and set
 * it through `innerHTML` — the drag ghost (moved sixty times a second) and the
 * markers (hundreds per map). Colour is left to the stylesheet: `.pin-svg__body`
 * takes the pin's colour, `.pin-svg__glyph` is knocked out in white.
 *
 * One *element*, always. A circle, a square and a diamond are the same `<path>`
 * with different data, and a pin with a glyph, a pin with a logo and a pin with
 * nothing in it are that path with different contents — so the markup has no
 * branch a stylesheet has to know about, no second set of CSS rules, and no way
 * for the two to drift. (The circle was a `<circle>` when it was the only shape;
 * as path data it draws the same pixels and costs one selector instead of two.)
 *
 * The image is not clipped here. `.pin-svg__image` rounds it off in CSS
 * (app/globals.css), because the alternative — a `<clipPath>` — needs an id, and
 * an id is either shared across five hundred markers and dangling the moment the
 * one that declared it is removed, or unique per marker and five hundred more
 * definitions of the same circle.
 */
export function pinSvg(pin?: ResolvedPin | null): string {
  const shape = pin?.shape ?? DEFAULT_PIN_SHAPE;

  return (
    `<svg class="pin-svg" viewBox="0 0 ${PIN_BOX} ${PIN_BOX}"` +
    ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    `<path class="pin-svg__body" d="${PIN_SHAPES[shape].path}"/>` +
    headOf(pin, shape) +
    "</svg>"
  );
}

/** What sits inside the body, if anything. */
function headOf(pin: ResolvedPin | null | undefined, shape: PinShape): string {
  if (!pin) return "";

  if (pin.image) {
    const box = imageBoxFor(shape);

    return (
      `<image class="pin-svg__image" href="${pin.image}"` +
      ` x="${box.x}" y="${box.y}"` +
      ` width="${box.size}" height="${box.size}"` +
      ' preserveAspectRatio="xMidYMid meet"/>'
    );
  }

  if (pin.paths.length > 0) {
    const box = glyphBoxFor(shape);

    return (
      `<svg class="pin-svg__glyph" x="${box.x}" y="${box.y}"` +
      ` width="${box.size}" height="${box.size}"` +
      ` viewBox="0 0 ${GLYPH_SOURCE_BOX} ${GLYPH_SOURCE_BOX}"` +
      ` fill="none" stroke-width="${GLYPH_STROKE_WIDTH}"` +
      ' stroke-linecap="round" stroke-linejoin="round">' +
      pin.paths.map((path) => `<path d="${path}"/>`).join("") +
      "</svg>"
    );
  }

  // Unreachable: `resolvePin` returns null rather than a pin with an empty head.
  return "";
}
