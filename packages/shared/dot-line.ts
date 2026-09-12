/**
 * The dot a dotted outline is drawn with.
 *
 * **MapLibre cannot draw a round dot with `line-dasharray`, and the reason is
 * worth writing down because the spelling that fails looks exactly right.** A
 * zero-length dash under a round cap — `[0, 2]` with `line-cap: "round"` — is
 * the documented way to dot a line, and it produces a circle only at *integer*
 * zooms. The dash pattern is an SDF texture sampled along the line, and the
 * shader anchors its horizontal scale to tile units, correcting in 2× steps via
 * the fromScale/toScale crossfade. So between two zoom levels the pattern is
 * stretched *along* the line by up to ~1.41× while the dot's height stays pinned
 * to the real line width. Measured in the browser at 6px: round at z15, a
 * visible egg at z15.5, round again at z16.
 *
 * A `symbol` layer has no such scale. An icon is placed along the line and drawn
 * at its own aspect at every zoom, which is what this image is for.
 *
 * **SDF, so one image serves every colour.** `icon-color` is only honoured for
 * an SDF icon, and a shape's colour is per-feature — the alternative is an image
 * per colour on the map, added and evicted as the owner recolours things. One
 * image, `icon-color: ["get", "color"]`, no bookkeeping.
 *
 * Here rather than in /lib because the embed draws dotted outlines too, and the
 * publish preview renders the real embed bundle against the same map the editor
 * is drawing. Two dot images that agree today is exactly the drift
 * `packages/shared` exists to prevent. Zero dependencies, vanilla TS — the
 * condition for putting runtime here (CLAUDE.md §4).
 */

import { MAX_STROKE_WIDTH, MIN_STROKE_WIDTH } from "./shapes";

/** The id both renderers register the image under. */
export const DOT_IMAGE_ID = "shape-dot";

/**
 * The image's own size in pixels.
 *
 * 32 is a compromise a reader should be able to check: the dot is drawn at
 * `icon-size = width / DOT_IMAGE_SIZE`, so a 4px hairline samples it down by 8
 * and a 12px stroke by under 3. Bigger costs memory in the sprite atlas for a
 * shape that is a disc; smaller shows its own pixels on a thick line.
 */
export const DOT_IMAGE_SIZE = 32;

/**
 * How far the alpha ramp spans, in image pixels.
 *
 * The SDF shader takes its edge at alpha 0.75 and smoothsteps a narrow band
 * around it, so the encoding below has to put 0.75 exactly on the circle and
 * move away from it fast enough that the transition is about a pixel wide once
 * the icon is scaled down. A gentler ramp reads as a blurred dot at small sizes;
 * a harder one aliases.
 */
const EDGE = 4;

/**
 * A white disc as an SDF, ready for `map.addImage(..., { sdf: true })`.
 *
 * RGB is left at zero and only the alpha channel carries the field, which is
 * what an SDF icon is: the shader reads alpha as distance and takes the colour
 * from `icon-color`. Written as a flat loop rather than through a canvas so it
 * runs identically in both renderers and in a test, with no DOM.
 */
export function dotImage(): { width: number; height: number; data: Uint8Array } {
  const size = DOT_IMAGE_SIZE;
  const data = new Uint8Array(size * size * 4);
  // Half a pixel in from the centre of the grid, so the disc is symmetric about
  // the image rather than about one pixel of it.
  const centre = (size - 1) / 2;
  // One pixel of margin, so the ramp has somewhere to finish inside the image.
  const radius = size / 2 - 1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - centre, y - centre);
      // 0.75 on the edge is what the shader calls the outline; inside is more,
      // outside is less, and both are clamped to a byte.
      const alpha = 0.75 + (radius - distance) / EDGE;

      data[(y * size + x) * 4 + 3] = Math.max(
        0,
        Math.min(255, Math.round(alpha * 255)),
      );
    }
  }

  return { width: size, height: size, data };
}

/**
 * How far apart the dots sit, centre to centre, as a multiple of the stroke.
 *
 * The dot's diameter *is* the stroke width (`icon-size = width / DOT_IMAGE_SIZE`),
 * so this is the gap plus one dot: at 1.5 a dotted line is half again as long as
 * it is thick per dot. `line-dasharray: [0, 2]` drew 2, dash units being
 * multiples of the line width, and 1.5 is tighter than that on purpose — see the
 * swing below, which the dash version did not have to pay in the same way.
 *
 * **A symbol placed along a line does not hold its spacing between zoom levels,
 * and nothing can make it.** MapLibre lays a tile's symbols out once, in tile
 * units, at that tile's integer zoom, and then scales the whole tile — so the
 * spacing on screen is what is asked for at an integer zoom and up to *twice*
 * that just below the next one. Layout properties are evaluated at the bucket's
 * zoom, which is that same integer, so a zoom expression cannot correct it.
 * Measured on a 6px route asking for 12px: 11.96px at z17, 17.0px at z17.5,
 * 22.4px at z17.9, 12.0px again at z18.
 *
 * So the number is chosen for the *tight* end and allowed to open up from there,
 * rather than being right in the middle and sparse for most of a zoom level.
 *
 * None of this means anything without `DOT_TEXT_SIZE` — without that, MapLibre
 * floors the spacing at ~21px whatever is asked for, which is what "the dots
 * have huge gaps" was actually reporting.
 */
