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

/**
 * The pin. All of it.
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
 * gone, and a pin now sits on its coordinate because it is centred on it.
 *
 * Radius 8 is what the teardrop's head was, so the glyphs below did not have to
 * be re-fitted — only re-centred.
 */
export const PIN_BALL = { cx: 12, cy: 12, r: 8 } as const;

/**
 * Where a glyph sits inside the pin, in pin units.
 *
 * Centred on the ball and 10 across, so its corners land 7.07 units from the
 * centre — inside the 8-unit radius with room for the outline. Any larger and a
 * square-ish glyph pokes through the side.
 */
export const GLYPH_BOX = { x: 7, y: 7, size: 10 } as const;

/** A lucide icon's own box. The glyph is scaled from this into GLYPH_BOX. */
export const GLYPH_SOURCE_BOX = 24;

/**
 * Where an uploaded image sits inside the pin, in pin units.
 *
 * A second box rather than reusing GLYPH_BOX, for one reason: an image is clipped
 * to a circle, and a circle fits where the square it is inscribed in does not.
 * GLYPH_BOX has to keep its *corners* inside the outline; a circle only has to
 * keep its edge inside.
 *
 * 6.4 rather than the 5.6 it was under the teardrop. That number was small
 * because it had to dodge the taper below the head and sit clear of it; a ball
 * has no taper, so the only constraint left is the outline — 6.4 plus half the
 * map's 1.5 stroke is 7.15, inside 8, leaving a ring of pin colour around the
 * logo. A customer's logo is the thing they care most about seeing.
 *
 * Expressed as a circle because that is what both renderers actually draw: the
 * editor's CSS clips to it, the embed's canvas arcs to it.
 */
export const IMAGE_CIRCLE = { cx: 12, cy: 12, r: 6.4 } as const;

/** The same circle as the box an `<image>` or `drawImage` needs. Derived, not measured. */
export const IMAGE_BOX = {
  x: IMAGE_CIRCLE.cx - IMAGE_CIRCLE.r,
  y: IMAGE_CIRCLE.cy - IMAGE_CIRCLE.r,
  size: IMAGE_CIRCLE.r * 2,
} as const;

/** Prefixes an id that names one of the map's own pins rather than a built-in. */
export const CUSTOM_PIN_PREFIX = "custom:";

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
};

/** What either kind of pin reduces to once the id has been looked up. */
export type ResolvedPin = {
  /**
   * Changes whenever the drawing does, so a marker can skip rebuilding its SVG
   * without missing a pin that was recoloured under it. Not the icon id: two
   * different drawings can share one.
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
};

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

    return { key: builtIn.id, paths: builtIn.paths, image: "", color: null };
  }

  const record = custom?.find(
    (entry) => entry.id === icon.slice(CUSTOM_PIN_PREFIX.length),
  );
  if (!record) return null;

  if (record.image) {
    // Fingerprinted rather than keyed on the image itself: `key` is written to a
    // DOM attribute on every marker, and a few hundred copies of a base64 logo
    // is real weight for a value only ever compared against itself.
    return {
      key: `${icon}:${record.color}:${record.image.length}:${record.image.slice(-12)}`,
      paths: [],
      image: record.image,
      color: record.color,
    };
  }

  const glyph = findPinIcon(record.glyph);
  if (!glyph) return null;

  return {
    key: `${icon}:${record.color}:${glyph.id}`,
    paths: glyph.paths,
    image: "",
    color: record.color,
  };
}

/**
 * The pin as SVG markup, colourless.
 *
 * A string rather than elements because both callers are outside React and set
 * it through `innerHTML` — the drag ghost (moved sixty times a second) and the
 * markers (hundreds per map). Colour is left to the stylesheet: `.pin-svg__body`
 * takes the pin's colour, `.pin-svg__glyph` is knocked out in white.
 *
 * One shape, always. A pin with a glyph, a pin with a logo and a pin with nothing
 * in it are the same ball with different contents — so there is no branch here,
 * no second set of CSS rules, and no way for the two to drift.
 *
 * The image is not clipped here. `.pin-svg__image` rounds it off in CSS
 * (app/globals.css), because the alternative — a `<clipPath>` — needs an id, and
 * an id is either shared across five hundred markers and dangling the moment the
 * one that declared it is removed, or unique per marker and five hundred more
 * definitions of the same circle.
 */
export function pinSvg(pin?: ResolvedPin | null): string {
  return (
    `<svg class="pin-svg" viewBox="0 0 ${PIN_BOX} ${PIN_BOX}"` +
    ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    `<circle class="pin-svg__body" cx="${PIN_BALL.cx}" cy="${PIN_BALL.cy}" r="${PIN_BALL.r}"/>` +
    headOf(pin) +
    "</svg>"
  );
}

/** What sits inside the ball, if anything. */
function headOf(pin?: ResolvedPin | null): string {
  if (!pin) return "";

  if (pin.image) {
    return (
      `<image class="pin-svg__image" href="${pin.image}"` +
      ` x="${IMAGE_BOX.x}" y="${IMAGE_BOX.y}"` +
      ` width="${IMAGE_BOX.size}" height="${IMAGE_BOX.size}"` +
      ' preserveAspectRatio="xMidYMid meet"/>'
    );
  }

  if (pin.paths.length > 0) {
    return (
      `<svg class="pin-svg__glyph" x="${GLYPH_BOX.x}" y="${GLYPH_BOX.y}"` +
      ` width="${GLYPH_BOX.size}" height="${GLYPH_BOX.size}"` +
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
