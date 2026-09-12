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
 * How far apart the dots sit, centre to centre, in screen pixels.
 *
 * `symbol-spacing` is a layout property and cannot be data-driven, so this
 * cannot follow the stroke the way `line-dasharray`'s units did. The number is
 * the spacing a 6px stroke wants, and a thick line therefore reads as a denser
 * row of dots than a hairline does — which is the trade for a dot that is round
 * at every zoom, and is the right way round anyway: a heavy dotted line is meant
 * to read as heavier.
 */
export const DOT_SPACING_PX = 14;