export const DOT_SPACING_RATIO = 1.5;

/**
 * The closest two dots are ever placed, whatever the ratio works out to.
 *
 * A 1px hairline would otherwise ask for 1.5px, and `symbol-placement: "line"`
 * puts an icon at every step along the whole feature — a long route is then tens
 * of thousands of symbols for a marking nobody can resolve anyway. Four pixels is
 * where a 1, 2 or 3px outline still reads as dotted rather than as a dashed line
 * of specks, and it is the floor for exactly those three widths.
 */
export const DOT_MIN_SPACING_PX = 4;

/**
 * The spacing one stroke width wants.
 *
 * **`symbol-spacing` is a layout property and cannot be data-driven**, which is
 * the whole reason this is a function and not an expression: the spacing has to be
 * a constant per layer, so the renderers draw one dotted layer per width and ask
 * this for each one. It was a single flat 14px before — tuned for a 6px stroke,
 * which left the default 4px route with a 10px gap and a 2px area outline with a
 * 12px one, and both read as a line that had given up rather than a dotted one.
 */
export function dotSpacingFor(width: number): number {
  return Math.max(DOT_MIN_SPACING_PX, width * DOT_SPACING_RATIO);
}

/**
 * Every width a dotted layer has to be built for.
 *
 * Twelve layers rather than a handful of buckets, because twelve is the whole
 * range (`MIN_STROKE_WIDTH`..`MAX_STROKE_WIDTH`) and an exact match needs no
 * argument about where a boundary should sit. A layer whose width nothing on the
 * map is using builds no bucket and costs nothing per tile.
 */
export const DOT_WIDTH_BUCKETS: readonly number[] = Array.from(
  { length: MAX_STROKE_WIDTH - MIN_STROKE_WIDTH + 1 },
  (_, index) => MIN_STROKE_WIDTH + index,
);

/**
 * The `text-size` a dotted layer has to declare, and it is not about text.
 *
 * **Without this, `symbol-spacing` is silently floored and the dots are drawn
 * two to three times further apart than the layer asks for.** MapLibre's
 * `getAnchors` refuses to place symbols closer together than the label they
 * carry: if `spacing - labelLength * boxScale < spacing / 4`, it replaces the
 * spacing with `labelLength * boxScale + spacing / 4`. `labelLength` for an
 * icon-only symbol is the image's **raw pixel width** — 32 here, ignoring
 * `icon-size` entirely — and `boxScale` is `tilePixelRatio * text-size / 24`.
 * At the default `text-size` of 16 that is 32 x 16/24 = 21.3px, so *every*
 * spacing below ~28px came out as `21.3 + asked/4`.
 *
 * Measured in the browser on a 6px route at z17, reading the bucket's own
 * `symbolInstances`: asking for 12px gave 24.35px; with this set, 11.96px.
 * That floor is the whole of the reported "dots have huge gaps" — the flat 14px
 * this replaced was really drawing 24.8px.
 *
 * One rather than zero because the property's minimum is 0 and a zero scale
 * would also zero the end-of-line inset that keeps a dot from hanging off the
 * geometry. At 1 the floor is 1.3px, which no spacing we ask for can trip.
 * These layers carry no text at all, so nothing else reads it.
 */
export const DOT_TEXT_SIZE = 1;

/** One dotted layer's id, given the width it draws. */
export function dotLayerId(base: string, width: number): string {
  return `${base}-${width}`;
}

/**
 * A MapLibre filter matching one stroke width, spelled as a literal tuple.
 *
 * Written out rather than borrowed from `maplibre-gl`: this directory is the
 * embed's only shared surface and may have **no dependencies** (CLAUDE.md §4), so
 * a type import from the map library cannot live here. The shape is narrow enough
 * that both renderers' `FilterSpecification` accepts it structurally, which is the
 * part that matters — a mistake here is a filter that silently matches nothing.
 */
export type DotWidthFilter = [
  "==",
  ["min", number, ["max", number, ["round", ["get", "width"]]]],
  number,
];

/**
 * Which features belong to the layer drawn at `width`.
 *
 * Rounded and clamped rather than compared straight: the schema only ever admits
 * an integer in range, but a row written by hand or by an older version must still
 * land on *some* layer — an unmatched feature is a dotted shape that draws nothing
 * at all, which looks like a shape that was deleted.
 */
export function dotWidthFilter(width: number): DotWidthFilter {
  return [
    "==",
    [
      "min",
      MAX_STROKE_WIDTH,
      ["max", MIN_STROKE_WIDTH, ["round", ["get", "width"]]],
    ],
    width,
  ];
}
