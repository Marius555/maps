/**
 * The credit, painted onto the bitmap.
 *
 * Attribution for OpenStreetMap and the tile provider has to be visible on every
 * rendered map (CLAUDE.md §12), and an exported PNG or PDF is a rendered map that
 * will outlive the tab it came from. MapLibre's own attribution control cannot
 * help: it is an HTML element sitting *over* the canvas, so it is not in a canvas
 * capture, and the export map is built with `attributionControl: false` precisely
 * so there is no half-measure to mistake for one.
 *
 * Painted rather than drawn as a layer because a symbol layer would collide,
 * fade, move with the camera and be subject to the style's own label rules — all
 * of which are properties you want for a place name and none of which you want
 * for a legal notice.
 */

/** Type size at 1×, in CSS pixels. Scaled with the render, like everything else. */
const FONT_PX = 11;
const PADDING_X = 6;
const PADDING_Y = 3;
const MARGIN = 6;

export type Composition = {
  attribution: string;
  /** The render's own ratio, so the credit is the same size on the page at any DPI. */
  pixelRatio: number;
};

/**
 * Draws the credit into the bottom-right corner of the canvas it is given, and
 * returns the same canvas.
 *
 * Mutating rather than copying: the caller has just made this canvas for exactly
 * this purpose, and a second full-size bitmap at 300 DPI is another 35MB of
 * allocation for no benefit.
 */
export function composeExport(
  canvas: HTMLCanvasElement,
  { attribution, pixelRatio }: Composition,
): HTMLCanvasElement {
  const context = canvas.getContext("2d");
  // A canvas we cannot draw on still has the map in it. Losing the credit is not
  // acceptable, but neither is losing the export to an exception on a browser
  // that refused a 2D context — and the caller has already drawn through one to
  // get here, so this cannot realistically fire.
  if (!context) return canvas;

  const scale = Math.max(pixelRatio, 1);
  const font = FONT_PX * scale;

  context.save();
  context.font = `${font}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";

  const width = context.measureText(attribution).width + PADDING_X * 2 * scale;
  const height = font + PADDING_Y * 2 * scale;
  const x = canvas.width - width - MARGIN * scale;
  const y = canvas.height - height - MARGIN * scale;

  /*
   * A plate under the text, not text alone.
   *
   * Sixteen basemap looks means the corner underneath is anything from white
   * paper to near-black, and one colour of text cannot be legible on all of
   * them. A translucent white plate with dark text reads on every one, which is
   * the same trick MapLibre's own control uses.
   */
  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.fillRect(x, y, width, height);

  context.fillStyle = "#1a1a1a";
  context.fillText(attribution, x + PADDING_X * scale, y + height / 2);
  context.restore();

  return canvas;
}
